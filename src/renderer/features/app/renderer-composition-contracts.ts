/**
 * Owns: shared renderer composition callback contracts used across action and composition wiring.
 * Out of scope: controller implementation details and DOM orchestration.
 * Inputs/Outputs: type-only callback surfaces for composed renderer features.
 * Side effects: none.
 */
import type { AppSettings } from "../../../shared/types";

/**
 * Captures the callback surface passed from renderer actions into controller composition.
 */
export type RendererCompositionCallbacks = {
  setStatus: (message: string, clearAfterMs?: number) => void;
  syncSettingsInputs: (settings: AppSettings) => void;
  renderStatusFooter: () => void;
  renderEditorHeaderVisibility: () => void;
  restartAutosaveTimer: () => void;
  isUserTyping: () => boolean;
  waitForTypingPause: () => Promise<void>;
  runAutosaveTick: () => Promise<void>;
  closeTreeContextMenu: () => void;
  refreshEditorLayout: () => void;
  showEditorWidthGuides: () => void;
  clearEditorWidthGuides: () => void;
  getProjectDisplayTitle: (projectPath: string) => string;
  setSidebarFaded: (nextFaded: boolean) => void;
  closeCurrentFile: () => Promise<void>;
  openFile: (relativePath: string) => Promise<void>;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  resetActiveFile: () => void;
  setDirty: (nextDirty: boolean) => void;
  renderFileList: () => void;
  setEditorWritable: (enabled: boolean) => void;
  renderEmptyEditorState: () => void;
  consumeActiveTypingSeconds: () => number;
  stopSidebarResize: () => void;
  syncProjectPathLabels: (projectPath: string) => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  setEditorZoomFromPercent: (percent: number, showStatus?: boolean) => void;
  populateFontSelect: (selectedFont: string) => void;
  applyEditorFont: (fontFamily: string) => void;
  cancelPendingLiveWordCount: () => void;
  scheduleLiveWordCountRefresh: () => void;
  primaryShortcutLabel: (key: string) => string;
  parseSnapshotTimestamp: (snapshotName: string) => number | null;
  persistSettings: (update: Partial<AppSettings>) => Promise<void>;
};
