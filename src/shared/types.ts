export type AppSettings = {
  autosaveIntervalSec: number;
  theme: "light" | "dark";
  defaultFileExtension: ".txt" | ".md" | ".wxt";
  showWordCount: boolean;
  showWritingTime: boolean;
  showCurrentFileBar: boolean;
  smartQuotes: boolean;
  gitSnapshots: boolean;
  gitPushRemote: string | null;
  editorLineHeight: number;
  editorParagraphSpacing: "none" | "tight" | "loose" | "very-loose";
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
  latestSnapshotCreatedAt: string | null;
  isGitRepository: boolean;
  gitRemotes: string[];
  settings: AppSettings;
  lastOpenedFilePath: string | null;
  hasStoredLastOpenedFilePath: boolean;
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

export type TreeContextAction = "new-file" | "new-folder" | "rename" | "delete" | "close-project" | "close-file";

export type ShowTreeContextMenuPayload = {
  relativePath: string;
  kind: "file" | "folder" | "project";
  isCurrentFile?: boolean;
  x: number;
  y: number;
  testAction?: TreeContextAction;
};
