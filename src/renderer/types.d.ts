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

type WitApi = {
  getPlatform: () => NodeJS.Platform;
  selectProject: () => Promise<ProjectMetadata | null>;
  getActiveProject: () => Promise<ProjectMetadata | null>;
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
  autosaveTick: (activeSeconds: number) => Promise<AutosaveTickResult>;
  getAppVersion: () => Promise<string>;
  onMenuOpenProject: (listener: () => void) => Unsubscribe;
  onMenuSaveCurrentFile: (listener: () => void) => Unsubscribe;
  onMenuZoomInText: (listener: () => void) => Unsubscribe;
  onMenuZoomOutText: (listener: () => void) => Unsubscribe;
  onMenuZoomResetText: (listener: () => void) => Unsubscribe;
  onMenuToggleSidebar: (listener: () => void) => Unsubscribe;
};

declare global {
  interface Window {
    witApi: WitApi;
  }
}

export {};
