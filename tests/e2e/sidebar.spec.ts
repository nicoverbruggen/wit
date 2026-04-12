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

test.describe("Wit sidebar and shell chrome", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("sidebar stays hidden and the sidebar toggle stays hidden before a project is selected", async () => {
    const { app, page } = await launchApp();

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
    const projectPath = await makeTempDir("wit-e2e-toggle-sidebar-");
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
    const projectPath = await makeTempDir("wit-e2e-resize-sidebar-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const resizer = page.locator("#sidebar-resizer");

    const readSidebarWidth = async () =>
      page.locator(".sidebar").evaluate((element) => Math.round(element.getBoundingClientRect().width));

    const widthBefore = await readSidebarWidth();
    const box = await resizer.boundingBox();
    if (!box) {
      throw new Error("Sidebar resize handle is missing.");
    }

    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 100, centerY, { steps: 8 });
    await page.mouse.up();

    const widthExpanded = await readSidebarWidth();
    expect(widthExpanded).toBeGreaterThan(widthBefore);

    await page.mouse.move(centerX + 100, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY, { steps: 8 });
    await page.mouse.up();

    const widthAfter = await readSidebarWidth();
    expect(widthAfter).toBeLessThan(widthExpanded);

    await app.close();
  });

  test("sidebar toggle button reflects its pressed state with a distinct visual style", async () => {
    const projectPath = await makeTempDir("wit-e2e-sidebar-icon-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "hello world", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const toggleButton = page.locator("#toggle-sidebar-btn");

    const readStyles = async () =>
      toggleButton.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor
        };
      });

    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    const activeStylesBefore = await readStyles();

    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(200, 200);

    const inactiveStyles = await readStyles();
    expect(inactiveStyles.backgroundColor).not.toBe(activeStylesBefore.backgroundColor);
    expect(inactiveStyles.borderColor).not.toBe(activeStylesBefore.borderColor);

    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    const activeStylesAfter = await readStyles();
    expect(activeStylesAfter.backgroundColor).toBe(activeStylesBefore.backgroundColor);
    expect(activeStylesAfter.borderColor).toBe(activeStylesBefore.borderColor);

    await app.close();
  });

  test("fullscreen can be toggled from the top-left toolbar button", async () => {
    const projectPath = await makeTempDir("wit-e2e-fullscreen-");
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

  test("sidebar fades while typing and restores when editor loses focus", async () => {
    const projectPath = await makeTempDir("wit-e2e-sidebar-");
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
