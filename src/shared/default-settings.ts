import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveIntervalSec: 60,
  showWordCount: true,
  showWritingTime: true,
  showCurrentFileBar: true,
  smartQuotes: true,
  gitSnapshots: false,
  gitPushRemote: null,
  editorLineHeight: 1.68,
  editorMaxWidthPx: 750,
  editorZoomPercent: 100,
  editorFontFamily: "Readerly"
};
