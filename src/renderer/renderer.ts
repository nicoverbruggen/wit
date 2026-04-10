import type { AppSettings, ProjectMetadata, TreeContextAction } from "../shared/types";
import {
  normalizeEditorLineHeight,
  normalizeEditorMaxWidth,
  normalizeEditorParagraphSpacing,
  normalizeEditorZoomPercent,
  pathEquals
} from "../shared/utils.js";
import { formatRelativeElapsed, formatWritingTime, parseSnapshotTimestamp } from "./formatting.js";
import { createCodeMirrorEditor } from "./codemirror-editor-adapter.js";
import {
  renderEmptyStateShortcutRows as renderShortcutRows,
  formatPrimaryShortcut,
  type EmptyStateShortcut
} from "./empty-state-shortcuts.js";
import {
  buildEditorFontStack,
  loadSystemFontFamilies,
  populateFontSelect as populateFontOptions
} from "./font-utils.js";
import {
  renderProjectTreeList,
  type ProjectTreeSelectionKind
} from "./features/project-tree/project-tree-view.js";
import {
  createProjectTreeRenderCallbacks
} from "./features/project-tree/project-tree-controller.js";
import { createEntryDialogController } from "./features/project-tree/entry-dialog-controller.js";
import { createProjectEntryActionsController } from "./features/project-tree/project-entry-actions-controller.js";
import { createLiveWordCountTracker } from "./features/editor/live-word-count.js";
import { createEditorInteractionsController } from "./features/editor/editor-interactions-controller.js";
import {
  openFileInEditorSession,
  persistCurrentFileInSession,
  saveCurrentFileSynchronouslyInSession
} from "./features/editor/editor-session.js";
import { createTypingActivityTracker } from "./features/editor/typing-activity.js";
import { createAutosaveController } from "./features/autosave/autosave-controller.js";
import { createSnapshotLabelController } from "./features/autosave/snapshot-label-controller.js";
import { createSidebarController } from "./features/sidebar/sidebar-controller.js";
import { createSettingsDialogController } from "./features/settings/settings-dialog-controller.js";
import { initializeApp } from "./features/app/app-initializer.js";
import { bindAppEventBindings } from "./features/app/app-event-bindings.js";
import { createProjectUiController } from "./features/project/project-ui-controller.js";
import { createProjectLifecycleController } from "./features/project/project-lifecycle-controller.js";

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

type SelectedTreeKind = ProjectTreeSelectionKind;

let project: ProjectMetadata | null = null;
let currentFilePath: string | null = null;
let currentFileWordCount = 0;
let dirty = false;
const TYPING_IDLE_THRESHOLD_MS = 5_000;
const AUTOSAVE_LENIENCY_THRESHOLD_SEC = 60;
const AUTOSAVE_LENIENCY_MAX_MS = 5_000;
const AUTOSAVE_LENIENCY_POLL_MS = 500;
let statusResetTimer: number | null = null;
let suppressDirtyEvents = false;
let editorBaseFontSizePx = 0;
let editorZoomFactor = 1;
let isWindowFullscreen = false;
let editorWidthGuideTimer: number | null = null;
let settingsPersistQueue: Promise<void> = Promise.resolve();
let dragSourceFilePath: string | null = null;
const collapsedFolderPaths = new Set<string>();
let selectedTreePath: string | null = null;
let selectedTreeKind: SelectedTreeKind | null = null;
let systemFontFamilies: string[] = [];

const subscriptions: Array<() => void> = [];
type TestWindowWithContextAction = Window & {
  __WIT_TEST_TREE_ACTION?: TreeContextAction;
};
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
const entryDialogController = createEntryDialogController({
  getProject: () => project,
  getSelectedFolderPath,
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
const projectEntryActionsController = createProjectEntryActionsController({
  getProject: () => project,
  getCurrentFilePath: () => currentFilePath,
  setCurrentFilePath: setCurrentFilePathState,
  getDirty: () => dirty,
  setSelectedTree: (relativePath, kind) => {
    selectedTreePath = relativePath;
    selectedTreeKind = kind;
  },
  getSelectedFolderPath,
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
  renderFileList,
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
  resetTreeState,
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
  renderFileList,
  restartAutosaveTimer,
  renderEmptyEditorState,
  closeTreeContextMenu,
  closeProject: () => window.witApi.closeProject(),
  selectProject: () => window.witApi.selectProject(),
  applyProjectMetadata,
  openFile,
  setStatus
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

function setProjectState(nextProject: ProjectMetadata | null): void {
  project = nextProject;
}

function setCurrentFilePathState(nextFilePath: string | null): void {
  currentFilePath = nextFilePath;
}

function setDirtyState(nextDirty: boolean): void {
  dirty = nextDirty;
}

function primaryShortcutLabel(key: string): string {
  return formatPrimaryShortcut(key, window.witApi.getPlatform());
}

function setStatus(message: string, clearAfterMs?: number): void {
  statusMessage.textContent = message;

  if (statusResetTimer) {
    window.clearTimeout(statusResetTimer);
    statusResetTimer = null;
  }

  if (clearAfterMs) {
    statusResetTimer = window.setTimeout(() => {
      statusMessage.textContent = DEFAULT_STATUS_MESSAGE;
      statusResetTimer = null;
    }, clearAfterMs);
  }
}

function renderSnapshotLabel(): void {
  snapshotLabelController.render();
}

function restartSnapshotLabelTimer(): void {
  snapshotLabelController.start();
}

function showEditorWidthGuides(): void {
  editorWrap.classList.add("show-width-guides");

  if (editorWidthGuideTimer) {
    window.clearTimeout(editorWidthGuideTimer);
    editorWidthGuideTimer = null;
  }

  editorWidthGuideTimer = window.setTimeout(() => {
    editorWrap.classList.remove("show-width-guides");
    editorWidthGuideTimer = null;
  }, 900);
}

function clearEditorWidthGuides(): void {
  if (editorWidthGuideTimer) {
    window.clearTimeout(editorWidthGuideTimer);
    editorWidthGuideTimer = null;
  }

  editorWrap.classList.remove("show-width-guides");
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
  setDirtyState(nextDirty);
  dirtyIndicator.hidden = !nextDirty;
  syncActiveFileMarkerState();
}

async function persistLastOpenedFilePath(relativePath: string | null): Promise<void> {
  if (!project) {
    return;
  }

  try {
    const savedPath = await window.witApi.setLastOpenedFilePath(relativePath);
    if (project) {
      project.lastOpenedFilePath = savedPath;
      project.hasStoredLastOpenedFilePath = true;
    }
  } catch {
    setStatus("Could not update last opened file.");
  }
}

function refreshEditorLayout(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function syncActiveFileMarkerState(): void {
  const markers = fileList.querySelectorAll(".file-button .active-file-marker");

  markers.forEach((element) => {
    const marker = element as HTMLElement;
    const fileButton = marker.closest(".file-button") as HTMLElement | null;
    const relativePath = fileButton?.dataset.relativePath;
    const isCurrentFile = Boolean(relativePath && currentFilePath && pathEquals(relativePath, currentFilePath));
    marker.hidden = !isCurrentFile;
    marker.dataset.dirty = String(isCurrentFile && dirty);
  });
}

function setProjectControlsEnabled(enabled: boolean): void {
  projectActions.classList.toggle("project-open", enabled);
  openProjectWrap.classList.toggle("project-open", enabled);
  settingsToggleButton.hidden = !enabled;
  newFileButton.disabled = !enabled;
  newFolderButton.disabled = !enabled;
  showWordCountInput.disabled = !enabled;
  showWritingTimeInput.disabled = !enabled;
  showCurrentFileBarInput.disabled = !enabled;
  smartQuotesInput.disabled = !enabled;
  gitSnapshotsInput.disabled = !enabled || !project?.isGitRepository;
  gitPushRemoteSelect.disabled = true;
  autosaveIntervalInput.disabled = !enabled;
  snapshotMaxSizeInput.disabled = !enabled;
  lineHeightInput.disabled = !enabled;
  editorWidthInput.disabled = !enabled;
  themeSelect.disabled = !enabled;
  fontSelect.disabled = !enabled;
  gitSnapshotsNotice.hidden = !enabled || Boolean(project?.isGitRepository);
}

function setSidebarFaded(nextFaded: boolean): void {
  const shouldFade = Boolean(sidebarController.isVisible() && project && currentFilePath && nextFaded);
  sidebarController.setFaded(shouldFade);
}

function loadSidebarWidthPreference(): void {
  sidebarController.loadWidthPreference();
}

function syncSidebarToggleButton(): void {
  sidebarController.syncToggleButton(Boolean(project));
}

function syncFullscreenToggleButton(isFullscreen: boolean): void {
  const wasFullscreen = isWindowFullscreen;
  isWindowFullscreen = isFullscreen;
  const nextActionLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenToggleButton.title = nextActionLabel;
  fullscreenToggleButton.setAttribute("aria-label", nextActionLabel);
  fullscreenToggleButton.setAttribute("aria-pressed", String(isFullscreen));

  if (isFullscreen && !wasFullscreen) {
    sidebarController.setVisibleBeforeFullscreen(sidebarController.isVisible());
    setSidebarVisibility(false, false);
  } else if (!isFullscreen && wasFullscreen) {
    setSidebarVisibility(sidebarController.getVisibleBeforeFullscreen(), false);
  }

  applyEditorZoom(false);
}

function setSidebarVisibility(nextVisible: boolean, showStatus = true): void {
  sidebarController.setVisibility(nextVisible, {
    showStatus,
    setStatus,
    projectAvailable: Boolean(project)
  });
}

function toggleSidebarVisibility(): void {
  sidebarController.toggleVisibility(Boolean(project), {
    setStatus
  });
}

function stopSidebarResize(): void {
  sidebarController.stopResize();
}

function beginSidebarResize(pointerClientX: number): void {
  sidebarController.beginResize(pointerClientX, Boolean(project));
}

async function loadAboutInfo(): Promise<void> {
  try {
    const info = await window.witApi.getAppInfo();
    aboutVersion.textContent = info.version;
    aboutDescription.textContent = info.description;
    aboutAuthor.textContent = info.author;
    aboutWebsite.textContent = info.website || "Not specified";
    aboutWebsite.href = info.website || "#";
    aboutWebsite.hidden = info.website.length === 0;
  } catch {
    aboutVersion.textContent = "--";
    aboutDescription.textContent = "Minimalist desktop writing app for plain text projects.";
    aboutAuthor.textContent = "Nico Verbruggen";
    aboutWebsite.textContent = "https://nicoverbruggen.be";
    aboutWebsite.href = "https://nicoverbruggen.be";
    aboutWebsite.hidden = false;
  }
}

function setEditorWritable(enabled: boolean): void {
  editor.setDisabled(!enabled);
}

function applyEditorLineHeight(lineHeight: number): void {
  const normalized = normalizeEditorLineHeight(lineHeight);
  editor.setLineHeight(normalized);
  lineHeightValue.textContent = normalized.toFixed(2);
  lineHeightInput.value = normalized.toFixed(2);
}

function applyEditorParagraphSpacing(spacing: AppSettings["editorParagraphSpacing"]): void {
  paragraphSpacingSelect.value = spacing;
  editor.setParagraphSpacing(spacing);
}

function applyEditorMaxWidth(editorWidth: number): void {
  const normalized = normalizeEditorMaxWidth(editorWidth);
  const widthValue = `${normalized}px`;
  editorWrap.style.setProperty("--editor-max-width", widthValue);
  editorWidthValue.textContent = widthValue;
  editorWidthInput.value = String(normalized);
}

function applyEditorFont(fontFamily: string): void {
  const fontStack = buildEditorFontStack(fontFamily);
  editor.setFontFamily(fontStack);
  fontSelect.style.fontFamily = fontStack;
}

function populateFontSelect(selectedFont: string): void {
  const resolvedFont = populateFontOptions({
    select: fontSelect,
    builtInFonts: BUILT_IN_EDITOR_FONTS,
    systemFontFamilies,
    selectedFont,
    defaultFont: DEFAULT_EDITOR_FONT
  });
  fontSelect.style.fontFamily = buildEditorFontStack(resolvedFont);
}

async function loadSystemFonts(): Promise<void> {
  systemFontFamilies = await loadSystemFontFamilies(window, BUILT_IN_EDITOR_FONTS);
}

function applyTheme(theme: AppSettings["theme"]): void {
  document.body.dataset.theme = theme;
}

function ensureEditorBaseFontSize(): void {
  if (editorBaseFontSizePx > 0) {
    return;
  }

  const computedSize = editor.getComputedFontSize();
  editorBaseFontSizePx = Number.isFinite(computedSize) && computedSize > 0 ? computedSize : 20;
}

function syncZoomControlWithState(): void {
  const currentPercent = Math.round(editorZoomFactor * 100);
  textZoomInput.value = String(currentPercent);
  textZoomValue.textContent = `${currentPercent}%`;
}

function applyEditorZoom(showStatus = true): void {
  ensureEditorBaseFontSize();
  const nextFontSize = Number((editorBaseFontSizePx * editorZoomFactor).toFixed(2));
  editor.setFontSize(nextFontSize);
  syncZoomControlWithState();

  if (showStatus) {
    setStatus(`Text zoom ${Math.round(editorZoomFactor * 100)}%`, 1200);
  }
}

function setEditorZoomFromPercent(percent: number, showStatus = true): void {
  const bounded = normalizeEditorZoomPercent(percent);
  editorZoomFactor = bounded / 100;
  applyEditorZoom(showStatus);

  if (showStatus) {
    void persistSettings({ editorZoomPercent: bounded });
  }
}

function stepEditorZoom(direction: 1 | -1): void {
  const currentPercent = Math.round(editorZoomFactor * 100);

  if (direction > 0) {
    const next = EDITOR_ZOOM_PRESETS.find((preset) => preset > currentPercent) ?? 250;
    setEditorZoomFromPercent(next);
    return;
  }

  const previous = [...EDITOR_ZOOM_PRESETS].reverse().find((preset) => preset < currentPercent) ?? 50;
  setEditorZoomFromPercent(previous);
}

function resetEditorZoom(): void {
  setEditorZoomFromPercent(100);
}

function getProjectDisplayTitle(projectPath: string): string {
  const trimmed = projectPath.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments.at(-1) ?? projectPath;
}

function collapsedFoldersStorageKey(): string | null {
  if (!project) {
    return null;
  }

  return `wit:collapsed:${project.projectPath}`;
}

function saveCollapsedFolders(): void {
  const key = collapsedFoldersStorageKey();
  if (!key) {
    return;
  }

  try {
    if (collapsedFolderPaths.size === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify([...collapsedFolderPaths]));
    }
  } catch {
    // localStorage may be unavailable; ignore silently.
  }
}

function restoreCollapsedFolders(): void {
  collapsedFolderPaths.clear();
  const key = collapsedFoldersStorageKey();
  if (!key) {
    return;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") {
            collapsedFolderPaths.add(item);
          }
        }
      }
    }
  } catch {
    // Ignore malformed data.
  }
}

function resetTreeState(): void {
  collapsedFolderPaths.clear();
  selectedTreePath = null;
  selectedTreeKind = null;
}

function resetActiveFile(): void {
  setCurrentFilePathState(null);
  currentFileWordCount = 0;
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

function renderEmptyStateShortcutRows(shortcuts: EmptyStateShortcut[]): void {
  renderShortcutRows(emptyStateShortcutsList, shortcuts);
}

function renderEmptyEditorState(): void {
  const showEmptyState = !project || !currentFilePath;
  editorWrap.classList.toggle("show-empty-state", showEmptyState);
  emptyStateScreen.hidden = !showEmptyState;

  if (!showEmptyState) {
    return;
  }

  if (!project) {
    emptyStateScreen.dataset.mode = "no-project";
    emptyStateEyebrow.hidden = false;
    emptyStateTitle.hidden = false;
    emptyStateDescription.hidden = false;
    emptyStateEyebrow.textContent = "Wit";
    emptyStateTitle.textContent = "Start by opening a project folder";
    emptyStateDescription.textContent =
      "Use a command below to open a folder, browse commands, or jump straight into a writing workspace.";
    emptyStatePrimaryButton.textContent = "Open Project";
    emptyStatePrimaryButton.hidden = false;
    emptyStateSecondaryButton.hidden = true;
    emptyStateShortcutsLabel.hidden = false;
    renderEmptyStateShortcutRows([
      { label: "Open project", key: primaryShortcutLabel("O") },
      { label: "Toggle fullscreen", key: "F11" }
    ]);
    return;
  }

  emptyStateScreen.dataset.mode = "project";
  emptyStateEyebrow.hidden = false;
  emptyStateTitle.hidden = false;
  emptyStateDescription.hidden = false;
  emptyStateShortcutsLabel.hidden = false;
  emptyStateEyebrow.textContent = getProjectDisplayTitle(project.projectPath);
  emptyStateTitle.textContent = "Write something wonderful";
  emptyStateDescription.textContent =
    "Select a document in the sidebar, or create a new file or folder to begin drafting in this project.";
  emptyStatePrimaryButton.textContent = "New File";
  emptyStatePrimaryButton.hidden = false;
  emptyStateSecondaryButton.hidden = false;
  emptyStateSecondaryButton.textContent = "New Folder";
  renderEmptyStateShortcutRows([
    { label: "New file", key: primaryShortcutLabel("N") },
    { label: "Save file", key: primaryShortcutLabel("S") },
    { label: "Toggle sidebar", key: primaryShortcutLabel("B") },
    { label: "Text zoom", key: `${primaryShortcutLabel("+")} / ${primaryShortcutLabel("-")}` }
  ]);
}

function syncProjectPathLabels(projectPath: string): void {
  projectUiController.syncProjectPathLabels(projectPath, project);
}

function getSelectedFolderPath(): string | null {
  if (selectedTreeKind === "folder" && selectedTreePath !== null) {
    return selectedTreePath;
  }

  return null;
}

function renderStatusFooter(): void {
  projectUiController.renderStatusFooter(project);
}

const projectTreeRenderCallbacks = createProjectTreeRenderCallbacks({
  state: {
    getSelectedTreePath: () => selectedTreePath,
    setSelectedTreePath: (value) => {
      selectedTreePath = value;
    },
    getSelectedTreeKind: () => selectedTreeKind,
    setSelectedTreeKind: (value) => {
      selectedTreeKind = value;
    },
    getCurrentFilePath: () => currentFilePath,
    getDragSourceFilePath: () => dragSourceFilePath,
    setDragSourceFilePath: (value) => {
      dragSourceFilePath = value;
    }
  },
  collapsedFolderPaths,
  actions: {
    closeTreeContextMenu,
    setSidebarFaded,
    renderFileList,
    saveCollapsedFolders,
    closeCurrentFile,
    openFile,
    moveFileToFolder: (sourcePath, toFolderRelativePath) =>
      projectEntryActionsController.moveFileToFolder(sourcePath, toFolderRelativePath)
  }
});

function renderFileList(): void {
  renderProjectTreeList({
    listElement: fileList,
    project,
    selectedTreePath,
    selectedTreeKind,
    currentFilePath,
    dirty,
    collapsedFolderPaths,
    maxTreeIndent: MAX_TREE_INDENT,
    getProjectDisplayTitle,
    getDragSourceFilePath: () => dragSourceFilePath,
    callbacks: projectTreeRenderCallbacks
  });
}

function syncSettingsInputs(settings: AppSettings): void {
  projectUiController.syncSettingsInputs(settings, project);
}

function applyProjectMetadata(metadata: ProjectMetadata): void {
  cancelPendingLiveWordCount();
  stopSidebarResize();
  resetTreeState();
  setProjectState(metadata);
  restoreCollapsedFolders();
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
  liveWordCountTracker.cancelPending();
}

function scheduleLiveWordCountRefresh(): void {
  if (!project || !currentFilePath) {
    return;
  }

  const contentSnapshot = editor.getValue();
  const filePathSnapshot = currentFilePath;
  liveWordCountTracker.schedule({
    contentSnapshot,
    filePathSnapshot,
    countPreviewWords: (text) => window.witApi.countPreviewWords(text),
    shouldApply: (snapshotPath) => Boolean(project && currentFilePath === snapshotPath),
    onApply: (nextWordCount) => {
      if (!project || currentFilePath !== filePathSnapshot) {
        return;
      }

      const delta = nextWordCount - currentFileWordCount;
      if (delta === 0) {
        return;
      }

      project.wordCount = Math.max(0, project.wordCount + delta);
      currentFileWordCount = nextWordCount;
      renderStatusFooter();
    }
  });
}

async function persistCurrentFile(showStatus = true): Promise<boolean> {
  return persistCurrentFileInSession({
    project,
    currentFilePath,
    dirty,
    showStatus,
    editorValue: editor.getValue(),
    cancelPendingLiveWordCount,
    saveFile: (relativePath, content) => window.witApi.saveFile(relativePath, content),
    getWordCount: () => window.witApi.getWordCount(),
    countPreviewWords: (text) => window.witApi.countPreviewWords(text),
    setProjectWordCount: (wordCount) => {
      if (!project) {
        return;
      }

      project.wordCount = wordCount;
    },
    setCurrentFileWordCount: (wordCount) => {
      currentFileWordCount = wordCount;
    },
    setDirty,
    renderStatusFooter,
    setStatus
  });
}

function saveCurrentFileSynchronously(): void {
  saveCurrentFileSynchronouslyInSession({
    project,
    currentFilePath,
    dirty,
    editorValue: editor.getValue(),
    saveFileSync: (relativePath, content) => window.witApi.saveFileSync(relativePath, content),
    setDirty
  });
}

async function openFile(relativePath: string): Promise<void> {
  await openFileInEditorSession({
    relativePath,
    project,
    persistCurrentFile,
    cancelPendingLiveWordCount,
    openFile: (nextPath) => window.witApi.openFile(nextPath),
    countPreviewWords: (text) => window.witApi.countPreviewWords(text),
    setEditorValueSilently: (content) => {
      suppressDirtyEvents = true;
      editor.setValue(content);
      suppressDirtyEvents = false;
    },
    setCurrentFilePath: (nextPath) => {
      setCurrentFilePathState(nextPath);
    },
    setSelectedTreeToFile: (nextPath) => {
      selectedTreePath = nextPath;
      selectedTreeKind = "file";
    },
    setCurrentFileWordCount: (wordCount) => {
      currentFileWordCount = wordCount;
    },
    setActiveFileLabel: (nextPath) => {
      activeFileLabel.textContent = nextPath;
      activeFileLabel.title = nextPath;
    },
    setEditorPlaceholder: (value) => {
      editor.setPlaceholder(value);
    },
    setDirty,
    setSidebarFaded,
    renderFileList,
    setEditorWritable,
    renderEmptyEditorState,
    persistLastOpenedFilePath,
    focusEditor: () => {
      editor.focus();
    },
    setStatus
  });
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
  if (!project) {
    return;
  }

  try {
    await persistCurrentFile(false);

    const activeSeconds = consumeActiveTypingSeconds();

    const result = await window.witApi.autosaveTick(activeSeconds);
    project.wordCount = result.wordCount;
    project.totalWritingSeconds = result.totalWritingSeconds;
    snapshotLabelController.update(parseSnapshotTimestamp(result.snapshotCreatedAt) ?? Date.now());
    renderStatusFooter();

    setStatus(`Autosaved (${project.settings.autosaveIntervalSec}s interval)`, 2000);
  } catch {
    setStatus("Autosave tick failed.");
  }
}

async function openProjectPicker(): Promise<void> {
  await projectLifecycleController.openProjectPicker();
}

async function closeCurrentProject(): Promise<void> {
  await projectLifecycleController.closeCurrentProject();
}

async function persistSettings(update: Partial<AppSettings>): Promise<void> {
  settingsPersistQueue = settingsPersistQueue
    .then(async () => {
      if (!project) {
        return;
      }

      const nextSettings: AppSettings = {
        ...project.settings,
        ...update
      };

      const savedSettings = await window.witApi.updateSettings(nextSettings);
      if (!project) {
        return;
      }

      project.settings = savedSettings;
      syncSettingsInputs(savedSettings);
      renderStatusFooter();
      restartAutosaveTimer();
      setStatus("Settings saved.", 1300);
    })
    .catch(() => {
      setStatus("Could not save settings.");
    });

  return settingsPersistQueue;
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
  projectTreeState: {
    getSelectedTreePath: () => selectedTreePath,
    setSelectedTreePath: (value) => {
      selectedTreePath = value;
    },
    getSelectedTreeKind: () => selectedTreeKind,
    setSelectedTreeKind: (value) => {
      selectedTreeKind = value;
    },
    getCurrentFilePath: () => currentFilePath,
    getDragSourceFilePath: () => dragSourceFilePath,
    setDragSourceFilePath: (value) => {
      dragSourceFilePath = value;
    }
  },
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
  setDragSourceFilePath: (value) => {
    dragSourceFilePath = value;
  },
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
