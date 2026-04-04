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

async function gitCommitCount(projectPath: string): Promise<number> {
  const result = await execFileAsync("git", ["-C", projectPath, "rev-list", "--count", "HEAD"]);
  return Number.parseInt(result.stdout.trim(), 10);
}

async function latestCommitMessage(projectPath: string): Promise<string> {
  const result = await execFileAsync("git", ["-C", projectPath, "log", "-1", "--pretty=%s"]);
  return result.stdout.trim();
}

test.describe("Wit core app flow", () => {
  test("opens a project and renders file list + word count", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-open-"));
    await fs.writeFile(path.join(projectPath, "a.txt"), "One two", "utf8");
    await fs.writeFile(path.join(projectPath, "b.md"), "Three four five", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator(".file-button", { hasText: "a.txt" })).toBeVisible();
    await expect(page.locator(".file-button", { hasText: "b.md" })).toBeVisible();
    await expect(page.locator("#word-count")).toContainText("Words: 5");

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

    await page.click("#smart-quotes-input");
    await page.click("#editor");
    await page.keyboard.type('\n"straight"');
    await page.keyboard.press(`${modifier}+S`);

    const updatedContent = await fs.readFile(path.join(projectPath, "chapter-02.txt"), "utf8");
    expect(updatedContent).toContain('"straight"');

    await app.close();
  });

  test("autosave creates snapshot and tracks writing time", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-auto-"));
    await fs.writeFile(path.join(projectPath, "draft.txt"), "Draft", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");

    await page.click(".file-button:has-text('draft.txt')");
    await page.click("#editor");
    await page.keyboard.type(" typing for autosave");

    await expect(page.locator("#snapshot-label")).not.toHaveText("Snapshot: --", {
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

  test("word count visibility toggle and zoom controls work", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-ui-"));
    await fs.writeFile(path.join(projectPath, "ui.txt"), "one two three", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await expect(page.locator("#word-count")).toBeVisible();
    await page.click("#show-word-count-input");
    await expect(page.locator("#word-count")).toBeHidden();

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

    await page.click("#zoom-in-btn");
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

    await page.click("#zoom-reset-btn");
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

  test("word count updates after editing and manual save", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "wit-e2e-count-"));
    await fs.writeFile(path.join(projectPath, "count.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('count.txt')");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await page.click("#editor");
    await page.keyboard.type(" three four");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);
    await expect(page.locator("#status-message")).toContainText("Saved count.txt");
    await expect(page.locator("#word-count")).toContainText("Words: 4");

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

    await page.click("#smart-quotes-input");
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
    await firstRun.page.click("#show-word-count-input");
    await firstRun.page.click("#smart-quotes-input");
    await firstRun.page.fill("#autosave-interval-input", "15");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await firstRun.page.click("#git-snapshots-input");
    await expect(firstRun.page.locator("#status-message")).toContainText("Settings saved.");
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await expect(secondRun.page.locator("#show-word-count-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#smart-quotes-input")).not.toBeChecked();
    await expect(secondRun.page.locator("#git-snapshots-input")).toBeChecked();
    await expect(secondRun.page.locator("#autosave-interval-input")).toHaveValue("15");
    await expect(secondRun.page.locator("#word-count")).toBeHidden();
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
    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");
    await page.click(".file-button:has-text('git.txt')");

    await page.click("#editor");
    await page.keyboard.type(" first autosave");
    await expect(page.locator("#snapshot-label")).not.toHaveText("Snapshot: --", { timeout: 20_000 });

    const commitsWhenDisabled = await gitCommitCount(projectPath);
    expect(commitsWhenDisabled).toBe(1);

    const previousSnapshotLabel = await page.locator("#snapshot-label").innerText();
    await page.click("#git-snapshots-input");
    await expect(page.locator("#git-snapshots-input")).toBeChecked();
    await page.click("#editor");
    await page.keyboard.type(" second autosave");

    await expect
      .poll(async () => page.locator("#snapshot-label").innerText(), { timeout: 20_000 })
      .not.toBe(previousSnapshotLabel);

    const commitsWhenEnabled = await gitCommitCount(projectPath);
    expect(commitsWhenEnabled).toBeGreaterThan(1);
    expect(await latestCommitMessage(projectPath)).toContain("wit snapshot");
    await app.close();
  });
});
