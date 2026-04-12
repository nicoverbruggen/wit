/**
 * Owns: shared domain payloads passed between the main process, preload, and renderer.
 * Out of scope: runtime validation and persistence logic.
 * Inputs/Outputs: serializable app and project shapes used across process boundaries.
 * Side effects: none.
 */
/**
 * Persists project-scoped editor and autosave preferences.
 */
export type AppSettings = {
  autosaveIntervalSec: number;
  theme: "light" | "dark";
  defaultFileExtension: ".txt" | ".md";
  showWordCount: boolean;
  showWritingTime: boolean;
  showCurrentFileBar: boolean;
  smartQuotes: boolean;
  snapshotMaxSizeMb: number;
  gitSnapshots: boolean;
  gitPushRemote: string | null;
  editorLineHeight: number;
  editorParagraphSpacing: "none" | "tight" | "loose" | "very-loose";
  editorCursorStyle: "wit-default" | "system-default" | "system-wide";
  editorMaxWidthPx: number;
  editorZoomPercent: number;
  editorFontFamily: string;
};

/**
 * Captures the active project's normalized state for renderer consumption.
 */
export type ProjectMetadata = {
  projectPath: string;
  files: string[];
  folders: string[];
  wordCount: number;
  totalWritingSeconds: number;
  latestSnapshotCreatedAt: string | null;
  isGitRepository: boolean;
  hasGitInitialCommit: boolean;
  gitRemotes: string[];
  settings: AppSettings;
  lastOpenedFilePath: string | null;
  hasStoredLastOpenedFilePath: boolean;
  configCorrupted: boolean;
};

/**
 * Describes the result of one autosave/snapshot tick.
 */
export type AutosaveTickResult = {
  wordCount: number;
  totalWritingSeconds: number;
  snapshotCreatedAt: string;
};

/**
 * Payload for creating a new project file.
 */
export type NewFilePayload = {
  relativePath: string;
  initialContent?: string;
};

/**
 * Payload for creating a new project folder.
 */
export type NewFolderPayload = {
  relativePath: string;
};

/**
 * Payload for deleting a file or folder.
 */
export type DeleteEntryPayload = {
  relativePath: string;
  kind: "file" | "folder";
};

/**
 * Payload for moving a file into another folder.
 */
export type MoveFilePayload = {
  fromRelativePath: string;
  toFolderRelativePath: string;
};

/**
 * Payload for renaming a file or folder.
 */
export type RenameEntryPayload = {
  relativePath: string;
  kind: "file" | "folder";
  nextRelativePath: string;
};

/**
 * Supported project-tree context menu actions returned from the main process.
 */
export type TreeContextAction = "new-file" | "new-folder" | "rename" | "delete" | "close-project" | "close-file";

/**
 * Coordinates a native tree context menu request.
 */
export type ShowTreeContextMenuPayload = {
  relativePath: string;
  kind: "file" | "folder" | "project";
  isCurrentFile?: boolean;
  x: number;
  y: number;
  testAction?: TreeContextAction;
};

/**
 * Static application metadata shown in the About panel.
 */
export type AppInfo = {
  version: string;
  description: string;
  author: string;
  website: string;
};
