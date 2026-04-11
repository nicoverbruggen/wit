/**
 * Owns: the canonical default project settings used during initialization and fallback reads.
 * Out of scope: settings validation and persistence.
 * Inputs/Outputs: none; exports a stable default settings object.
 * Side effects: none.
 */
import type { AppSettings } from "./types";

/**
 * Defines the default per-project settings used when no persisted values exist.
 */
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
