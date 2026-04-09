export type AppSettings = {
  autosaveIntervalSec: number;
  showWordCount: boolean;
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

export type TreeContextAction = "rename" | "delete";

export type ShowTreeContextMenuPayload = {
  relativePath: string;
  kind: "file" | "folder";
  x: number;
  y: number;
  testAction?: TreeContextAction;
};
