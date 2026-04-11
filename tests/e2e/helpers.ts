import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { expect } from "@playwright/test";
import { _electron as electron, ElectronApplication, Page } from "playwright";

export const repoRoot = path.resolve(__dirname, "../..");
export const execFileAsync = promisify(execFile);
const LAST_PROJECT_STATE_FILE_NAME = "last-project.json";
let cachedUserDataPath: string | null = null;

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body.dataset.appReady === "true");
}

export async function launchWithProject(projectPath: string): Promise<{ app: ElectronApplication; page: Page }> {
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
