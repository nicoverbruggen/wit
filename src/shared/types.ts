export type AppSettings = {
  autosaveIntervalSec: number;
  showWordCount: boolean;
  smartQuotes: boolean;
  gitSnapshots: boolean;
};

export type ProjectMetadata = {
  projectPath: string;
  files: string[];
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
