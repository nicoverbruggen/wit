import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  afterEachCleanup,
  clearLastProjectState,
  launchApp,
  launchWithProject,
  makeTempDir
} from "./helpers";

test.describe("Wit project lifecycle", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("opens a project and renders file list + word count", async () => {
    const projectPath = await makeTempDir("wit-e2e-open-");
    await fs.writeFile(path.join(projectPath, "a.txt"), "One two", "utf8");
    await fs.writeFile(path.join(projectPath, "b.md"), "Three four five", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator(".file-button", { hasText: "a.txt" })).toBeVisible();
    await expect(page.locator(".file-button", { hasText: "b.md" })).toBeVisible();
    await expect(page.locator("#open-project-btn")).toBeHidden();
    await expect(page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(page.locator("#project-path")).toHaveAttribute("title", projectPath);
    await expect(page.locator("#word-count")).toContainText("Words: 2 / 5");

    await app.close();
  });

  test("project can be closed from the root project context menu", async () => {
    const projectPath = await makeTempDir("wit-e2e-close-project-");
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
    const projectPath = await makeTempDir("wit-e2e-root-close-file-");
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
    const projectPath = await makeTempDir("wit-e2e-close-current-file-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('draft.txt')");
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
    const projectPath = await makeTempDir("wit-e2e-active-dot-");
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

  test("reopens the last project when the app is relaunched", async () => {
    const projectPath = await makeTempDir("wit-e2e-reopen-");
    await fs.writeFile(path.join(projectPath, "persist.txt"), "One two three", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.app.close();

    const secondRun = await launchApp();
    await expect(secondRun.page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(secondRun.page.locator(".file-button", { hasText: "persist.txt" })).toBeVisible();
    await expect(secondRun.page.locator("#open-project-btn")).toBeHidden();

    await secondRun.app.close();
  });

  test("restores the last opened file and respects an explicitly closed editor on relaunch", async () => {
    const projectPath = await makeTempDir("wit-e2e-last-opened-file-");
    await fs.writeFile(path.join(projectPath, "alpha.txt"), "alpha", "utf8");
    await fs.writeFile(path.join(projectPath, "beta.txt"), "beta", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.page.click(".file-button:has-text('beta.txt')");
    await expect(firstRun.page.locator("#active-file-label")).toHaveText("beta.txt");
    await firstRun.app.close();

    const secondRun = await launchApp();
    await expect(secondRun.page.locator("#active-file-label")).toHaveText("beta.txt");

    await secondRun.page.click(".tree-root-item");
    await secondRun.page.click(".tree-root-item");
    await expect(secondRun.page.locator("#active-file-label")).toHaveText("No file selected");
    await secondRun.app.close();

    const thirdRun = await launchApp();
    await expect(thirdRun.page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(thirdRun.page.locator("#active-file-label")).toHaveText("No file selected");

    await thirdRun.app.close();
  });

  test("does not restore the last project when the folder no longer exists", async () => {
    const projectPath = await makeTempDir("wit-e2e-missing-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "still here", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.app.close();
    await fs.rm(projectPath, { recursive: true, force: true });

    const secondRun = await launchApp();
    await expect(secondRun.page.locator("#sidebar-project-title")).toHaveText("No Project");
    await expect(secondRun.page.locator("#open-project-btn")).toBeEnabled();
    await expect(secondRun.page.locator(".file-button", { hasText: "draft.txt" })).toHaveCount(0);

    await secondRun.app.close();
  });

  test("unsaved edits are persisted on app close", async () => {
    const projectPath = await makeTempDir("wit-e2e-close-");
    await fs.writeFile(path.join(projectPath, "close.txt"), "Start", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('close.txt')");
    await page.click("#editor");
    await page.keyboard.type(" unsaved text");
    await app.close();

    const content = await fs.readFile(path.join(projectPath, "close.txt"), "utf8");
    expect(content).toContain("unsaved text");
  });

  test("exit snapshot creates a snapshot archive on app close", async () => {
    const projectPath = await makeTempDir("wit-e2e-exit-snapshot-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "snapshot content", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('draft.txt')");
    await page.click("#editor");
    await page.keyboard.type(" edited");
    await app.close();

    const snapshotsDir = path.join(projectPath, ".wit", "snapshots");
    const entries = await fs.readdir(snapshotsDir);
    expect(entries.some((entry) => entry.endsWith(".zip"))).toBe(true);
  });

  test("recovers gracefully when config.json contains invalid JSON", async () => {
    const projectPath = await makeTempDir("wit-e2e-corrupt-config-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.app.close();

    await fs.writeFile(path.join(projectPath, ".wit", "config.json"), "{invalid json!!", "utf8");

    const secondRun = await launchWithProject(projectPath);
    await expect(secondRun.page.locator(".file-button", { hasText: "draft.txt" })).toBeVisible();
    await expect(secondRun.page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(secondRun.page.locator("#config-corrupted-banner")).toBeVisible();
    await secondRun.app.close();
  });

  test("falls back to first file when last-opened file was deleted externally", async () => {
    const projectPath = await makeTempDir("wit-e2e-deleted-last-file-");
    await fs.writeFile(path.join(projectPath, "alpha.txt"), "alpha", "utf8");
    await fs.writeFile(path.join(projectPath, "beta.txt"), "beta", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await firstRun.page.click(".file-button:has-text('beta.txt')");
    await expect(firstRun.page.locator("#active-file-label")).toHaveText("beta.txt");
    await firstRun.app.close();

    await fs.rm(path.join(projectPath, "beta.txt"));

    const secondRun = await launchApp();
    await expect(secondRun.page.locator("#sidebar-project-title")).toHaveText(path.basename(projectPath));
    await expect(secondRun.page.locator(".file-button", { hasText: "beta.txt" })).toHaveCount(0);
    await expect(secondRun.page.locator("#active-file-label")).toHaveText("alpha.txt");
    await secondRun.app.close();
  });
});
