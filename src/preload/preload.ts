import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
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
} from "../shared/types";

type Unsubscribe = () => void;
type NodePlatform = typeof process.platform;

function createMenuListener(channel: string, listener: () => void): Unsubscribe {
  const wrappedListener = () => listener();

  ipcRenderer.on(channel, wrappedListener);
  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
}

const api = {
  getPlatform: (): NodePlatform => process.platform,
  selectProject: (): Promise<ProjectMetadata | null> => ipcRenderer.invoke("project:select"),
  getActiveProject: (): Promise<ProjectMetadata | null> => ipcRenderer.invoke("project:get-active"),
  closeProject: (): Promise<null> => ipcRenderer.invoke("project:close"),
  exitSnapshot: (): Promise<void> => ipcRenderer.invoke("project:exit-snapshot"),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke("window:toggle-fullscreen"),
  openProjectPath: (projectPath: string): Promise<ProjectMetadata> =>
    ipcRenderer.invoke("project:open-path", projectPath),
  openFile: (relativePath: string): Promise<string> =>
    ipcRenderer.invoke("project:open-file", relativePath),
  saveFile: (relativePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke("project:save-file", relativePath, content),
  getWordCount: (): Promise<number> => ipcRenderer.invoke("project:get-word-count"),
  countPreviewWords: (text: string): Promise<number> => ipcRenderer.invoke("project:count-preview-words", text),
  saveFileSync: (relativePath: string, content: string): boolean =>
    ipcRenderer.sendSync("project:save-file-sync", relativePath, content),
  newFile: (payload: NewFilePayload): Promise<string[]> => ipcRenderer.invoke("project:new-file", payload),
  newFolder: (payload: NewFolderPayload): Promise<string[]> =>
    ipcRenderer.invoke("project:new-folder", payload),
  deleteEntry: (payload: DeleteEntryPayload): Promise<ProjectMetadata> =>
    ipcRenderer.invoke("project:delete-entry", payload),
  renameEntry: (
    payload: RenameEntryPayload
  ): Promise<{ nextRelativePath: string; metadata: ProjectMetadata }> =>
    ipcRenderer.invoke("project:rename-entry", payload),
  moveFile: (
    payload: MoveFilePayload
  ): Promise<{ nextFilePath: string; metadata: ProjectMetadata }> =>
    ipcRenderer.invoke("project:move-file", payload),
  showTreeContextMenu: (payload: ShowTreeContextMenuPayload): Promise<TreeContextAction | null> =>
    ipcRenderer.invoke("project:show-tree-context-menu", payload),
  updateSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke("project:update-settings", settings),
  setLastOpenedFilePath: (relativePath: string | null): Promise<string | null> =>
    ipcRenderer.invoke("project:set-last-opened-file-path", relativePath),
  autosaveTick: (activeSeconds: number): Promise<AutosaveTickResult> =>
    ipcRenderer.invoke("project:autosave-tick", activeSeconds),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
  onMenuOpenProject: (listener: () => void): Unsubscribe => createMenuListener("menu:open-project", listener),
  onMenuNewFile: (listener: () => void): Unsubscribe => createMenuListener("menu:new-file", listener),
  onMenuSaveCurrentFile: (listener: () => void): Unsubscribe =>
    createMenuListener("menu:save-current-file", listener),
  onMenuZoomInText: (listener: () => void): Unsubscribe => createMenuListener("menu:zoom-in-text", listener),
  onMenuZoomOutText: (listener: () => void): Unsubscribe =>
    createMenuListener("menu:zoom-out-text", listener),
  onMenuZoomResetText: (listener: () => void): Unsubscribe =>
    createMenuListener("menu:zoom-reset-text", listener),
  onMenuToggleSidebar: (listener: () => void): Unsubscribe =>
    createMenuListener("menu:toggle-sidebar", listener),
  onFullscreenChanged: (listener: (isFullscreen: boolean) => void): Unsubscribe => {
    const channel = "window:fullscreen-changed";
    const wrappedListener = (_event: IpcRendererEvent, isFullscreen: boolean) => {
      listener(isFullscreen);
    };

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  }
};

contextBridge.exposeInMainWorld("witApi", api);
