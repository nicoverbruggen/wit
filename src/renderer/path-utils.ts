import { normalizePathInput } from "../shared/utils.js";

export function getBaseName(relativePath: string): string {
  const normalized = normalizePathInput(relativePath);
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts.at(-1) ?? normalized;
}

export function getParentFolderPath(relativePath: string): string | null {
  const normalized = normalizePathInput(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  return normalized.slice(0, slashIndex);
}

export function getDropDestinationLabel(relativeFolderPath: string): string {
  if (relativeFolderPath.length > 0) {
    return relativeFolderPath;
  }

  return "project root";
}

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

export function buildSiblingPath(relativePath: string, nextName: string): string {
  const parentPath = getParentFolderPath(relativePath);
  return parentPath ? `${parentPath}/${nextName}` : nextName;
}
