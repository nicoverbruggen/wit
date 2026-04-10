import path from "node:path";
import { DEFAULT_SETTINGS } from "../../shared/default-settings";
import type { AppSettings } from "../../shared/types";

const WIT_DIR_NAME = ".wit";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "stats.json";
export const SNAPSHOT_DIR_NAME = "snapshots";
const GITIGNORE_FILE_NAME = ".gitignore";
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text", ".wxt"]);

export type ProjectStats = {
  totalWritingSeconds: number;
};

export type ProjectConfig = {
  lastOpenedFilePath?: string | null;
  settings: AppSettings;
};

export const DEFAULT_STATS: ProjectStats = {
  totalWritingSeconds: 0
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  settings: DEFAULT_SETTINGS
};

export function toProjectRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

export function ensureInsideProject(projectPath: string, relativePath: string): string {
  const resolvedPath = path.resolve(projectPath, relativePath);
  const normalizedProjectPath = path.resolve(projectPath);

  if (resolvedPath !== normalizedProjectPath && !resolvedPath.startsWith(`${normalizedProjectPath}${path.sep}`)) {
    throw new Error("Path escapes project root.");
  }

  return resolvedPath;
}

export function getWitDir(projectPath: string): string {
  return path.join(projectPath, WIT_DIR_NAME);
}

export function getConfigPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), CONFIG_FILE_NAME);
}

export function getStatsPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), STATS_FILE_NAME);
}

export function getGitignorePath(projectPath: string): string {
  return path.join(projectPath, GITIGNORE_FILE_NAME);
}

export function getSnapshotDirectory(projectPath: string): string {
  return path.join(getWitDir(projectPath), SNAPSHOT_DIR_NAME);
}

export function isTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function shouldIgnoreDirectory(name: string): boolean {
  return name === ".git" || name === ".wit" || name === "node_modules";
}
