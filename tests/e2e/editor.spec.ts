import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  afterEachCleanup,
  clearLastProjectState,
  closeSettingsDialog,
  getEditorPlaceholder,
  getEditorSyntaxState,
  getEditorText,
  getEditorTypography,
  launchWithProject,
  makeTempDir,
  openSettingsTab,
  setRangeValueWithoutMovingFocus,
  setSelectValueWithoutMovingFocus
} from "./helpers";

test.describe("Wit editor behavior", () => {
  test.beforeEach(async () => {
    await clearLastProjectState();
  });

  test.afterEach(async () => {
    await afterEachCleanup();
  });

  test.afterAll(async () => {
    await clearLastProjectState();
  });

  test("editor placeholder is hidden when a file is selected", async () => {
    const projectPath = await makeTempDir("wit-e2e-placeholder-");
    await fs.writeFile(path.join(projectPath, "empty.txt"), "", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await expect(page.locator("#active-file-label")).toHaveText("empty.txt");
    await expect.poll(async () => getEditorPlaceholder(page)).toBe("");
    await app.close();
  });

  test("autosave creates snapshot and tracks writing time", async () => {
    const projectPath = await makeTempDir("wit-e2e-auto-");
    await fs.writeFile(path.join(projectPath, "draft.txt"), "Draft", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await openSettingsTab(page, "autosave");
    await page.fill("#autosave-interval-input", "10");
    await page.dispatchEvent("#autosave-interval-input", "change");
    await closeSettingsDialog(page);

    await page.click(".file-button:has-text('draft.txt')");
    await page.click("#editor");
    await page.keyboard.type(" typing for autosave");

    await expect(page.locator("#snapshot-label")).not.toHaveText("✓ --", {
      timeout: 20_000
    });

    const statsRaw = await fs.readFile(path.join(projectPath, ".wit", "stats.json"), "utf8");
    const stats = JSON.parse(statsRaw) as { totalWritingSeconds: number };
    expect(Number.isFinite(stats.totalWritingSeconds)).toBe(true);
    expect(stats.totalWritingSeconds).toBeGreaterThanOrEqual(0);

    const snapshotsDir = path.join(projectPath, ".wit", "snapshots");
    const snapshotEntries = await fs.readdir(snapshotsDir);
    expect(snapshotEntries).toContain("version.json");
    expect(snapshotEntries.some((entry) => entry.endsWith(".json.gz"))).toBe(true);

    await app.close();
  });

  test("footer and editor chrome visibility toggles and the text zoom slider work", async () => {
    const projectPath = await makeTempDir("wit-e2e-ui-");
    await fs.writeFile(path.join(projectPath, "ui.txt"), "one two three", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await openSettingsTab(page, "writing");
    await expect(page.locator("#word-count")).toBeHidden();
    await expect(page.locator("#writing-time")).toBeHidden();
    await expect(page.locator(".editor-header")).toBeHidden();
    await page.click("#show-word-count-input");
    await expect(page.locator("#word-count")).toBeVisible();
    await page.click("#show-writing-time-input");
    await expect(page.locator("#writing-time")).toBeVisible();
    await page.click("#show-current-file-bar-input");
    await expect(page.locator(".editor-header")).toBeVisible();
    await closeSettingsDialog(page);

    const sizesBefore = await page.evaluate(() => {
      const editor = document.querySelector("#editor .cm-content");
      const writingTime = document.querySelector("#writing-time");
      if (!editor || !writingTime) {
        throw new Error("Zoom targets are missing.");
      }

      return {
        editor: Number.parseFloat(window.getComputedStyle(editor).fontSize),
        writingTime: Number.parseFloat(window.getComputedStyle(writingTime).fontSize)
      };
    });

    await openSettingsTab(page, "editor");
    await page.fill("#text-zoom-input", "150");
    await page.dispatchEvent("#text-zoom-input", "input");

    const sizesAfterZoomIn = await page.evaluate(() => {
      const editor = document.querySelector("#editor .cm-content");
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

    await page.fill("#text-zoom-input", "100");
    await page.dispatchEvent("#text-zoom-input", "input");
    const editorSizeAfterReset = await getEditorTypography(page);
    expect(editorSizeAfterReset.fontSize).toBeCloseTo(sizesBefore.editor, 3);
    await closeSettingsDialog(page);

    await app.close();
  });

  test("word count updates live per typed word and stays correct after save", async () => {
    const projectPath = await makeTempDir("wit-e2e-count-");
    await fs.writeFile(path.join(projectPath, "count.txt"), "one two", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('count.txt')");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await page.click("#editor");
    await page.keyboard.type(" three");
    await expect(page.locator("#word-count")).toContainText("Words: 3");

    await page.keyboard.type(" four");
    await expect(page.locator("#word-count")).toContainText("Words: 4");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);
    await expect(page.locator("#status-message")).toContainText("Saved count.txt");
    await expect(page.locator("#word-count")).toContainText("Words: 4");

    await app.close();
  });

  test("Cmd/Ctrl+A selects all editor text for replacement", async () => {
    const projectPath = await makeTempDir("wit-e2e-select-all-");
    await fs.writeFile(path.join(projectPath, "all.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('all.txt')");
    await page.click("#editor");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+A`);
    await page.keyboard.type("replacement text");

    await expect.poll(async () => getEditorText(page)).toBe("replacement text");
    await expect(page.locator("#word-count")).toContainText("Words: 2");

    await app.close();
  });

  test("selection still replaces text after font and zoom changes", async () => {
    const projectPath = await makeTempDir("wit-e2e-selection-typography-");
    await fs.writeFile(path.join(projectPath, "selection.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('selection.txt')");
    await page.click("#editor");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+A`);
    await setRangeValueWithoutMovingFocus(page, "#text-zoom-input", "150");
    await setSelectValueWithoutMovingFocus(page, "#font-select", "iA Writer Duo");
    await page.keyboard.type("replacement text");

    await expect.poll(async () => getEditorText(page)).toBe("replacement text");

    await app.close();
  });

  test("editor does not suppress the native contextmenu event", async () => {
    const projectPath = await makeTempDir("wit-e2e-system-context-");
    await fs.writeFile(path.join(projectPath, "context.txt"), "alpha beta gamma", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('context.txt')");

    const dispatchReturned = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      if (!(editor instanceof HTMLElement)) {
        throw new Error("Editor is missing.");
      }

      const contextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2
      });

      return editor.dispatchEvent(contextEvent);
    });

    expect(dispatchReturned).toBe(true);
    await app.close();
  });

  test("smart quotes toggle applies immediately", async () => {
    const projectPath = await makeTempDir("wit-e2e-smart-");
    await fs.writeFile(path.join(projectPath, "smart.txt"), "", "utf8");

    const { app, page } = await launchWithProject(projectPath);
    await page.click(".file-button:has-text('smart.txt')");
    await page.click("#editor");

    await page.keyboard.type("\"curly\"");
    await page.keyboard.press("Enter");

    await openSettingsTab(page, "writing");
    await page.click("#smart-quotes-input");
    await closeSettingsDialog(page);
    await page.click("#editor");
    await page.keyboard.type("\"straight\"");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+S`);

    const smartFilePath = path.join(projectPath, "smart.txt");
    await expect
      .poll(async () => fs.readFile(smartFilePath, "utf8"))
      .toContain("“curly”");

    const content = await fs.readFile(smartFilePath, "utf8");
    expect(content).toContain("“curly”");
    expect(content).toContain("\"straight\"");

    await app.close();
  });

  test("CodeMirror enables Markdown syntax support for markdown files only", async () => {
    const projectPath = await makeTempDir("wit-e2e-markdown-editor-");
    await fs.writeFile(path.join(projectPath, "notes.md"), "# Heading\n\nThis is **bold** text.\n", "utf8");
    await fs.writeFile(path.join(projectPath, "plain.txt"), "# Heading\n\nThis is **bold** text.\n", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.click(".file-button:has-text('notes.md')");
    await expect(page.locator("#active-file-label")).toHaveText("notes.md");
    const markdownState = await getEditorSyntaxState(page);
    expect(markdownState.syntax).toBe("markdown");
    expect(markdownState.highlightedSpanCount).toBeGreaterThan(0);

    await page.click(".file-button:has-text('plain.txt')");
    await expect(page.locator("#active-file-label")).toHaveText("plain.txt");
    const plainState = await getEditorSyntaxState(page);
    expect(plainState.syntax).toBe("plain");
    expect(plainState.highlightedSpanCount).toBe(0);

    await app.close();
  });

  test("renaming a file between .txt and .md toggles Markdown syntax on the open editor", async () => {
    const projectPath = await makeTempDir("wit-e2e-rename-syntax-");
    await fs.writeFile(path.join(projectPath, "plain.txt"), "# Heading\n\nThis is **bold** text.\n", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.click(".file-button:has-text('plain.txt')");
    await expect(page.locator("#active-file-label")).toHaveText("plain.txt");
    const initialState = await getEditorSyntaxState(page);
    expect(initialState.syntax).toBe("plain");
    expect(initialState.highlightedSpanCount).toBe(0);

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "rename";
    });
    await page.dispatchEvent(".file-button:has-text('plain.txt')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 160,
      clientY: 160
    });
    await expect(page.locator("#rename-entry-dialog")).toBeVisible();
    await page.fill("#rename-entry-input", "plain.md");
    await page.press("#rename-entry-input", "Enter");

    await expect(page.locator("#active-file-label")).toHaveText("plain.md");
    await expect
      .poll(async () => (await getEditorSyntaxState(page)).syntax)
      .toBe("markdown");
    const markdownState = await getEditorSyntaxState(page);
    expect(markdownState.highlightedSpanCount).toBeGreaterThan(0);

    await page.evaluate(() => {
      (window as Window & { __WIT_TEST_TREE_ACTION?: "rename" | "delete" }).__WIT_TEST_TREE_ACTION =
        "rename";
    });
    await page.dispatchEvent(".file-button:has-text('plain.md')", "contextmenu", {
      button: 2,
      bubbles: true,
      clientX: 160,
      clientY: 160
    });
    await expect(page.locator("#rename-entry-dialog")).toBeVisible();
    await page.fill("#rename-entry-input", "plain.txt");
    await page.press("#rename-entry-input", "Enter");

    await expect(page.locator("#active-file-label")).toHaveText("plain.txt");
    await expect
      .poll(async () => (await getEditorSyntaxState(page)).syntax)
      .toBe("plain");
    const plainAgain = await getEditorSyntaxState(page);
    expect(plainAgain.highlightedSpanCount).toBe(0);

    await app.close();
  });

  test("Tab inserts a tab character unless the current markdown line is a list item", async () => {
    const projectPath = await makeTempDir("wit-e2e-tab-behavior-");
    await fs.writeFile(path.join(projectPath, "plain.txt"), "alpha", "utf8");
    await fs.writeFile(path.join(projectPath, "notes.md"), "- item", "utf8");

    const { app, page } = await launchWithProject(projectPath);

    await page.click(".file-button:has-text('plain.txt')");
    await page.click("#editor");
    await page.keyboard.press("End");
    await page.keyboard.press("Tab");
    await expect.poll(async () => getEditorText(page)).toBe("alpha\t");

    await page.click(".file-button:has-text('notes.md')");
    await expect(page.locator("#active-file-label")).toHaveText("notes.md");
    await page.click("#editor");
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    await expect.poll(async () => getEditorText(page)).toBe("  - item");

    await app.close();
  });
});
