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

type ParsedConfig = Partial<AppSettings> & {
  settings?: Partial<AppSettings>;
  lastOpenedFilePath?: unknown;
};

type NormalizeAppSettingsOptions = {
  invalidPositiveIntegerFallback: "default" | "minimum";
};

const corruptedProjects = new Set<string>();

function parseConfig(projectPath: string, raw: string): ParsedConfig {
  try {
    return JSON.parse(raw) as ParsedConfig;
  } catch {
    corruptedProjects.add(projectPath);
    return {};
  }
}

export function isConfigCorrupted(projectPath: string): boolean {
  return corruptedProjects.has(projectPath);
}

function extractRawSettings(parsed: ParsedConfig): Partial<AppSettings> {
  return parsed.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
}

function normalizePositiveInteger(
  value: unknown,
  defaultValue: number,
  minimumValue: number,
  options: NormalizeAppSettingsOptions
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return options.invalidPositiveIntegerFallback === "minimum" ? minimumValue : defaultValue;
  }

  return Math.max(minimumValue, Math.round(value));
}

function normalizeGitPushRemote(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_SETTINGS.gitPushRemote;
}

function normalizeStoredLastOpenedFilePath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeAppSettings(
  raw: Partial<AppSettings>,
  options: NormalizeAppSettingsOptions = { invalidPositiveIntegerFallback: "default" }
): AppSettings {
  return {
    autosaveIntervalSec: normalizePositiveInteger(
      raw.autosaveIntervalSec,
      DEFAULT_SETTINGS.autosaveIntervalSec,
      5,
      options
    ),
    theme: normalizeTheme(raw.theme),
    defaultFileExtension: normalizeDefaultFileExtension(raw.defaultFileExtension),
    showWordCount: typeof raw.showWordCount === "boolean" ? raw.showWordCount : DEFAULT_SETTINGS.showWordCount,
    showWritingTime: typeof raw.showWritingTime === "boolean" ? raw.showWritingTime : DEFAULT_SETTINGS.showWritingTime,
    showCurrentFileBar:
      typeof raw.showCurrentFileBar === "boolean" ? raw.showCurrentFileBar : DEFAULT_SETTINGS.showCurrentFileBar,
    smartQuotes: typeof raw.smartQuotes === "boolean" ? raw.smartQuotes : DEFAULT_SETTINGS.smartQuotes,
    snapshotMaxSizeMb: normalizePositiveInteger(
      raw.snapshotMaxSizeMb,
      DEFAULT_SETTINGS.snapshotMaxSizeMb,
      1,
      options
    ),
    gitSnapshots: typeof raw.gitSnapshots === "boolean" ? raw.gitSnapshots : DEFAULT_SETTINGS.gitSnapshots,
    gitPushRemote: normalizeGitPushRemote(raw.gitPushRemote),
    editorLineHeight:
      typeof raw.editorLineHeight === "number" && Number.isFinite(raw.editorLineHeight)
        ? normalizeEditorLineHeight(raw.editorLineHeight)
        : DEFAULT_SETTINGS.editorLineHeight,
    editorParagraphSpacing: normalizeEditorParagraphSpacing(raw.editorParagraphSpacing),
    editorMaxWidthPx:
      typeof raw.editorMaxWidthPx === "number" && Number.isFinite(raw.editorMaxWidthPx)
        ? normalizeEditorMaxWidth(raw.editorMaxWidthPx)
        : DEFAULT_SETTINGS.editorMaxWidthPx,
    editorZoomPercent:
      typeof raw.editorZoomPercent === "number" && Number.isFinite(raw.editorZoomPercent)
        ? normalizeEditorZoomPercent(raw.editorZoomPercent)
        : DEFAULT_SETTINGS.editorZoomPercent,
    editorFontFamily:
      typeof raw.editorFontFamily === "string" && raw.editorFontFamily.length > 0
        ? raw.editorFontFamily
        : DEFAULT_SETTINGS.editorFontFamily
  };
}

/**
 * Loads normalized project settings from disk.
 *
 * @param projectPath Absolute project root.
 * @returns Normalized project settings with defaults applied.
 */
export async function loadSettings(projectPath: string): Promise<AppSettings> {
  await ensureProjectInitialized(projectPath);

  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  return normalizeAppSettings(extractRawSettings(parseConfig(projectPath, raw)));
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
  const baseSettings = normalizeAppSettings(settings, { invalidPositiveIntegerFallback: "minimum" });
  const normalizedRemote =
    typeof baseSettings.gitPushRemote === "string" && gitRemotes.includes(baseSettings.gitPushRemote)
      ? baseSettings.gitPushRemote
      : null;
  const normalizedSettings: AppSettings = {
    ...baseSettings,
    gitPushRemote: normalizedRemote
  };

  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = parseConfig(projectPath, raw);
  await fs.writeFile(
    getConfigPath(projectPath),
    `${JSON.stringify(
      {
        lastOpenedFilePath: normalizeStoredLastOpenedFilePath(parsed.lastOpenedFilePath),
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
  return normalizeStoredLastOpenedFilePath(parseConfig(projectPath, raw).lastOpenedFilePath);
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
  return Object.prototype.hasOwnProperty.call(parseConfig(projectPath, raw), "lastOpenedFilePath");
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
