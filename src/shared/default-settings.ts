import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveIntervalSec: 60,
  theme: "light",
  defaultFileExtension: ".txt",
  showWordCount: false,
  showWritingTime: false,
  showCurrentFileBar: false,
  smartQuotes: true,
  snapshotMaxSizeMb: 10,
  gitSnapshots: false,
  gitPushRemote: null,
  editorLineHeight: 1.68,
  editorParagraphSpacing: "none",
  editorMaxWidthPx: 750,
  editorZoomPercent: 100,
  editorFontFamily: "iA Writer Mono"
};
