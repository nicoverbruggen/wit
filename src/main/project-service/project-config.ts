/**
 * Owns: loading and saving `.wit/config.json` settings and last-opened-file state.
 * Out of scope: broader project metadata assembly and file tree mutation.
 * Inputs/Outputs: project roots and settings values in, normalized config values out.
 * Side effects: reads and writes the project config file.
 */
import { promises as fs } from "node:fs";
import { DEFAULT_SETTINGS } from "../../shared/default-settings";
import type { AppSettings } from "../../shared/types";
import {
  normalizeDefaultFileExtension,
  normalizeEditorLineHeight,
  normalizeEditorMaxWidth,
  normalizeEditorParagraphSpacing,
  normalizeEditorZoomPercent,
  normalizeTheme
} from "../../shared/utils";
import { listGitRemotes } from "./project-git";
import { ensureProjectInitialized } from "./project-init";
import { getConfigPath } from "./project-paths";

/**
 * Loads normalized project settings from disk.
 *
 * @param projectPath Absolute project root.
 * @returns Normalized project settings with defaults applied.
 */
export async function loadSettings(projectPath: string): Promise<AppSettings> {
  await ensureProjectInitialized(projectPath);

  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as Partial<AppSettings> & {
    settings?: Partial<AppSettings>;
    lastOpenedFilePath?: unknown;
  };
  const rawSettings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;

  return {
    autosaveIntervalSec:
      typeof rawSettings.autosaveIntervalSec === "number" && rawSettings.autosaveIntervalSec > 0
        ? Math.round(rawSettings.autosaveIntervalSec)
        : DEFAULT_SETTINGS.autosaveIntervalSec,
    theme: normalizeTheme(rawSettings.theme),
    defaultFileExtension: normalizeDefaultFileExtension(rawSettings.defaultFileExtension),
    showWordCount:
      typeof rawSettings.showWordCount === "boolean" ? rawSettings.showWordCount : DEFAULT_SETTINGS.showWordCount,
    showWritingTime:
      typeof rawSettings.showWritingTime === "boolean"
        ? rawSettings.showWritingTime
        : DEFAULT_SETTINGS.showWritingTime,
    showCurrentFileBar:
      typeof rawSettings.showCurrentFileBar === "boolean"
        ? rawSettings.showCurrentFileBar
        : DEFAULT_SETTINGS.showCurrentFileBar,
    smartQuotes:
      typeof rawSettings.smartQuotes === "boolean" ? rawSettings.smartQuotes : DEFAULT_SETTINGS.smartQuotes,
    snapshotMaxSizeMb:
      typeof rawSettings.snapshotMaxSizeMb === "number" && rawSettings.snapshotMaxSizeMb > 0
        ? Math.round(rawSettings.snapshotMaxSizeMb)
        : DEFAULT_SETTINGS.snapshotMaxSizeMb,
    gitSnapshots:
      typeof rawSettings.gitSnapshots === "boolean" ? rawSettings.gitSnapshots : DEFAULT_SETTINGS.gitSnapshots,
    gitPushRemote:
      typeof rawSettings.gitPushRemote === "string" && rawSettings.gitPushRemote.trim().length > 0
        ? rawSettings.gitPushRemote.trim()
        : DEFAULT_SETTINGS.gitPushRemote,
    editorLineHeight:
      typeof rawSettings.editorLineHeight === "number" && Number.isFinite(rawSettings.editorLineHeight)
        ? normalizeEditorLineHeight(rawSettings.editorLineHeight)
        : DEFAULT_SETTINGS.editorLineHeight,
    editorParagraphSpacing: normalizeEditorParagraphSpacing(rawSettings.editorParagraphSpacing),
    editorMaxWidthPx:
      typeof rawSettings.editorMaxWidthPx === "number" && Number.isFinite(rawSettings.editorMaxWidthPx)
        ? normalizeEditorMaxWidth(rawSettings.editorMaxWidthPx)
        : DEFAULT_SETTINGS.editorMaxWidthPx,
    editorZoomPercent:
      typeof rawSettings.editorZoomPercent === "number" && Number.isFinite(rawSettings.editorZoomPercent)
        ? normalizeEditorZoomPercent(rawSettings.editorZoomPercent)
        : DEFAULT_SETTINGS.editorZoomPercent,
    editorFontFamily:
      typeof rawSettings.editorFontFamily === "string" && rawSettings.editorFontFamily.length > 0
        ? rawSettings.editorFontFamily
        : DEFAULT_SETTINGS.editorFontFamily
  };
}

/**
 * Saves normalized project settings while preserving the last-opened-file entry.
 *
 * @param projectPath Absolute project root.
 * @param settings Requested settings values.
 * @returns The normalized settings written to disk.
 */
export async function saveSettings(projectPath: string, settings: AppSettings): Promise<AppSettings> {
  const gitRemotes = await listGitRemotes(projectPath);
  const normalizedRemote =
    typeof settings.gitPushRemote === "string" && gitRemotes.includes(settings.gitPushRemote)
      ? settings.gitPushRemote
      : null;
  const normalizedSettings: AppSettings = {
    autosaveIntervalSec: Math.max(5, Math.round(settings.autosaveIntervalSec)),
    theme: normalizeTheme(settings.theme),
    defaultFileExtension: normalizeDefaultFileExtension(settings.defaultFileExtension),
    showWordCount: Boolean(settings.showWordCount),
    showWritingTime: Boolean(settings.showWritingTime),
    showCurrentFileBar: Boolean(settings.showCurrentFileBar),
    smartQuotes: Boolean(settings.smartQuotes),
    snapshotMaxSizeMb: Math.max(1, Math.round(settings.snapshotMaxSizeMb)),
    gitSnapshots: Boolean(settings.gitSnapshots),
    gitPushRemote: normalizedRemote,
    editorLineHeight: normalizeEditorLineHeight(settings.editorLineHeight),
    editorParagraphSpacing: normalizeEditorParagraphSpacing(settings.editorParagraphSpacing),
    editorMaxWidthPx: normalizeEditorMaxWidth(settings.editorMaxWidthPx),
    editorZoomPercent: normalizeEditorZoomPercent(settings.editorZoomPercent),
    editorFontFamily: settings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily
  };

  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as { lastOpenedFilePath?: unknown };
  await fs.writeFile(
    getConfigPath(projectPath),
    `${JSON.stringify(
      {
        lastOpenedFilePath:
          typeof parsed.lastOpenedFilePath === "string" && parsed.lastOpenedFilePath.trim().length > 0
            ? parsed.lastOpenedFilePath.trim()
            : null,
        settings: normalizedSettings
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return normalizedSettings;
}

/**
 * Reads the last opened file path from config.
 *
 * @param projectPath Absolute project root.
 * @returns The stored relative path, or `null` when unset.
 */
export async function getLastOpenedFilePath(projectPath: string): Promise<string | null> {
  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as { lastOpenedFilePath?: unknown };

  return typeof parsed.lastOpenedFilePath === "string" && parsed.lastOpenedFilePath.trim().length > 0
    ? parsed.lastOpenedFilePath.trim()
    : null;
}

/**
 * Reports whether config explicitly stores a last-opened-file value.
 *
 * @param projectPath Absolute project root.
 * @returns `true` when the config contains the `lastOpenedFilePath` key.
 */
export async function hasStoredLastOpenedFilePath(projectPath: string): Promise<boolean> {
  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as { lastOpenedFilePath?: unknown };
  return Object.prototype.hasOwnProperty.call(parsed, "lastOpenedFilePath");
}

/**
 * Saves the last opened file path while preserving project settings.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative file path to store, or `null` to clear it.
 * @returns The normalized stored path.
 */
export async function saveLastOpenedFilePath(projectPath: string, relativePath: string | null): Promise<string | null> {
  await ensureProjectInitialized(projectPath);
  const settings = await loadSettings(projectPath);
  const normalizedRelativePath =
    typeof relativePath === "string" && relativePath.trim().length > 0 ? relativePath.trim() : null;

  await fs.writeFile(
    getConfigPath(projectPath),
    `${JSON.stringify(
      {
        lastOpenedFilePath: normalizedRelativePath,
        settings
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return normalizedRelativePath;
}
