export type FolderNode = {
  kind: "folder";
  name: string;
  relativePath: string;
  children: TreeNode[];
};

export type FileNode = {
  kind: "file";
  name: string;
  relativePath: string;
};

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
