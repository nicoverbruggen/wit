/**
 * Owns: conversion from flat project file/folder paths into a nested tree model.
 * Out of scope: DOM rendering and tree interaction state.
 * Inputs/Outputs: flat relative path arrays in, sorted tree nodes out.
 * Side effects: none.
 */
/**
 * Represents a folder node in the sidebar tree model.
 */
export type FolderNode = {
  kind: "folder";
  name: string;
  relativePath: string;
  children: TreeNode[];
};

/**
 * Represents a file node in the sidebar tree model.
 */
export type FileNode = {
  kind: "file";
  name: string;
  relativePath: string;
};

/**
 * Represents any node in the sidebar tree model.
 */
export type TreeNode = FolderNode | FileNode;

function compareTreeNodes(left: TreeNode, right: TreeNode): number {
  if (left.kind !== right.kind) {
    return left.kind === "folder" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function insertPathIntoTree(root: FolderNode, filePath: string): void {
  const parts = filePath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }

  let parent = root;
  let accumulatedPath = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
    const isLeaf = index === parts.length - 1;

    if (isLeaf) {
      parent.children.push({
        kind: "file",
        name: part,
        relativePath: accumulatedPath
      });
      continue;
    }

    let folder = parent.children.find(
      (child): child is FolderNode => child.kind === "folder" && child.relativePath === accumulatedPath
    );

    if (!folder) {
      folder = {
        kind: "folder",
        name: part,
        relativePath: accumulatedPath,
        children: []
      };
      parent.children.push(folder);
    }

    parent = folder;
  }
}

function insertFolderIntoTree(root: FolderNode, folderPath: string): void {
  const parts = folderPath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }

  let parent = root;
  let accumulatedPath = "";

  for (const part of parts) {
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

    let folder = parent.children.find(
      (child): child is FolderNode => child.kind === "folder" && child.relativePath === accumulatedPath
    );

    if (!folder) {
      folder = {
        kind: "folder",
        name: part,
        relativePath: accumulatedPath,
        children: []
      };
      parent.children.push(folder);
    }

    parent = folder;
  }
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  const sorted = [...nodes].sort(compareTreeNodes);

  return sorted.map((node) => {
    if (node.kind === "folder") {
      return {
        ...node,
        children: sortTree(node.children)
      };
    }

    return node;
  });
}

/**
 * Builds a sorted tree model from flat project file and folder paths.
 *
 * @param paths Relative file paths in the project.
 * @param folders Relative folder paths in the project.
 * @returns Root-level tree nodes with nested children for folders.
 */
export function buildProjectTree(paths: string[], folders: string[]): TreeNode[] {
  const root: FolderNode = {
    kind: "folder",
    name: "",
    relativePath: "",
    children: []
  };

  for (const folderPath of folders) {
    insertFolderIntoTree(root, folderPath);
  }

  for (const filePath of paths) {
    insertPathIntoTree(root, filePath);
  }

  return sortTree(root.children);
}
