/**
 * Owns: small path helpers for renderer tree and rename flows.
 * Out of scope: filesystem access and project validation.
 * Inputs/Outputs: relative path strings in, derived labels or sibling paths out.
 * Side effects: none.
 */
import { normalizePathInput } from "../../shared/utils.js";

/**
 * Extracts the last segment of a relative path.
 *
 * @param relativePath Relative project path.
 * @returns The basename portion of the path.
 */
export function getBaseName(relativePath: string): string {
  const normalized = normalizePathInput(relativePath);
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts.at(-1) ?? normalized;
}

/**
 * Extracts the parent folder path from a relative path.
 *
 * @param relativePath Relative project path.
 * @returns The parent folder path, or `null` for root-level entries.
 */
export function getParentFolderPath(relativePath: string): string | null {
  const normalized = normalizePathInput(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  return normalized.slice(0, slashIndex);
}

/**
 * Formats a drag-and-drop destination label for the UI.
 *
 * @param relativeFolderPath Relative destination folder path.
 * @returns The folder path, or `"project root"` for the root destination.
 */
export function getDropDestinationLabel(relativeFolderPath: string): string {
  if (relativeFolderPath.length > 0) {
    return relativeFolderPath;
  }

  return "project root";
}

/**
 * Preserves the original file extension when a rename only changes the basename.
 *
 * @param newName New basename entered by the user.
 * @param originalPath Existing file path.
 * @returns The new name with the original extension restored when needed.
 */
export function withOriginalFileExtension(newName: string, originalPath: string): string {
  const originalBaseName = getBaseName(originalPath);
  const extensionIndex = originalBaseName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < originalBaseName.length - 1;
  const newNameHasExtension = /\.[^./\\]+$/.test(newName);

  if (!hasExtension || newNameHasExtension) {
    return newName;
  }

  return `${newName}${originalBaseName.slice(extensionIndex)}`;
}

/**
 * Builds a sibling path next to an existing entry.
 *
 * @param relativePath Existing relative path.
 * @param nextName New basename for the sibling entry.
 * @returns A relative path in the same parent folder.
 */
export function buildSiblingPath(relativePath: string, nextName: string): string {
  const parentPath = getParentFolderPath(relativePath);
  return parentPath ? `${parentPath}/${nextName}` : nextName;
}
