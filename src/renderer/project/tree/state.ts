/**
 * Owns: project-tree selection, collapse state, drag source state, and render orchestration.
 * Out of scope: tree DOM event binding and project mutation behavior.
 * Inputs/Outputs: project/tree readers and callbacks in, tree state helpers out.
 * Side effects: mutates localStorage-backed collapsed-folder state and triggers tree rendering.
 */
import type { ProjectMetadata } from "../../../shared/types";
import {
  createProjectTreeRenderCallbacks,
  type ProjectTreeControllerState
} from "./interactions.js";
import {
  renderProjectTreeList,
  type ProjectTreeSelectionKind
} from "./view.js";

/**
 * Exposes project-tree state and render helpers.
 */
export type ProjectTreeStateController = {
  state: ProjectTreeControllerState;
  setSelectedTree: (relativePath: string | null, kind: ProjectTreeSelectionKind | null) => void;
  setSelectedTreeToFile: (relativePath: string) => void;
  getSelectedFolderPath: () => string | null;
  saveCollapsedFolders: () => void;
  restoreCollapsedFolders: () => void;
  resetTreeState: () => void;
  renderFileList: () => void;
  setDragSource: (path: string | null, kind: "file" | "folder" | null) => void;
};

/**
 * Creates the project-tree state controller.
 *
 * @param options Project readers and callbacks used for tree rendering and navigation.
 * @returns Tree state helpers used by composition and event bindings.
 */
export function createProjectTreeStateController(options: {
  fileList: HTMLUListElement;
  maxTreeIndent: number;
  getProject: () => ProjectMetadata | null;
  getCurrentFilePath: () => string | null;
  getDirty: () => boolean;
  getProjectDisplayTitle: (projectPath: string) => string;
  closeTreeContextMenu: () => void;
  setSidebarFaded: (faded: boolean) => void;
  closeCurrentFile: () => Promise<void>;
  openFile: (relativePath: string) => Promise<void>;
  moveFileToFolder: (sourcePath: string, toFolderRelativePath: string) => Promise<void>;
  moveFolderToFolder: (sourcePath: string, toFolderRelativePath: string) => Promise<void>;
}): ProjectTreeStateController {
  let selectedTreePath: string | null = null;
  let selectedTreeKind: ProjectTreeSelectionKind | null = null;
  let dragSourcePath: string | null = null;
  let dragSourceKind: "file" | "folder" | null = null;
  const collapsedFolderPaths = new Set<string>();

  const collapsedFoldersStorageKey = (): string | null => {
    const project = options.getProject();
    if (!project) {
      return null;
    }

    return `wit:collapsed:${project.projectPath}`;
  };

  const state: ProjectTreeControllerState = {
    getSelectedTreePath: () => selectedTreePath,
    setSelectedTreePath: (value) => {
      selectedTreePath = value;
    },
    getSelectedTreeKind: () => selectedTreeKind,
    setSelectedTreeKind: (value) => {
      selectedTreeKind = value;
    },
    getCurrentFilePath: () => options.getCurrentFilePath(),
    getDragSourcePath: () => dragSourcePath,
    getDragSourceKind: () => dragSourceKind,
    setDragSource: (path, kind) => {
      dragSourcePath = path;
      dragSourceKind = kind;
    }
  };

  function saveCollapsedFolders(): void {
    const key = collapsedFoldersStorageKey();
    if (!key) {
      return;
    }

    try {
      if (collapsedFolderPaths.size === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify([...collapsedFolderPaths]));
      }
    } catch {
      // localStorage may be unavailable; ignore silently.
    }
  }

  function restoreCollapsedFolders(): void {
    collapsedFolderPaths.clear();
    const key = collapsedFoldersStorageKey();
    if (!key) {
      return;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      for (const item of parsed) {
        if (typeof item === "string") {
          collapsedFolderPaths.add(item);
        }
      }
    } catch {
      // Ignore malformed data.
    }
  }

  function resetTreeState(): void {
    collapsedFolderPaths.clear();
    selectedTreePath = null;
    selectedTreeKind = null;
    dragSourcePath = null;
    dragSourceKind = null;
  }

  function renderFileList(): void {
    renderProjectTreeList({
      listElement: options.fileList,
      project: options.getProject(),
      selectedTreePath,
      selectedTreeKind,
      currentFilePath: options.getCurrentFilePath(),
      dirty: options.getDirty(),
      collapsedFolderPaths,
      maxTreeIndent: options.maxTreeIndent,
      getProjectDisplayTitle: options.getProjectDisplayTitle,
      getDragSourcePath: () => dragSourcePath,
      getDragSourceKind: () => dragSourceKind,
      callbacks: projectTreeRenderCallbacks
    });
  }

  const projectTreeRenderCallbacks = createProjectTreeRenderCallbacks({
    state,
    collapsedFolderPaths,
    actions: {
      closeTreeContextMenu: options.closeTreeContextMenu,
      setSidebarFaded: options.setSidebarFaded,
      renderFileList,
      saveCollapsedFolders,
      closeCurrentFile: options.closeCurrentFile,
      openFile: options.openFile,
      moveFileToFolder: options.moveFileToFolder,
      moveFolderToFolder: options.moveFolderToFolder
    }
  });

  const setSelectedTree = (relativePath: string | null, kind: ProjectTreeSelectionKind | null): void => {
    selectedTreePath = relativePath;
    selectedTreeKind = kind;
  };

  const setSelectedTreeToFile = (relativePath: string): void => {
    selectedTreePath = relativePath;
    selectedTreeKind = "file";
  };

  const getSelectedFolderPath = (): string | null => {
    if (selectedTreeKind === "folder" && selectedTreePath !== null) {
      return selectedTreePath;
    }

    return null;
  };

  return {
    state,
    setSelectedTree,
    setSelectedTreeToFile,
    getSelectedFolderPath,
    saveCollapsedFolders,
    restoreCollapsedFolders,
    resetTreeState,
    renderFileList,
    setDragSource: state.setDragSource
  };
}
