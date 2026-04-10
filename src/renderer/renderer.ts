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
import { createSettingsDialogController } from "./features/settings/settings-dialog-controller.js";
import { initializeApp } from "./features/app/app-initializer.js";
import { bindAppEventBindings } from "./features/app/app-event-bindings.js";
import { createProjectUiController } from "./features/project/project-ui-controller.js";
import { createProjectLifecycleController } from "./features/project/project-lifecycle-controller.js";
import { createProjectPersistenceController } from "./features/project/project-persistence-controller.js";
import { createEmptyEditorStateController } from "./features/project/empty-editor-state-controller.js";

const openProjectButton = document.getElementById("open-project-btn") as HTMLButtonElement;
const openProjectWrap = document.querySelector(".open-project-wrap") as HTMLElement;
const newFileButton = document.getElementById("new-file-btn") as HTMLButtonElement;
const newFolderButton = document.getElementById("new-folder-btn") as HTMLButtonElement;
const projectActions = document.getElementById("project-actions") as HTMLElement;
const settingsToggleButton = document.getElementById("settings-toggle-btn") as HTMLButtonElement;
const fullscreenToggleButton = document.getElementById("toggle-fullscreen-btn") as HTMLButtonElement;
const settingsDialog = document.getElementById("settings-dialog") as HTMLDialogElement;
const settingsTabWriting = document.getElementById("settings-tab-writing") as HTMLButtonElement;
const settingsTabEditor = document.getElementById("settings-tab-editor") as HTMLButtonElement;
const settingsTabAutosave = document.getElementById("settings-tab-autosave") as HTMLButtonElement;
const settingsTabAbout = document.getElementById("settings-tab-about") as HTMLButtonElement;
const settingsPanelWriting = document.getElementById("settings-panel-writing") as HTMLElement;
const settingsPanelEditor = document.getElementById("settings-panel-editor") as HTMLElement;
const settingsPanelAutosave = document.getElementById("settings-panel-autosave") as HTMLElement;
const settingsPanelAbout = document.getElementById("settings-panel-about") as HTMLElement;
const appShell = document.getElementById("app-shell") as HTMLElement;
const toggleSidebarButton = document.getElementById("toggle-sidebar-btn") as HTMLButtonElement;
const sidebarResizer = document.getElementById("sidebar-resizer") as HTMLDivElement;
const sidebar = document.querySelector(".sidebar") as HTMLElement;
const editorWrap = document.querySelector(".editor-wrap") as HTMLElement;
const editorHeader = document.querySelector(".editor-header") as HTMLElement;
const statusBar = document.querySelector(".status-bar") as HTMLElement;
const emptyStateScreen = document.getElementById("empty-state-screen") as HTMLDivElement;
const emptyStateEyebrow = document.getElementById("empty-state-eyebrow") as HTMLParagraphElement;
const emptyStateTitle = document.getElementById("empty-state-title") as HTMLHeadingElement;
const emptyStateDescription = document.getElementById("empty-state-description") as HTMLParagraphElement;
const emptyStatePrimaryButton = document.getElementById("empty-state-primary-btn") as HTMLButtonElement;
const emptyStateSecondaryButton = document.getElementById("empty-state-secondary-btn") as HTMLButtonElement;
const emptyStateShortcutsLabel = document.querySelector(".empty-state-shortcuts-label") as HTMLParagraphElement;
const emptyStateShortcutsList = document.getElementById("empty-state-shortcuts-list") as HTMLUListElement;
const sidebarProjectTitle = document.getElementById("sidebar-project-title") as HTMLHeadingElement;
const fileList = document.getElementById("file-list") as HTMLUListElement;
const newFileDialog = document.getElementById("new-file-dialog") as HTMLDialogElement;
const newFilePathInput = document.getElementById("new-file-path-input") as HTMLInputElement;
const newFileCancelButton = document.getElementById("new-file-cancel-btn") as HTMLButtonElement;
const newFileCreateButton = document.getElementById("new-file-create-btn") as HTMLButtonElement;
const newFileError = document.getElementById("new-file-error") as HTMLParagraphElement;
const newFolderDialog = document.getElementById("new-folder-dialog") as HTMLDialogElement;
const newFolderPathInput = document.getElementById("new-folder-path-input") as HTMLInputElement;
const newFolderCancelButton = document.getElementById("new-folder-cancel-btn") as HTMLButtonElement;
const newFolderCreateButton = document.getElementById("new-folder-create-btn") as HTMLButtonElement;
const newFolderError = document.getElementById("new-folder-error") as HTMLParagraphElement;
const renameEntryDialog = document.getElementById("rename-entry-dialog") as HTMLDialogElement;
const renameEntryTitle = document.getElementById("rename-entry-title") as HTMLHeadingElement;
const renameEntryInput = document.getElementById("rename-entry-input") as HTMLInputElement;
const renameEntryCancelButton = document.getElementById("rename-entry-cancel-btn") as HTMLButtonElement;
const renameEntryConfirmButton = document.getElementById("rename-entry-confirm-btn") as HTMLButtonElement;
const renameEntryError = document.getElementById("rename-entry-error") as HTMLParagraphElement;
const editorElement = document.getElementById("editor") as HTMLDivElement;
const editor = createCodeMirrorEditor(editorElement);
const projectPathLabel = document.getElementById("project-path") as HTMLSpanElement;
const activeFileLabel = document.getElementById("active-file-label") as HTMLSpanElement;
const dirtyIndicator = document.getElementById("dirty-indicator") as HTMLSpanElement;
const statusMessage = document.getElementById("status-message") as HTMLSpanElement;
const wordCountLabel = document.getElementById("word-count") as HTMLSpanElement;
const writingTimeLabel = document.getElementById("writing-time") as HTMLSpanElement;
const snapshotLabel = document.getElementById("snapshot-label") as HTMLSpanElement;
const showWordCountInput = document.getElementById("show-word-count-input") as HTMLInputElement;
const showWritingTimeInput = document.getElementById("show-writing-time-input") as HTMLInputElement;
const showCurrentFileBarInput = document.getElementById("show-current-file-bar-input") as HTMLInputElement;
const smartQuotesInput = document.getElementById("smart-quotes-input") as HTMLInputElement;
const defaultFileExtensionSelect = document.getElementById("default-file-extension-select") as HTMLSelectElement;
const gitSnapshotsInput = document.getElementById("git-snapshots-input") as HTMLInputElement;
const gitPushRemoteSelect = document.getElementById("git-push-remote-select") as HTMLSelectElement;
const gitSnapshotsNotice = document.getElementById("git-snapshots-notice") as HTMLParagraphElement;
const autosaveIntervalInput = document.getElementById("autosave-interval-input") as HTMLInputElement;
const snapshotMaxSizeInput = document.getElementById("snapshot-max-size-input") as HTMLInputElement;
const lineHeightInput = document.getElementById("line-height-input") as HTMLInputElement;
const lineHeightValue = document.getElementById("line-height-value") as HTMLSpanElement;
const paragraphSpacingSelect = document.getElementById("paragraph-spacing-select") as HTMLSelectElement;
const editorWidthInput = document.getElementById("editor-width-input") as HTMLInputElement;
const editorWidthValue = document.getElementById("editor-width-value") as HTMLSpanElement;
const textZoomInput = document.getElementById("text-zoom-input") as HTMLInputElement;
const textZoomValue = document.getElementById("text-zoom-value") as HTMLSpanElement;
const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
const fontSelect = document.getElementById("font-select") as HTMLSelectElement;
const aboutVersion = document.getElementById("about-version") as HTMLSpanElement;
const aboutDescription = document.getElementById("about-description") as HTMLParagraphElement;
const aboutAuthor = document.getElementById("about-author") as HTMLSpanElement;
const aboutWebsite = document.getElementById("about-website") as HTMLAnchorElement;

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

const subscriptions: Array<() => void> = [];
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
const projectLifecycleController = createProjectLifecycleController({
  getCurrentFilePath: () => currentFilePath,
  persistCurrentFile,
  persistLastOpenedFilePath,
  resetActiveFile,
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
  applyProjectMetadata,
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
const fileSessionController = createFileSessionController({
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
  setCurrentFilePathState(null);
  fileSessionController.resetCurrentFileWordCount();
  activeFileLabel.textContent = "No file selected";
  activeFileLabel.removeAttribute("title");

  suppressDirtyEvents = true;
  editor.setValue("");
  suppressDirtyEvents = false;
  editor.setPlaceholder(DEFAULT_EDITOR_PLACEHOLDER);

  setDirty(false);
  setEditorWritable(false);
  renderEmptyEditorState();
  renderFileList();
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
  cancelPendingLiveWordCount();
  stopSidebarResize();
  projectTreeStateController.resetTreeState();
  setProjectState(metadata);
  projectTreeStateController.restoreCollapsedFolders();
  snapshotLabelController.update(
    metadata.latestSnapshotCreatedAt ? parseSnapshotTimestamp(metadata.latestSnapshotCreatedAt) : null
  );
  resetActiveFile();

  syncProjectPathLabels(metadata.projectPath);
  setProjectControlsEnabled(true);
  syncSettingsInputs(metadata.settings);
  renderStatusFooter();
  renderFileList();
  setSidebarVisibility(!isWindowFullscreen, false);
  setSidebarFaded(false);
  setEditorWritable(false);
  restartAutosaveTimer();
  renderEmptyEditorState();
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

bindAppEventBindings({
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
  getProject: () => project,
  onEditorInput: () => editorInteractionsController.onEditorInput(),
  onEditorBlur: () => editorInteractionsController.onEditorBlur(),
  onEditorKeydown: (event) => editorInteractionsController.onEditorKeydown(event),
  projectTreeState: projectTreeStateController.state,
  closeTreeContextMenu,
  openProjectPicker,
  createNewFile: () => projectEntryActionsController.createNewFile(),
  createNewFolder: () => projectEntryActionsController.createNewFolder(),
  toggleSidebarVisibility,
  beginSidebarResize,
  isSidebarVisible: () => sidebarController.isVisible(),
  adjustSidebarWidth: (delta) => sidebarController.adjustWidth(delta),
  toggleFullscreen: () => window.witApi.toggleFullscreen(),
  syncFullscreenToggleButton,
  setSidebarFaded,
  addSubscription: (unsubscribe) => {
    subscriptions.push(unsubscribe);
  },
  consumeTestTreeContextAction,
  showTreeContextMenu: (payload) => window.witApi.showTreeContextMenu(payload),
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
  cleanupSubscriptions: () => {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
  },
  setDragSourceFilePath: projectTreeStateController.setDragSourceFilePath,
  setStatus
});

void initializeApp({
  body: document.body,
  witApi: window.witApi,
  defaultEditorFont: DEFAULT_EDITOR_FONT,
  lineHeightInput,
  paragraphSpacingSelect,
  editorWidthInput,
  fontSelect,
  getProject: () => project,
  loadAboutInfo,
  loadSidebarWidthPreference,
  setProjectControlsEnabled,
  setSettingsTab: (tab) => settingsDialogController.setActiveTab(tab),
  syncSidebarToggleButton,
  syncFullscreenToggleButton,
  setSidebarVisibility,
  setSidebarFaded,
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
  renderFileList,
  renderStatusFooter,
  renderEmptyEditorState,
  applyProjectMetadata,
  openFile,
  resetActiveFile,
  setStatus,
  addSubscription: (unsubscribe) => {
    subscriptions.push(unsubscribe);
  },
  openProjectPicker,
  createNewFile: () => projectEntryActionsController.createNewFile(),
  persistCurrentFile,
  stepEditorZoom,
  resetEditorZoom,
  toggleSidebarVisibility,
  loadSystemFonts
});
