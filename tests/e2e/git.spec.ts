import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  afterEachCleanup,
  clearLastProjectState,
  closeSettingsDialog,
  execFileAsync,
  gitCommitCount,
  latestCommitMessage,
  launchWithProject,
  makeTempDir,
  openSettingsTab
} from "./helpers";
import { FEATURES } from "../../src/shared/features";

test.describe("Wit git integration", () => {
  test.skip(!FEATURES.git, "git feature flag disabled");

  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("git snapshots setting is disabled with notice outside git repositories", async () => {
    const projectPath = await makeTempDir("wit-e2e-no-git-");
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
    const projectPath = await makeTempDir("wit-e2e-no-initial-commit-");
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
    const projectPath = await makeTempDir("wit-e2e-refresh-git-");
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
    const projectPath = await makeTempDir("wit-e2e-init-git-");
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
    const projectPath = await makeTempDir("wit-e2e-no-remote-");
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
    const projectPath = await makeTempDir("wit-e2e-with-remote-");
    const remotePath = await makeTempDir("wit-e2e-with-remote-origin-");
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
  });

  test("git snapshot commits run only when Git Snapshot is enabled", async () => {
    const projectPath = await makeTempDir("wit-e2e-git-");
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
    await expect(page.locator("#snapshot-label")).not.toContainText("--", { timeout: 20_000 });

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
    const projectPath = await makeTempDir("wit-e2e-snapshot-reopen-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "Draft", "utf8");

    const firstRun = await launchWithProject(projectPath);
    await openSettingsTab(firstRun.page, "autosave");
    await firstRun.page.fill("#autosave-interval-input", "10");
    await firstRun.page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(firstRun.page);

    await firstRun.page.click(".file-button:has-text('draft.txt')");
    await firstRun.page.click("#editor");
    await firstRun.page.keyboard.type(" typing for snapshot");
    await expect(firstRun.page.locator("#snapshot-label")).not.toContainText("--", {
      timeout: 20_000
    });
    const firstSnapshotLabel = await firstRun.page.locator("#snapshot-label").textContent();
    await firstRun.app.close();

    const secondRun = await launchWithProject(projectPath);
    await expect(secondRun.page.locator("#snapshot-label")).not.toContainText("--");
    await expect(secondRun.page.locator("#snapshot-label")).toHaveText(firstSnapshotLabel ?? "");
    await secondRun.app.close();
  });
});
