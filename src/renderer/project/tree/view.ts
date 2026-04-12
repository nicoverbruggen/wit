import type { ProjectMetadata } from "../../../shared/types";
import { pathEquals } from "../../../shared/utils.js";
import { buildProjectTree, type TreeNode } from "../../shared/tree-model.js";

/**
 * Owns: rendering and DOM event wiring for the project tree list (root, folders, files).
 * Out of scope: business actions (open/save/delete/rename/move implementations) and state persistence.
 * Inputs/Outputs: renderer state snapshot + callbacks in, tree DOM interactions out via callbacks.
 * Side effects: mutates `listElement` DOM subtree and registers event listeners on created nodes.
 */

export type ProjectTreeSelectionKind = "file" | "folder";

export type ProjectTreeCallbacks = {
  onBeforeInteraction: () => void;
  onProjectRootClick: (closingCurrentFile: boolean) => void;
  onFolderClick: (relativePath: string, isCollapsed: boolean) => void;
  onFileClick: (relativePath: string) => void;
  onMoveFileToFolder: (sourcePath: string, toFolderRelativePath: string) => void | Promise<void>;
  onDragSourceChange: (sourcePath: string | null) => void;
};

export type RenderProjectTreeListOptions = {
  listElement: HTMLUListElement;
  project: ProjectMetadata | null;
  selectedTreePath: string | null;
  selectedTreeKind: ProjectTreeSelectionKind | null;
  currentFilePath: string | null;
  dirty: boolean;
  collapsedFolderPaths: Set<string>;
  maxTreeIndent: number;
  getProjectDisplayTitle: (projectPath: string) => string;
  getDragSourceFilePath: () => string | null;
  callbacks: ProjectTreeCallbacks;
};

function toIndentClass(depth: number, maxTreeIndent: number): string {
  return `tree-indent-${Math.min(depth, maxTreeIndent)}`;
}

function clearDropTargets(listElement: HTMLUListElement): void {
  listElement.querySelectorAll(".drop-target").forEach((element) => {
    element.classList.remove("drop-target");
  });
}

function resolveDraggedSourcePath(
  event: DragEvent,
  getDragSourceFilePath: () => string | null
): string | null {
  return event.dataTransfer?.getData("text/wit-file-path") || getDragSourceFilePath();
}

function renderTreeNodes(options: RenderProjectTreeListOptions, nodes: TreeNode[], depth: number): void {
  for (const node of nodes) {
    if (node.kind === "folder") {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const disclosure = document.createElement("span");
      const icon = document.createElement("span");
      const label = document.createElement("span");
      const isCollapsed = options.collapsedFolderPaths.has(node.relativePath);

      button.type = "button";
      const selectedClass =
        options.selectedTreeKind === "folder" && options.selectedTreePath === node.relativePath ? "active" : "";
      button.className = ["tree-item", "folder-button", toIndentClass(depth, options.maxTreeIndent), selectedClass]
        .filter(Boolean)
        .join(" ");
      button.dataset.relativePath = node.relativePath;
      button.dataset.itemKind = "folder";
      button.title = node.relativePath;
      button.setAttribute("aria-expanded", String(!isCollapsed));
      disclosure.className = "material-symbol-icon tree-disclosure";
      disclosure.textContent = isCollapsed ? "chevron_right" : "expand_more";
      disclosure.setAttribute("aria-hidden", "true");
      icon.className = "material-symbol-icon folder-icon";
      icon.textContent = isCollapsed ? "folder" : "folder_open";
      icon.setAttribute("aria-hidden", "true");
      label.className = "tree-label";
      label.textContent = node.name;

      button.append(disclosure, icon, label);
      button.addEventListener("click", () => {
        options.callbacks.onBeforeInteraction();
        options.callbacks.onFolderClick(node.relativePath, isCollapsed);
      });
      button.addEventListener("dragenter", () => {
        if (!options.getDragSourceFilePath()) {
          return;
        }

        button.classList.add("drop-target");
      });
      button.addEventListener("dragover", (event) => {
        if (!options.getDragSourceFilePath() && !event.dataTransfer?.types.includes("text/wit-file-path")) {
          return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        button.classList.add("drop-target");
      });
      button.addEventListener("dragleave", () => {
        button.classList.remove("drop-target");
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        button.classList.remove("drop-target");
        const sourcePath = resolveDraggedSourcePath(event, options.getDragSourceFilePath);

        if (!sourcePath) {
          return;
        }

        void options.callbacks.onMoveFileToFolder(sourcePath, node.relativePath);
      });

      item.appendChild(button);
      options.listElement.appendChild(item);

      if (!isCollapsed) {
        renderTreeNodes(options, node.children, depth + 1);
      }

      continue;
    }

    const item = document.createElement("li");
    const button = document.createElement("button");
    const disclosurePlaceholder = document.createElement("span");
    const icon = document.createElement("span");
    const label = document.createElement("span");
    const marker = document.createElement("span");
    const isCurrentFile = options.currentFilePath !== null && pathEquals(options.currentFilePath, node.relativePath);

    button.type = "button";
    const selectedClass =
      options.selectedTreeKind === "file" && options.selectedTreePath === node.relativePath ? "active" : "";
    const currentFileClass = isCurrentFile ? "current-file" : "";
    const rootFileClass = depth === 0 ? "tree-root-file" : "";
    button.className = [
      "tree-item",
      "file-button",
      toIndentClass(depth, options.maxTreeIndent),
      selectedClass,
      currentFileClass,
      rootFileClass
    ]
      .filter(Boolean)
      .join(" ");
    button.dataset.relativePath = node.relativePath;
    button.dataset.itemKind = "file";
    button.draggable = true;
    button.title = node.relativePath;
    disclosurePlaceholder.className = "tree-disclosure-placeholder";
    disclosurePlaceholder.setAttribute("aria-hidden", "true");
    icon.className = "material-symbol-icon file-icon";
    icon.textContent = node.name.endsWith(".md") ? "markdown" : "description";
    icon.setAttribute("aria-hidden", "true");
    label.className = "tree-label";
    label.textContent = node.name;
    marker.className = "active-file-marker";
    marker.hidden = !isCurrentFile;
    marker.dataset.dirty = String(isCurrentFile && options.dirty);
    marker.setAttribute("aria-hidden", "true");

    button.append(disclosurePlaceholder, icon, label, marker);
    button.addEventListener("click", () => {
      options.callbacks.onBeforeInteraction();
      options.callbacks.onFileClick(node.relativePath);
    });
    button.addEventListener("dragstart", (event) => {
      options.callbacks.onBeforeInteraction();
      options.callbacks.onDragSourceChange(node.relativePath);
      button.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/wit-file-path", node.relativePath);
      }
    });
    button.addEventListener("dragend", () => {
      options.callbacks.onDragSourceChange(null);
      button.classList.remove("dragging");
      clearDropTargets(options.listElement);
    });

    item.appendChild(button);
    options.listElement.appendChild(item);
  }
}

/**
 * Renders the full project tree sidebar list and wires interactions to callbacks.
 *
 * @param options Renderer state and callback dependencies for tree rendering.
 */
export function renderProjectTreeList(options: RenderProjectTreeListOptions): void {
  options.listElement.innerHTML = "";

  if (!options.project) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Open a project to start writing.";
    emptyItem.className = "empty-state";
    options.listElement.appendChild(emptyItem);
    return;
  }

  const rootItem = document.createElement("li");
  const rootButton = document.createElement("button");
  const rootIcon = document.createElement("span");
  const rootLabel = document.createElement("span");
  const selectedRootClass = options.selectedTreeKind === "folder" && options.selectedTreePath === "" ? "active" : "";

  rootButton.type = "button";
  rootButton.className = ["tree-item", "folder-button", "tree-root-item", selectedRootClass].filter(Boolean).join(" ");
  rootButton.dataset.relativePath = "";
  rootButton.dataset.itemKind = "project";
  rootButton.title = options.project.projectPath;
  rootIcon.className = "material-symbol-icon folder-icon";
  rootIcon.textContent = "workspaces";
  rootIcon.setAttribute("aria-hidden", "true");
  rootLabel.className = "tree-label";
  const rootLabelTitle = document.createElement("strong");
  rootLabelTitle.textContent = "Project";
  const rootLabelName = document.createElement("span");
  rootLabelName.className = "tree-root-project-name";
  rootLabelName.textContent = ` (${options.getProjectDisplayTitle(options.project.projectPath)})`;
  rootLabel.append(rootLabelTitle, rootLabelName);

  const rootSpacer = document.createElement("span");
  rootSpacer.setAttribute("aria-hidden", "true");
  rootButton.append(rootSpacer, rootIcon, rootLabel);

  rootButton.addEventListener("click", () => {
    const closingCurrentFile =
      options.selectedTreePath === "" && options.selectedTreeKind === "folder" && options.currentFilePath !== null;

    options.callbacks.onBeforeInteraction();
    options.callbacks.onProjectRootClick(closingCurrentFile);
  });
  rootButton.addEventListener("dragenter", () => {
    if (!options.getDragSourceFilePath()) {
      return;
    }

    rootButton.classList.add("drop-target");
  });
  rootButton.addEventListener("dragover", (event) => {
    if (!options.getDragSourceFilePath() && !event.dataTransfer?.types.includes("text/wit-file-path")) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    rootButton.classList.add("drop-target");
  });
  rootButton.addEventListener("dragleave", () => {
    rootButton.classList.remove("drop-target");
  });
  rootButton.addEventListener("drop", (event) => {
    event.preventDefault();
    rootButton.classList.remove("drop-target");
    const sourcePath = resolveDraggedSourcePath(event, options.getDragSourceFilePath);

    if (!sourcePath) {
      return;
    }

    void options.callbacks.onMoveFileToFolder(sourcePath, "");
  });

  rootItem.appendChild(rootButton);
  options.listElement.appendChild(rootItem);

  const separator = document.createElement("li");
  separator.className = "tree-root-separator";
  separator.setAttribute("aria-hidden", "true");
  options.listElement.appendChild(separator);

  if (options.project.files.length === 0 && options.project.folders.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No files yet. Create one with New File or add a folder.";
    emptyItem.className = "empty-state";
    options.listElement.appendChild(emptyItem);
    return;
  }

  renderTreeNodes(options, buildProjectTree(options.project.files, options.project.folders), 0);
}
