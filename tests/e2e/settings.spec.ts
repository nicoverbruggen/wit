import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  clearLastProjectState,
  closeSettingsDialog,
  ensureSettingsDialogOpen,
  execFileAsync,
  getEditorTypography,
  launchWithProject,
  openSettingsTab
} from "./helpers";

test.describe("Wit settings dialog", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("settings remain accessible even when no file is open", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-empty-"));
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
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-settings-focus-"));
    await fs.writeFile(path.join(projectPath, "focus.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await ensureSettingsDialogOpen(page);

    const activeElementId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(activeElementId).not.toBe("autosave-interval-input");

    await app.close();
  });

  test("about settings tab shows populated application metadata", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-about-"));
    await fs.writeFile(path.join(projectPath, "about.txt"), "metadata", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "about");

    await expect(page.locator("#settings-panel-about .about-header")).toBeVisible();
    await expect(page.locator("#about-version")).toHaveText(/\d+\.\d+\.\d+/);
    await expect(page.locator("#about-description")).toContainText("Minimalist desktop writing app");
    await expect(page.locator("#about-author")).toHaveText("Nico Verbruggen");
    await expect(page.locator("#about-website")).toHaveAttribute("href", "https://nicoverbruggen.be");

    await app.close();
  });

  test("settings persist across relaunch", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-settings-"));
    const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-settings-remote-"));
    await fs.writeFile(path.join(projectPath, "settings.txt"), "one two", "utf8");
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["init", "--bare", "-q", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    const firstRun = await launchWithProject(projectPath);
    const lineHeightBefore = (await getEditorTypography(firstRun.page)).lineHeight;

    await openSettingsTab(firstRun.page, "writing");
    await firstRun.page.click("#show-word-count-input");
    await firstRun.page.click("#smart-quotes-input");
    await firstRun.page.selectOption("#default-file-extension-select", ".md");
    await openSettingsTab(firstRun.page, "autosave");
    await firstRun.page.fill("#autosave-interval-input", "15");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await firstRun.page.click("#git-snapshots-input");
    await firstRun.page.selectOption("#git-push-remote-select", "origin");
    await openSettingsTab(firstRun.page, "editor");
    await firstRun.page.selectOption("#theme-select", "dark");
    await firstRun.page.selectOption("#paragraph-spacing-select", "loose");
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
    const lineHeightAfter = (await getEditorTypography(firstRun.page)).lineHeight;
    expect(lineHeightAfter).toBeGreaterThan(lineHeightBefore);
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await openSettingsTab(secondRun.page, "writing");
    await expect(secondRun.page.locator("#show-word-count-input")).toBeChecked();
    await expect(secondRun.page.locator("#smart-quotes-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#default-file-extension-select")).toHaveValue(".md");
    await openSettingsTab(secondRun.page, "autosave");
    await expect(secondRun.page.locator("#git-snapshots-input")).toBeChecked();
    await expect(secondRun.page.locator("#git-push-remote-select")).toHaveValue("origin");
    await expect(secondRun.page.locator("#autosave-interval-input")).toHaveValue("15");
    await openSettingsTab(secondRun.page, "editor");
    await expect(secondRun.page.locator("#theme-select")).toHaveValue("dark");
    await expect(secondRun.page.locator("#paragraph-spacing-select")).toHaveValue("loose");
    await expect(secondRun.page.locator("#line-height-value")).toHaveText("1.90");
    await expect(secondRun.page.locator("#editor-width-value")).toHaveText("740px");
    await expect(secondRun.page.locator("#word-count")).toBeVisible();
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
    await fs.rm(remotePath, { recursive: true, force: true });
  });

  test("theme can be switched to dark and resets to light after closing the project", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-theme-"));
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
