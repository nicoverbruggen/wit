/**
 * Owns: project file and folder traversal plus filesystem mutations constrained to the project root.
 * Out of scope: project settings/stats persistence and metadata aggregation.
 * Inputs/Outputs: project-relative paths in, file contents, listings, or normalized paths out.
 * Side effects: reads, writes, renames, and deletes project files and folders on disk.
 */
import path from "node:path";
import { mkdirSync, promises as fs, writeFileSync } from "node:fs";
import { normalizePathInput, pathEquals } from "../../shared/utils";
import {
  ensureInsideProject,
  isTextFile,
  shouldIgnoreDirectory,
  toProjectRelativePath
} from "./project-paths";

type PathStats = Awaited<ReturnType<typeof fs.stat>>;
type FsErrorWithCode = Error & { code?: string };

function requireNonEmptyRelativePath(relativePath: string, errorMessage: string): string {
  const normalizedPath = normalizePathInput(relativePath);
  if (!normalizedPath) {
    throw new Error(errorMessage);
  }

  return normalizedPath;
}

async function assertPathMissing(absolutePath: string, errorMessage: string): Promise<void> {
  try {
    await fs.access(absolutePath);
    throw new Error(errorMessage);
  } catch (error) {
    const fsError = error as FsErrorWithCode;
    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }
}

async function getPathStatsOrThrow(absolutePath: string, notFoundMessage: string): Promise<PathStats> {
  try {
    return await fs.stat(absolutePath);
  } catch (error) {
    const fsError = error as FsErrorWithCode;
    if (fsError.code === "ENOENT") {
      throw new Error(notFoundMessage);
    }

    throw error;
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

/**
 * Lists supported text files in the project.
 *
 * @param projectPath Absolute project root.
 * @returns Sorted relative file paths.
 */
export async function listProjectFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  await walkTextFiles(projectPath, projectPath, files);
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Lists folders in the project, excluding ignored directories.
 *
 * @param projectPath Absolute project root.
 * @returns Sorted relative folder paths.
 */
export async function listProjectFolders(projectPath: string): Promise<string[]> {
  const folders: string[] = [];
  await walkProjectFolders(projectPath, projectPath, folders);
  return folders.sort((a, b) => a.localeCompare(b));
}

/**
 * Reads a project file as UTF-8 text.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative file path to read.
 * @returns The file contents.
 */
export async function readProjectFile(projectPath: string, relativePath: string): Promise<string> {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  return fs.readFile(absolutePath, "utf8");
}

/**
 * Saves a project file asynchronously, creating parent folders when needed.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative file path to save.
 * @param content UTF-8 text content to write.
 */
export async function saveProjectFile(
  projectPath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

/**
 * Saves a project file synchronously during shutdown.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative file path to save.
 * @param content UTF-8 text content to write.
 */
export function saveProjectFileSync(projectPath: string, relativePath: string, content: string): void {
  const absolutePath = ensureInsideProject(projectPath, relativePath);
  const parentDirectory = path.dirname(absolutePath);

  if (!parentDirectory.startsWith(path.resolve(projectPath))) {
    throw new Error("Path escapes project root.");
  }

  mkdirSync(parentDirectory, { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

/**
 * Creates a new supported text file inside the project.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative file path to create.
 * @param initialContent Initial file contents.
 */
export async function createProjectFile(
  projectPath: string,
  relativePath: string,
  initialContent = ""
): Promise<void> {
  const normalizedPath = requireNonEmptyRelativePath(relativePath, "File name cannot be empty.");
  const absolutePath = ensureInsideProject(projectPath, normalizedPath);

  if (!isTextFile(absolutePath)) {
    throw new Error("Only plain text, Markdown, and Wit text files are supported.");
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await assertPathMissing(absolutePath, "File already exists.");
  await fs.writeFile(absolutePath, initialContent, "utf8");
}

/**
 * Creates a new folder inside the project.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative folder path to create.
 */
export async function createProjectFolder(projectPath: string, relativePath: string): Promise<void> {
  const normalizedPath = requireNonEmptyRelativePath(relativePath, "Folder name cannot be empty.");
  const absolutePath = ensureInsideProject(projectPath, normalizedPath);
  await assertPathMissing(absolutePath, "Folder already exists.");
  await fs.mkdir(absolutePath, { recursive: true });
}

/**
 * Deletes a file or folder from the project.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Relative entry path to delete.
 * @param kind Expected entry kind.
 */
export async function deleteProjectEntry(
  projectPath: string,
  relativePath: string,
  kind: "file" | "folder"
): Promise<void> {
  const normalizedPath = requireNonEmptyRelativePath(relativePath, "Path cannot be empty.");
  const absolutePath = ensureInsideProject(projectPath, normalizedPath);
  const entryStat = await getPathStatsOrThrow(absolutePath, "Entry does not exist.");

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

/**
 * Moves a file into another folder inside the project.
 *
 * @param projectPath Absolute project root.
 * @param fromRelativePath Source file path.
 * @param toFolderRelativePath Destination folder path, or empty for the project root.
 * @returns The destination relative file path.
 */
export async function moveProjectFile(
  projectPath: string,
  fromRelativePath: string,
  toFolderRelativePath: string
): Promise<string> {
  const normalizedFrom = requireNonEmptyRelativePath(fromRelativePath, "Source file path cannot be empty.");
  const normalizedToFolder = normalizePathInput(toFolderRelativePath);

  const fromAbsolutePath = ensureInsideProject(projectPath, normalizedFrom);
  const toFolderAbsolutePath =
    normalizedToFolder.length > 0 ? ensureInsideProject(projectPath, normalizedToFolder) : path.resolve(projectPath);

  const sourceStats = await getPathStatsOrThrow(fromAbsolutePath, "Source file does not exist.");

  if (!sourceStats.isFile()) {
    throw new Error("Source path is not a file.");
  }

  const destinationFolderStats = await getPathStatsOrThrow(toFolderAbsolutePath, "Destination folder does not exist.");

  if (!destinationFolderStats.isDirectory()) {
    throw new Error("Destination path is not a folder.");
  }

  const fileName = path.basename(normalizedFrom);
  const targetRelativePath = normalizedToFolder.length > 0 ? `${normalizedToFolder}/${fileName}` : fileName;
  const targetAbsolutePath = ensureInsideProject(projectPath, targetRelativePath);

  if (pathEquals(normalizedFrom, targetRelativePath)) {
    return targetRelativePath;
  }

  await assertPathMissing(targetAbsolutePath, "A file with that name already exists in the destination folder.");
  await fs.rename(fromAbsolutePath, targetAbsolutePath);
  return targetRelativePath;
}

/**
 * Renames a file or folder inside the project.
 *
 * @param projectPath Absolute project root.
 * @param relativePath Existing relative path.
 * @param kind Expected entry kind.
 * @param nextRelativePath New relative path.
 * @returns The normalized final relative path.
 */
export async function renameProjectEntry(
  projectPath: string,
  relativePath: string,
  kind: "file" | "folder",
  nextRelativePath: string
): Promise<string> {
  const normalizedCurrentPath = requireNonEmptyRelativePath(relativePath, "Path cannot be empty.");
  const normalizedNextPath = requireNonEmptyRelativePath(nextRelativePath, "New name cannot be empty.");

  const currentAbsolutePath = ensureInsideProject(projectPath, normalizedCurrentPath);
  const nextAbsolutePath = ensureInsideProject(projectPath, normalizedNextPath);

  const currentStats = await getPathStatsOrThrow(currentAbsolutePath, "Entry does not exist.");

  if (kind === "file" && !currentStats.isFile()) {
    throw new Error("Selected path is not a file.");
  }

  if (kind === "folder" && !currentStats.isDirectory()) {
    throw new Error("Selected path is not a folder.");
  }

  if (pathEquals(normalizedCurrentPath, normalizedNextPath)) {
    return normalizedCurrentPath;
  }

  await assertPathMissing(nextAbsolutePath, "An entry with that name already exists.");
  await fs.rename(currentAbsolutePath, nextAbsolutePath);
  return normalizedNextPath;
}
