import type { AppSettings, ProjectMetadata, TreeContextAction } from "../shared/types";
import { normalizeEditorParagraphSpacing } from "../shared/utils.js";
import { formatRelativeElapsed, formatWritingTime, parseSnapshotTimestamp } from "./formatting.js";
import { createCodeMirrorEditor } from "./codemirror-editor-adapter.js";
import { formatPrimaryShortcut } from "./empty-state-shortcuts.js";
import { createProjectTreeStateController } from "./features/project-tree/project-tree-state-controller.js";
import { createEntryDialogController } from "./features/project-tree/entry-dialog-controller.js";
import { createProjectEntryActionsController } from "./features/project-tree/project-entry-actions-controller.js";
import { createLiveWordCountTracker } from "./features/editor/live-word-count.js";
import { createEditorInteractionsController } from "./features/editor/editor-interactions-controller.js";
import { createEditorPresentationController } from "./features/editor/editor-presentation-controller.js";
import { createEditorDirtyStateController } from "./features/editor/editor-dirty-state-controller.js";
import { createFileSessionController } from "./features/editor/file-session-controller.js";
import { createTypingActivityTracker } from "./features/editor/typing-activity.js";
import { createAutosaveController } from "./features/autosave/autosave-controller.js";
import { createSnapshotLabelController } from "./features/autosave/snapshot-label-controller.js";
import { createSidebarController } from "./features/sidebar/sidebar-controller.js";
import { createSidebarUiController } from "./features/sidebar/sidebar-ui-controller.js";
import { createAppShellUiController } from "./features/app/app-shell-ui-controller.js";
import { bootstrapAppController } from "./features/app/app-bootstrap-controller.js";
import { resolveRendererDom } from "./features/app/renderer-dom.js";
import { createSettingsDialogController } from "./features/settings/settings-dialog-controller.js";
import { createProjectUiController } from "./features/project/project-ui-controller.js";
import { createProjectLifecycleController } from "./features/project/project-lifecycle-controller.js";
import { createProjectPersistenceController } from "./features/project/project-persistence-controller.js";
import { createProjectStateApplicationController } from "./features/project/project-state-application-controller.js";
import { createEmptyEditorStateController } from "./features/project/empty-editor-state-controller.js";

const dom = resolveRendererDom();
const editor = createCodeMirrorEditor(dom.editorElement);
const {
  openProjectButton, openProjectWrap, newFileButton, newFolderButton, projectActions, settingsToggleButton,
  fullscreenToggleButton, settingsDialog, settingsTabWriting, settingsTabEditor, settingsTabAutosave, settingsTabAbout,
  settingsPanelWriting, settingsPanelEditor, settingsPanelAutosave, settingsPanelAbout, appShell, toggleSidebarButton,
  sidebarResizer, sidebar, editorWrap, editorHeader, statusBar, emptyStateScreen, emptyStateEyebrow, emptyStateTitle,
  emptyStateDescription, emptyStatePrimaryButton, emptyStateSecondaryButton, emptyStateShortcutsLabel,
  emptyStateShortcutsList, sidebarProjectTitle, fileList, newFileDialog, newFilePathInput, newFileCancelButton,
  newFileCreateButton, newFileError, newFolderDialog, newFolderPathInput, newFolderCancelButton, newFolderCreateButton,
  newFolderError, renameEntryDialog, renameEntryTitle, renameEntryInput, renameEntryCancelButton, renameEntryConfirmButton,
  renameEntryError, projectPathLabel, activeFileLabel, dirtyIndicator, statusMessage, wordCountLabel, writingTimeLabel,
  snapshotLabel, showWordCountInput, showWritingTimeInput, showCurrentFileBarInput, smartQuotesInput,
  defaultFileExtensionSelect, gitSnapshotsInput, gitPushRemoteSelect, gitSnapshotsNotice, autosaveIntervalInput,
  snapshotMaxSizeInput, lineHeightInput, lineHeightValue, paragraphSpacingSelect, editorWidthInput, editorWidthValue,
  textZoomInput, textZoomValue, themeSelect, fontSelect, aboutVersion, aboutDescription, aboutAuthor, aboutWebsite
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
const appShellUiController = createAppShellUiController({
  projectActions,
  openProjectWrap,
  settingsToggleButton,
  newFileButton,
  newFolderButton,
  showWordCountInput,
  showWritingTimeInput,
  showCurrentFileBarInput,
  smartQuotesInput,
  gitSnapshotsInput,
  gitPushRemoteSelect,
  gitSnapshotsNotice,
  autosaveIntervalInput,
  snapshotMaxSizeInput,
  lineHeightInput,
  editorWidthInput,
  themeSelect,
  fontSelect,
  statusMessage,
  defaultStatusMessage: DEFAULT_STATUS_MESSAGE,
  aboutVersion,
  aboutDescription,
  aboutAuthor,
  aboutWebsite,
  getProject: () => project,
  getAppInfo: () => window.witApi.getAppInfo()
});
const projectPersistenceController = createProjectPersistenceController({
  getProject: () => project,
  setLastOpenedFilePath: (relativePath) => window.witApi.setLastOpenedFilePath(relativePath),
  updateSettings: (nextSettings) => window.witApi.updateSettings(nextSettings),
  syncSettingsInputs,
  renderStatusFooter,
  restartAutosaveTimer,
  setStatus
});
const editorDirtyStateController = createEditorDirtyStateController({
  dirtyIndicator,
  fileList,
  getCurrentFilePath: () => currentFilePath
});
const liveWordCountTracker = createLiveWordCountTracker(LIVE_WORD_COUNT_DEBOUNCE_MS);
const typingActivityTracker = createTypingActivityTracker(TYPING_IDLE_THRESHOLD_MS);
const snapshotLabelController = createSnapshotLabelController({
  element: snapshotLabel,
  refreshMs: SNAPSHOT_LABEL_REFRESH_MS,
  formatRelativeElapsed
});
const autosaveController = createAutosaveController({
  getIntervalSec: () => (project ? project.settings.autosaveIntervalSec : null),
  leniencyThresholdSec: AUTOSAVE_LENIENCY_THRESHOLD_SEC,
  isTyping: () => isUserTyping(),
  waitForPause: waitForTypingPause,
  onTick: runAutosaveTick
});
const sidebarController = createSidebarController({
  appShell,
  toggleButton: toggleSidebarButton,
  minWidthPx: MIN_SIDEBAR_WIDTH_PX,
  maxWidthPx: MAX_SIDEBAR_WIDTH_PX,
  defaultWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
  widthStorageKey: SIDEBAR_WIDTH_STORAGE_KEY
});
const sidebarUiController = createSidebarUiController({
  sidebarController,
  fullscreenToggleButton,
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  getIsWindowFullscreen: () => isWindowFullscreen,
  setIsWindowFullscreen: (nextValue) => {
    isWindowFullscreen = nextValue;
  },
  setStatus,
  applyEditorZoom
});
const editorPresentationController = createEditorPresentationController({
  editor,
  editorWrap,
  lineHeightInput,
  lineHeightValue,
  paragraphSpacingSelect,
  editorWidthInput,
  editorWidthValue,
  textZoomInput,
  textZoomValue,
  fontSelect,
  body: document.body,
  builtInEditorFonts: BUILT_IN_EDITOR_FONTS,
  defaultEditorFont: DEFAULT_EDITOR_FONT,
  zoomPresets: EDITOR_ZOOM_PRESETS,
  setStatus,
  persistZoomPercent: (percent) => {
    void persistSettings({ editorZoomPercent: percent });
  }
});
const settingsDialogController = createSettingsDialogController({
  dialog: settingsDialog,
  toggleButton: settingsToggleButton,
  tabs: {
    writing: { button: settingsTabWriting, panel: settingsPanelWriting },
    editor: { button: settingsTabEditor, panel: settingsPanelEditor },
    autosave: { button: settingsTabAutosave, panel: settingsPanelAutosave },
    about: { button: settingsTabAbout, panel: settingsPanelAbout }
  },
  inputs: {
    showWordCountInput,
    showWritingTimeInput,
    showCurrentFileBarInput,
    smartQuotesInput,
    defaultFileExtensionSelect,
    gitSnapshotsInput,
    gitPushRemoteSelect,
    autosaveIntervalInput,
    snapshotMaxSizeInput,
    lineHeightInput,
    paragraphSpacingSelect,
    editorWidthInput,
    textZoomInput,
    themeSelect,
    fontSelect
  },
  closeTreeContextMenu,
  persistSettings,
  applyEditorLineHeight,
  applyEditorParagraphSpacing,
  applyEditorMaxWidth,
  applyEditorFont,
  setEditorZoomFromPercent,
  applyTheme,
  refreshEditorLayout,
  showEditorWidthGuides,
  clearEditorWidthGuides,
  setStatus,
  initialTab: "writing"
});
let projectEntryActionsController: ReturnType<typeof createProjectEntryActionsController>;
const projectTreeStateController = createProjectTreeStateController({
  fileList,
  maxTreeIndent: MAX_TREE_INDENT,
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  getDirty: () => editorDirtyStateController.getDirty(),
  getProjectDisplayTitle,
  closeTreeContextMenu,
  setSidebarFaded,
  closeCurrentFile,
  openFile,
  moveFileToFolder: (sourcePath, toFolderRelativePath) =>
    projectEntryActionsController.moveFileToFolder(sourcePath, toFolderRelativePath)
});
const entryDialogController = createEntryDialogController({
  getProject: () => project,
  getSelectedFolderPath: () => projectTreeStateController.getSelectedFolderPath(),
  setStatus,
  newFileDialog,
  newFilePathInput,
  newFileCancelButton,
  newFileCreateButton,
  newFileError,
  newFolderDialog,
  newFolderPathInput,
  newFolderCancelButton,
  newFolderCreateButton,
  newFolderError,
  renameEntryDialog,
  renameEntryTitle,
  renameEntryInput,
  renameEntryCancelButton,
  renameEntryConfirmButton,
  renameEntryError
});
projectEntryActionsController = createProjectEntryActionsController({
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  setCurrentFilePath: setCurrentFilePathState,
  getDirty: () => editorDirtyStateController.getDirty(),
  setSelectedTree: projectTreeStateController.setSelectedTree,
  getSelectedFolderPath: projectTreeStateController.getSelectedFolderPath,
  closeTreeContextMenu,
  askForNewFilePath: () => entryDialogController.askForNewFilePath(),
  askForNewFolderPath: () => entryDialogController.askForNewFolderPath(),
  askForRenameValue: (kind, currentName) => entryDialogController.askForRenameValue(kind, currentName),
  openFile,
  persistCurrentFile,
  persistLastOpenedFilePath,
  resetActiveFile,
  setSidebarFaded,
  setActiveFileLabel: (label) => {
    activeFileLabel.textContent = label;
    activeFileLabel.title = label;
  },
  renderFileList: () => projectTreeStateController.renderFileList(),
  renderStatusFooter,
  setStatus,
  newFile: (payload) => window.witApi.newFile(payload),
  newFolder: (payload) => window.witApi.newFolder(payload),
  deleteEntry: (payload) => window.witApi.deleteEntry(payload),
  renameEntry: (payload) => window.witApi.renameEntry(payload),
  moveFile: (payload) => window.witApi.moveFile(payload)
});
const projectUiController = createProjectUiController({
  sidebarProjectTitle,
  projectPathLabel,
  statusBar,
  statusMessage,
  wordCountLabel,
  writingTimeLabel,
  snapshotLabel,
  editorHeader,
  themeSelect,
  defaultFileExtensionSelect,
  showWordCountInput,
  showWritingTimeInput,
  showCurrentFileBarInput,
  smartQuotesInput,
  gitSnapshotsInput,
  gitPushRemoteSelect,
  gitSnapshotsNotice,
  autosaveIntervalInput,
  snapshotMaxSizeInput,
  applyTheme,
  applyEditorLineHeight,
  applyEditorParagraphSpacing,
  applyEditorMaxWidth,
  setEditorZoomFromPercent,
  populateFontSelect,
  applyEditorFont,
  getProjectDisplayTitle,
  formatWritingTime,
  defaultEditorFont: DEFAULT_EDITOR_FONT
});
let fileSessionController: ReturnType<typeof createFileSessionController>;
const projectStateApplicationController = createProjectStateApplicationController({
  defaultEditorPlaceholder: DEFAULT_EDITOR_PLACEHOLDER,
  getIsWindowFullscreen: () => isWindowFullscreen,
  setProjectState,
  setCurrentFilePathState,
  resetCurrentFileWordCount: () => fileSessionController.resetCurrentFileWordCount(),
  clearActiveFileLabel: () => {
    activeFileLabel.textContent = "No file selected";
    activeFileLabel.removeAttribute("title");
  },
  clearEditorValueSilently: () => {
    suppressDirtyEvents = true;
    editor.setValue("");
    suppressDirtyEvents = false;
  },
  setEditorPlaceholder: (value) => {
    editor.setPlaceholder(value);
  },
  setDirty,
  setEditorWritable,
  renderEmptyEditorState,
  renderFileList,
  cancelPendingLiveWordCount,
  stopSidebarResize,
  resetTreeState: () => projectTreeStateController.resetTreeState(),
  restoreCollapsedFolders: () => projectTreeStateController.restoreCollapsedFolders(),
  updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
  parseSnapshotTimestamp,
  syncProjectPathLabels,
  setProjectControlsEnabled,
  syncSettingsInputs,
  renderStatusFooter,
  setSidebarVisibility,
  setSidebarFaded,
  restartAutosaveTimer
});
const projectLifecycleController = createProjectLifecycleController({
  getCurrentFilePath: () => currentFilePath,
  persistCurrentFile,
  persistLastOpenedFilePath,
  resetActiveFile: () => projectStateApplicationController.resetActiveFile(),
  setProjectState,
  stopSidebarResize,
  resetTreeState: () => projectTreeStateController.resetTreeState(),
  updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
  syncProjectPathLabels,
  setProjectControlsEnabled,
  setSidebarVisibility,
  setSidebarFaded,
  setThemeValue: (theme) => {
    themeSelect.value = theme;
  },
  applyTheme,
  renderStatusFooter,
  renderFileList: () => projectTreeStateController.renderFileList(),
  restartAutosaveTimer,
  renderEmptyEditorState,
  closeTreeContextMenu,
  closeProject: () => window.witApi.closeProject(),
  selectProject: () => window.witApi.selectProject(),
  applyProjectMetadata: (metadata) => projectStateApplicationController.applyProjectMetadata(metadata),
  openFile,
  setStatus
});
const emptyEditorStateController = createEmptyEditorStateController({
  editorWrap,
  emptyStateScreen,
  emptyStateEyebrow,
  emptyStateTitle,
  emptyStateDescription,
  emptyStatePrimaryButton,
  emptyStateSecondaryButton,
  emptyStateShortcutsLabel,
  emptyStateShortcutsList,
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  getProjectDisplayTitle,
  primaryShortcutLabel
});
const editorInteractionsController = createEditorInteractionsController({
  getSuppressDirtyEvents: () => suppressDirtyEvents,
  setSuppressDirtyEvents: (value) => {
    suppressDirtyEvents = value;
  },
  getSmartQuotesEnabled: () => Boolean(project?.settings.smartQuotes),
  getEditorSelection: () => editor.getSelection(),
  getEditorValue: () => editor.getValue(),
  replaceEditorSelection: (value) => {
    editor.replaceSelection(value);
  },
  persistCurrentFile,
  handleUserEdit: () => {
    typingActivityTracker.recordTypingActivity();
    setDirty(true);
    scheduleLiveWordCountRefresh();
    setSidebarFaded(true);
  },
  setSidebarFaded
});
fileSessionController = createFileSessionController({
  liveWordCountTracker,
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  getDirty: () => editorDirtyStateController.getDirty(),
  getEditorValue: () => editor.getValue(),
  setEditorValueSilently: (content) => {
    suppressDirtyEvents = true;
    editor.setValue(content);
    suppressDirtyEvents = false;
  },
  setCurrentFilePath: setCurrentFilePathState,
  setSelectedTreeToFile: projectTreeStateController.setSelectedTreeToFile,
  setActiveFileLabel: (nextPath) => {
    activeFileLabel.textContent = nextPath;
    activeFileLabel.title = nextPath;
  },
  setEditorPlaceholder: (value) => {
    editor.setPlaceholder(value);
  },
  setDirty,
  setSidebarFaded,
  renderFileList: () => projectTreeStateController.renderFileList(),
  setEditorWritable,
  renderEmptyEditorState,
  persistLastOpenedFilePath,
  focusEditor: () => {
    editor.focus();
  },
  setStatus,
  countPreviewWords: (text) => window.witApi.countPreviewWords(text),
  getWordCount: () => window.witApi.getWordCount(),
  saveFile: (relativePath, content) => window.witApi.saveFile(relativePath, content),
  saveFileSync: (relativePath, content) => window.witApi.saveFileSync(relativePath, content),
  openFileApi: (nextPath) => window.witApi.openFile(nextPath),
  autosaveTick: (activeSeconds) => window.witApi.autosaveTick(activeSeconds),
  consumeActiveTypingSeconds,
  parseSnapshotTimestamp: (value) => (value ? parseSnapshotTimestamp(value) : null),
  updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
  renderStatusFooter
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
  appShellUiController.setStatus(message, clearAfterMs);
}

function renderSnapshotLabel(): void {
  snapshotLabelController.render();
}

function restartSnapshotLabelTimer(): void {
  snapshotLabelController.start();
}

function showEditorWidthGuides(): void {
  editorPresentationController.showEditorWidthGuides();
}

function clearEditorWidthGuides(): void {
  editorPresentationController.clearEditorWidthGuides();
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
  return typingActivityTracker.consumeActiveSeconds();
}

function setDirty(nextDirty: boolean): void {
  editorDirtyStateController.setDirty(nextDirty);
}

async function persistLastOpenedFilePath(relativePath: string | null): Promise<void> {
  await projectPersistenceController.persistLastOpenedFilePath(relativePath);
}

function refreshEditorLayout(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function setProjectControlsEnabled(enabled: boolean): void {
  appShellUiController.setProjectControlsEnabled(enabled);
}

function setSidebarFaded(nextFaded: boolean): void {
  sidebarUiController.setSidebarFaded(nextFaded);
}

function loadSidebarWidthPreference(): void {
  sidebarUiController.loadSidebarWidthPreference();
}

function syncSidebarToggleButton(): void {
  sidebarUiController.syncSidebarToggleButton();
}

function syncFullscreenToggleButton(isFullscreen: boolean): void {
  sidebarUiController.syncFullscreenToggleButton(isFullscreen);
}

function setSidebarVisibility(nextVisible: boolean, showStatus = true): void {
  sidebarUiController.setSidebarVisibility(nextVisible, showStatus);
}

function toggleSidebarVisibility(): void {
  sidebarUiController.toggleSidebarVisibility();
}

function stopSidebarResize(): void {
  sidebarUiController.stopSidebarResize();
}

function beginSidebarResize(pointerClientX: number): void {
  sidebarUiController.beginSidebarResize(pointerClientX);
}

async function loadAboutInfo(): Promise<void> {
  await appShellUiController.loadAboutInfo();
}

function setEditorWritable(enabled: boolean): void {
  editorPresentationController.setEditorWritable(enabled);
}

function applyEditorLineHeight(lineHeight: number): void {
  editorPresentationController.applyEditorLineHeight(lineHeight);
}

function applyEditorParagraphSpacing(spacing: AppSettings["editorParagraphSpacing"]): void {
  editorPresentationController.applyEditorParagraphSpacing(spacing);
}

function applyEditorMaxWidth(editorWidth: number): void {
  editorPresentationController.applyEditorMaxWidth(editorWidth);
}

function applyEditorFont(fontFamily: string): void {
  editorPresentationController.applyEditorFont(fontFamily);
}

function populateFontSelect(selectedFont: string): void {
  editorPresentationController.populateFontSelect(selectedFont);
}

async function loadSystemFonts(): Promise<void> {
  await editorPresentationController.loadSystemFonts();
}

function applyTheme(theme: AppSettings["theme"]): void {
  editorPresentationController.applyTheme(theme);
}

function applyEditorZoom(showStatus = true): void {
  editorPresentationController.applyEditorZoom(showStatus);
}

function setEditorZoomFromPercent(percent: number, showStatus = true): void {
  editorPresentationController.setEditorZoomFromPercent(percent, showStatus);
}

function stepEditorZoom(direction: 1 | -1): void {
  editorPresentationController.stepEditorZoom(direction);
}

function resetEditorZoom(): void {
  editorPresentationController.resetEditorZoom();
}

function getProjectDisplayTitle(projectPath: string): string {
  const trimmed = projectPath.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments.at(-1) ?? projectPath;
}

function resetActiveFile(): void {
  projectStateApplicationController.resetActiveFile();
}

async function closeCurrentFile(): Promise<void> {
  await projectLifecycleController.closeCurrentFile();
}

function renderEmptyEditorState(): void {
  emptyEditorStateController.renderEmptyEditorState();
}

function syncProjectPathLabels(projectPath: string): void {
  projectUiController.syncProjectPathLabels(projectPath, project);
}

function renderStatusFooter(): void {
  projectUiController.renderStatusFooter(project);
}

function renderFileList(): void {
  projectTreeStateController.renderFileList();
}

function syncSettingsInputs(settings: AppSettings): void {
  projectUiController.syncSettingsInputs(settings, project);
}

function applyProjectMetadata(metadata: ProjectMetadata): void {
  projectStateApplicationController.applyProjectMetadata(metadata);
}

function cancelPendingLiveWordCount(): void {
  fileSessionController.cancelPendingLiveWordCount();
}

function scheduleLiveWordCountRefresh(): void {
  fileSessionController.scheduleLiveWordCountRefresh();
}

async function persistCurrentFile(showStatus = true): Promise<boolean> {
  return fileSessionController.persistCurrentFile(showStatus);
}

function saveCurrentFileSynchronously(): void {
  fileSessionController.saveCurrentFileSynchronously();
}

async function openFile(relativePath: string): Promise<void> {
  await fileSessionController.openFile(relativePath);
}

function isUserTyping(): boolean {
  return typingActivityTracker.isTyping();
}

function waitForTypingPause(): Promise<void> {
  return typingActivityTracker.waitForPause({
    maxWaitMs: AUTOSAVE_LENIENCY_MAX_MS,
    pollMs: AUTOSAVE_LENIENCY_POLL_MS
  });
}

function restartAutosaveTimer(): void {
  autosaveController.restart();
}

async function runAutosaveTick(): Promise<void> {
  await fileSessionController.runAutosaveTick();
}

async function openProjectPicker(): Promise<void> {
  await projectLifecycleController.openProjectPicker();
}

async function closeCurrentProject(): Promise<void> {
  await projectLifecycleController.closeCurrentProject();
}

async function persistSettings(update: Partial<AppSettings>): Promise<void> {
  return projectPersistenceController.persistSettings(update);
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
  projectTreeState: projectTreeStateController.state,
  getProject: () => project,
  onEditorInput: () => editorInteractionsController.onEditorInput(),
  onEditorBlur: () => editorInteractionsController.onEditorBlur(),
  onEditorKeydown: (event) => editorInteractionsController.onEditorKeydown(event),
  closeTreeContextMenu,
  openProjectPicker,
  createNewFile: () => projectEntryActionsController.createNewFile(),
  createNewFolder: () => projectEntryActionsController.createNewFolder(),
  toggleSidebarVisibility,
  beginSidebarResize,
  isSidebarVisible: () => sidebarController.isVisible(),
  adjustSidebarWidth: (delta) => sidebarController.adjustWidth(delta),
  syncFullscreenToggleButton,
  setSidebarFaded,
  consumeTestTreeContextAction,
  closeCurrentProject,
  deleteEntryByPath: (relativePath, kind) => projectEntryActionsController.deleteEntryByPath(relativePath, kind),
  closeCurrentFile,
  renameEntryByPath: (relativePath, kind) => projectEntryActionsController.renameEntryByPath(relativePath, kind),
  renderFileList,
  persistCurrentFile,
  cancelPendingLiveWordCount,
  saveCurrentFileSynchronously,
  stopSidebarResize,
  clearEditorWidthGuides,
  stopAutosaveController: () => autosaveController.stop(),
  stopSnapshotLabelController: () => snapshotLabelController.stop(),
  destroySettingsDialogController: () => settingsDialogController.destroy(),
  destroyEntryDialogController: () => entryDialogController.destroy(),
  setDragSourceFilePath: projectTreeStateController.setDragSourceFilePath,
  setStatus,
  defaultEditorFont: DEFAULT_EDITOR_FONT,
  lineHeightInput,
  paragraphSpacingSelect,
  editorWidthInput,
  fontSelect,
  loadAboutInfo,
  loadSidebarWidthPreference,
  setProjectControlsEnabled,
  setSettingsTab: (tab) => settingsDialogController.setActiveTab(tab),
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
