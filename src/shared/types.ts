export type AppSettings = {
  autosaveIntervalSec: number;
  showWordCount: boolean;
  showWritingTime: boolean;
  smartQuotes: boolean;
  gitSnapshots: boolean;
  editorLineHeight: number;
  editorMaxWidthPx: number;
  editorZoomPercent: number;
  editorFontFamily: string;
};

export type ProjectMetadata = {
  projectPath: string;
  files: string[];
  folders: string[];
  wordCount: number;
  totalWritingSeconds: number;
  isGitRepository: boolean;
  settings: AppSettings;
};

export type AutosaveTickResult = {
  wordCount: number;
  totalWritingSeconds: number;
  snapshotCreatedAt: string;
};

export type NewFilePayload = {
  relativePath: string;
  initialContent?: string;
};

export type NewFolderPayload = {
  relativePath: string;
};

export type DeleteEntryPayload = {
  relativePath: string;
  kind: "file" | "folder";
};

export type MoveFilePayload = {
  fromRelativePath: string;
  toFolderRelativePath: string;
};

export type RenameEntryPayload = {
  relativePath: string;
  kind: "file" | "folder";
  nextRelativePath: string;
};

export type TreeContextAction = "new-file" | "new-folder" | "rename" | "delete" | "close-project";

export type ShowTreeContextMenuPayload = {
  relativePath: string;
  kind: "file" | "folder" | "project";
  x: number;
  y: number;
  testAction?: TreeContextAction;
};
