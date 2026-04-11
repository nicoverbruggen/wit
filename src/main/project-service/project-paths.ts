/**
 * Owns: canonical filesystem path helpers and default project-shape constants.
 * Out of scope: file I/O and project metadata aggregation.
 * Inputs/Outputs: project paths in, normalized filesystem paths and config defaults out.
 * Side effects: none.
 */
import path from "node:path";
import { DEFAULT_SETTINGS } from "../../shared/default-settings";
import type { AppSettings } from "../../shared/types";

const WIT_DIR_NAME = ".wit";
const CONFIG_FILE_NAME = "config.json";
const STATS_FILE_NAME = "stats.json";
export const SNAPSHOT_DIR_NAME = "snapshots";
const GITIGNORE_FILE_NAME = ".gitignore";
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".text", ".wxt"]);

/**
 * Tracks cumulative writing-time statistics for a project.
 */
export type ProjectStats = {
  totalWritingSeconds: number;
};

/**
 * Describes the persisted `.wit/config.json` shape.
 */
export type ProjectConfig = {
  lastOpenedFilePath?: string | null;
  settings: AppSettings;
};

/**
 * Default project statistics for initialization.
 */
export const DEFAULT_STATS: ProjectStats = {
  totalWritingSeconds: 0
};

/**
 * Default project config for initialization.
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  settings: DEFAULT_SETTINGS
};

/**
 * Converts an absolute path under a project root to a slash-delimited relative path.
 *
 * @param root Absolute project root.
 * @param absolutePath Absolute path inside the project.
 * @returns A relative path using forward slashes.
 */
export function toProjectRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/**
 * Resolves a relative path and rejects escapes outside the project root.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative project path.
 * @returns The resolved absolute path inside the project.
 * @throws When the path escapes the project root.
 */
export function ensureInsideProject(projectPath: string, relativePath: string): string {
  const resolvedPath = path.resolve(projectPath, relativePath);
  const normalizedProjectPath = path.resolve(projectPath);

  if (resolvedPath !== normalizedProjectPath && !resolvedPath.startsWith(`${normalizedProjectPath}${path.sep}`)) {
    throw new Error("Path escapes project root.");
  }

  return resolvedPath;
}

/**
 * Returns the project's `.wit` directory path.
 *
 * @param projectPath Absolute project root.
 * @returns The absolute `.wit` directory path.
 */
export function getWitDir(projectPath: string): string {
  return path.join(projectPath, WIT_DIR_NAME);
}

/**
 * Returns the `.wit/config.json` path.
 *
 * @param projectPath Absolute project root.
 * @returns The absolute config file path.
 */
export function getConfigPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), CONFIG_FILE_NAME);
}

/**
 * Returns the `.wit/stats.json` path.
 *
 * @param projectPath Absolute project root.
 * @returns The absolute stats file path.
 */
export function getStatsPath(projectPath: string): string {
  return path.join(getWitDir(projectPath), STATS_FILE_NAME);
}

/**
 * Returns the project `.gitignore` path.
 *
 * @param projectPath Absolute project root.
 * @returns The absolute `.gitignore` path.
 */
export function getGitignorePath(projectPath: string): string {
  return path.join(projectPath, GITIGNORE_FILE_NAME);
}

/**
 * Returns the snapshot directory path inside `.wit`.
 *
 * @param projectPath Absolute project root.
 * @returns The absolute snapshot directory path.
 */
export function getSnapshotDirectory(projectPath: string): string {
  return path.join(getWitDir(projectPath), SNAPSHOT_DIR_NAME);
}

/**
 * Reports whether a path uses one of the supported text-file extensions.
 *
 * @param filePath File path to inspect.
 * @returns `true` for supported plain-text extensions.
 */
export function isTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Reports whether a directory should be skipped by project traversal.
 *
 * @param name Directory name to inspect.
 * @returns `true` for internal or dependency directories the app ignores.
 */
export function shouldIgnoreDirectory(name: string): boolean {
  return name === ".git" || name === ".wit" || name === "node_modules";
}
