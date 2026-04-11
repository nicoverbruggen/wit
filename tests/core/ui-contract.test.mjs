import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("renderer markup contains core writing controls", async () => {
  const html = await fs.readFile(path.join(repoRoot, "src/renderer/index.html"), "utf8");

  const requiredIds = [
    "toggle-sidebar-btn",
    "toggle-fullscreen-btn",
    "sidebar-resizer",
    "settings-tab-writing",
    "settings-tab-editor",
    "settings-tab-autosave",
    "settings-tab-about",
    "settings-panel-writing",
    "settings-panel-editor",
    "settings-panel-autosave",
    "settings-panel-about",
    "open-project-btn",
    "new-file-btn",
    "new-folder-btn",
    "file-list",
    "editor",
    "show-word-count-input",
    "show-writing-time-input",
    "show-current-file-bar-input",
    "smart-quotes-input",
    "default-file-extension-select",
    "git-snapshots-input",
    "git-push-remote-select",
    "initialize-git-repo-card",
    "initialize-git-repo-btn",
    "git-snapshots-notice",
    "autosave-interval-input",
    "line-height-input",
    "line-height-value",
    "paragraph-spacing-select",
    "editor-width-input",
    "editor-width-value",
    "theme-select",
    "about-version",
    "about-description",
    "about-author",
    "about-website",
    "new-file-error",
    "new-folder-error",
    "new-file-cancel-btn",
    "new-folder-cancel-btn",
    "rename-entry-dialog",
    "rename-entry-input",
    "rename-entry-cancel-btn",
    "rename-entry-confirm-btn",
    "text-zoom-input",
    "text-zoom-value",
    "sidebar-project-title",
    "project-path",
    "new-folder-dialog",
    "word-count",
    "writing-time",
    "snapshot-label"
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=\"${id}\"`));
  }
});

test("renderer markup separates writing and editor appearance settings", async () => {
  const html = await fs.readFile(path.join(repoRoot, "src/renderer/index.html"), "utf8");

  assert.match(html, /id="settings-section-writing"/);
  assert.match(html, /id="settings-section-editor"/);
  assert.match(html, /id="settings-section-autosave"/);
  assert.match(html, /id="settings-section-snapshots"/);
  assert.match(html, />Editor Appearance</);
  assert.match(html, />Git</);
});

test("renderer markup gives the about panel a compact metadata grid layout", async () => {
  const html = await fs.readFile(path.join(repoRoot, "src/renderer/index.html"), "utf8");

  assert.match(html, /class="about-header"/);
  assert.match(html, /class="about-version-badge"/);
  assert.match(html, /class="about-details"/);
  assert.match(html, /class="about-detail-row"/);
  assert.match(html, /class="about-description-copy"/);
});

test("renderer markup uses material symbols for toolbar and open-project icons", async () => {
  const html = await fs.readFile(path.join(repoRoot, "src/renderer/index.html"), "utf8");

  assert.match(html, /id="toggle-sidebar-btn"[\s\S]*material-symbol-icon[\s\S]*left_panel_open/);
  assert.match(html, /id="toggle-fullscreen-btn"[\s\S]*material-symbol-icon[\s\S]*fullscreen/);
  assert.match(html, /id="open-project-btn"[\s\S]*material-symbol-icon[\s\S]*folder_open/);
});

test("renderer styles include dedicated writing font configuration", async () => {
  const css = await fs.readFile(path.join(repoRoot, "src/renderer/styles.css"), "utf8");

  assert.match(css, /@font-face\s*\{/);
  assert.match(css, /font-family:\s*"WitWriter"/);
  assert.match(css, /#editor\s*\{[\s\S]*font-family:\s*"WitWriter"/);
});

test("renderer exposes bundled editor font options", async () => {
  const css = await fs.readFile(path.join(repoRoot, "src/renderer/styles.css"), "utf8");
  const rendererSource = await fs.readFile(path.join(repoRoot, "src/renderer/renderer.ts"), "utf8");

  for (const fontName of ["Sourcerer", "Readerly", "iA Writer Mono", "iA Writer Duo", "iA Writer Quattro"]) {
    assert.match(css, new RegExp(`font-family:\\s*"${fontName.replaceAll(" ", "\\s+")}"`));
    assert.match(rendererSource, new RegExp(`"${fontName.replaceAll(" ", "\\s+")}"`));
  }
});

test("renderer styles keep buttons on the system UI font", async () => {
  const css = await fs.readFile(path.join(repoRoot, "src/renderer/styles.css"), "utf8");

  assert.match(css, /button\s*\{[\s\S]*font-family:\s*"Inter",\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*sans-serif;/);
});

test("main window keeps a minimum size for the current settings layout", async () => {
  const mainSource = await fs.readFile(path.join(repoRoot, "src/main/main.ts"), "utf8");

  assert.match(mainSource, /minWidth:\s*1040/);
  assert.match(mainSource, /minHeight:\s*700/);
});
