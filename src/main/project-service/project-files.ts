import path from "node:path";
import { mkdirSync, promises as fs, writeFileSync } from "node:fs";
import { normalizePathInput, pathEquals } from "../../shared/utils";
import {
  ensureInsideProject,
  isTextFile,
  shouldIgnoreDirectory,
  toProjectRelativePath
} from "./project-paths";

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
    normalizedToFolder.length > 0 ? ensureInsideProject(projectPath, normalizedToFolder) : path.resolve(projectPath);

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
  const targetRelativePath = normalizedToFolder.length > 0 ? `${normalizedToFolder}/${fileName}` : fileName;
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
