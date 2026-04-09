import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveIntervalSec: 60,
  theme: "light",
  showWordCount: false,
  showWritingTime: false,
  showCurrentFileBar: false,
  smartQuotes: true,
  gitSnapshots: false,
  gitPushRemote: null,
  editorLineHeight: 1.68,
  editorMaxWidthPx: 750,
  editorZoomPercent: 100,
  editorFontFamily: "iA Writer Mono"
};
