/**
 * Owns: DOM and window event binding for the renderer shell and editor host.
 * Out of scope: event handler business logic and project state persistence internals.
 * Inputs/Outputs: DOM nodes and callback adapters in, listener side effects out.
 * Side effects: registers global/window listeners and renderer cleanup hooks.
 */
import type { TreeContextAction } from "../../../shared/types";
import {
  bindProjectTreeContextMenuController,
  type ProjectTreeControllerState
} from "../project-tree/project-tree-controller.js";
import type { ProjectTreeSelectionKind } from "../project-tree/project-tree-view.js";

type EditorEventAdapter = {
  onInput: (listener: () => void) => () => void;
  onKeydown: (listener: (event: KeyboardEvent) => void) => () => void;
  onBlur: (listener: () => void) => () => void;
  destroy: () => void;
};

/**
 * Binds renderer DOM events to the supplied action callbacks.
 *
 * @param options DOM nodes, renderer state, and action callbacks to connect.
 */
export function bindAppEventBindings(options: {
  openProjectButton: HTMLButtonElement;
  emptyStatePrimaryButton: HTMLButtonElement;
  emptyStateSecondaryButton: HTMLButtonElement;
  newFileButton: HTMLButtonElement;
  newFolderButton: HTMLButtonElement;
  toggleSidebarButton: HTMLButtonElement;
  sidebarResizer: HTMLDivElement;
  fullscreenToggleButton: HTMLButtonElement;
  sidebar: HTMLElement;
  fileList: HTMLUListElement;
  editor: EditorEventAdapter;
  getProject: () => unknown | null;
  onEditorInput: () => void;
  onEditorBlur: () => void;
  onEditorKeydown: (event: KeyboardEvent) => void;
  projectTreeState: ProjectTreeControllerState;
  closeTreeContextMenu: () => void;
  openProjectPicker: () => Promise<void>;
  createNewFile: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  toggleSidebarVisibility: () => void;
  beginSidebarResize: (pointerClientX: number) => void;
  isSidebarVisible: () => boolean;
  adjustSidebarWidth: (delta: number) => void;
  toggleFullscreen: () => Promise<boolean>;
  syncFullscreenToggleButton: (isFullscreen: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  addSubscription: (unsubscribe: () => void) => void;
  consumeTestTreeContextAction: () => TreeContextAction | undefined;
  showTreeContextMenu: (payload: {
    relativePath: string;
    kind: "project" | "file" | "folder";
    x: number;
    y: number;
    isCurrentFile?: boolean;
    testAction?: TreeContextAction;
  }) => Promise<TreeContextAction | null>;
  closeCurrentProject: () => Promise<void>;
  deleteEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  closeCurrentFile: () => Promise<void>;
  renameEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  renderFileList: () => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  cancelPendingLiveWordCount: () => void;
  saveCurrentFileSynchronously: () => void;
  stopSidebarResize: () => void;
  clearEditorWidthGuides: () => void;
  stopAutosaveController: () => void;
  stopSnapshotLabelController: () => void;
  destroySettingsDialogController: () => void;
  destroyEntryDialogController: () => void;
  cleanupSubscriptions: () => void;
  setDragSourceFilePath: (value: string | null) => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
}): void {
  options.openProjectButton.addEventListener("click", () => {
    options.closeTreeContextMenu();
    void options.openProjectPicker();
  });

  options.emptyStatePrimaryButton.addEventListener("click", () => {
    options.closeTreeContextMenu();

    if (!options.getProject()) {
      void options.openProjectPicker();
      return;
    }

    void options.createNewFile();
  });

  options.emptyStateSecondaryButton.addEventListener("click", () => {
    options.closeTreeContextMenu();

    if (!options.getProject()) {
      return;
    }

    void options.createNewFolder();
  });

  options.newFileButton.addEventListener("click", () => {
    options.closeTreeContextMenu();
    void options.createNewFile();
  });

  options.newFolderButton.addEventListener("click", () => {
    options.closeTreeContextMenu();
    void options.createNewFolder();
  });

  options.toggleSidebarButton.addEventListener("click", () => {
    options.closeTreeContextMenu();
    options.toggleSidebarVisibility();
  });

  options.sidebarResizer.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    options.closeTreeContextMenu();
    options.beginSidebarResize(event.clientX);
  });

  options.sidebarResizer.addEventListener("keydown", (event) => {
    if (!options.getProject() || !options.isSidebarVisible()) {
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    options.closeTreeContextMenu();
    const delta = event.key === "ArrowLeft" ? -20 : 20;
    options.adjustSidebarWidth(delta);
  });

  options.fullscreenToggleButton.addEventListener("click", () => {
    options.closeTreeContextMenu();
    void (async () => {
      try {
        const isFullscreen = await options.toggleFullscreen();
        options.syncFullscreenToggleButton(isFullscreen);
      } catch {
        options.setStatus("Could not toggle fullscreen.");
      }
    })();
  });

  options.addSubscription(
    options.editor.onInput(() => {
      options.onEditorInput();
    })
  );

  options.addSubscription(
    options.editor.onKeydown((event) => {
      options.onEditorKeydown(event);
    })
  );

  options.addSubscription(
    options.editor.onBlur(() => {
      options.onEditorBlur();
    })
  );

  options.sidebar.addEventListener("mouseenter", () => {
    options.setSidebarFaded(false);
  });

  options.sidebar.addEventListener("focusin", () => {
    options.setSidebarFaded(false);
  });

  options.addSubscription(
    bindProjectTreeContextMenuController({
      listElement: options.fileList,
      state: options.projectTreeState,
      consumeTestTreeContextAction: options.consumeTestTreeContextAction,
      showTreeContextMenu: options.showTreeContextMenu,
      createNewFile: options.createNewFile,
      createNewFolder: options.createNewFolder,
      closeCurrentProject: options.closeCurrentProject,
      deleteEntryByPath: options.deleteEntryByPath,
      closeCurrentFile: options.closeCurrentFile,
      renameEntryByPath: options.renameEntryByPath,
      closeTreeContextMenu: options.closeTreeContextMenu,
      renderFileList: options.renderFileList,
      setSidebarFaded: options.setSidebarFaded,
      setStatus: options.setStatus
    })
  );

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      options.closeTreeContextMenu();
      void options.persistCurrentFile(true);
    }
  });

  document.addEventListener("dragend", () => {
    options.setDragSourceFilePath(null);
    options.fileList.querySelectorAll(".drop-target").forEach((element) => {
      element.classList.remove("drop-target");
    });
  });

  document.addEventListener("drop", () => {
    options.setDragSourceFilePath(null);
  });

  window.addEventListener("beforeunload", () => {
    options.cancelPendingLiveWordCount();
    options.saveCurrentFileSynchronously();
    options.stopSidebarResize();
    options.clearEditorWidthGuides();
    options.closeTreeContextMenu();
    options.stopAutosaveController();
    options.stopSnapshotLabelController();
    options.destroySettingsDialogController();
    options.destroyEntryDialogController();
    options.cleanupSubscriptions();
    options.editor.destroy();
  });

  window.addEventListener("error", () => {
    options.closeTreeContextMenu();
    options.setStatus("A UI error occurred. Check logs.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled renderer rejection:", event.reason);
    options.closeTreeContextMenu();
    options.setStatus("An unexpected async error occurred.");
    event.preventDefault();
  });
}
