import path from "node:path";
import { mkdirSync, promises as fs, writeFileSync } from "node:fs";
import type { AppSettings, ProjectMetadata } from "../shared/types";

const WIT_DIR_NAME = ".wit";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "stats.json";
const SNAPSHOT_DIR_NAME = "snapshots";
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text"]);

const DEFAULT_SETTINGS: AppSettings = {
  autosaveIntervalSec: 60,
  showWordCount: true,
  smartQuotes: true,
  gitSnapshots: false
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

export async function ensureProjectInitialized(projectPath: string): Promise<void> {
  const witDir = getWitDir(projectPath);
  const snapshotDir = path.join(witDir, SNAPSHOT_DIR_NAME);

  await fs.mkdir(witDir, { recursive: true });
  await fs.mkdir(snapshotDir, { recursive: true });

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

export async function listProjectFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  await walkTextFiles(projectPath, projectPath, files);
  return files.sort((a, b) => a.localeCompare(b));
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
        : DEFAULT_SETTINGS.gitSnapshots
  };
}

export async function saveSettings(projectPath: string, settings: AppSettings): Promise<AppSettings> {
  const normalizedSettings: AppSettings = {
    autosaveIntervalSec: Math.max(10, Math.round(settings.autosaveIntervalSec)),
    showWordCount: Boolean(settings.showWordCount),
    smartQuotes: Boolean(settings.smartQuotes),
    gitSnapshots: Boolean(settings.gitSnapshots)
  };

  await ensureProjectInitialized(projectPath);
  await fs.writeFile(getConfigPath(projectPath), `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf8");

  return normalizedSettings;
}

function countWordsInText(text: string): number {
  const tokens = text.trim().match(/\S+/g);
  return tokens?.length ?? 0;
}

export async function calculateTotalWordCount(projectPath: string): Promise<number> {
  const files = await listProjectFiles(projectPath);

  let total = 0;
  for (const filePath of files) {
    const content = await readProjectFile(projectPath, filePath);
    total += countWordsInText(content);
  }

  return total;
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

  const [files, settings, wordCount, stats] = await Promise.all([
    listProjectFiles(projectPath),
    loadSettings(projectPath),
    calculateTotalWordCount(projectPath),
    getProjectStats(projectPath)
  ]);

  return {
    projectPath,
    files,
    wordCount,
    totalWritingSeconds: stats.totalWritingSeconds,
    settings
  };
}

export function getSnapshotDirectory(projectPath: string): string {
  return path.join(getWitDir(projectPath), SNAPSHOT_DIR_NAME);
}
