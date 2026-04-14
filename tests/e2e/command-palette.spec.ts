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

const MODIFIER = process.platform === "darwin" ? "Meta" : "Control";

test.describe("Wit command palette", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("does not open without an active project", async () => {
    const { app, page } = await launchApp();

    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(page.locator("#command-palette-overlay")).toBeHidden();

    await app.close();
  });

  test("opens, filters, and opens the selected file with Enter", async () => {
    const projectPath = await makeTempDir("wit-e2e-palette-basic-");
    await fs.mkdir(path.join(projectPath, "drafts"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "drafts", "chapter-01.md"), "first", "utf8");
    await fs.writeFile(path.join(projectPath, "drafts", "chapter-02.md"), "second", "utf8");
    await fs.writeFile(path.join(projectPath, "notes.txt"), "notes", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.keyboard.press(`${MODIFIER}+P`);
    const overlay = page.locator("#command-palette-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.locator(".command-palette-input")).toBeFocused();

    await page.keyboard.type("ch02");
    const results = page.locator(".command-palette-result");
    await expect(results.first()).toContainText("chapter-02.md");

    await page.keyboard.press("Enter");
    await expect(overlay).toBeHidden();
    await expect(page.locator("#active-file-label")).toHaveText("drafts/chapter-02.md");

    await app.close();
  });

  test("arrow keys move selection and click opens a file", async () => {
    const projectPath = await makeTempDir("wit-e2e-palette-nav-");
    await fs.writeFile(path.join(projectPath, "alpha.txt"), "a", "utf8");
    await fs.writeFile(path.join(projectPath, "beta.txt"), "b", "utf8");
    await fs.writeFile(path.join(projectPath, "gamma.txt"), "c", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(page.locator("#command-palette-overlay")).toBeVisible();

    const results = page.locator(".command-palette-result");
    await expect(results).toHaveCount(3);
    await expect(results.nth(0)).toHaveClass(/is-selected/);

    await page.keyboard.press("ArrowDown");
    await expect(results.nth(1)).toHaveClass(/is-selected/);
    await page.keyboard.press("ArrowDown");
    await expect(results.nth(2)).toHaveClass(/is-selected/);
    await page.keyboard.press("ArrowUp");
    await expect(results.nth(1)).toHaveClass(/is-selected/);

    await results.nth(0).click();
    await expect(page.locator("#command-palette-overlay")).toBeHidden();
    await expect(page.locator("#active-file-label")).toHaveText("alpha.txt");

    await app.close();
  });

  test("Escape and shortcut toggle close the palette", async () => {
    const projectPath = await makeTempDir("wit-e2e-palette-close-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "x", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    const overlay = page.locator("#command-palette-overlay");

    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();

    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(overlay).toBeVisible();
    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(overlay).toBeHidden();

    await app.close();
  });

  test("handles hundreds of files and filters quickly", async () => {
    const projectPath = await makeTempDir("wit-e2e-palette-scale-");
    const FILE_COUNT = 500;
    for (let index = 0; index < FILE_COUNT; index += 1) {
      const folder = `folder-${String(index % 20).padStart(2, "0")}`;
      await fs.mkdir(path.join(projectPath, folder), { recursive: true });
      await fs.writeFile(
        path.join(projectPath, folder, `file-${String(index).padStart(4, "0")}.md`),
        "x",
        "utf8"
      );
    }
    const uniqueName = "target-needle-unique.md";
    await fs.writeFile(path.join(projectPath, uniqueName), "hit", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.keyboard.press(`${MODIFIER}+P`);
    await expect(page.locator("#command-palette-overlay")).toBeVisible();

    const timings = await page.evaluate(async () => {
      const input = document.querySelector<HTMLInputElement>(".command-palette-input");
      if (!input) throw new Error("palette input missing");
      const start = performance.now();
      input.value = "needle";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return performance.now() - start;
    });
    expect(timings).toBeLessThan(200);

    const results = page.locator(".command-palette-result");
    await expect(results.first()).toContainText(uniqueName);

    await page.keyboard.press("Enter");
    await expect(page.locator("#active-file-label")).toHaveText(uniqueName);

    await app.close();
  });
});
