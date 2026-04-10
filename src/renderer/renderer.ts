import type { AppSettings, ProjectMetadata, TreeContextAction } from "../shared/types";
import { normalizeEditorParagraphSpacing } from "../shared/utils.js";
import { formatRelativeElapsed, formatWritingTime, parseSnapshotTimestamp } from "./formatting.js";
import { createCodeMirrorEditor } from "./codemirror-editor-adapter.js";
import { formatPrimaryShortcut } from "./empty-state-shortcuts.js";
import { bootstrapAppController } from "./features/app/app-bootstrap-controller.js";
import { createRendererComposition } from "./features/app/renderer-composition.js";
import { resolveRendererDom } from "./features/app/renderer-dom.js";

const dom = resolveRendererDom();
const editor = createCodeMirrorEditor(dom.editorElement);
const {
  openProjectButton,
  newFileButton,
  newFolderButton,
  toggleSidebarButton,
  sidebarResizer,
  fullscreenToggleButton,
  sidebar,
  emptyStatePrimaryButton,
  emptyStateSecondaryButton,
  fileList,
  lineHeightInput,
  paragraphSpacingSelect,
  editorWidthInput,
  fontSelect
} = dom;

const EDITOR_ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 150, 175, 200, 225, 250];
const LIVE_WORD_COUNT_DEBOUNCE_MS = 280;
const MAX_TREE_INDENT = 4;
const SNAPSHOT_LABEL_REFRESH_MS = 15_000;
const DEFAULT_EDITOR_PLACEHOLDER = "Open a project and choose a text file to begin writing.";
const DEFAULT_STATUS_MESSAGE = "";
const SIDEBAR_WIDTH_STORAGE_KEY = "wit.sidebar-width";
const MIN_SIDEBAR_WIDTH_PX = 220;
const MAX_SIDEBAR_WIDTH_PX = 420;
const DEFAULT_SIDEBAR_WIDTH_PX = 270;
const BUILT_IN_EDITOR_FONTS = ["Sourcerer", "Readerly", "iA Writer Mono", "iA Writer Duo", "iA Writer Quattro"] as const;
const DEFAULT_EDITOR_FONT = "Readerly";

let project: ProjectMetadata | null = null;
let currentFilePath: string | null = null;
const TYPING_IDLE_THRESHOLD_MS = 5_000;
const AUTOSAVE_LENIENCY_THRESHOLD_SEC = 60;
const AUTOSAVE_LENIENCY_MAX_MS = 5_000;
const AUTOSAVE_LENIENCY_POLL_MS = 500;
let suppressDirtyEvents = false;
let isWindowFullscreen = false;

type TestWindowWithContextAction = Window & {
  __WIT_TEST_TREE_ACTION?: TreeContextAction;
};
const composition = createRendererComposition({
  dom,
  body: document.body,
  editor,
  witApi: window.witApi,
  config: {
    liveWordCountDebounceMs: LIVE_WORD_COUNT_DEBOUNCE_MS,
    typingIdleThresholdMs: TYPING_IDLE_THRESHOLD_MS,
    autosaveLeniencyThresholdSec: AUTOSAVE_LENIENCY_THRESHOLD_SEC,
    autosaveLeniencyMaxMs: AUTOSAVE_LENIENCY_MAX_MS,
    autosaveLeniencyPollMs: AUTOSAVE_LENIENCY_POLL_MS,
    snapshotLabelRefreshMs: SNAPSHOT_LABEL_REFRESH_MS,
    maxTreeIndent: MAX_TREE_INDENT,
    defaultEditorPlaceholder: DEFAULT_EDITOR_PLACEHOLDER,
    defaultStatusMessage: DEFAULT_STATUS_MESSAGE,
    sidebarWidthStorageKey: SIDEBAR_WIDTH_STORAGE_KEY,
    minSidebarWidthPx: MIN_SIDEBAR_WIDTH_PX,
    maxSidebarWidthPx: MAX_SIDEBAR_WIDTH_PX,
    defaultSidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
    builtInEditorFonts: BUILT_IN_EDITOR_FONTS,
    defaultEditorFont: DEFAULT_EDITOR_FONT,
    editorZoomPresets: EDITOR_ZOOM_PRESETS
  },
  state: {
    getProject: () => project,
    setProject: setProjectState,
    getCurrentFilePath: () => currentFilePath,
    setCurrentFilePath: setCurrentFilePathState,
    getSuppressDirtyEvents: () => suppressDirtyEvents,
    setSuppressDirtyEvents: (value) => {
      suppressDirtyEvents = value;
    },
    getIsWindowFullscreen: () => isWindowFullscreen,
    setIsWindowFullscreen: (nextValue) => {
      isWindowFullscreen = nextValue;
    }
  },
  callbacks: {
    setStatus,
    syncSettingsInputs,
    renderStatusFooter,
    restartAutosaveTimer,
    isUserTyping,
    waitForTypingPause,
    runAutosaveTick,
    closeTreeContextMenu,
    refreshEditorLayout,
    showEditorWidthGuides,
    clearEditorWidthGuides,
    getProjectDisplayTitle,
    setSidebarFaded,
    closeCurrentFile,
    openFile,
    persistCurrentFile,
    persistLastOpenedFilePath,
    resetActiveFile,
    setDirty,
    renderFileList,
    setEditorWritable,
    renderEmptyEditorState,
    consumeActiveTypingSeconds,
    stopSidebarResize,
    syncProjectPathLabels,
    setProjectControlsEnabled,
    setSidebarVisibility,
    applyTheme,
    applyEditorLineHeight,
    applyEditorParagraphSpacing,
    applyEditorMaxWidth,
    setEditorZoomFromPercent,
    populateFontSelect,
    applyEditorFont,
    cancelPendingLiveWordCount,
    scheduleLiveWordCountRefresh,
    primaryShortcutLabel,
    parseSnapshotTimestamp,
    persistSettings
  },
  formatting: {
    formatRelativeElapsed,
    formatWritingTime
  }
});

function setProjectState(nextProject: ProjectMetadata | null): void {
  project = nextProject;
}

function setCurrentFilePathState(nextFilePath: string | null): void {
  currentFilePath = nextFilePath;
}

function primaryShortcutLabel(key: string): string {
  return formatPrimaryShortcut(key, window.witApi.getPlatform());
}

function setStatus(message: string, clearAfterMs?: number): void {
  composition.appShellUiController.setStatus(message, clearAfterMs);
}

function renderSnapshotLabel(): void {
  composition.snapshotLabelController.render();
}

function restartSnapshotLabelTimer(): void {
  composition.snapshotLabelController.start();
}

function showEditorWidthGuides(): void {
  composition.editorPresentationController.showEditorWidthGuides();
}

function clearEditorWidthGuides(): void {
  composition.editorPresentationController.clearEditorWidthGuides();
}

function closeTreeContextMenu(): void {
  // Native context menus are managed by the operating system.
}

function consumeTestTreeContextAction(): TreeContextAction | undefined {
  const testWindow = window as TestWindowWithContextAction;
  const action = testWindow.__WIT_TEST_TREE_ACTION;
  delete testWindow.__WIT_TEST_TREE_ACTION;
  return action;
}

function consumeActiveTypingSeconds(): number {
  return composition.typingActivityTracker.consumeActiveSeconds();
}

function setDirty(nextDirty: boolean): void {
  composition.editorDirtyStateController.setDirty(nextDirty);
}

async function persistLastOpenedFilePath(relativePath: string | null): Promise<void> {
  await composition.projectPersistenceController.persistLastOpenedFilePath(relativePath);
}

function refreshEditorLayout(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function setProjectControlsEnabled(enabled: boolean): void {
  composition.appShellUiController.setProjectControlsEnabled(enabled);
}

function setSidebarFaded(nextFaded: boolean): void {
  composition.sidebarUiController.setSidebarFaded(nextFaded);
}

function loadSidebarWidthPreference(): void {
  composition.sidebarUiController.loadSidebarWidthPreference();
}

function syncSidebarToggleButton(): void {
  composition.sidebarUiController.syncSidebarToggleButton();
}

function syncFullscreenToggleButton(isFullscreen: boolean): void {
  composition.sidebarUiController.syncFullscreenToggleButton(isFullscreen);
}

function setSidebarVisibility(nextVisible: boolean, showStatus = true): void {
  composition.sidebarUiController.setSidebarVisibility(nextVisible, showStatus);
}

function toggleSidebarVisibility(): void {
  composition.sidebarUiController.toggleSidebarVisibility();
}

function stopSidebarResize(): void {
  composition.sidebarUiController.stopSidebarResize();
}

function beginSidebarResize(pointerClientX: number): void {
  composition.sidebarUiController.beginSidebarResize(pointerClientX);
}

async function loadAboutInfo(): Promise<void> {
  await composition.appShellUiController.loadAboutInfo();
}

function setEditorWritable(enabled: boolean): void {
  composition.editorPresentationController.setEditorWritable(enabled);
}

function applyEditorLineHeight(lineHeight: number): void {
  composition.editorPresentationController.applyEditorLineHeight(lineHeight);
}

function applyEditorParagraphSpacing(spacing: AppSettings["editorParagraphSpacing"]): void {
  composition.editorPresentationController.applyEditorParagraphSpacing(spacing);
}

function applyEditorMaxWidth(editorWidth: number): void {
  composition.editorPresentationController.applyEditorMaxWidth(editorWidth);
}

function applyEditorFont(fontFamily: string): void {
  composition.editorPresentationController.applyEditorFont(fontFamily);
}

function populateFontSelect(selectedFont: string): void {
  composition.editorPresentationController.populateFontSelect(selectedFont);
}

async function loadSystemFonts(): Promise<void> {
  await composition.editorPresentationController.loadSystemFonts();
}

function applyTheme(theme: AppSettings["theme"]): void {
  composition.editorPresentationController.applyTheme(theme);
}

function applyEditorZoom(showStatus = true): void {
  composition.editorPresentationController.applyEditorZoom(showStatus);
}

function setEditorZoomFromPercent(percent: number, showStatus = true): void {
  composition.editorPresentationController.setEditorZoomFromPercent(percent, showStatus);
}

function stepEditorZoom(direction: 1 | -1): void {
  composition.editorPresentationController.stepEditorZoom(direction);
}

function resetEditorZoom(): void {
  composition.editorPresentationController.resetEditorZoom();
}

function getProjectDisplayTitle(projectPath: string): string {
  const trimmed = projectPath.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments.at(-1) ?? projectPath;
}

function resetActiveFile(): void {
  composition.projectStateApplicationController.resetActiveFile();
}

async function closeCurrentFile(): Promise<void> {
  await composition.projectLifecycleController.closeCurrentFile();
}

function renderEmptyEditorState(): void {
  composition.emptyEditorStateController.renderEmptyEditorState();
}

function syncProjectPathLabels(projectPath: string): void {
  composition.projectUiController.syncProjectPathLabels(projectPath, project);
}

function renderStatusFooter(): void {
  composition.projectUiController.renderStatusFooter(project);
}

function renderFileList(): void {
  composition.projectTreeStateController.renderFileList();
}

function syncSettingsInputs(settings: AppSettings): void {
  composition.projectUiController.syncSettingsInputs(settings, project);
}

function applyProjectMetadata(metadata: ProjectMetadata): void {
  composition.projectStateApplicationController.applyProjectMetadata(metadata);
}

function cancelPendingLiveWordCount(): void {
  composition.fileSessionController.cancelPendingLiveWordCount();
}

function scheduleLiveWordCountRefresh(): void {
  composition.fileSessionController.scheduleLiveWordCountRefresh();
}

async function persistCurrentFile(showStatus = true): Promise<boolean> {
  return composition.fileSessionController.persistCurrentFile(showStatus);
}

function saveCurrentFileSynchronously(): void {
  composition.fileSessionController.saveCurrentFileSynchronously();
}

async function openFile(relativePath: string): Promise<void> {
  await composition.fileSessionController.openFile(relativePath);
}

function isUserTyping(): boolean {
  return composition.typingActivityTracker.isTyping();
}

function waitForTypingPause(): Promise<void> {
  return composition.typingActivityTracker.waitForPause({
    maxWaitMs: AUTOSAVE_LENIENCY_MAX_MS,
    pollMs: AUTOSAVE_LENIENCY_POLL_MS
  });
}

function restartAutosaveTimer(): void {
  composition.autosaveController.restart();
}

async function runAutosaveTick(): Promise<void> {
  await composition.fileSessionController.runAutosaveTick();
}

async function openProjectPicker(): Promise<void> {
  await composition.projectLifecycleController.openProjectPicker();
}

async function closeCurrentProject(): Promise<void> {
  await composition.projectLifecycleController.closeCurrentProject();
}

async function persistSettings(update: Partial<AppSettings>): Promise<void> {
  return composition.projectPersistenceController.persistSettings(update);
}

bootstrapAppController({
  body: document.body,
  witApi: window.witApi,
  openProjectButton,
  emptyStatePrimaryButton,
  emptyStateSecondaryButton,
  newFileButton,
  newFolderButton,
  toggleSidebarButton,
  sidebarResizer,
  fullscreenToggleButton,
  sidebar,
  fileList,
  editor,
  projectTreeState: composition.projectTreeStateController.state,
  getProject: () => project,
  onEditorInput: () => composition.editorInteractionsController.onEditorInput(),
  onEditorBlur: () => composition.editorInteractionsController.onEditorBlur(),
  onEditorKeydown: (event) => composition.editorInteractionsController.onEditorKeydown(event),
  closeTreeContextMenu,
  openProjectPicker,
  createNewFile: () => composition.projectEntryActionsController.createNewFile(),
  createNewFolder: () => composition.projectEntryActionsController.createNewFolder(),
  toggleSidebarVisibility,
  beginSidebarResize,
  isSidebarVisible: () => composition.sidebarController.isVisible(),
  adjustSidebarWidth: (delta) => composition.sidebarController.adjustWidth(delta),
  syncFullscreenToggleButton,
  setSidebarFaded,
  consumeTestTreeContextAction,
  closeCurrentProject,
  deleteEntryByPath: (relativePath, kind) => composition.projectEntryActionsController.deleteEntryByPath(relativePath, kind),
  closeCurrentFile,
  renameEntryByPath: (relativePath, kind) => composition.projectEntryActionsController.renameEntryByPath(relativePath, kind),
  renderFileList,
  persistCurrentFile,
  cancelPendingLiveWordCount,
  saveCurrentFileSynchronously,
  stopSidebarResize,
  clearEditorWidthGuides,
  stopAutosaveController: () => composition.autosaveController.stop(),
  stopSnapshotLabelController: () => composition.snapshotLabelController.stop(),
  destroySettingsDialogController: () => composition.settingsDialogController.destroy(),
  destroyEntryDialogController: () => composition.entryDialogController.destroy(),
  setDragSourceFilePath: composition.projectTreeStateController.setDragSourceFilePath,
  setStatus,
  defaultEditorFont: DEFAULT_EDITOR_FONT,
  lineHeightInput,
  paragraphSpacingSelect,
  editorWidthInput,
  fontSelect,
  loadAboutInfo,
  loadSidebarWidthPreference,
  setProjectControlsEnabled,
  setSettingsTab: (tab) => composition.settingsDialogController.setActiveTab(tab),
  syncSidebarToggleButton,
  setSidebarVisibility,
  setEditorWritable,
  populateFontSelect,
  applyTheme,
  applyEditorLineHeight,
  normalizeEditorParagraphSpacing,
  applyEditorParagraphSpacing,
  applyEditorMaxWidth,
  applyEditorZoom,
  applyEditorFont,
  renderSnapshotLabel,
  restartSnapshotLabelTimer,
  renderStatusFooter,
  renderEmptyEditorState,
  applyProjectMetadata,
  openFile,
  resetActiveFile,
  stepEditorZoom,
  resetEditorZoom,
  loadSystemFonts
});
