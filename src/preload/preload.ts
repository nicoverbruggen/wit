/**
 * Owns: preload-side IPC bridge exposure for the sandboxed renderer.
 * Out of scope: main-process IPC handlers and renderer state management.
 * Inputs/Outputs: Electron IPC requests in, a typed `witApi` object on `window` out.
 * Side effects: registers IPC listeners and exposes the preload API via `contextBridge`.
 */
import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type { Unsubscribe, WitApi } from "../shared/ipc";
type NodePlatform = typeof process.platform;

// Keep channel literals in preload so the sandboxed preload script has no local runtime imports.
const IPC_CHANNELS = {
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
    newFile: "menu:new-file",
    saveCurrentFile: "menu:save-current-file",
    zoomInText: "menu:zoom-in-text",
    zoomOutText: "menu:zoom-out-text",
    zoomResetText: "menu:zoom-reset-text",
    toggleSidebar: "menu:toggle-sidebar"
  }
} as const;

function createMenuListener(channel: string, listener: () => void): Unsubscribe {
  const wrappedListener = () => listener();

  ipcRenderer.on(channel, wrappedListener);
  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
}

const api: WitApi = {
  getPlatform: (): NodePlatform => process.platform,
  selectProject: () => ipcRenderer.invoke(IPC_CHANNELS.project.select),
  getActiveProject: () => ipcRenderer.invoke(IPC_CHANNELS.project.getActive),
  initializeGitRepository: () => ipcRenderer.invoke(IPC_CHANNELS.project.initializeGitRepository),
  closeProject: () => ipcRenderer.invoke(IPC_CHANNELS.project.close),
  exitSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.project.exitSnapshot),
  toggleFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.window.toggleFullscreen),
  openProjectPath: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.openPath, projectPath),
  openFile: (relativePath: string) => ipcRenderer.invoke(IPC_CHANNELS.project.openFile, relativePath),
  saveFile: (relativePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.project.saveFile, relativePath, content),
  getWordCount: () => ipcRenderer.invoke(IPC_CHANNELS.project.getWordCount),
  countPreviewWords: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.project.countPreviewWords, text),
  saveFileSync: (relativePath: string, content: string): boolean =>
    ipcRenderer.sendSync(IPC_CHANNELS.project.saveFileSync, relativePath, content),
  newFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.newFile, payload),
  newFolder: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.newFolder, payload),
  deleteEntry: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.deleteEntry, payload),
  renameEntry: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.renameEntry, payload),
  moveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.moveFile, payload),
  showTreeContextMenu: (payload) => ipcRenderer.invoke(IPC_CHANNELS.project.showTreeContextMenu, payload),
  updateSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.project.updateSettings, settings),
  setLastOpenedFilePath: (relativePath: string | null) => ipcRenderer.invoke(IPC_CHANNELS.project.setLastOpenedFilePath, relativePath),
  autosaveTick: (activeSeconds: number) => ipcRenderer.invoke(IPC_CHANNELS.project.autosaveTick, activeSeconds),
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.version),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.info),
  onMenuOpenProject: (listener: () => void): Unsubscribe => createMenuListener(IPC_CHANNELS.menu.openProject, listener),
  onMenuNewFile: (listener: () => void): Unsubscribe => createMenuListener(IPC_CHANNELS.menu.newFile, listener),
  onMenuSaveCurrentFile: (listener: () => void): Unsubscribe =>
    createMenuListener(IPC_CHANNELS.menu.saveCurrentFile, listener),
  onMenuZoomInText: (listener: () => void): Unsubscribe => createMenuListener(IPC_CHANNELS.menu.zoomInText, listener),
  onMenuZoomOutText: (listener: () => void): Unsubscribe =>
    createMenuListener(IPC_CHANNELS.menu.zoomOutText, listener),
  onMenuZoomResetText: (listener: () => void): Unsubscribe =>
    createMenuListener(IPC_CHANNELS.menu.zoomResetText, listener),
  onMenuToggleSidebar: (listener: () => void): Unsubscribe =>
    createMenuListener(IPC_CHANNELS.menu.toggleSidebar, listener),
  onFullscreenChanged: (listener: (isFullscreen: boolean) => void): Unsubscribe => {
    const channel = IPC_CHANNELS.window.fullscreenChanged;
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
