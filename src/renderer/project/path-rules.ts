/**
 * Owns: renderer-side validation and path resolution for new files, folders, and deletions.
 * Out of scope: filesystem writes and project tree rendering.
 * Inputs/Outputs: project state plus raw UI input in, normalized path decisions out.
 * Side effects: none.
 */
import type { ProjectMetadata } from "../../shared/types";
import { normalizeDefaultFileExtension, normalizePathInput, pathEquals } from "../../shared/utils.js";

/**
 * Resolves a new file path from dialog input and current project state.
 *
 * @param project Active project metadata, if any.
 * @param rawInput User-entered file path.
 * @param selectedFolder Currently selected folder, if any.
 * @returns A normalized relative path or a user-facing validation error.
 */
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

  if (!/\.(txt|md|markdown|text)$/i.test(relativePath)) {
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

/**
 * Resolves a new folder path from dialog input and current project state.
 *
 * @param project Active project metadata, if any.
 * @param rawInput User-entered folder path.
 * @param selectedFolder Currently selected folder, if any.
 * @returns A normalized relative path or a user-facing validation error.
 */
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

/**
 * Determines whether deleting an entry would remove the currently open file.
 *
 * @param currentFilePath Active file path, if any.
 * @param relativePath Path being deleted.
 * @param kind Whether the deletion target is a file or folder.
 * @returns `true` when the open file would be deleted directly or via folder removal.
 */
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
