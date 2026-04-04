import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

const repoRoot = path.resolve(__dirname, "../..");

test.describe("Wit new file flow", () => {
  test("creates a new file from the in-app dialog", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-"));
    await fs.writeFile(path.join(projectPath, "start.txt"), "Opening chapter", "utf8");

    const app = await electron.launch({
      args: [repoRoot],
      cwd: repoRoot
    });

    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.evaluate(async (targetPath) => {
      await window.witApi.openProjectPath(targetPath);
    }, projectPath);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#new-file-btn")).toBeEnabled();
    await page.click("#new-file-btn");

    await expect(page.locator("#new-file-dialog")).toBeVisible();
    await page.fill("#new-file-path-input", "chapter-02.txt");
    await page.click("#new-file-create-btn");

    await expect(page.locator(".file-button", { hasText: "chapter-02.txt" })).toBeVisible();
    await expect(page.locator("#active-file-label")).toHaveText("chapter-02.txt");
    await expect(page.locator("#status-message")).toContainText("Created chapter-02.txt");

    const createdContent = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(createdContent).toBe("");
    expect(pageErrors).toEqual([]);

    await app.close();
  });
});
