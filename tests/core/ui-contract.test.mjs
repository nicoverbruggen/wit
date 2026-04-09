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
    "open-project-btn",
    "new-file-btn",
    "new-folder-btn",
    "file-list",
    "editor",
    "show-word-count-input",
    "smart-quotes-input",
    "git-snapshots-input",
    "git-snapshots-notice",
    "autosave-interval-input",
    "line-height-input",
    "line-height-value",
    "editor-width-input",
    "editor-width-value",
    "new-file-error",
    "new-folder-error",
    "new-file-cancel-btn",
    "new-folder-cancel-btn",
    "rename-entry-dialog",
    "rename-entry-input",
    "rename-entry-cancel-btn",
    "rename-entry-confirm-btn",
    "text-zoom-select",
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

test("renderer styles include dedicated writing font configuration", async () => {
  const css = await fs.readFile(path.join(repoRoot, "src/renderer/styles.css"), "utf8");

  assert.match(css, /@font-face\s*\{/);
  assert.match(css, /font-family:\s*"WitWriter"/);
  assert.match(css, /#editor\s*\{[\s\S]*font-family:\s*"WitWriter"/);
});
