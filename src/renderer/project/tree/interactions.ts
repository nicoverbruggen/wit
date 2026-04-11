import type { TreeContextAction } from "../../../shared/types";
import { pathEquals } from "../../../shared/utils.js";
import { bindProjectTreeContextMenu } from "./context-menu.js";
import type { ProjectTreeCallbacks, ProjectTreeSelectionKind } from "./view.js";

/**
 * Owns: orchestration logic for project-tree interactions and context-menu actions.
 * Out of scope: low-level tree DOM rendering and file-system business operations.
 * Inputs/Outputs: callbacks and state accessors in, action invocations out.
 * Side effects: binds context-menu listeners and invokes provided async handlers.
 */

export type ProjectTreeControllerState = {
  getSelectedTreePath: () => string | null;
  setSelectedTreePath: (value: string | null) => void;
  getSelectedTreeKind: () => ProjectTreeSelectionKind | null;
  setSelectedTreeKind: (value: ProjectTreeSelectionKind | null) => void;
  getCurrentFilePath: () => string | null;
  getDragSourceFilePath: () => string | null;
  setDragSourceFilePath: (value: string | null) => void;
};

export type ProjectTreeControllerActions = {
  closeTreeContextMenu: () => void;
  setSidebarFaded: (faded: boolean) => void;
  renderFileList: () => void;
  saveCollapsedFolders: () => void;
  closeCurrentFile: () => Promise<void>;
  openFile: (relativePath: string) => Promise<void>;
  moveFileToFolder: (sourcePath: string, toFolderRelativePath: string) => Promise<void>;
};

/**
 * Creates callbacks consumed by the project-tree view renderer.
 *
 * @param options Shared state and actions used by tree click/drag behavior.
 * @returns Callback object passed to `renderProjectTreeList`.
 */
export function createProjectTreeRenderCallbacks(options: {
  state: ProjectTreeControllerState;
  collapsedFolderPaths: Set<string>;
  actions: ProjectTreeControllerActions;
}): ProjectTreeCallbacks {
  return {
    onBeforeInteraction: options.actions.closeTreeContextMenu,
    onProjectRootClick: (closingCurrentFile) => {
      options.state.setSelectedTreePath("");
      options.state.setSelectedTreeKind("folder");
      options.actions.setSidebarFaded(false);

      if (closingCurrentFile) {
        void options.actions.closeCurrentFile();
        return;
      }

      options.actions.renderFileList();
    },
    onFolderClick: (relativePath, isCollapsed) => {
      if (
        options.state.getSelectedTreePath() === relativePath &&
        options.state.getSelectedTreeKind() === "folder" &&
        !isCollapsed
      ) {
        options.collapsedFolderPaths.add(relativePath);
      } else {
        options.collapsedFolderPaths.delete(relativePath);
      }

      options.state.setSelectedTreePath(relativePath);
      options.state.setSelectedTreeKind("folder");
      options.actions.saveCollapsedFolders();
      options.actions.setSidebarFaded(false);
      options.actions.renderFileList();
    },
    onFileClick: (relativePath) => {
      options.state.setSelectedTreePath(relativePath);
      options.state.setSelectedTreeKind("file");
      void options.actions.openFile(relativePath);
    },
    onMoveFileToFolder: (sourcePath, toFolderRelativePath) => {
      void options.actions.moveFileToFolder(sourcePath, toFolderRelativePath);
    },
    onDragSourceChange: (sourcePath) => {
      options.state.setDragSourceFilePath(sourcePath);
    }
  };
}

export type ProjectTreeContextMenuControllerOptions = {
  listElement: HTMLUListElement;
  state: ProjectTreeControllerState;
  consumeTestTreeContextAction: () => TreeContextAction | undefined;
  showTreeContextMenu: (payload: {
    relativePath: string;
    kind: "project" | "file" | "folder";
    x: number;
    y: number;
    isCurrentFile?: boolean;
    testAction?: TreeContextAction;
  }) => Promise<TreeContextAction | null>;
  createNewFile: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  closeCurrentProject: () => Promise<void>;
  deleteEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  closeCurrentFile: () => Promise<void>;
  renameEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  closeTreeContextMenu: () => void;
  renderFileList: () => void;
  setSidebarFaded: (faded: boolean) => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
};

/**
 * Binds project-tree context-menu behavior and returns a cleanup callback.
 *
 * @param options State accessors and action handlers used by context-menu flows.
 * @returns Unsubscribe function that removes the bound DOM listener.
 */
export function bindProjectTreeContextMenuController(
  options: ProjectTreeContextMenuControllerOptions
): () => void {
  return bindProjectTreeContextMenu({
    listElement: options.listElement,
    onInvalidTarget: () => {
      options.closeTreeContextMenu();
    },
    onProjectTarget: ({ relativePath, x, y }) => {
      options.state.setSelectedTreePath("");
      options.state.setSelectedTreeKind("folder");
      options.renderFileList();
      options.setSidebarFaded(false);

      const testAction = options.consumeTestTreeContextAction();
      void (async () => {
        try {
          const action = await options.showTreeContextMenu({
            relativePath,
            kind: "project",
            x,
            y,
            testAction
          });

          if (action === "new-file") {
            await options.createNewFile();
            return;
          }

          if (action === "new-folder") {
            await options.createNewFolder();
            return;
          }

          if (action === "close-project") {
            await options.closeCurrentProject();
          }
        } catch {
          options.setStatus("Could not open project actions menu.");
        }
      })();
    },
    onNodeTarget: ({ relativePath, kind, x, y }) => {
      options.state.setSelectedTreePath(relativePath);
      options.state.setSelectedTreeKind(kind);
      options.renderFileList();
      options.setSidebarFaded(false);

      const testAction = options.consumeTestTreeContextAction();
      void (async () => {
        try {
          const action = await options.showTreeContextMenu({
            relativePath,
            kind,
            isCurrentFile:
              kind === "file" &&
              options.state.getCurrentFilePath() !== null &&
              pathEquals(options.state.getCurrentFilePath() ?? "", relativePath),
            x,
            y,
            testAction
          });

          if (action === "new-file") {
            await options.createNewFile();
            return;
          }

          if (action === "new-folder") {
            await options.createNewFolder();
            return;
          }

          if (action === "delete") {
            await options.deleteEntryByPath(relativePath, kind);
            return;
          }

          if (action === "close-file") {
            await options.closeCurrentFile();
            return;
          }

          if (action === "rename") {
            await options.renameEntryByPath(relativePath, kind);
          }
        } catch {
          options.setStatus("Could not open file actions menu.");
        }
      })();
    }
  });
}
