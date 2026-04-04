import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { _electron as electron, ElectronApplication, Page } from "playwright";
import { promisify } from "node:util";

const repoRoot = path.resolve(__dirname, "../..");
const execFileAsync = promisify(execFile);

async function launchWithProject(projectPath: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [repoRoot],
    cwd: repoRoot
  });

  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  await page.evaluate(async (targetPath) => {
    await window.witApi.openProjectPath(targetPath);
  }, projectPath);

  await page.reload();
  await page.waitForLoadState("domcontentloaded");

  return { app, page };
}

async function ensureSettingsDialogOpen(page: Page): Promise<void> {
  const dialog = page.locator("#settings-dialog");
  if (await dialog.isVisible()) {
    return;
  }

  await page.click("#settings-toggle-btn");
  await expect(dialog).toBeVisible();
}

async function closeSettingsDialog(page: Page): Promise<void> {
  const dialog = page.locator("#settings-dialog");
  if (!(await dialog.isVisible())) {
    return;
  }

  await page.click("#settings-close-btn");
  await expect(dialog).toBeHidden();
}

function acceptNextConfirmDialog(page: Page): void {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

async function gitCommitCount(projectPath: string): Promise<number> {
  const result = await execFileAsync("git", ["-C", projectPath, "rev-list", "--count", "HEAD"]);
  return Number.parseInt(result.stdout.trim(), 10);
}

async function latestCommitMessage(projectPath: string): Promise<string> {
  const result = await execFileAsync("git", ["-C", projectPath, "log", "-1", "--pretty=%s"]);
  return result.stdout.trim();
}

test.describe("Wit core app flow", () => {
  test("settings dialog is accessible before a project is selected", async () => {
    const app = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#open-project-btn")).toBeEnabled();
    await expect(page.locator("#new-file-btn")).toBeHidden();
    await expect(page.locator("#new-folder-btn")).toBeHidden();
    await expect(page.locator("#settings-toggle-btn")).toBeEnabled();
    await page.click("#settings-toggle-btn");
    await expect(page.locator("#settings-dialog")).toBeVisible();
    await closeSettingsDialog(page);

    await app.close();
  });

  test("opens a project and renders file list + word count", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-open-"));
    await fs.writeFile(path.join(projectPath, "a.txt"), "One two", "utf8");
    await fs.writeFile(path.join(projectPath, "b.md"), "Three four five", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator(".file-button", { hasText: "a.txt" })).toBeVisible();
    await expect(page.locator(".file-button", { hasText: "b.md" })).toBeVisible();
    await expect(page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(page.locator("#project-path")).toHaveAttribute("title", projectPath);
    await expect(page.locator("#word-count")).toContainText("Words: 5");

    await app.close();
  });

  test("renders folders in sidebar and shows full relative path on hover", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-folders-"));
    await fs.mkdir(path.join(projectPath, "drafts", "chapter-01"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "drafts", "chapter-01", "scene.txt"), "one two", "utf8");
    await fs.writeFile(path.join(projectPath, "root.txt"), "three four", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();
    await expect(page.locator(".folder-button", { hasText: "chapter-01" })).toBeVisible();
    const nestedFile = page.locator(".file-button", { hasText: "scene.txt" });
    await expect(nestedFile).toBeVisible();
    await expect(nestedFile).toHaveAttribute("title", "drafts/chapter-01/scene.txt");

    await app.close();
  });

  test("settings remain accessible even when no file is open", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-empty-"));
    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator("#new-file-btn")).toBeEnabled();
    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(page.locator("#settings-toggle-btn")).toBeEnabled();
    await page.click("#settings-toggle-btn");
    await expect(page.locator("#settings-dialog")).toBeVisible();

    await app.close();
  });

  test("creates a new folder from the sidebar action", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-folder-create-"));
    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator("#new-folder-btn")).toBeEnabled();
    await page.click("#new-folder-btn");
    await expect(page.locator("#new-folder-dialog")).toBeVisible();
    await page.fill("#new-folder-path-input", "drafts/chapter-01");
    await page.click("#new-folder-create-btn");

    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();
    await expect(page.locator(".folder-button", { hasText: "chapter-01" })).toBeVisible();
    await expect(page.locator("#status-message")).toContainText("Created folder drafts/chapter-01");

    const stats = await fs.stat(path.join(projectPath, "drafts", "chapter-01"));
    expect(stats.isDirectory()).toBe(true);
    await app.close();
  });

  test("prevents duplicate file and folder names before create", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-duplicates-"));
    await fs.mkdir(path.join(projectPath, "notes"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "chapter-01.txt"), "start", "utf8");
    const { app, page } = await launchWithProject(projectPath);

    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-01");
    await expect(page.locator("#new-file-error")).toContainText("already exists");
    await expect(page.locator("#new-file-create-btn")).toBeDisabled();
    await page.fill("#new-file-path-input", "chapter-02");
    await expect(page.locator("#new-file-create-btn")).toBeEnabled();
    await page.click("#new-file-cancel-btn");

    await page.click("#new-folder-btn");
    await expect(page.locator("#new-folder-dialog")).toBeVisible();
    await page.fill("#new-folder-path-input", "notes");
    await expect(page.locator("#new-folder-error")).toContainText("already exists");
    await expect(page.locator("#new-folder-create-btn")).toBeDisabled();
    await page.fill("#new-folder-path-input", "ideas");
    await expect(page.locator("#new-folder-create-btn")).toBeEnabled();
    await page.click("#new-folder-cancel-btn");

    await app.close();
  });

  test("creates new file, applies smart quotes, and saves with keyboard shortcut", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-write-"));
    await fs.writeFile(path.join(projectPath, "start.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator("#new-file-btn")).toBeEnabled();
    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-02.txt");
    await page.click("#new-file-create-btn");

    await expect(page.locator("#active-file-label")).toHaveText("chapter-02.txt");
    await expect(page.locator("#editor")).toHaveValue("");
    await page.click("#editor");
    await page.keyboard.type('"hello" and \'world\'');

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);
    await expect(page.locator("#status-message")).toContainText("Saved chapter-02.txt");

    const content = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(content).toContain("“hello” and ‘world’");

    await ensureSettingsDialogOpen(page);
    await page.click("#smart-quotes-input");
    await closeSettingsDialog(page);
    await page.click("#editor");
    await page.keyboard.type('\n"straight"');
    await page.keyboard.press(`${modifier}+S`);

    const updatedContent = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(updatedContent).toContain('"straight"');

    await app.close();
  });

  test("deletes files and folders from right-click context menu", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-delete-"));
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "drafts", "scene.txt"), "hello", "utf8");
    await fs.writeFile(path.join(projectPath, "keep.txt"), "keep", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.dispatchEvent(".file-button:has-text('scene.txt')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 120,
      clientY: 120
    });
    await expect(page.locator("#tree-context-menu")).toBeVisible();
    acceptNextConfirmDialog(page);
    await page.click("#tree-context-delete-btn");

    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeHidden();
    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt")).catch(() => null)).resolves.toBeNull();

    await page.dispatchEvent(".folder-button:has-text('drafts')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 140,
      clientY: 140
    });
    await expect(page.locator("#tree-context-menu")).toBeVisible();
    acceptNextConfirmDialog(page);
    await page.click("#tree-context-delete-btn");

    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeHidden();
    await expect(fs.stat(path.join(projectPath, "drafts")).catch(() => null)).resolves.toBeNull();
    await expect(fs.stat(path.join(projectPath, "keep.txt"))).resolves.toBeTruthy();
    await app.close();
  });

  test("moves files between folder and project root using drag and drop", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-dnd-"));
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "scene.txt"), "hello", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator(".tree-root-item", { hasText: path.basename(projectPath) })).toBeVisible();
    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeVisible();
    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();

    await page.dragAndDrop(".file-button:has-text('scene.txt')", ".folder-button:has-text('drafts')");
    await expect(page.locator("#active-file-label")).toHaveText("drafts/scene.txt");
    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeVisible();
    await expect(page.locator("#status-message")).toContainText("Moved scene.txt to drafts");

    await expect(fs.stat(path.join(projectPath, "scene.txt")).catch(() => null)).resolves.toBeNull();
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt"))).resolves.toBeTruthy();

    await page.dragAndDrop(".file-button:has-text('scene.txt')", ".tree-root-item");
    await expect(page.locator("#active-file-label")).toHaveText("scene.txt");
    await expect(page.locator("#status-message")).toContainText("Moved scene.txt to project root");
    await expect(fs.stat(path.join(projectPath, "scene.txt"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt")).catch(() => null)).resolves.toBeNull();
    await app.close();
  });

  test("creates new file inside selected folder when folder is selected", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-folder-target-"));
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });

    const { app, page } = await launchWithProject(projectPath);

    await page.click(".folder-button:has-text('drafts')");
    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "scene");
    await page.click("#new-file-create-btn");

    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeVisible();
    await expect(page.locator("#active-file-label")).toHaveText("drafts/scene.txt");

    const content = await fs.readFile(path.join(projectPath, "drafts", "scene.txt"), "utf8");
    expect(content).toBe("");
    await app.close();
  });

  test("autosave creates snapshot and tracks writing time", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-auto-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "Draft", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await ensureSettingsDialogOpen(page);
    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(page);

    await page.click(".file-button:has-text('draft.txt')");
    await page.click("#editor");
    await page.keyboard.type(" typing for autosave");

    await expect(page.locator("#snapshot-label")).not.toHaveText("✓ --", {
      timeout: 20_000
    });

    const statsRaw = await fs.readFile(path.join(projectPath, ".wit", "stats.json"), "utf8");
    const stats = JSON.parse(statsRaw) as { totalWritingSeconds: number };
    expect(stats.totalWritingSeconds).toBeGreaterThanOrEqual(10);

    const snapshotsDir = path.join(projectPath, ".wit", "snapshots");
    const snapshotEntries = await fs.readdir(snapshotsDir);
    expect(snapshotEntries.length).toBeGreaterThan(0);

    await app.close();
  });

  test("word count visibility toggle and zoom dropdown control work", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-ui-"));
    await fs.writeFile(path.join(projectPath, "ui.txt"), "one two three", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await ensureSettingsDialogOpen(page);
    await expect(page.locator("#word-count")).toBeVisible();
    await page.click("#show-word-count-input");
    await expect(page.locator("#word-count")).toBeHidden();
    await closeSettingsDialog(page);

    const sizesBefore = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      const writingTime = document.querySelector("#writing-time");
      if (!editor || !writingTime) {
        throw new Error("Zoom targets are missing.");
      }

      return {
        editor: Number.parseFloat(window.getComputedStyle(editor).fontSize),
        writingTime: Number.parseFloat(window.getComputedStyle(writingTime).fontSize)
      };
    });

    await page.selectOption("#text-zoom-select", "150");
    await expect(page.locator("#status-message")).toContainText("Text zoom");

    const sizesAfterZoomIn = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      const writingTime = document.querySelector("#writing-time");
      if (!editor || !writingTime) {
        throw new Error("Zoom targets are missing.");
      }

      return {
        editor: Number.parseFloat(window.getComputedStyle(editor).fontSize),
        writingTime: Number.parseFloat(window.getComputedStyle(writingTime).fontSize)
      };
    });

    expect(sizesAfterZoomIn.editor).toBeGreaterThan(sizesBefore.editor);
    expect(sizesAfterZoomIn.writingTime).toBeCloseTo(sizesBefore.writingTime, 3);

    await page.selectOption("#text-zoom-select", "100");
    const editorSizeAfterReset = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      if (!editor) {
        throw new Error("Editor is missing.");
      }

      return Number.parseFloat(window.getComputedStyle(editor).fontSize);
    });
    expect(editorSizeAfterReset).toBeCloseTo(sizesBefore.editor, 3);

    await app.close();
  });

  test("word count updates live per typed word and stays correct after save", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-count-"));
    await fs.writeFile(path.join(projectPath, "count.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('count.txt')");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await page.click("#editor");
    await page.keyboard.type(" three");
    await expect(page.locator("#word-count")).toContainText("Words: 3");

    await page.keyboard.type(" four");
    await expect(page.locator("#word-count")).toContainText("Words: 4");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);
    await expect(page.locator("#status-message")).toContainText("Saved count.txt");
    await expect(page.locator("#word-count")).toContainText("Words: 4");

    await app.close();
  });

  test("Cmd/Ctrl+A selects all editor text for replacement", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-select-all-"));
    await fs.writeFile(path.join(projectPath, "all.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('all.txt')");
    await page.click("#editor");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+A`);
    await page.keyboard.type("replacement text");

    await expect(page.locator("#editor")).toHaveValue("replacement text");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await app.close();
  });

  test("smart quotes toggle applies immediately", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-smart-"));
    await fs.writeFile(path.join(projectPath, "smart.txt"), "", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('smart.txt')");
    await page.click("#editor");

    await page.keyboard.type("\"curly\"");
    await page.keyboard.press("Enter");

    await ensureSettingsDialogOpen(page);
    await page.click("#smart-quotes-input");
    await closeSettingsDialog(page);
    await page.click("#editor");
    await page.keyboard.type("\"straight\"");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);

    const content = await fs.readFile(path.join(projectPath, "smart.txt"), "utf8");
    expect(content).toContain("“curly”");
    expect(content).toContain("\"straight\"");

    await app.close();
  });

  test("settings persist across relaunch", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-settings-"));
    await fs.writeFile(path.join(projectPath, "settings.txt"), "one two", "utf8");

    const firstRun = await launchWithProject(projectPath);
    const lineHeightBefore = await firstRun.page.evaluate(() => {
      const editor = document.querySelector("#editor");
      if (!editor) {
        throw new Error("Editor is missing.");
      }

      return Number.parseFloat(window.getComputedStyle(editor).lineHeight);
    });

    await ensureSettingsDialogOpen(firstRun.page);
    await firstRun.page.click("#show-word-count-input");
    await firstRun.page.click("#smart-quotes-input");
    await firstRun.page.fill("#autosave-interval-input", "15");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await firstRun.page.click("#git-snapshots-input");
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
    const lineHeightAfter = await firstRun.page.evaluate(() => {
      const editor = document.querySelector("#editor");
      if (!editor) {
        throw new Error("Editor is missing.");
      }

      return Number.parseFloat(window.getComputedStyle(editor).lineHeight);
    });
    expect(lineHeightAfter).toBeGreaterThan(lineHeightBefore);
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await ensureSettingsDialogOpen(secondRun.page);
    await expect(secondRun.page.locator("#show-word-count-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#smart-quotes-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#git-snapshots-input")).toBeChecked();
    await expect(secondRun.page.locator("#autosave-interval-input")).toHaveValue("15");
    await expect(secondRun.page.locator("#line-height-value")).toHaveText("1.90");
    await expect(secondRun.page.locator("#editor-width-value")).toHaveText("740px");
    await expect(secondRun.page.locator("#word-count")).toBeHidden();
    const widthLayout = await secondRun.page.evaluate(() => {
      const editor = document.querySelector("#editor");
      const wrap = document.querySelector(".editor-wrap");
      if (!editor || !wrap) {
        throw new Error("Editor layout nodes are missing.");
      }

      const editorRect = editor.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const editorCenter = editorRect.left + editorRect.width / 2;
      const wrapCenter = wrapRect.left + wrapRect.width / 2;

      return {
        editorWidth: editorRect.width,
        centerDelta: Math.abs(editorCenter - wrapCenter)
      };
    });
    expect(widthLayout.editorWidth).toBeLessThanOrEqual(741);
    expect(widthLayout.editorWidth).toBeGreaterThan(500);
    expect(widthLayout.centerDelta).toBeLessThan(2);
    await secondRun.app.close();
  });

  test("unsaved edits are persisted on app close", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-close-"));
    await fs.writeFile(path.join(projectPath, "close.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('close.txt')");
    await page.click("#editor");
    await page.keyboard.type(" unsaved text");
    await app.close();

    const content = await fs.readFile(path.join(projectPath, "close.txt"), "utf8");
    expect(content).toContain("unsaved text");
  });

  test("git snapshot commits run only when Git Snapshot is enabled", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-git-"));
    await fs.writeFile(path.join(projectPath, ".gitignore"), ".wit/\n", "utf8");
    await fs.writeFile(path.join(projectPath, "git.txt"), "Start", "utf8");

    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    const { app, page } = await launchWithProject(projectPath);
    await ensureSettingsDialogOpen(page);
    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(page);
    await page.click(".file-button:has-text('git.txt')");

    await page.click("#editor");
    await page.keyboard.type(" first autosave");
    await expect(page.locator("#snapshot-label")).not.toHaveText("✓ --", { timeout: 20_000 });

    const commitsWhenDisabled = await gitCommitCount(projectPath);
    expect(commitsWhenDisabled).toBe(1);

    await ensureSettingsDialogOpen(page);
    await page.click("#git-snapshots-input");
    await expect(page.locator("#git-snapshots-input")).toBeChecked();
    await closeSettingsDialog(page);
    await page.click("#editor");
    await page.keyboard.type(" second autosave");

    await expect
      .poll(async () => gitCommitCount(projectPath), { timeout: 20_000 })
      .toBeGreaterThan(commitsWhenDisabled);
    const finalCommitCount = await gitCommitCount(projectPath);
    expect(finalCommitCount).toBeGreaterThan(1);
    expect(await latestCommitMessage(projectPath)).toContain("wit snapshot");
    await app.close();
  });

  test("sidebar fades while typing and restores when editor loses focus", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-sidebar-"));
    await fs.writeFile(path.join(projectPath, "sidebar.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('sidebar.txt')");
    await page.click("#editor");
    await page.keyboard.type(" typing");

    await expect(page.locator("#app-shell")).toHaveClass(/sidebar-faded/);
    await page.click(".file-button:has-text('sidebar.txt')");
    await expect(page.locator("#app-shell")).not.toHaveClass(/sidebar-faded/);
    await app.close();
  });
});
