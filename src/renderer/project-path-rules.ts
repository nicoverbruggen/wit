import type { ProjectMetadata } from "../shared/types";
import { normalizeDefaultFileExtension, normalizePathInput, pathEquals } from "../shared/utils.js";

export function resolveNewFilePath(
  project: ProjectMetadata | null,
  rawInput: string,
  selectedFolder: string | null
): { relativePath: string | null; error: string | null } {
  if (!project) {
    return { relativePath: null, error: "Open a project first." };
  }

  let relativePath = normalizePathInput(rawInput);
  if (!relativePath) {
    return { relativePath: null, error: "File name cannot be empty." };
  }

  if (relativePath.endsWith("/")) {
    return { relativePath: null, error: "File path cannot end with '/'." };
  }

  if (selectedFolder && !relativePath.includes("/")) {
    relativePath = `${selectedFolder}/${relativePath}`;
  }

  if (!/\.(txt|md|markdown|text|wxt)$/i.test(relativePath)) {
    const defaultExtension = normalizeDefaultFileExtension(project.settings.defaultFileExtension);
    relativePath = `${relativePath}${defaultExtension}`;
  }

  const existingFile = project.files.find((filePath) => pathEquals(filePath, relativePath));
  if (existingFile) {
    return { relativePath: null, error: "A file with that path already exists." };
  }

  const existingFolder = project.folders.find((folderPath) => pathEquals(folderPath, relativePath));
  if (existingFolder) {
    return { relativePath: null, error: "A folder already exists at that path." };
  }

  return { relativePath, error: null };
}

export function resolveNewFolderPath(
  project: ProjectMetadata | null,
  rawInput: string,
  selectedFolder: string | null
): { relativePath: string | null; error: string | null } {
  if (!project) {
    return { relativePath: null, error: "Open a project first." };
  }

  let relativePath = normalizePathInput(rawInput);
  if (!relativePath) {
    return { relativePath: null, error: "Folder name cannot be empty." };
  }

  if (selectedFolder && !relativePath.includes("/")) {
    relativePath = `${selectedFolder}/${relativePath}`;
  }

  const existingFolder = project.folders.find((folderPath) => pathEquals(folderPath, relativePath));
  if (existingFolder) {
    return { relativePath: null, error: "A folder with that path already exists." };
  }

  const existingFile = project.files.find((filePath) => pathEquals(filePath, relativePath));
  if (existingFile) {
    return { relativePath: null, error: "A file already exists at that path." };
  }

  return { relativePath, error: null };
}

export function currentFileWillBeDeleted(
  currentFilePath: string | null,
  relativePath: string,
  kind: "file" | "folder"
): boolean {
  if (!currentFilePath) {
    return false;
  }

  if (kind === "file") {
    return pathEquals(currentFilePath, relativePath);
  }

  return pathEquals(currentFilePath, relativePath) || currentFilePath.startsWith(`${relativePath}/`);
}
