import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  acceptNextConfirmDialog,
  afterEachCleanup,
  clearLastProjectState,
  getPageErrors,
  launchWithProject,
  makeTempDir
} from "./helpers";

test.describe("Wit tree entry actions", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("renders folders in sidebar and shows full relative path on hover", async () => {
    const projectPath = await makeTempDir("wit-e2e-folders-");
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

  test("creates a new folder from the sidebar action", async () => {
    const projectPath = await makeTempDir("wit-e2e-folder-create-");
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
    const projectPath = await makeTempDir("wit-e2e-duplicates-");
    await fs.mkdir(path.join(projectPath, "notes"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "chapter-01.txt"), "start", "utf8");
    const { app, page } = await launchWithProject(projectPath);

    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-01.txt");
    await expect(page.locator("#new-file-error")).toContainText("already exists");
    await expect(page.locator("#new-file-create-btn")).toBeDisabled();
    await page.fill("#new-file-path-input", "chapter-02.txt");
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
    const projectPath = await makeTempDir("wit-e2e-enter-submit-");
    const { app, page } = await launchWithProject(projectPath);

    await page.click("#new-folder-btn");
    await expect(page.locator("#new-folder-dialog")).toBeVisible();
    await page.fill("#new-folder-path-input", "drafts");
    await page.press("#new-folder-path-input", "Enter");
    await expect(page.locator(".folder-button", { hasText: "drafts" })).toBeVisible();

    await page.click(".folder-button:has-text('drafts')");
    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-01.txt");
    await page.press("#new-file-path-input", "Enter");

    await expect(page.locator("#active-file-label")).toHaveText("drafts/chapter-01.txt");
    await expect(fs.stat(path.join(projectPath, "drafts", "chapter-01.txt"))).resolves.toBeTruthy();
    await app.close();
  });

  test("deletes files and folders from right-click context menu", async () => {
    const projectPath = await makeTempDir("wit-e2e-delete-");
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
    const projectPath = await makeTempDir("wit-e2e-context-create-");
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
    await page.fill("#new-file-path-input", "root-note.txt");
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
    await page.fill("#new-file-path-input", "scene.txt");
    await page.click("#new-file-create-btn");
    await expect(page.locator("#active-file-label")).toHaveText("drafts/scene.txt");
    await expect(fs.stat(path.join(projectPath, "drafts", "scene.txt"))).resolves.toBeTruthy();

    await app.close();
  });

  test("renames files and folders from right-click context menu", async () => {
    const projectPath = await makeTempDir("wit-e2e-rename-");
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
    const projectPath = await makeTempDir("wit-e2e-dnd-");
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
    const projectPath = await makeTempDir("wit-e2e-folder-target-");
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });

    const { app, page } = await launchWithProject(projectPath);

    await page.click(".folder-button:has-text('drafts')");
    await page.click("#new-file-btn");
    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "scene.txt");
    await page.click("#new-file-create-btn");

    await expect(page.locator(".file-button", { hasText: "scene.txt" })).toBeVisible();
    await expect(page.locator("#active-file-label")).toHaveText("drafts/scene.txt");

    const content = await fs.readFile(path.join(projectPath, "drafts", "scene.txt"), "utf8");
    expect(content).toBe("");
    await app.close();
  });

  test("creates a new file from the in-app dialog", async () => {
    const projectPath = await makeTempDir("wit-e2e-");
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const { app, page } = await launchWithProject(projectPath);

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
    expect(getPageErrors(page)).toEqual([]);

    await app.close();
  });

  test("adds the default Markdown extension when a new file is created without one", async () => {
    const projectPath = await makeTempDir("wit-e2e-default-markdown-ext-");
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.click("#new-file-btn");
    await page.fill("#new-file-path-input", "chapter-three");
    await page.click("#new-file-create-btn");

    await expect(page.locator("#active-file-label")).toHaveText("chapter-three.md");
    await expect(page.locator(".file-button", { hasText: "chapter-three.md" })).toBeVisible();
    await expect(fs.stat(path.join(projectPath, "chapter-three.md"))).resolves.toBeTruthy();

    await app.close();
  });

  test("uses the configured default extension for new files without one", async () => {
    const projectPath = await makeTempDir("wit-e2e-default-ext-");
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const { app, page } = await launchWithProject(projectPath);

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
