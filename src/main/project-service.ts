import path from "node:path";
import { mkdirSync, promises as fs, writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../shared/default-settings";
import type { AppSettings, ProjectMetadata } from "../shared/types";
import {
  normalizeDefaultFileExtension,
  normalizeEditorLineHeight,
  normalizeEditorMaxWidth,
  normalizeEditorParagraphSpacing,
  normalizeEditorZoomPercent,
  normalizePathInput,
  normalizeTheme,
  pathEquals
} from "../shared/utils";
import { countWordsInFilesUsingSystemTool } from "./word-count-service";
import {
  getLatestSnapshotName,
  SNAPSHOT_SYSTEM_VERSION,
  SNAPSHOT_VERSION_FILE_NAME
} from "./snapshot-service";

const WIT_DIR_NAME = ".wit";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "stats.json";
const SNAPSHOT_DIR_NAME = "snapshots";
const GITIGNORE_FILE_NAME = ".gitignore";
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text", ".wxt"]);

type ProjectStats = {
  totalWritingSeconds: number;
};

type ProjectConfig = {
  lastOpenedFilePath?: string | null;
  settings: AppSettings;
};

const DEFAULT_STATS: ProjectStats = {
  totalWritingSeconds: 0
};

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  settings: DEFAULT_SETTINGS
};
const initializedProjects = new Set<string>();

function toProjectRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function ensureInsideProject(projectPath: string, relativePath: string): string {
  const resolvedPath = path.resolve(projectPath, relativePath);
  const normalizedProjectPath = path.resolve(projectPath);

  if (resolvedPath !== normalizedProjectPath && !resolvedPath.startsWith(`${normalizedProjectPath}${path.sep}`)) {
    throw new Error("Path escapes project root.");
  }

  return resolvedPath;
}

function getWitDir(projectPath: string): string {
  return path.join(projectPath, WIT_DIR_NAME);
}

function getConfigPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), CONFIG_FILE_NAME);
}

function getStatsPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), STATS_FILE_NAME);
}

function getGitignorePath(projectPath: string): string {
  return path.join(projectPath, GITIGNORE_FILE_NAME);
}

function isTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function ensureProjectInitialized(projectPath: string): Promise<void> {
  const normalizedProjectPath = path.resolve(projectPath);
  if (initializedProjects.has(normalizedProjectPath)) {
    return;
  }

  const witDir = getWitDir(projectPath);
  const snapshotDir = path.join(witDir, SNAPSHOT_DIR_NAME);

  await fs.mkdir(witDir, { recursive: true });
  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotDir, SNAPSHOT_VERSION_FILE_NAME),
    `${JSON.stringify({ version: SNAPSHOT_SYSTEM_VERSION }, null, 2)}\n`,
    "utf8"
  );

  await ensureJsonFile(getConfigPath(projectPath), DEFAULT_PROJECT_CONFIG);
  await ensureJsonFile(getStatsPath(projectPath), DEFAULT_STATS);
  await ensureGitignoreFile(projectPath);
  initializedProjects.add(normalizedProjectPath);
}

async function ensureJsonFile<T>(filePath: string, fallback: T): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function ensureGitignoreFile(projectPath: string): Promise<void> {
  const gitignorePath = getGitignorePath(projectPath);

  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, ".wit/snapshots/\n", "utf8");
  }
}

async function isGitRepository(projectPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path.join(projectPath, ".git"));
    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

export async function listGitRemotes(projectPath: string): Promise<string[]> {
  if (!(await isGitRepository(projectPath))) {
    return [];
  }

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const result = await execFileAsync("git", ["-C", projectPath, "remote"]);

    return result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function walkTextFiles(projectPath: string, currentPath: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      await walkTextFiles(projectPath, absolutePath, results);
      continue;
    }

    if (entry.isFile() && isTextFile(absolutePath)) {
      results.push(toProjectRelativePath(projectPath, absolutePath));
    }
  }
}

function shouldIgnoreDirectory(name: string): boolean {
  return name === ".git" || name === ".wit" || name === "node_modules";
}

async function walkProjectFolders(projectPath: string, currentPath: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || shouldIgnoreDirectory(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    results.push(toProjectRelativePath(projectPath, absolutePath));
    await walkProjectFolders(projectPath, absolutePath, results);
  }
}

export async function listProjectFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  await walkTextFiles(projectPath, projectPath, files);
  return files.sort((a, b) => a.localeCompare(b));
}

export async function listProjectFolders(projectPath: string): Promise<string[]> {
  const folders: string[] = [];
  await walkProjectFolders(projectPath, projectPath, folders);
  return folders.sort((a, b) => a.localeCompare(b));
}

export async function readProjectFile(projectPath: string, relativePath: string): Promise<string> {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  return fs.readFile(absolutePath, "utf8");
}

export async function saveProjectFile(
  projectPath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

export function saveProjectFileSync(projectPath: string, relativePath: string, content: string): void {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  const parentDirectory = path.dirname(absolutePath);

  if (!parentDirectory.startsWith(path.resolve(projectPath))) {
    throw new Error("Path escapes project root.");
  }

  mkdirSync(parentDirectory, { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

export async function createProjectFile(
  projectPath: string,
  relativePath: string,
  initialContent = ""
): Promise<void> {
  const absolutePath = ensureInsideProject(projectPath, relativePath);

  if (!isTextFile(absolutePath)) {
    throw new Error("Only plain text, Markdown, and Wit text files are supported.");
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  try {
    await fs.access(absolutePath);
    throw new Error("File already exists.");
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(absolutePath, initialContent, "utf8");
}

export async function createProjectFolder(projectPath: string, relativePath: string): Promise<void> {
  const normalized = relativePath.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    throw new Error("Folder name cannot be empty.");
  }

  const absolutePath = ensureInsideProject(projectPath, normalized);

  try {
    await fs.access(absolutePath);
    throw new Error("Folder already exists.");
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(absolutePath, { recursive: true });
}

export async function deleteProjectEntry(
  projectPath: string,
  relativePath: string,
  kind: "file" | "folder"
): Promise<void> {
  const normalized = relativePath.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    throw new Error("Path cannot be empty.");
  }

  const absolutePath = ensureInsideProject(projectPath, normalized);
  let entryStat: Awaited<ReturnType<typeof fs.stat>>;

  try {
    entryStat = await fs.stat(absolutePath);
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code === "ENOENT") {
      throw new Error("Entry does not exist.");
    }

    throw error;
  }

  if (kind === "file") {
    if (!entryStat.isFile()) {
      throw new Error("Selected path is not a file.");
    }

    await fs.unlink(absolutePath);
    return;
  }

  if (!entryStat.isDirectory()) {
    throw new Error("Selected path is not a folder.");
  }

  await fs.rm(absolutePath, { recursive: true, force: false });
}

export async function moveProjectFile(
  projectPath: string,
  fromRelativePath: string,
  toFolderRelativePath: string
): Promise<string> {
  const normalizedFrom = normalizePathInput(fromRelativePath);
  const normalizedToFolder = normalizePathInput(toFolderRelativePath);

  if (!normalizedFrom) {
    throw new Error("Source file path cannot be empty.");
  }

  const fromAbsolutePath = ensureInsideProject(projectPath, normalizedFrom);
  const toFolderAbsolutePath =
    normalizedToFolder.length > 0
      ? ensureInsideProject(projectPath, normalizedToFolder)
      : path.resolve(projectPath);

  let sourceStats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    sourceStats = await fs.stat(fromAbsolutePath);
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code === "ENOENT") {
      throw new Error("Source file does not exist.");
    }

    throw error;
  }

  if (!sourceStats.isFile()) {
    throw new Error("Source path is not a file.");
  }

  let destinationFolderStats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    destinationFolderStats = await fs.stat(toFolderAbsolutePath);
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code === "ENOENT") {
      throw new Error("Destination folder does not exist.");
    }

    throw error;
  }

  if (!destinationFolderStats.isDirectory()) {
    throw new Error("Destination path is not a folder.");
  }

  const fileName = path.basename(normalizedFrom);
  const targetRelativePath =
    normalizedToFolder.length > 0 ? `${normalizedToFolder}/${fileName}` : fileName;
  const targetAbsolutePath = ensureInsideProject(projectPath, targetRelativePath);

  if (pathEquals(normalizedFrom, targetRelativePath)) {
    return targetRelativePath;
  }

  try {
    await fs.access(targetAbsolutePath);
    throw new Error("A file with that name already exists in the destination folder.");
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.rename(fromAbsolutePath, targetAbsolutePath);
  return targetRelativePath;
}

export async function renameProjectEntry(
  projectPath: string,
  relativePath: string,
  kind: "file" | "folder",
  nextRelativePath: string
): Promise<string> {
  const normalizedCurrentPath = normalizePathInput(relativePath);
  const normalizedNextPath = normalizePathInput(nextRelativePath);

  if (!normalizedCurrentPath) {
    throw new Error("Path cannot be empty.");
  }

  if (!normalizedNextPath) {
    throw new Error("New name cannot be empty.");
  }

  const currentAbsolutePath = ensureInsideProject(projectPath, normalizedCurrentPath);
  const nextAbsolutePath = ensureInsideProject(projectPath, normalizedNextPath);

  let currentStats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    currentStats = await fs.stat(currentAbsolutePath);
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code === "ENOENT") {
      throw new Error("Entry does not exist.");
    }

    throw error;
  }

  if (kind === "file" && !currentStats.isFile()) {
    throw new Error("Selected path is not a file.");
  }

  if (kind === "folder" && !currentStats.isDirectory()) {
    throw new Error("Selected path is not a folder.");
  }

  if (pathEquals(normalizedCurrentPath, normalizedNextPath)) {
    return normalizedCurrentPath;
  }

  try {
    await fs.access(nextAbsolutePath);
    throw new Error("An entry with that name already exists.");
  } catch (error) {
    const fsError = error as { code?: string };
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.rename(currentAbsolutePath, nextAbsolutePath);
  return normalizedNextPath;
}

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
      typeof rawSettings.showWordCount === "boolean"
        ? rawSettings.showWordCount
        : DEFAULT_SETTINGS.showWordCount,
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
      typeof rawSettings.gitSnapshots === "boolean"
        ? rawSettings.gitSnapshots
        : DEFAULT_SETTINGS.gitSnapshots,
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

export async function getLastOpenedFilePath(projectPath: string): Promise<string | null> {
  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as { lastOpenedFilePath?: unknown };

  return typeof parsed.lastOpenedFilePath === "string" && parsed.lastOpenedFilePath.trim().length > 0
    ? parsed.lastOpenedFilePath.trim()
    : null;
}

async function hasStoredLastOpenedFilePath(projectPath: string): Promise<boolean> {
  await ensureProjectInitialized(projectPath);
  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as { lastOpenedFilePath?: unknown };
  return Object.prototype.hasOwnProperty.call(parsed, "lastOpenedFilePath");
}

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

export async function calculateTotalWordCount(projectPath: string): Promise<number> {
  const relativeFiles = await listProjectFiles(projectPath);
  const absoluteFiles = relativeFiles.map((filePath) => path.resolve(projectPath, filePath));
  return countWordsInFilesUsingSystemTool(absoluteFiles);
}

export async function getProjectStats(projectPath: string): Promise<ProjectStats> {
  await ensureProjectInitialized(projectPath);

  const raw = await fs.readFile(getStatsPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as Partial<ProjectStats>;

  return {
    totalWritingSeconds:
      typeof parsed.totalWritingSeconds === "number" && parsed.totalWritingSeconds >= 0
        ? Math.floor(parsed.totalWritingSeconds)
        : DEFAULT_STATS.totalWritingSeconds
  };
}

export async function addWritingSeconds(projectPath: string, seconds: number): Promise<ProjectStats> {
  const stats = await getProjectStats(projectPath);
  const nextStats: ProjectStats = {
    totalWritingSeconds: Math.max(0, stats.totalWritingSeconds + Math.floor(seconds))
  };

  await fs.writeFile(getStatsPath(projectPath), `${JSON.stringify(nextStats, null, 2)}\n`, "utf8");

  return nextStats;
}

export async function getProjectMetadata(projectPath: string): Promise<ProjectMetadata> {
  await ensureProjectInitialized(projectPath);

  const [
    files,
    folders,
    settings,
    lastOpenedFilePath,
    hasStoredPath,
    wordCount,
    stats,
    gitRepository,
    gitRemotes,
    latestSnapshotCreatedAt
  ] = await Promise.all([
    listProjectFiles(projectPath),
    listProjectFolders(projectPath),
    loadSettings(projectPath),
    getLastOpenedFilePath(projectPath),
    hasStoredLastOpenedFilePath(projectPath),
    calculateTotalWordCount(projectPath),
    getProjectStats(projectPath),
    isGitRepository(projectPath),
    listGitRemotes(projectPath),
    getLatestSnapshotName(getSnapshotDirectory(projectPath))
  ]);

  return {
    projectPath,
    files,
    folders,
    wordCount,
    totalWritingSeconds: stats.totalWritingSeconds,
    latestSnapshotCreatedAt,
    isGitRepository: gitRepository,
    gitRemotes,
    settings,
    lastOpenedFilePath,
    hasStoredLastOpenedFilePath: hasStoredPath
  };
}

export async function getGitRepositoryStatus(projectPath: string): Promise<boolean> {
  return isGitRepository(projectPath);
}

export function getSnapshotDirectory(projectPath: string): string {
  return path.join(getWitDir(projectPath), SNAPSHOT_DIR_NAME);
}
