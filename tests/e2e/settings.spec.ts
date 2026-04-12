import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  afterEachCleanup,
  clearLastProjectState,
  closeSettingsDialog,
  ensureSettingsDialogOpen,
  execFileAsync,
  getEditorTypography,
  launchWithProject,
  makeTempDir,
  openSettingsTab
} from "./helpers";

test.describe("Wit settings dialog", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("settings remain accessible even when no file is open", async () => {
    const projectPath = await makeTempDir("wit-e2e-empty-");
    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator("#open-project-btn")).toBeHidden();
    await expect(page.locator("#new-file-btn")).toBeEnabled();
    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(page.locator("#settings-toggle-btn")).toBeEnabled();
    await page.click("#settings-toggle-btn");
    await expect(page.locator("#settings-dialog")).toBeVisible();

    await app.close();
  });

  test("opening settings does not autofocus the autosave interval input", async () => {
    const projectPath = await makeTempDir("wit-e2e-settings-focus-");
    await fs.writeFile(path.join(projectPath, "focus.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await ensureSettingsDialogOpen(page);

    const activeElementId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(activeElementId).not.toBe("autosave-interval-input");

    await app.close();
  });

  test("about settings tab shows populated application metadata", async () => {
    const projectPath = await makeTempDir("wit-e2e-about-");
    await fs.writeFile(path.join(projectPath, "about.txt"), "metadata", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "about");

    await expect(page.locator("#settings-panel-about .about-header")).toBeVisible();
    await expect(page.locator("#about-version")).toHaveText(/\d+\.\d+\.\d+/);
    await expect(page.locator("#about-description")).toContainText("Minimalist desktop writing app");
    await expect(page.locator("#about-author")).not.toBeEmpty();
    await expect(page.locator("#about-website")).toHaveAttribute("href", /^https?:\/\/.+/);

    await app.close();
  });

  test("writing settings persist across relaunch", async () => {
    const projectPath = await makeTempDir("wit-e2e-settings-writing-");
    await fs.writeFile(path.join(projectPath, "settings.txt"), "one two", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await openSettingsTab(firstRun.page, "writing");
    await firstRun.page.click("#show-word-count-input");
    await firstRun.page.click("#smart-quotes-input");
    await firstRun.page.selectOption("#default-file-extension-select", ".md");
    await closeSettingsDialog(firstRun.page);
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await openSettingsTab(secondRun.page, "writing");
    await expect(secondRun.page.locator("#show-word-count-input")).toBeChecked();
    await expect(secondRun.page.locator("#smart-quotes-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#default-file-extension-select")).toHaveValue(".md");
    await expect(secondRun.page.locator("#word-count")).toBeVisible();
    await secondRun.app.close();
  });

  test("editor typography settings persist across relaunch", async () => {
    const projectPath = await makeTempDir("wit-e2e-settings-editor-");
    await fs.writeFile(path.join(projectPath, "settings.txt"), "one two", "utf8");

    const firstRun = await launchWithProject(projectPath);
    const lineHeightBefore = (await getEditorTypography(firstRun.page)).lineHeight;

    await openSettingsTab(firstRun.page, "editor");
    await firstRun.page.selectOption("#theme-select", "dark");
    await firstRun.page.selectOption("#paragraph-spacing-select", "loose");
    await firstRun.page.selectOption("#cursor-style-select", "system-wide");
    await firstRun.page.evaluate(() => {
      const input = document.querySelector("#line-height-input");
      if (!input) {
        throw new Error("Line-height input is missing.");
      }

      const slider = input as HTMLInputElement;
      slider.value = "1.9";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await firstRun.page.evaluate(() => {
      const input = document.querySelector("#editor-width-input");
      if (!input) {
        throw new Error("Editor-width input is missing.");
      }

      const slider = input as HTMLInputElement;
      slider.value = "740";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(firstRun.page.locator(".editor-wrap")).toHaveClass(/show-width-guides/);
    await closeSettingsDialog(firstRun.page);
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    const lineHeightAfter = (await getEditorTypography(firstRun.page)).lineHeight;
    expect(lineHeightAfter).toBeGreaterThan(lineHeightBefore);
    await firstRun.app.close();
    await clearLastProjectState();

    const secondRun = await launchWithProject(projectPath);
    await openSettingsTab(secondRun.page, "editor");
    await expect(secondRun.page.locator("#theme-select")).toHaveValue("dark");
    await expect(secondRun.page.locator("#paragraph-spacing-select")).toHaveValue("loose");
    await expect(secondRun.page.locator("#cursor-style-select")).toHaveValue("system-wide");
    await expect(secondRun.page.locator("#line-height-value")).toHaveText("1.90");
    await expect(secondRun.page.locator("#editor-width-value")).toHaveText("740px");

    const widthLayout = await secondRun.page.evaluate(() => {
      const editorWrap = document.querySelector(".editor-wrap");
      if (!editorWrap) {
        throw new Error("Editor layout nodes are missing.");
      }

      const editorMaxWidth = window.getComputedStyle(editorWrap).getPropertyValue("--editor-max-width").trim();

      return {
        editorMaxWidth
      };
    });
    expect(widthLayout.editorMaxWidth).toBe("740px");
    await expect(secondRun.page.locator("body")).toHaveAttribute("data-theme", "dark");
    await secondRun.app.close();
  });

  test("autosave and git settings persist across relaunch", async () => {
    const projectPath = await makeTempDir("wit-e2e-settings-autosave-");
    const remotePath = await makeTempDir("wit-e2e-settings-autosave-remote-");
    await fs.writeFile(path.join(projectPath, "settings.txt"), "one two", "utf8");
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["init", "--bare", "-q", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    const firstRun = await launchWithProject(projectPath);
    await openSettingsTab(firstRun.page, "autosave");
    await firstRun.page.fill("#autosave-interval-input", "15");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await firstRun.page.click("#git-snapshots-input");
    await firstRun.page.selectOption("#git-push-remote-select", "origin");
    await closeSettingsDialog(firstRun.page);
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await openSettingsTab(secondRun.page, "autosave");
    await expect(secondRun.page.locator("#autosave-interval-input")).toHaveValue("15");
    await expect(secondRun.page.locator("#git-snapshots-input")).toBeChecked();
    await expect(secondRun.page.locator("#git-push-remote-select")).toHaveValue("origin");
    await secondRun.app.close();
  });

  test("caret style updates the editor cursor width", async () => {
    const projectPath = await makeTempDir("wit-e2e-caret-");
    await fs.writeFile(path.join(projectPath, "caret.txt"), "first line\nsecond line", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.waitForSelector("#editor .cm-cursor");

    const readCursorState = async () => {
      return page.evaluate(() => {
        const editorHost = document.querySelector("#editor") as HTMLElement | null;
        const cursor = document.querySelector("#editor .cm-cursor") as HTMLElement | null;
        if (!editorHost || !cursor) {
          throw new Error("Editor cursor not present.");
        }
        return {
          dataAttr: editorHost.dataset.cursorStyle,
          borderWidth: window.getComputedStyle(cursor).borderLeftWidth
        };
      });
    };

    const witDefault = await readCursorState();
    expect(witDefault.dataAttr).toBe("wit-default");
    expect(witDefault.borderWidth).toBe("3px");

    await openSettingsTab(page, "editor");
    await page.selectOption("#cursor-style-select", "system-default");
    await closeSettingsDialog(page);

    const systemDefault = await readCursorState();
    expect(systemDefault.dataAttr).toBe("system-default");
    expect(systemDefault.borderWidth).toBe("1px");

    await openSettingsTab(page, "editor");
    await page.selectOption("#cursor-style-select", "system-wide");
    await closeSettingsDialog(page);

    const systemWide = await readCursorState();
    expect(systemWide.dataAttr).toBe("system-wide");
    expect(systemWide.borderWidth).toBe("2px");

    await app.close();
  });

  test("theme can be switched to dark and resets to light after closing the project", async () => {
    const projectPath = await makeTempDir("wit-e2e-theme-");
    await fs.writeFile(path.join(projectPath, "theme.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");

    await openSettingsTab(page, "editor");
    await page.selectOption("#theme-select", "dark");
    await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
    await closeSettingsDialog(page);

    await page.evaluate(() => {
      (window as typeof window & { __WIT_TEST_TREE_ACTION?: "close-project" }).__WIT_TEST_TREE_ACTION =
        "close-project";
    });
    await page.dispatchEvent(".tree-root-item", "contextmenu", {
      button: 2,
      clientX: 40,
      clientY: 40
    });

    await expect(page.locator("#sidebar-project-title")).toHaveText("No Project");
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    await app.close();
  });
});
