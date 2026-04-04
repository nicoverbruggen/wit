import type { AppSettings, AutosaveTickResult, NewFilePayload, ProjectMetadata } from "../shared/types";

type Unsubscribe = () => void;

type WitApi = {
  selectProject: () => Promise<ProjectMetadata | null>;
  getActiveProject: () => Promise<ProjectMetadata | null>;
  openProjectPath: (projectPath: string) => Promise<ProjectMetadata>;
  openFile: (relativePath: string) => Promise<string>;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  getWordCount: () => Promise<number>;
  saveFileSync: (relativePath: string, content: string) => boolean;
  newFile: (payload: NewFilePayload) => Promise<string[]>;
  updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  autosaveTick: (activeSeconds: number) => Promise<AutosaveTickResult>;
  getAppVersion: () => Promise<string>;
  onMenuOpenProject: (listener: () => void) => Unsubscribe;
  onMenuSaveCurrentFile: (listener: () => void) => Unsubscribe;
  onMenuZoomInText: (listener: () => void) => Unsubscribe;
  onMenuZoomOutText: (listener: () => void) => Unsubscribe;
  onMenuZoomResetText: (listener: () => void) => Unsubscribe;
};

declare global {
  interface Window {
    witApi: WitApi;
  }
}

export {};
