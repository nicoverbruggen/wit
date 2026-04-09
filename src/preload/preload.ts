import { contextBridge, ipcRenderer } from "electron";
import type {
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
type AppInfo = {
  version: string;
  description: string;
  author: string;
  website: string;
};

const api = {
  getPlatform: (): NodeJS.Platform => process.platform,
  selectProject: (): Promise<ProjectMetadata | null> => ipcRenderer.invoke("project:select"),
  getActiveProject: (): Promise<ProjectMetadata | null> => ipcRenderer.invoke("project:get-active"),
  closeProject: (): Promise<null> => ipcRenderer.invoke("project:close"),
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
  autosaveTick: (activeSeconds: number): Promise<AutosaveTickResult> =>
    ipcRenderer.invoke("project:autosave-tick", activeSeconds),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
  onMenuOpenProject: (listener: () => void): Unsubscribe => {
    const channel = "menu:open-project";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuNewFile: (listener: () => void): Unsubscribe => {
    const channel = "menu:new-file";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuSaveCurrentFile: (listener: () => void): Unsubscribe => {
    const channel = "menu:save-current-file";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuZoomInText: (listener: () => void): Unsubscribe => {
    const channel = "menu:zoom-in-text";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuZoomOutText: (listener: () => void): Unsubscribe => {
    const channel = "menu:zoom-out-text";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuZoomResetText: (listener: () => void): Unsubscribe => {
    const channel = "menu:zoom-reset-text";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onMenuToggleSidebar: (listener: () => void): Unsubscribe => {
    const channel = "menu:toggle-sidebar";
    const wrappedListener = () => listener();

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  onFullscreenChanged: (listener: (isFullscreen: boolean) => void): Unsubscribe => {
    const channel = "window:fullscreen-changed";
    const wrappedListener = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => {
      listener(isFullscreen);
    };

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  }
};

contextBridge.exposeInMainWorld("witApi", api);
