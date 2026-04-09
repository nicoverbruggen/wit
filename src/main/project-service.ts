import path from "node:path";
import { mkdirSync, promises as fs, writeFileSync } from "node:fs";
import type { AppSettings, ProjectMetadata } from "../shared/types";
import { countWordsInFilesUsingSystemTool } from "./word-count-service";
import { SNAPSHOT_SYSTEM_VERSION, SNAPSHOT_VERSION_FILE_NAME } from "./snapshot-service";

const WIT_DIR_NAME = ".wit";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "stats.json";
const SNAPSHOT_DIR_NAME = "snapshots";
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text"]);

const DEFAULT_SETTINGS: AppSettings = {
  autosaveIntervalSec: 60,
  showWordCount: true,
  smartQuotes: true,
  gitSnapshots: false,
  editorLineHeight: 1.68,
  editorMaxWidthPx: 750,
  editorZoomPercent: 100,
  editorFontFamily: "Readerly"
};

type ProjectStats = {
  totalWritingSeconds: number;
};

const DEFAULT_STATS: ProjectStats = {
  totalWritingSeconds: 0
};

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

function isTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function normalizeEditorLineHeight(value: number): number {
  const bounded = Math.max(1.2, Math.min(2.4, value));
  return Number(bounded.toFixed(2));
}

function normalizeEditorMaxWidth(value: number): number {
  return Math.max(360, Math.min(1200, Math.round(value)));
}

function normalizeEditorZoomPercent(value: number): number {
  return Math.max(50, Math.min(250, Math.round(value)));
}

export async function ensureProjectInitialized(projectPath: string): Promise<void> {
  const witDir = getWitDir(projectPath);
  const snapshotDir = path.join(witDir, SNAPSHOT_DIR_NAME);

  await fs.mkdir(witDir, { recursive: true });
  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotDir, SNAPSHOT_VERSION_FILE_NAME),
    `${JSON.stringify({ version: SNAPSHOT_SYSTEM_VERSION }, null, 2)}\n`,
    "utf8"
  );

  await ensureJsonFile(getConfigPath(projectPath), DEFAULT_SETTINGS);
  await ensureJsonFile(getStatsPath(projectPath), DEFAULT_STATS);
}

async function ensureJsonFile<T>(filePath: string, fallback: T): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function walkTextFiles(projectPath: string, currentPath: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === ".wit" || entry.name === "node_modules") {
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
    throw new Error("Only plain text and markdown files are supported.");
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

function normalizePathInput(input: string): string {
  return input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function pathEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export async function loadSettings(projectPath: string): Promise<AppSettings> {
  await ensureProjectInitialized(projectPath);

  const raw = await fs.readFile(getConfigPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as Partial<AppSettings>;

  return {
    autosaveIntervalSec:
      typeof parsed.autosaveIntervalSec === "number" && parsed.autosaveIntervalSec > 0
        ? Math.round(parsed.autosaveIntervalSec)
        : DEFAULT_SETTINGS.autosaveIntervalSec,
    showWordCount:
      typeof parsed.showWordCount === "boolean"
        ? parsed.showWordCount
        : DEFAULT_SETTINGS.showWordCount,
    smartQuotes:
      typeof parsed.smartQuotes === "boolean" ? parsed.smartQuotes : DEFAULT_SETTINGS.smartQuotes,
    gitSnapshots:
      typeof parsed.gitSnapshots === "boolean"
        ? parsed.gitSnapshots
        : DEFAULT_SETTINGS.gitSnapshots,
    editorLineHeight:
      typeof parsed.editorLineHeight === "number" && Number.isFinite(parsed.editorLineHeight)
        ? normalizeEditorLineHeight(parsed.editorLineHeight)
        : DEFAULT_SETTINGS.editorLineHeight,
    editorMaxWidthPx:
      typeof parsed.editorMaxWidthPx === "number" && Number.isFinite(parsed.editorMaxWidthPx)
        ? normalizeEditorMaxWidth(parsed.editorMaxWidthPx)
        : DEFAULT_SETTINGS.editorMaxWidthPx,
    editorZoomPercent:
      typeof parsed.editorZoomPercent === "number" && Number.isFinite(parsed.editorZoomPercent)
        ? normalizeEditorZoomPercent(parsed.editorZoomPercent)
        : DEFAULT_SETTINGS.editorZoomPercent,
    editorFontFamily:
      typeof parsed.editorFontFamily === "string" && parsed.editorFontFamily.length > 0
        ? parsed.editorFontFamily
        : DEFAULT_SETTINGS.editorFontFamily
  };
}

export async function saveSettings(projectPath: string, settings: AppSettings): Promise<AppSettings> {
  const normalizedSettings: AppSettings = {
    autosaveIntervalSec: Math.max(10, Math.round(settings.autosaveIntervalSec)),
    showWordCount: Boolean(settings.showWordCount),
    smartQuotes: Boolean(settings.smartQuotes),
    gitSnapshots: Boolean(settings.gitSnapshots),
    editorLineHeight: normalizeEditorLineHeight(settings.editorLineHeight),
    editorMaxWidthPx: normalizeEditorMaxWidth(settings.editorMaxWidthPx),
    editorZoomPercent: normalizeEditorZoomPercent(settings.editorZoomPercent),
    editorFontFamily: settings.editorFontFamily || DEFAULT_SETTINGS.editorFontFamily
  };

  await ensureProjectInitialized(projectPath);
  await fs.writeFile(getConfigPath(projectPath), `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf8");

  return normalizedSettings;
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

  const [files, folders, settings, wordCount, stats] = await Promise.all([
    listProjectFiles(projectPath),
    listProjectFolders(projectPath),
    loadSettings(projectPath),
    calculateTotalWordCount(projectPath),
    getProjectStats(projectPath)
  ]);

  return {
    projectPath,
    files,
    folders,
    wordCount,
    totalWritingSeconds: stats.totalWritingSeconds,
    settings
  };
}

export function getSnapshotDirectory(projectPath: string): string {
  return path.join(getWitDir(projectPath), SNAPSHOT_DIR_NAME);
}
