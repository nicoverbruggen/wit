import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import { IPC_CHANNELS, type Unsubscribe, type WitApi } from "../shared/ipc";
type NodePlatform = typeof process.platform;

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
