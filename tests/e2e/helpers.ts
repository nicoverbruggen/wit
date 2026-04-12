import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect } from "@playwright/test";
import { _electron as electron, ElectronApplication, Page } from "playwright";

export const repoRoot = path.resolve(__dirname, "../..");
export const execFileAsync = promisify(execFile);
const LAST_PROJECT_STATE_FILE_NAME = "last-project.json";
let cachedUserDataPath: string | null = null;

const trackedTempDirs = new Set<string>();
const pageErrorsByPage = new WeakMap<Page, string[]>();
const trackedPages = new Set<Page>();

export async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  trackedTempDirs.add(dir);
  return dir;
}

export async function cleanupTempDirs(): Promise<void> {
  const dirs = Array.from(trackedTempDirs);
  trackedTempDirs.clear();
  await Promise.all(
    dirs.map((dir) => fs.rm(dir, { recursive: true, force: true }).catch(() => undefined))
  );
}

function trackPage(page: Page): void {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  pageErrorsByPage.set(page, errors);
  trackedPages.add(page);
}

export function getPageErrors(page: Page): string[] {
  return pageErrorsByPage.get(page) ?? [];
}

export function assertNoPageErrors(): void {
  const errors: string[] = [];
  for (const page of trackedPages) {
    const pageErrors = pageErrorsByPage.get(page) ?? [];
    if (pageErrors.length > 0) {
      errors.push(...pageErrors);
    }
  }
  trackedPages.clear();
  if (errors.length > 0) {
    throw new Error(`Page errors detected during test:\n${errors.join("\n")}`);
  }
}

export async function afterEachCleanup(): Promise<void> {
  try {
    assertNoPageErrors();
  } finally {
    await cleanupTempDirs();
  }
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body.dataset.appReady === "true");
}

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [repoRoot],
    cwd: repoRoot
  });

  const page = await app.firstWindow();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  trackPage(page);
  await waitForAppReady(page);

  return { app, page };
}

export async function launchWithProject(projectPath: string): Promise<{ app: ElectronApplication; page: Page }> {
  const { app, page } = await launchApp();

  await page.evaluate(async (targetPath) => {
    await window.witApi.openProjectPath(targetPath);
  }, projectPath);

  await page.reload();
  trackPage(page);
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

export async function clearLastProjectState(): Promise<void> {
  const userDataPath = await resolveUserDataPath();
  await fs.rm(path.join(userDataPath, LAST_PROJECT_STATE_FILE_NAME), { force: true });
}

export async function ensureSettingsDialogOpen(page: Page): Promise<void> {
  const dialog = page.locator("#settings-dialog");
  if (await dialog.isVisible()) {
    return;
  }

  await page.click("#settings-toggle-btn");
  await expect(dialog).toBeVisible();
}

export async function closeSettingsDialog(page: Page): Promise<void> {
  const dialog = page.locator("#settings-dialog");
  if (!(await dialog.isVisible())) {
    return;
  }

  await page.click("#settings-close-btn");
  await expect(dialog).toBeHidden();
}

export async function openSettingsTab(page: Page, tab: "writing" | "editor" | "autosave" | "about"): Promise<void> {
  await ensureSettingsDialogOpen(page);
  await page.click(`#settings-tab-${tab}`);
  await expect(page.locator(`#settings-panel-${tab}`)).toBeVisible();
}

export function acceptNextConfirmDialog(page: Page): void {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export async function gitCommitCount(projectPath: string): Promise<number> {
  const result = await execFileAsync("git", ["-C", projectPath, "rev-list", "--count", "HEAD"]);
  return Number.parseInt(result.stdout.trim(), 10);
}

export async function latestCommitMessage(projectPath: string): Promise<string> {
  const result = await execFileAsync("git", ["-C", projectPath, "log", "-1", "--pretty=%s"]);
  return result.stdout.trim();
}

export async function getEditorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const content = document.querySelector("#editor .cm-content");
    return content?.textContent ?? "";
  });
}

export async function getEditorPlaceholder(page: Page): Promise<string> {
  return page.evaluate(() => {
    const placeholder = document.querySelector("#editor .cm-placeholder");
    return placeholder?.textContent ?? "";
  });
}

export async function getEditorSyntaxState(page: Page): Promise<{ syntax: string; highlightedSpanCount: number }> {
  return page.evaluate(() => {
    const editor = document.querySelector("#editor");
    if (!(editor instanceof HTMLDivElement)) {
      throw new Error("Editor host is missing.");
    }

    return {
      syntax: editor.dataset.syntax ?? "",
      highlightedSpanCount: editor.querySelectorAll(".cm-line span[class]").length
    };
  });
}

export async function getEditorTypography(page: Page): Promise<{ fontSize: number; lineHeight: number }> {
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

export async function setSelectValueWithoutMovingFocus(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(
    ({ selector: targetSelector, value: targetValue }) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLSelectElement)) {
        throw new Error(`Select ${targetSelector} is missing.`);
      }

      element.value = targetValue;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value }
  );
}

export async function setRangeValueWithoutMovingFocus(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(
    ({ selector: targetSelector, value: targetValue }) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Range input ${targetSelector} is missing.`);
      }

      element.value = targetValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { selector, value }
  );
}
