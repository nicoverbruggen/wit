import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  afterEachCleanup,
  clearLastProjectState,
  launchWithProject,
  makeTempDir
} from "./helpers";

const MODIFIER = process.platform === "darwin" ? "Meta" : "Control";

test.describe("Wit editor search panel", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("Ctrl/Cmd+F opens the search panel and highlights matches", async () => {
    const projectPath = await makeTempDir("wit-e2e-search-open-");
    await fs.writeFile(
      path.join(projectPath, "draft.txt"),
      "alpha beta gamma\nbeta delta\nomega beta",
      "utf8"
    );

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("#active-file-label")).toHaveText("draft.txt");

    await page.locator("#editor .cm-content").click();
    await page.keyboard.press(`${MODIFIER}+F`);

    const panel = page.locator("#editor .cm-panel.cm-search");
    await expect(panel).toBeVisible();

    const searchField = panel.locator("input.cm-textfield").first();
    await expect(searchField).toBeFocused();
    await searchField.fill("beta");
    await page.keyboard.press("Enter");

    await expect(page.locator("#editor .cm-searchMatch")).not.toHaveCount(0);

    await app.close();
  });

  test("Escape closes the search panel", async () => {
    const projectPath = await makeTempDir("wit-e2e-search-close-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "alpha beta", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.locator("#editor .cm-content").click();
    await page.keyboard.press(`${MODIFIER}+F`);
    const panel = page.locator("#editor .cm-panel.cm-search");
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);

    await app.close();
  });

  test("replace-all updates the document", async () => {
    const projectPath = await makeTempDir("wit-e2e-search-replace-");
    await fs.writeFile(
      path.join(projectPath, "draft.txt"),
      "cat sat\nanother cat\nno dogs",
      "utf8"
    );

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("#active-file-label")).toHaveText("draft.txt");

    await page.locator("#editor .cm-content").click();
    await page.keyboard.press(`${MODIFIER}+F`);

    const panel = page.locator("#editor .cm-panel.cm-search");
    await expect(panel).toBeVisible();

    const fields = panel.locator("input.cm-textfield");
    await expect(fields).toHaveCount(2);
    await fields.nth(0).fill("cat");
    await fields.nth(1).fill("dog");

    await panel.getByRole("button", { name: /replace all/i }).click();

    const content = await page.locator("#editor .cm-content").textContent();
    expect(content).toContain("dog sat");
    expect(content).toContain("another dog");
    expect(content).not.toContain("cat");

    await app.close();
  });
});
