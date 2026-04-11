import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { _electron as electron, ElectronApplication, Page } from "playwright";
import { promisify } from "node:util";

const repoRoot = path.resolve(__dirname, "../..");
const execFileAsync = promisify(execFile);
const LAST_PROJECT_STATE_FILE_NAME = "last-project.json";
let cachedUserDataPath: string | null = null;

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body.dataset.appReady === "true");
}

async function launchWithProject(projectPath: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [repoRoot],
    cwd: repoRoot
  });

  const page = await app.firstWindow();
  await waitForAppReady(page);

  await page.evaluate(async (targetPath) => {
    await window.witApi.openProjectPath(targetPath);
  }, projectPath);

  await page.reload();
  await waitForAppReady(page);

  return { app, page };
}

async function resolveUserDataPath(): Promise<string> {
  if (cachedUserDataPath) {
    return cachedUserDataPath;
  }

  const app = await electron.launch({
    args: [repoRoot],
    cwd: repoRoot
  });

  try {
    cachedUserDataPath = await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"));
    return cachedUserDataPath;
  } finally {
    await app.close();
  }
}

async function clearLastProjectState(): Promise<void> {
  const userDataPath = await resolveUserDataPath();
  await fs.rm(path.join(userDataPath, LAST_PROJECT_STATE_FILE_NAME), { force: true });
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

async function openSettingsTab(page: Page, tab: "writing" | "editor" | "autosave" | "about"): Promise<void> {
  await ensureSettingsDialogOpen(page);
  await page.click(`#settings-tab-${tab}`);
  await expect(page.locator(`#settings-panel-${tab}`)).toBeVisible();
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

async function getEditorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const content = document.querySelector("#editor .cm-content");
    return content?.textContent ?? "";
  });
}

async function getEditorPlaceholder(page: Page): Promise<string> {
  return page.evaluate(() => {
    const placeholder = document.querySelector("#editor .cm-placeholder");
    return placeholder?.textContent ?? "";
  });
}

async function getEditorTypography(page: Page): Promise<{ fontSize: number; lineHeight: number }> {
  return page.evaluate(() => {
    const content = document.querySelector("#editor .cm-content");
    if (!content) {
      throw new Error("Editor content is missing.");
    }

    const styles = window.getComputedStyle(content);
    return {
      fontSize: Number.parseFloat(styles.fontSize),
      lineHeight: Number.parseFloat(styles.lineHeight)
    };
  });
}

async function setSelectValueWithoutMovingFocus(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(({ selector: targetSelector, value: targetValue }) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLSelectElement)) {
      throw new Error(`Select ${targetSelector} is missing.`);
    }

    element.value = targetValue;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, value });
}

async function setRangeValueWithoutMovingFocus(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(({ selector: targetSelector, value: targetValue }) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`Range input ${targetSelector} is missing.`);
    }

    element.value = targetValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, { selector, value });
}

test.describe("Wit core app flow", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("sidebar stays hidden and the sidebar toggle stays hidden before a project is selected", async () => {
    const app = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const page = await app.firstWindow();
    await waitForAppReady(page);

    await expect(page.locator("#app-shell")).toHaveClass(/sidebar-hidden/);
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator("#toggle-sidebar-btn")).toBeHidden();
    await expect(page.locator("#open-project-btn")).toBeEnabled();
    await expect(page.locator("#new-file-btn")).toBeHidden();
    await expect(page.locator("#new-folder-btn")).toBeHidden();
    await expect(page.locator("#settings-toggle-btn")).toBeHidden();

    await app.close();
  });

  test("sidebar can be toggled from the top-left toolbar button", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-toggle-sidebar-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const shell = page.locator("#app-shell");
    const toggleButton = page.locator("#toggle-sidebar-btn");

    await expect(shell).not.toHaveClass(/sidebar-hidden/);
    await expect(toggleButton).toHaveAttribute("aria-label", "Hide sidebar");

    await toggleButton.click();
    await expect(shell).toHaveClass(/sidebar-hidden/);
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(toggleButton).toHaveAttribute("aria-label", "Show sidebar");

    await toggleButton.click();
    await expect(shell).not.toHaveClass(/sidebar-hidden/);
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-label", "Hide sidebar");

    await app.close();
  });

  test("sidebar can be resized by dragging the resize handle", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-resize-sidebar-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const resizer = page.locator("#sidebar-resizer");

    const widthBefore = await page.locator(".sidebar").evaluate((element) => {
      return Math.round(element.getBoundingClientRect().width);
    });
    const box = await resizer.boundingBox();
    if (!box) {
      throw new Error("Sidebar resize handle is missing.");
    }

    await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
    await page.mouse.down();
    await page.mouse.move(box.x + 56, box.y + (box.height / 2), { steps: 8 });
    await page.mouse.up();

    const widthAfter = await page.locator(".sidebar").evaluate((element) => {
      return Math.round(element.getBoundingClientRect().width);
    });

    expect(widthAfter).toBeGreaterThanOrEqual(widthBefore);

    await app.close();
  });

  test("sidebar toggle icon switches to the blue active state when the sidebar is visible", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-sidebar-icon-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const toggleButton = page.locator("#toggle-sidebar-btn");

    const activeStylesBefore = await toggleButton.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor
      };
    });
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(activeStylesBefore.backgroundColor).toBe("rgb(234, 241, 255)");
    expect(activeStylesBefore.borderColor).toBe("rgb(184, 208, 255)");

    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(200, 200);

    const inactiveStyles = await toggleButton.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor
      };
    });
    expect(inactiveStyles.backgroundColor).not.toBe(activeStylesBefore.backgroundColor);
    expect(inactiveStyles.borderColor).not.toBe(activeStylesBefore.borderColor);

    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    const activeStylesAfter = await toggleButton.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor
      };
    });
    expect(activeStylesAfter.backgroundColor).toBe("rgb(234, 241, 255)");
    expect(activeStylesAfter.borderColor).toBe("rgb(184, 208, 255)");

    await app.close();
  });

  test("fullscreen can be toggled from the top-left toolbar button", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-fullscreen-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const fullscreenButton = page.locator("#toggle-fullscreen-btn");
    const shell = page.locator("#app-shell");

    await expect(fullscreenButton).toHaveAttribute("aria-label", "Enter fullscreen");
    await fullscreenButton.click();
    await expect(fullscreenButton).toHaveAttribute("aria-label", "Exit fullscreen");
    await expect(shell).toHaveClass(/sidebar-hidden/);
    await fullscreenButton.click();
    await expect(fullscreenButton).toHaveAttribute("aria-label", "Enter fullscreen");
    await expect(shell).not.toHaveClass(/sidebar-hidden/);

    await app.close();
  });

  test("project can be closed from the root project context menu", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-close-project-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);

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
    await expect(page.locator("#open-project-btn")).toBeEnabled();
    await expect(page.locator(".file-button", { hasText: "draft.txt" })).toHaveCount(0);

    await app.close();
  });

  test("clicking the project root twice closes the current file and keeps its tree marker in sync", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-root-close-file-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('draft.txt')");
    await expect(page.locator("#active-file-label")).toHaveText("draft.txt");
    await expect(page.locator(".file-button:has-text('draft.txt') .active-file-marker")).toBeVisible();

    await page.click(".tree-root-item");
    await expect(page.locator("#active-file-label")).toHaveText("draft.txt");
    await expect(page.locator(".file-button:has-text('draft.txt') .active-file-marker")).toBeVisible();

    await page.click(".tree-root-item");
    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(page.locator(".file-button:has-text('draft.txt') .active-file-marker")).toBeHidden();
    await expect(page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));

    await app.close();
  });

  test("current file can be closed from its context menu", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-close-current-file-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("#active-file-label")).toHaveText("draft.txt");

    await page.evaluate(() => {
      (window as typeof window & { __WIT_TEST_TREE_ACTION?: "close-file" }).__WIT_TEST_TREE_ACTION = "close-file";
    });
    await page.dispatchEvent(".file-button:has-text('draft.txt')", "contextmenu", {
      button: 2,
      clientX: 40,
      clientY: 40
    });

    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(page.locator(".file-button:has-text('draft.txt') .active-file-marker")).toBeHidden();

    await app.close();
  });

  test("active file dot reflects whether the open file is dirty", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-active-dot-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const activeMarker = page.locator(".file-button:has-text('draft.txt') .active-file-marker");
    const saveShortcut = process.platform === "darwin" ? "Meta+S" : "Control+S";

    await page.click(".file-button:has-text('draft.txt')");
    await expect(activeMarker).toHaveAttribute("data-dirty", "false");

    await page.click("#editor");
    await page.keyboard.type(" updated");
    await expect(activeMarker).toHaveAttribute("data-dirty", "true");

    await page.keyboard.press(saveShortcut);
    await expect(activeMarker).toHaveAttribute("data-dirty", "false");

    await app.close();
  });

  test("opens a project and renders file list + word count", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-open-"));
    await fs.writeFile(path.join(projectPath, "a.txt"), "One two", "utf8");
    await fs.writeFile(path.join(projectPath, "b.md"), "Three four five", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator(".file-button", { hasText: "a.txt" })).toBeVisible();
    await expect(page.locator(".file-button", { hasText: "b.md" })).toBeVisible();
    await expect(page.locator("#open-project-btn")).toBeHidden();
    await expect(page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(page.locator("#project-path")).toHaveAttribute("title", projectPath);
    await expect(page.locator("#word-count")).toContainText("Words: 5");

    await app.close();
  });

  test("reopens the last project when the app is relaunched", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-reopen-"));
    await fs.writeFile(path.join(projectPath, "persist.txt"), "One two three", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.app.close();

    const secondRun = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const secondPage = await secondRun.firstWindow();
    await waitForAppReady(secondPage);
    await expect(secondPage.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(secondPage.locator(".file-button", { hasText: "persist.txt" })).toBeVisible();
    await expect(secondPage.locator("#open-project-btn")).toBeHidden();

    await secondRun.close();
  });

  test("restores the last opened file and respects an explicitly closed editor on relaunch", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-last-opened-file-"));
    await fs.writeFile(path.join(projectPath, "alpha.txt"), "alpha", "utf8");
    await fs.writeFile(path.join(projectPath, "beta.txt"), "beta", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.page.click(".file-button:has-text('beta.txt')");
    await expect(firstRun.page.locator("#active-file-label")).toHaveText("beta.txt");
    await firstRun.app.close();

    const secondRun = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const secondPage = await secondRun.firstWindow();
    await waitForAppReady(secondPage);
    await expect(secondPage.locator("#active-file-label")).toHaveText("beta.txt");

    await secondPage.click(".tree-root-item");
    await secondPage.click(".tree-root-item");
    await expect(secondPage.locator("#active-file-label")).toHaveText("No file selected");
    await secondRun.close();

    const thirdRun = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const thirdPage = await thirdRun.firstWindow();
    await waitForAppReady(thirdPage);
    await expect(thirdPage.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(thirdPage.locator("#active-file-label")).toHaveText("No file selected");

    await thirdRun.close();
  });

  test("does not restore the last project when the folder no longer exists", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-missing-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "still here", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.app.close();
    await fs.rm(projectPath, { recursive: true, force: true });

    const secondRun = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const secondPage = await secondRun.firstWindow();
    await waitForAppReady(secondPage);
    await expect(secondPage.locator("#sidebar-project-title")).toHaveText("No Project");
    await expect(secondPage.locator("#open-project-btn")).toBeEnabled();
    await expect(secondPage.locator(".file-button", { hasText: "draft.txt" })).toHaveCount(0);

    await secondRun.close();
  });

  test("editor placeholder is hidden when a file is selected", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-placeholder-"));
    await fs.writeFile(path.join(projectPath, "empty.txt"), "", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("#active-file-label")).toHaveText("empty.txt");
    await expect.poll(async () => getEditorPlaceholder(page)).toBe("");
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

    await expect(page.locator("#open-project-btn")).toBeHidden();
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

  test("pressing Enter submits new file and new folder dialogs", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-enter-submit-"));
    const { app, page } = await launchWithProject(projectPath);

    await page.click("#new-folder-btn");
    await expect(page.locator("#new-folder-dialog")).toBeVisible();
    await page.fill("#new-folder-path-input", "drafts");
    await page.press("#new-folder-path-input", "Enter");
    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();

    await page.click(".folder-button:has-text('drafts')");
    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-01");
    await page.press("#new-file-path-input", "Enter");

    await expect(page.locator("#active-file-label")).toHaveText("drafts/chapter-01.txt");
    await expect(fs.stat(path.join(projectPath, "drafts", "chapter-01.txt"))).resolves.toBeTruthy();
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
    await expect.poll(async () => getEditorText(page)).toBe("");
    await page.click("#editor");
    await page.keyboard.type('"hello" and \'world\'');

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);
    await expect(page.locator("#status-message")).toContainText("Saved chapter-02.txt");

    const content = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(content).toContain("“hello” and ‘world’");

    await openSettingsTab(page, "writing");
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

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "delete";
    });
    acceptNextConfirmDialog(page);
    await page.dispatchEvent(".file-button:has-text('scene.txt')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 120,
      clientY: 120
    });

    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeHidden();
    await expect(page.locator("#active-file-label")).toHaveText("No file selected");
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt")).catch(() => null)).resolves.toBeNull();

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "delete";
    });
    acceptNextConfirmDialog(page);
    await page.dispatchEvent(".folder-button:has-text('drafts')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 140,
      clientY: 140
    });

    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeHidden();
    await expect(fs.stat(path.join(projectPath, "drafts")).catch(() => null)).resolves.toBeNull();
    await expect(fs.stat(path.join(projectPath, "keep.txt"))).resolves.toBeTruthy();
    await app.close();
  });

  test("creates files and folders from project and folder context menus", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-context-create-"));
    const { app, page } = await launchWithProject(projectPath);

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "new-file" | "new-folder" }).__WIT_TEST_TREE_ACTION =
        "new-folder";
    });
    await page.dispatchEvent(".tree-root-item", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 80,
      clientY: 80
    });
    await expect(page.locator("#new-folder-dialog")).toBeVisible();
    await page.fill("#new-folder-path-input", "drafts");
    await page.click("#new-folder-create-btn");
    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "new-file" | "new-folder" }).__WIT_TEST_TREE_ACTION =
        "new-file";
    });
    await page.dispatchEvent(".tree-root-item", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 82,
      clientY: 82
    });
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "root-note");
    await page.click("#new-file-create-btn");
    await expect(page.locator("#active-file-label")).toHaveText("root-note.txt");
    await expect(fs.stat(path.join(projectPath, "root-note.txt"))).resolves.toBeTruthy();

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "new-file" | "new-folder" }).__WIT_TEST_TREE_ACTION =
        "new-file";
    });
    await page.dispatchEvent(".folder-button:has-text('drafts')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 110,
      clientY: 110
    });
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "scene");
    await page.click("#new-file-create-btn");
    await expect(page.locator("#active-file-label")).toHaveText("drafts/scene.txt");
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt"))).resolves.toBeTruthy();

    await app.close();
  });

  test("renames files and folders from right-click context menu", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-rename-"));
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "drafts", "scene.txt"), "hello", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "rename";
    });
    await page.dispatchEvent(".folder-button:has-text('drafts')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 130,
      clientY: 130
    });
    await expect(page.locator("#rename-entry-dialog")).toBeVisible();
    await page.fill("#rename-entry-input", "chapters");
    await page.press("#rename-entry-input", "Enter");

    await expect(page.locator(".folder-button", { hasText: "chapters" })).toBeVisible();
    await expect(fs.stat(path.join(projectPath, "chapters"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(projectPath, "drafts")).catch(() => null)).resolves.toBeNull();

    await page.click(".file-button:has-text('scene.txt')");
    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "rename";
    });
    await page.dispatchEvent(".file-button:has-text('scene.txt')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 160,
      clientY: 160
    });
    await expect(page.locator("#rename-entry-dialog")).toBeVisible();
    await page.fill("#rename-entry-input", "opening");
    await page.press("#rename-entry-input", "Enter");

    await expect(page.locator("#active-file-label")).toHaveText("chapters/opening.txt");
    await expect(page.locator(".file-button", { hasText: "opening.txt" })).toBeVisible();
    await expect(fs.stat(path.join(projectPath, "chapters", "opening.txt"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(projectPath, "chapters", "scene.txt")).catch(() => null)).resolves.toBeNull();
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

    await openSettingsTab(page, "autosave");
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
    expect(Number.isFinite(stats.totalWritingSeconds)).toBe(true);
    expect(stats.totalWritingSeconds).toBeGreaterThanOrEqual(0);

    const snapshotsDir = path.join(projectPath, ".wit", "snapshots");
    const snapshotEntries = await fs.readdir(snapshotsDir);
    expect(snapshotEntries).toContain("version.json");
    expect(snapshotEntries.some((entry) => entry.endsWith(".json.gz"))).toBe(true);

    await app.close();
  });

  test("footer and editor chrome visibility toggles and zoom dropdown control work", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-ui-"));
    await fs.writeFile(path.join(projectPath, "ui.txt"), "one two three", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await openSettingsTab(page, "writing");
    await expect(page.locator("#word-count")).toBeHidden();
    await expect(page.locator("#writing-time")).toBeHidden();
    await expect(page.locator(".editor-header")).toBeHidden();
    await page.click("#show-word-count-input");
    await expect(page.locator("#word-count")).toBeVisible();
    await page.click("#show-writing-time-input");
    await expect(page.locator("#writing-time")).toBeVisible();
    await page.click("#show-current-file-bar-input");
    await expect(page.locator(".editor-header")).toBeVisible();
    await closeSettingsDialog(page);

    const sizesBefore = await page.evaluate(() => {
      const editor = document.querySelector("#editor .cm-content");
      const writingTime = document.querySelector("#writing-time");
      if (!editor || !writingTime) {
        throw new Error("Zoom targets are missing.");
      }

      return {
        editor: Number.parseFloat(window.getComputedStyle(editor).fontSize),
        writingTime: Number.parseFloat(window.getComputedStyle(writingTime).fontSize)
      };
    });

    await openSettingsTab(page, "editor");
    await page.fill("#text-zoom-input", "150");
    await page.dispatchEvent("#text-zoom-input", "input");

    const sizesAfterZoomIn = await page.evaluate(() => {
      const editor = document.querySelector("#editor .cm-content");
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

    await page.fill("#text-zoom-input", "100");
    await page.dispatchEvent("#text-zoom-input", "input");
    const editorSizeAfterReset = await getEditorTypography(page);
    expect(editorSizeAfterReset.fontSize).toBeCloseTo(sizesBefore.editor, 3);
    await closeSettingsDialog(page);

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

    await expect.poll(async () => getEditorText(page)).toBe("replacement text");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await app.close();
  });

  test("selection still replaces text after font and zoom changes", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-selection-typography-"));
    await fs.writeFile(path.join(projectPath, "selection.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('selection.txt')");
    await page.click("#editor");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+A`);
    await setRangeValueWithoutMovingFocus(page, "#text-zoom-input", "150");
    await setSelectValueWithoutMovingFocus(page, "#font-select", "iA Writer Duo");
    await page.keyboard.type("replacement text");

    await expect.poll(async () => getEditorText(page)).toBe("replacement text");

    await app.close();
  });

  test("editor uses default system context menu behavior", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-system-context-"));
    await fs.writeFile(path.join(projectPath, "context.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('context.txt')");

    const dispatchReturned = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      if (!(editor instanceof HTMLElement)) {
        throw new Error("Editor is missing.");
      }

      const contextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2
      });

      return editor.dispatchEvent(contextEvent);
    });

    expect(dispatchReturned).toBe(true);
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

    await openSettingsTab(page, "writing");
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

  test("git snapshots setting is disabled with notice outside git repositories", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-no-git-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "autosave");
    await expect(page.locator("#git-snapshots-input")).toBeDisabled();
    await expect(page.locator("#git-push-remote-select")).toBeDisabled();
    await expect(page.locator("#initialize-git-repo-card")).toBeVisible();
    await expect(page.locator("#initialize-git-repo-btn")).toBeEnabled();
    await expect(page.locator("#git-snapshots-notice")).toBeVisible();
    await expect(page.locator("#git-snapshots-notice")).toContainText("not a Git repository");
    await app.close();
  });

  test("git snapshots stay disabled until a repository has an initial commit", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-no-initial-commit-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");
    await execFileAsync("git", ["init", "-q", projectPath]);

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "autosave");
    await expect(page.locator("#git-snapshots-input")).toBeDisabled();
    await expect(page.locator("#git-push-remote-select")).toBeDisabled();
    await expect(page.locator("#initialize-git-repo-card")).toBeHidden();
    await expect(page.locator("#git-snapshots-notice")).toBeVisible();
    await expect(page.locator("#git-snapshots-notice")).toContainText("does not have an initial commit");
    await app.close();
  });

  test("opening settings rescans git readiness for the active project", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-refresh-git-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    await openSettingsTab(page, "autosave");
    await expect(page.locator("#git-snapshots-input")).toBeEnabled();
    await expect(page.locator("#git-push-remote-select")).toBeEnabled();
    await expect(page.locator("#initialize-git-repo-card")).toBeHidden();
    await expect(page.locator("#git-snapshots-notice")).toBeHidden();
    await app.close();
  });

  test("settings can initialize a git repository with an initial commit", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-init-git-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "autosave");
    await page.click("#initialize-git-repo-btn");

    await expect(page.locator("#git-snapshots-input")).toBeEnabled();
    await expect(page.locator("#git-push-remote-select")).toBeEnabled();
    await expect(page.locator("#initialize-git-repo-card")).toBeHidden();
    await expect(page.locator("#git-snapshots-notice")).toBeHidden();
    expect(await gitCommitCount(projectPath)).toBe(1);
    await app.close();
  });

  test("git push remote defaults to don't push and stays available when no remotes are configured", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-no-remote-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "autosave");
    await expect(page.locator("#git-snapshots-input")).toBeEnabled();
    await expect(page.locator("#git-push-remote-select")).toBeEnabled();
    await expect(page.locator("#git-push-remote-select")).toHaveValue("");
    await expect(page.locator("#git-push-remote-select")).toContainText("Don't push");
    await app.close();
  });

  test("git push remote still defaults to don't push when remotes are configured", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-with-remote-"));
    const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-with-remote-origin-"));
    await fs.writeFile(path.join(projectPath, "plain.txt"), "Start", "utf8");
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);
    await execFileAsync("git", ["init", "--bare", "-q", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);

    const { app, page } = await launchWithProject(projectPath);
    await openSettingsTab(page, "autosave");
    await expect(page.locator("#git-push-remote-select")).toBeEnabled();
    await expect(page.locator("#git-push-remote-select")).toHaveValue("");
    await expect(page.locator("#git-push-remote-select")).toContainText("Don't push");
    await expect(page.locator("#git-push-remote-select")).toContainText("origin");
    await app.close();
    await fs.rm(remotePath, { recursive: true, force: true });
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
    await openSettingsTab(page, "autosave");
    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(page);
    await page.click(".file-button:has-text('git.txt')");

    await page.click("#editor");
    await page.keyboard.type(" first autosave");
    await expect(page.locator("#snapshot-label")).not.toHaveText("✓ --", { timeout: 20_000 });

    const commitsWhenDisabled = await gitCommitCount(projectPath);
    expect(commitsWhenDisabled).toBe(1);

    await openSettingsTab(page, "autosave");
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
    expect(await latestCommitMessage(projectPath)).toContain("automatic snapshot");
    await app.close();
  });

  test("latest snapshot label is restored when reopening a project", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-snapshot-reopen-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "Draft", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await openSettingsTab(firstRun.page, "autosave");
    await firstRun.page.fill("#autosave-interval-input", "10");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(firstRun.page);

    await firstRun.page.click(".file-button:has-text('draft.txt')");
    await firstRun.page.click("#editor");
    await firstRun.page.keyboard.type(" typing for snapshot");
    await expect(firstRun.page.locator("#snapshot-label")).not.toHaveText("✓ --", {
      timeout: 20_000
    });
    const firstSnapshotLabel = await firstRun.page.locator("#snapshot-label").textContent();
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await expect(secondRun.page.locator("#snapshot-label")).not.toHaveText("✓ --");
    await expect(secondRun.page.locator("#snapshot-label")).toHaveText(firstSnapshotLabel ?? "");
    await secondRun.app.close();
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

  test("creates a new file from the in-app dialog", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-"));
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const app = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const page = await app.firstWindow();
    await waitForAppReady(page);

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.evaluate(async (targetPath) => {
      await window.witApi.openProjectPath(targetPath);
    }, projectPath);
    await page.reload();
    await waitForAppReady(page);

    await expect(page.locator("#new-file-btn")).toBeEnabled();
    await page.click("#new-file-btn");

    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await expect(page.locator("#new-file-path-input")).toHaveValue("");
    await expect(page.locator("#new-file-create-btn")).toBeDisabled();
    await page.fill("#new-file-path-input", "chapter-02.txt");
    await expect(page.locator("#new-file-create-btn")).toBeEnabled();
    await page.click("#new-file-create-btn");

    await expect(page.locator(".file-button", { hasText: "chapter-02.txt" })).toBeVisible();
    await expect(page.locator("#active-file-label")).toHaveText("chapter-02.txt");
    await expect(page.locator("#status-message")).toContainText("Created chapter-02.txt");

    const createdContent = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(createdContent).toBe("");
    expect(pageErrors).toEqual([]);

    await app.close();
  });

  test("uses the configured default extension for new files without one", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-default-ext-"));
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const app = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const page = await app.firstWindow();
    await waitForAppReady(page);

    await page.evaluate(async (targetPath) => {
      await window.witApi.openProjectPath(targetPath);
    }, projectPath);
    await page.reload();
    await waitForAppReady(page);

    await page.click("#settings-toggle-btn");
    await page.click("#settings-tab-writing");
    await page.selectOption("#default-file-extension-select", ".wxt");
    await page.click("#settings-close-btn");

    await page.click("#new-file-btn");
    await page.fill("#new-file-path-input", "chapter-03");
    await page.click("#new-file-create-btn");

    await expect(page.locator("#active-file-label")).toHaveText("chapter-03.wxt");
    await expect(fs.stat(path.join(projectPath, "chapter-03.wxt"))).resolves.toBeTruthy();

    await app.close();
  });
});
