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

type WitApi = {
  getPlatform: () => NodePlatform;
  selectProject: () => Promise<ProjectMetadata | null>;
  getActiveProject: () => Promise<ProjectMetadata | null>;
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
  onMenuNewFile: (listener: () => void) => Unsubscribe;
  onMenuSaveCurrentFile: (listener: () => void) => Unsubscribe;
  onMenuZoomInText: (listener: () => void) => Unsubscribe;
  onMenuZoomOutText: (listener: () => void) => Unsubscribe;
  onMenuZoomResetText: (listener: () => void) => Unsubscribe;
  onMenuToggleSidebar: (listener: () => void) => Unsubscribe;
  onFullscreenChanged: (listener: (isFullscreen: boolean) => void) => Unsubscribe;
};

declare global {
  interface Window {
    witApi: WitApi;
  }
}

export {};
