/**
 * Owns: shared IPC channel names and the preload-exposed renderer API contract.
 * Out of scope: channel handler implementation and renderer state management.
 * Inputs/Outputs: typed payload contracts in, Promise-based IPC surface definitions out.
 * Side effects: none at runtime beyond exporting shared constants and types.
 */
import type {
  AppInfo,
  AppSettings,
  AutosaveTickResult,
  DeleteEntryPayload,
  MoveFilePayload,
  NewFilePayload,
  NewFolderPayload,
  ProjectMetadata,
  RenameEntryPayload,
  ShowTreeContextMenuPayload,
  TreeContextAction
} from "./types";

export const IPC_CHANNELS = {
  project: {
    select: "project:select",
    getActive: "project:get-active",
    initializeGitRepository: "project:initialize-git-repository",
    close: "project:close",
    exitSnapshot: "project:exit-snapshot",
    openPath: "project:open-path",
    openFile: "project:open-file",
    saveFile: "project:save-file",
    getWordCount: "project:get-word-count",
    countPreviewWords: "project:count-preview-words",
    saveFileSync: "project:save-file-sync",
    newFile: "project:new-file",
    newFolder: "project:new-folder",
    deleteEntry: "project:delete-entry",
    renameEntry: "project:rename-entry",
    moveFile: "project:move-file",
    showTreeContextMenu: "project:show-tree-context-menu",
    updateSettings: "project:update-settings",
    setLastOpenedFilePath: "project:set-last-opened-file-path",
    autosaveTick: "project:autosave-tick"
  },
  window: {
    toggleFullscreen: "window:toggle-fullscreen",
    fullscreenChanged: "window:fullscreen-changed"
  },
  app: {
    version: "app:version",
    info: "app:info"
  },
  menu: {
    openProject: "menu:open-project",
    closeProject: "menu:close-project",
    newFile: "menu:new-file",
    newFolder: "menu:new-folder",
    projectSettings: "menu:project-settings",
    saveCurrentFile: "menu:save-current-file",
    zoomInText: "menu:zoom-in-text",
    zoomOutText: "menu:zoom-out-text",
    zoomResetText: "menu:zoom-reset-text",
    toggleSidebar: "menu:toggle-sidebar"
  }
} as const;

/**
 * Removes a previously registered renderer listener.
 */
export type Unsubscribe = () => void;

/**
 * Declares the preload API exposed to the renderer.
 *
 * The renderer relies on this contract matching the preload implementation exactly.
 */
export type WitApi = {
  getPlatform: () => string;
  selectProject: () => Promise<ProjectMetadata | null>;
  getActiveProject: () => Promise<ProjectMetadata | null>;
  initializeGitRepository: () => Promise<ProjectMetadata>;
  closeProject: () => Promise<null>;
  exitSnapshot: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  openProjectPath: (projectPath: string) => Promise<ProjectMetadata>;
  openFile: (relativePath: string) => Promise<string>;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  getWordCount: () => Promise<number>;
  countPreviewWords: (text: string) => Promise<number>;
  saveFileSync: (relativePath: string, content: string) => boolean;
  newFile: (payload: NewFilePayload) => Promise<string[]>;
  newFolder: (payload: NewFolderPayload) => Promise<string[]>;
  deleteEntry: (payload: DeleteEntryPayload) => Promise<ProjectMetadata>;
  renameEntry: (payload: RenameEntryPayload) => Promise<{ nextRelativePath: string; metadata: ProjectMetadata }>;
  moveFile: (payload: MoveFilePayload) => Promise<{ nextFilePath: string; metadata: ProjectMetadata }>;
  showTreeContextMenu: (payload: ShowTreeContextMenuPayload) => Promise<TreeContextAction | null>;
  updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  setLastOpenedFilePath: (relativePath: string | null) => Promise<string | null>;
  autosaveTick: (activeSeconds: number) => Promise<AutosaveTickResult>;
  getAppVersion: () => Promise<string>;
  getAppInfo: () => Promise<AppInfo>;
  onMenuOpenProject: (listener: () => void) => Unsubscribe;
  onMenuCloseProject: (listener: () => void) => Unsubscribe;
  onMenuNewFile: (listener: () => void) => Unsubscribe;
  onMenuNewFolder: (listener: () => void) => Unsubscribe;
  onMenuProjectSettings: (listener: () => void) => Unsubscribe;
  onMenuSaveCurrentFile: (listener: () => void) => Unsubscribe;
  onMenuZoomInText: (listener: () => void) => Unsubscribe;
  onMenuZoomOutText: (listener: () => void) => Unsubscribe;
  onMenuZoomResetText: (listener: () => void) => Unsubscribe;
  onMenuToggleSidebar: (listener: () => void) => Unsubscribe;
  onFullscreenChanged: (listener: (isFullscreen: boolean) => void) => Unsubscribe;
};
