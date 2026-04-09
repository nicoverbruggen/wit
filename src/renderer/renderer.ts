import type { AppSettings, ProjectMetadata } from "../shared/types";
import { createTextareaEditor } from "./editor-adapter.js";

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
const emptyStateScreen = document.getElementById("empty-state-screen") as HTMLDivElement;
const emptyStateEyebrow = document.getElementById("empty-state-eyebrow") as HTMLParagraphElement;
const emptyStateTitle = document.getElementById("empty-state-title") as HTMLHeadingElement;
const emptyStateDescription = document.getElementById("empty-state-description") as HTMLParagraphElement;
const emptyStatePrimaryButton = document.getElementById("empty-state-primary-btn") as HTMLButtonElement;
const emptyStateSecondaryButton = document.getElementById("empty-state-secondary-btn") as HTMLButtonElement;
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
const editorElement = document.getElementById("editor") as HTMLTextAreaElement;
const editor = createTextareaEditor(editorElement);
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
const lineHeightInput = document.getElementById("line-height-input") as HTMLInputElement;
const lineHeightValue = document.getElementById("line-height-value") as HTMLSpanElement;
const paragraphSpacingSelect = document.getElementById("paragraph-spacing-select") as HTMLSelectElement;
const editorWidthInput = document.getElementById("editor-width-input") as HTMLInputElement;
const editorWidthValue = document.getElementById("editor-width-value") as HTMLSpanElement;
const settingsCloseButton = document.getElementById("settings-close-btn") as HTMLButtonElement;
const textZoomSelect = document.getElementById("text-zoom-select") as HTMLSelectElement;
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
const BUILT_IN_EDITOR_FONTS = ["Sourcerer", "Readerly", "iA Writer Mono"] as const;
const DEFAULT_EDITOR_FONT = "Readerly";

type FolderNode = {
  kind: "folder";
  name: string;
  relativePath: string;
  children: TreeNode[];
};

type FileNode = {
  kind: "file";
  name: string;
  relativePath: string;
};

type TreeNode = FolderNode | FileNode;
type SelectedTreeKind = "file" | "folder";
type SettingsTabKey = "writing" | "editor" | "autosave" | "about";

type AppInfo = {
  version: string;
  description: string;
  author: string;
  website: string;
};

type LocalFontData = {
  family: string;
};

type WindowWithLocalFonts = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

let project: ProjectMetadata | null = null;
let currentFilePath: string | null = null;
let currentFileWordCount = 0;
let dirty = false;
let lastTypedAtMs: number | null = null;
let activeTypingSeconds = 0;
const TYPING_IDLE_THRESHOLD_MS = 5_000;
let autosaveTimer: number | null = null;
let autosaveInFlight = false;
let statusResetTimer: number | null = null;
let suppressDirtyEvents = false;
let editorBaseFontSizePx = 0;
let editorZoomFactor = 1;
let isWindowFullscreen = false;
let liveWordCountTimer: number | null = null;
let liveWordCountRequestToken = 0;
let snapshotCreatedAtMs: number | null = null;
let snapshotLabelTimer: number | null = null;
let editorWidthGuideTimer: number | null = null;
let settingsPersistQueue: Promise<void> = Promise.resolve();
let dragSourceFilePath: string | null = null;
const collapsedFolderPaths = new Set<string>();
let selectedTreePath: string | null = null;
let selectedTreeKind: SelectedTreeKind | null = null;
let sidebarVisible = true;
let sidebarVisibleBeforeFullscreen = true;
let sidebarWidthPx = DEFAULT_SIDEBAR_WIDTH_PX;
let sidebarResizeCleanup: (() => void) | null = null;
let currentSettingsTab: SettingsTabKey = "writing";
let currentEditorLineHeight = 1.68;
let currentEditorParagraphSpacing: AppSettings["editorParagraphSpacing"] = "none";
let systemFontFamilies: string[] = [];

const subscriptions: Array<() => void> = [];
type TreeContextAction = "new-file" | "new-folder" | "rename" | "delete" | "close-project";
type TestWindowWithContextAction = Window & {
  __WIT_TEST_TREE_ACTION?: TreeContextAction;
};

function formatWritingTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function primaryShortcutLabel(key: string): string {
  return window.witApi.getPlatform() === "darwin" ? `Cmd+${key}` : `Ctrl+${key}`;
}


function normalizePathInput(input: string): string {
  return input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function pathEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function getBaseName(relativePath: string): string {
  const normalized = normalizePathInput(relativePath);
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts.at(-1) ?? normalized;
}

function getParentFolderPath(relativePath: string): string | null {
  const normalized = normalizePathInput(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  return normalized.slice(0, slashIndex);
}

function getDropDestinationLabel(relativeFolderPath: string): string {
  if (relativeFolderPath.length > 0) {
    return relativeFolderPath;
  }

  return "project root";
}

function withOriginalFileExtension(newName: string, originalPath: string): string {
  const originalBaseName = getBaseName(originalPath);
  const extensionIndex = originalBaseName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < originalBaseName.length - 1;
  const newNameHasExtension = /\.[^./\\]+$/.test(newName);

  if (!hasExtension || newNameHasExtension) {
    return newName;
  }

  return `${newName}${originalBaseName.slice(extensionIndex)}`;
}

function buildSiblingPath(relativePath: string, nextName: string): string {
  const parentPath = getParentFolderPath(relativePath);
  return parentPath ? `${parentPath}/${nextName}` : nextName;
}

function normalizeEditorMaxWidth(value: number): number {
  return Math.max(360, Math.min(1200, Math.round(value)));
}

function formatRelativeElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));

  if (seconds < 10) {
    return "just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseSnapshotTimestamp(snapshotName: string): number | null {
  const matches = snapshotName.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/
  );

  if (!matches) {
    return null;
  }

  const [, year, month, day, hour, minute, second, millisecond] = matches;
  const timestamp = Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    Number.parseInt(second, 10),
    Number.parseInt(millisecond ?? "0", 10)
  );

  return Number.isFinite(timestamp) ? timestamp : null;
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
  if (!snapshotCreatedAtMs) {
    snapshotLabel.textContent = "✓ --";
    snapshotLabel.title = "No snapshot yet";
    return;
  }

  const elapsedMs = Date.now() - snapshotCreatedAtMs;
  const relative = formatRelativeElapsed(elapsedMs);
  snapshotLabel.textContent = `✓ ${relative}`;
  snapshotLabel.title = `Last snapshot at ${new Date(snapshotCreatedAtMs).toLocaleString()}`;
}

function restartSnapshotLabelTimer(): void {
  if (snapshotLabelTimer) {
    window.clearInterval(snapshotLabelTimer);
    snapshotLabelTimer = null;
  }

  snapshotLabelTimer = window.setInterval(() => {
    if (!snapshotCreatedAtMs) {
      return;
    }

    renderSnapshotLabel();
  }, SNAPSHOT_LABEL_REFRESH_MS);
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

function recordTypingActivity(): void {
  const now = Date.now();

  if (lastTypedAtMs !== null) {
    const gap = now - lastTypedAtMs;
    if (gap < TYPING_IDLE_THRESHOLD_MS) {
      activeTypingSeconds += gap / 1000;
    }
  }

  lastTypedAtMs = now;
}

function consumeActiveTypingSeconds(): number {
  const seconds = Math.floor(activeTypingSeconds);
  activeTypingSeconds = 0;
  lastTypedAtMs = null;
  return seconds;
}

function setDirty(nextDirty: boolean): void {
  dirty = nextDirty;
  dirtyIndicator.hidden = !nextDirty;
  syncActiveFileMarkerState();
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
  lineHeightInput.disabled = !enabled;
  editorWidthInput.disabled = !enabled;
  themeSelect.disabled = !enabled;
  fontSelect.disabled = !enabled;
  gitSnapshotsNotice.hidden = !enabled || Boolean(project?.isGitRepository);
}

function setSidebarFaded(nextFaded: boolean): void {
  const shouldFade = Boolean(sidebarVisible && project && currentFilePath && nextFaded);
  appShell.classList.toggle("sidebar-faded", shouldFade);
}

function clampSidebarWidth(width: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, Math.round(width)));
}

function applySidebarWidth(width: number): void {
  sidebarWidthPx = clampSidebarWidth(width);
  appShell.style.setProperty("--sidebar-width", `${sidebarWidthPx}px`);

  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthPx));
  } catch {
    // Ignore storage failures.
  }
}

function loadSidebarWidthPreference(): void {
  try {
    const rawValue = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!rawValue) {
      applySidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
      return;
    }

    const parsed = Number.parseInt(rawValue, 10);
    applySidebarWidth(Number.isFinite(parsed) ? parsed : DEFAULT_SIDEBAR_WIDTH_PX);
  } catch {
    applySidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
  }
}

function syncSidebarToggleButton(): void {
  const sidebarAvailable = Boolean(project);
  toggleSidebarButton.hidden = !sidebarAvailable;

  if (!sidebarAvailable) {
    toggleSidebarButton.disabled = false;
    toggleSidebarButton.title = "Hide sidebar";
    toggleSidebarButton.setAttribute("aria-label", "Hide sidebar");
    toggleSidebarButton.setAttribute("aria-pressed", "false");
    return;
  }

  toggleSidebarButton.disabled = false;
  const nextActionLabel = sidebarVisible ? "Hide sidebar" : "Show sidebar";
  toggleSidebarButton.title = nextActionLabel;
  toggleSidebarButton.setAttribute("aria-label", nextActionLabel);
  toggleSidebarButton.setAttribute("aria-pressed", String(sidebarVisible));
}

function syncFullscreenToggleButton(isFullscreen: boolean): void {
  const wasFullscreen = isWindowFullscreen;
  isWindowFullscreen = isFullscreen;
  const nextActionLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenToggleButton.title = nextActionLabel;
  fullscreenToggleButton.setAttribute("aria-label", nextActionLabel);
  fullscreenToggleButton.setAttribute("aria-pressed", String(isFullscreen));

  if (isFullscreen && !wasFullscreen) {
    sidebarVisibleBeforeFullscreen = sidebarVisible;
    setSidebarVisibility(false, false);
  } else if (!isFullscreen && wasFullscreen) {
    setSidebarVisibility(sidebarVisibleBeforeFullscreen, false);
  }

  applyEditorZoom(false);
}

function setSidebarVisibility(nextVisible: boolean, showStatus = true): void {
  if (sidebarVisible === nextVisible) {
    syncSidebarToggleButton();
    return;
  }

  sidebarVisible = nextVisible;
  appShell.classList.toggle("sidebar-hidden", !sidebarVisible);
  appShell.classList.remove("sidebar-faded");
  syncSidebarToggleButton();

  if (showStatus) {
    setStatus(sidebarVisible ? "Sidebar shown." : "Sidebar hidden.", 1200);
  }
}

function toggleSidebarVisibility(): void {
  if (!project) {
    return;
  }

  setSidebarVisibility(!sidebarVisible);
}

function stopSidebarResize(): void {
  if (!sidebarResizeCleanup) {
    return;
  }

  sidebarResizeCleanup();
  sidebarResizeCleanup = null;
  appShell.classList.remove("sidebar-resizing");
}

function beginSidebarResize(pointerClientX: number): void {
  if (!project || !sidebarVisible) {
    return;
  }

  stopSidebarResize();
  appShell.classList.add("sidebar-resizing");

  const shellLeft = appShell.getBoundingClientRect().left;
  const handlePointerMove = (event: MouseEvent) => {
    applySidebarWidth(event.clientX - shellLeft);
  };
  const handlePointerUp = () => {
    stopSidebarResize();
  };

  applySidebarWidth(pointerClientX - shellLeft);
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp, { once: true });

  sidebarResizeCleanup = () => {
    window.removeEventListener("mousemove", handlePointerMove);
  };
}

function openSettingsDialog(): void {
  if (settingsToggleButton.disabled) {
    return;
  }

  if (typeof settingsDialog.showModal !== "function") {
    setStatus("Settings dialog is unavailable.");
    return;
  }

  if (!settingsDialog.open) {
    setActiveSettingsTab(currentSettingsTab);
    settingsDialog.showModal();
  }
}

function setActiveSettingsTab(nextTab: SettingsTabKey): void {
  currentSettingsTab = nextTab;

  const tabs: Array<{ key: SettingsTabKey; button: HTMLButtonElement; panel: HTMLElement }> = [
    { key: "writing", button: settingsTabWriting, panel: settingsPanelWriting },
    { key: "editor", button: settingsTabEditor, panel: settingsPanelEditor },
    { key: "autosave", button: settingsTabAutosave, panel: settingsPanelAutosave },
    { key: "about", button: settingsTabAbout, panel: settingsPanelAbout }
  ];

  for (const tab of tabs) {
    const isActive = tab.key === nextTab;
    tab.button.setAttribute("aria-selected", String(isActive));
    tab.button.tabIndex = isActive ? 0 : -1;
    tab.panel.hidden = !isActive;
  }
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

function normalizeLineHeightValue(value: number): number {
  const bounded = Math.max(1.2, Math.min(2.4, value));
  return Number(bounded.toFixed(2));
}

function normalizeParagraphSpacingValue(value: string): AppSettings["editorParagraphSpacing"] {
  switch (value) {
    case "tight":
    case "loose":
    case "very-loose":
      return value;
    default:
      return "none";
  }
}

function normalizeDefaultFileExtensionValue(value: string): AppSettings["defaultFileExtension"] {
  switch (value) {
    case ".md":
    case ".wxt":
      return value;
    default:
      return ".txt";
  }
}

function getParagraphSpacingLineHeightBoost(spacing: AppSettings["editorParagraphSpacing"]): number {
  switch (spacing) {
    case "tight":
      return 0.1;
    case "loose":
      return 0.22;
    case "very-loose":
      return 0.36;
    default:
      return 0;
  }
}

function refreshEditorLineHeight(): void {
  const effectiveLineHeight = normalizeLineHeightValue(
    currentEditorLineHeight + getParagraphSpacingLineHeightBoost(currentEditorParagraphSpacing)
  );
  editor.setLineHeight(effectiveLineHeight);
}

function applyEditorLineHeight(lineHeight: number): void {
  const normalized = normalizeLineHeightValue(lineHeight);
  currentEditorLineHeight = normalized;
  refreshEditorLineHeight();
  lineHeightValue.textContent = normalized.toFixed(2);
  lineHeightInput.value = normalized.toFixed(2);
}

function applyEditorParagraphSpacing(spacing: AppSettings["editorParagraphSpacing"]): void {
  currentEditorParagraphSpacing = spacing;
  paragraphSpacingSelect.value = spacing;
  refreshEditorLineHeight();
}

function applyEditorMaxWidth(editorWidth: number): void {
  const normalized = normalizeEditorMaxWidth(editorWidth);
  const widthValue = `${normalized}px`;
  editorWrap.style.setProperty("--editor-max-width", widthValue);
  editorWidthValue.textContent = widthValue;
  editorWidthInput.value = String(normalized);
}

function applyEditorFont(fontFamily: string): void {
  editor.setFontFamily(`"${fontFamily}", "Palatino", "Times New Roman", serif`);
}

function populateFontSelect(selectedFont: string): void {
  fontSelect.innerHTML = "";

  const seenValues = new Set<string>();
  const appendOption = (value: string, label = value): void => {
    if (seenValues.has(value)) {
      return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    fontSelect.appendChild(option);
    seenValues.add(value);
  };

  for (const fontName of BUILT_IN_EDITOR_FONTS) {
    appendOption(fontName);
  }

  if (systemFontFamilies.length > 0) {
    const separator = document.createElement("option");
    separator.disabled = true;
    separator.textContent = "\u2014\u2014 System Fonts \u2014\u2014";
    fontSelect.appendChild(separator);

    for (const fontName of systemFontFamilies) {
      appendOption(fontName);
    }
  }

  if (selectedFont && !seenValues.has(selectedFont)) {
    appendOption(selectedFont, `${selectedFont} (Current)`);
  }

  fontSelect.value = seenValues.has(selectedFont) ? selectedFont : DEFAULT_EDITOR_FONT;
}

async function loadSystemFonts(): Promise<void> {
  const fontWindow = window as WindowWithLocalFonts;
  if (typeof fontWindow.queryLocalFonts !== "function") {
    systemFontFamilies = [];
    return;
  }

  try {
    const localFonts = await fontWindow.queryLocalFonts();
    const uniqueFamilies = new Set<string>();

    for (const font of localFonts) {
      if (typeof font.family !== "string") {
        continue;
      }

      const normalizedFamily = font.family.trim();
      if (
        !normalizedFamily ||
        BUILT_IN_EDITOR_FONTS.includes(normalizedFamily as typeof BUILT_IN_EDITOR_FONTS[number])
      ) {
        continue;
      }

      uniqueFamilies.add(normalizedFamily);
    }

    systemFontFamilies = [...uniqueFamilies].sort((left, right) => left.localeCompare(right));
  } catch {
    systemFontFamilies = [];
  }
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

function findClosestZoomPreset(targetPercent: number): number {
  return EDITOR_ZOOM_PRESETS.reduce((closest, current) =>
    Math.abs(current - targetPercent) < Math.abs(closest - targetPercent) ? current : closest
  );
}

function syncZoomControlWithState(): void {
  const currentPercent = Math.round(editorZoomFactor * 100);
  textZoomSelect.value = String(findClosestZoomPreset(currentPercent));
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
  const bounded = Math.max(50, Math.min(250, Math.round(percent)));
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
  currentFilePath = null;
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

function clearProjectState(showStatusMessage = false): void {
  project = null;
  stopSidebarResize();
  resetTreeState();
  resetActiveFile();
  snapshotCreatedAtMs = null;
  renderSnapshotLabel();
  syncProjectPathLabels("No project selected");
  setProjectControlsEnabled(false);
  setSidebarVisibility(false, false);
  setSidebarFaded(false);
  themeSelect.value = "light";
  applyTheme("light");
  renderStatusFooter();
  renderFileList();
  restartAutosaveTimer();
  renderEmptyEditorState();

  if (showStatusMessage) {
    setStatus("Project closed.", 2000);
  }
}

function renderEmptyStateShortcutRows(shortcuts: Array<{ label: string; key: string }>): void {
  emptyStateShortcutsList.innerHTML = "";

  for (const shortcut of shortcuts) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const key = document.createElement("span");

    label.className = "empty-state-shortcut-label";
    label.textContent = shortcut.label;
    key.className = "empty-state-shortcut-key";
    key.textContent = shortcut.key;

    item.append(label, key);
    emptyStateShortcutsList.appendChild(item);
  }
}

function renderEmptyEditorState(): void {
  const showEmptyState = !project || !currentFilePath;
  editorWrap.classList.toggle("show-empty-state", showEmptyState);
  emptyStateScreen.hidden = !showEmptyState;

  if (!showEmptyState) {
    return;
  }

  if (!project) {
    emptyStateEyebrow.textContent = "Wit";
    emptyStateTitle.textContent = "Open a writing project";
    emptyStateDescription.textContent =
      "Choose a project folder to start writing, autosaving, and creating full text snapshots.";
    emptyStatePrimaryButton.textContent = "Open Project";
    emptyStateSecondaryButton.hidden = true;
    renderEmptyStateShortcutRows([
      { label: "Open project", key: primaryShortcutLabel("O") },
      { label: "Toggle sidebar", key: primaryShortcutLabel("B") },
      { label: "Fullscreen", key: "Toolbar" },
      { label: "Open settings", key: "Project only" }
    ]);
    return;
  }

  emptyStateEyebrow.textContent = getProjectDisplayTitle(project.projectPath);
  emptyStateTitle.textContent = "Choose a file or start a new one";
  emptyStateDescription.textContent =
    "Select a document in the sidebar, or create a new file or folder to begin drafting in this project.";
  emptyStatePrimaryButton.textContent = "New File";
  emptyStateSecondaryButton.hidden = false;
  emptyStateSecondaryButton.textContent = "New Folder";
  renderEmptyStateShortcutRows([
    { label: "New file", key: primaryShortcutLabel("N") },
    { label: "Save file", key: primaryShortcutLabel("S") },
    { label: "Toggle sidebar", key: primaryShortcutLabel("B") },
    { label: "Text zoom", key: `${primaryShortcutLabel("+")} / ${primaryShortcutLabel("-")}` }
  ]);
}

function toIndentClass(depth: number): string {
  return `tree-indent-${Math.min(depth, MAX_TREE_INDENT)}`;
}

function compareTreeNodes(left: TreeNode, right: TreeNode): number {
  if (left.kind !== right.kind) {
    return left.kind === "folder" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function insertPathIntoTree(root: FolderNode, filePath: string): void {
  const parts = filePath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }

  let parent = root;
  let accumulatedPath = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
    const isLeaf = index === parts.length - 1;

    if (isLeaf) {
      parent.children.push({
        kind: "file",
        name: part,
        relativePath: accumulatedPath
      });
      continue;
    }

    let folder = parent.children.find(
      (child): child is FolderNode => child.kind === "folder" && child.relativePath === accumulatedPath
    );

    if (!folder) {
      folder = {
        kind: "folder",
        name: part,
        relativePath: accumulatedPath,
        children: []
      };
      parent.children.push(folder);
    }

    parent = folder;
  }
}

function insertFolderIntoTree(root: FolderNode, folderPath: string): void {
  const parts = folderPath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }

  let parent = root;
  let accumulatedPath = "";

  for (const part of parts) {
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

    let folder = parent.children.find(
      (child): child is FolderNode => child.kind === "folder" && child.relativePath === accumulatedPath
    );

    if (!folder) {
      folder = {
        kind: "folder",
        name: part,
        relativePath: accumulatedPath,
        children: []
      };
      parent.children.push(folder);
    }

    parent = folder;
  }
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  const sorted = [...nodes].sort(compareTreeNodes);

  return sorted.map((node) => {
    if (node.kind === "folder") {
      return {
        ...node,
        children: sortTree(node.children)
      };
    }

    return node;
  });
}

function buildProjectTree(paths: string[], folders: string[]): TreeNode[] {
  const root: FolderNode = {
    kind: "folder",
    name: "",
    relativePath: "",
    children: []
  };

  for (const folderPath of folders) {
    insertFolderIntoTree(root, folderPath);
  }

  for (const filePath of paths) {
    insertPathIntoTree(root, filePath);
  }

  return sortTree(root.children);
}

function renderTreeNodes(nodes: TreeNode[], depth: number): void {
  for (const node of nodes) {
    if (node.kind === "folder") {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const disclosure = document.createElement("span");
      const icon = document.createElement("span");
      const label = document.createElement("span");
      const isCollapsed = collapsedFolderPaths.has(node.relativePath);

      button.type = "button";
      const selectedClass =
        selectedTreeKind === "folder" && selectedTreePath === node.relativePath ? "active" : "";
      button.className = `tree-item folder-button ${toIndentClass(depth)} ${selectedClass}`;
      button.dataset.relativePath = node.relativePath;
      button.dataset.itemKind = "folder";
      button.title = node.relativePath;
      button.setAttribute("aria-expanded", String(!isCollapsed));
      disclosure.className = "material-symbol-icon tree-disclosure";
      disclosure.textContent = isCollapsed ? "chevron_right" : "expand_more";
      disclosure.setAttribute("aria-hidden", "true");
      icon.className = "material-symbol-icon folder-icon";
      icon.textContent = isCollapsed ? "folder" : "folder_open";
      icon.setAttribute("aria-hidden", "true");
      label.className = "tree-label";
      label.textContent = node.name;

      button.append(disclosure, icon, label);
      button.addEventListener("click", () => {
        closeTreeContextMenu();

        if (selectedTreePath === node.relativePath && selectedTreeKind === "folder" && !isCollapsed) {
          collapsedFolderPaths.add(node.relativePath);
        } else {
          collapsedFolderPaths.delete(node.relativePath);
        }

        selectedTreePath = node.relativePath;
        selectedTreeKind = "folder";
        saveCollapsedFolders();
        setSidebarFaded(false);
        renderFileList();
      });
      button.addEventListener("dragenter", () => {
        if (!dragSourceFilePath) {
          return;
        }

        button.classList.add("drop-target");
      });
      button.addEventListener("dragover", (event) => {
        if (!dragSourceFilePath && !event.dataTransfer?.types.includes("text/wit-file-path")) {
          return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        button.classList.add("drop-target");
      });
      button.addEventListener("dragleave", () => {
        button.classList.remove("drop-target");
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        button.classList.remove("drop-target");
        const sourcePath =
          event.dataTransfer?.getData("text/wit-file-path") || dragSourceFilePath;

        if (!sourcePath) {
          return;
        }

        void moveFileToFolder(sourcePath, node.relativePath);
      });

      item.appendChild(button);
      fileList.appendChild(item);

      if (!isCollapsed) {
        renderTreeNodes(node.children, depth + 1);
      }

      continue;
    }

    const item = document.createElement("li");
    const button = document.createElement("button");
    const disclosurePlaceholder = document.createElement("span");
    const icon = document.createElement("span");
    const label = document.createElement("span");
    const marker = document.createElement("span");
    const isCurrentFile = currentFilePath !== null && pathEquals(currentFilePath, node.relativePath);

    button.type = "button";
    const selectedClass =
      selectedTreeKind === "file" && selectedTreePath === node.relativePath ? "active" : "";
    button.className = `tree-item file-button ${toIndentClass(depth)} ${selectedClass}`;
    button.dataset.relativePath = node.relativePath;
    button.dataset.itemKind = "file";
    button.draggable = true;
    button.title = node.relativePath;
    disclosurePlaceholder.className = "tree-disclosure-placeholder";
    disclosurePlaceholder.setAttribute("aria-hidden", "true");
    icon.className = "material-symbol-icon file-icon";
    icon.textContent = "description";
    icon.setAttribute("aria-hidden", "true");
    label.className = "tree-label";
    label.textContent = node.name;
    marker.className = "active-file-marker";
    marker.hidden = !isCurrentFile;
    marker.dataset.dirty = String(isCurrentFile && dirty);
    marker.setAttribute("aria-hidden", "true");

    button.append(disclosurePlaceholder, icon, label, marker);
    button.addEventListener("click", () => {
      selectedTreePath = node.relativePath;
      selectedTreeKind = "file";
      closeTreeContextMenu();
      void openFile(node.relativePath);
    });
    button.addEventListener("dragstart", (event) => {
      dragSourceFilePath = node.relativePath;
      closeTreeContextMenu();
      button.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/wit-file-path", node.relativePath);
      }
    });
    button.addEventListener("dragend", () => {
      dragSourceFilePath = null;
      button.classList.remove("dragging");
      fileList.querySelectorAll(".drop-target").forEach((element) => {
        element.classList.remove("drop-target");
      });
    });

    item.appendChild(button);
    fileList.appendChild(item);
  }
}

function renderRootTreeItem(): void {
  if (!project) {
    return;
  }

  const item = document.createElement("li");
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");
  const projectSuffix = document.createElement("span");
  const selectedClass = selectedTreeKind === "folder" && selectedTreePath === "" ? "active" : "";

  button.type = "button";
  button.className = `tree-item folder-button tree-root-item ${selectedClass}`;
  button.dataset.relativePath = "";
  button.dataset.itemKind = "project";
  button.title = project.projectPath;
  icon.className = "material-symbol-icon folder-icon";
  icon.textContent = "work";
  icon.setAttribute("aria-hidden", "true");
  label.className = "tree-label";
  label.textContent = getProjectDisplayTitle(project.projectPath);
  projectSuffix.className = "tree-root-suffix";
  projectSuffix.textContent = "PROJECT";

  button.append(icon, label, projectSuffix);
  button.addEventListener("click", () => {
    const closingCurrentFile =
      selectedTreePath === "" && selectedTreeKind === "folder" && currentFilePath !== null;

    selectedTreePath = "";
    selectedTreeKind = "folder";
    closeTreeContextMenu();
    setSidebarFaded(false);

    if (closingCurrentFile) {
      resetActiveFile();
      setStatus("Closed current file.", 1200);
      return;
    }

    renderFileList();
  });
  button.addEventListener("dragenter", () => {
    if (!dragSourceFilePath) {
      return;
    }

    button.classList.add("drop-target");
  });
  button.addEventListener("dragover", (event) => {
    if (!dragSourceFilePath && !event.dataTransfer?.types.includes("text/wit-file-path")) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    button.classList.add("drop-target");
  });
  button.addEventListener("dragleave", () => {
    button.classList.remove("drop-target");
  });
  button.addEventListener("drop", (event) => {
    event.preventDefault();
    button.classList.remove("drop-target");
    const sourcePath =
      event.dataTransfer?.getData("text/wit-file-path") || dragSourceFilePath;

    if (!sourcePath) {
      return;
    }

    void moveFileToFolder(sourcePath, "");
  });

  item.appendChild(button);
  fileList.appendChild(item);
}

function syncProjectPathLabels(projectPath: string): void {
  if (!project) {
    sidebarProjectTitle.textContent = "No Project";
    sidebarProjectTitle.title = "";
    projectPathLabel.textContent = "No project selected";
    projectPathLabel.title = "";
    return;
  }

  const displayName = getProjectDisplayTitle(projectPath);
  sidebarProjectTitle.textContent = displayName;
  sidebarProjectTitle.title = projectPath;
  projectPathLabel.textContent = displayName;
  projectPathLabel.title = projectPath;
}

function getSelectedFolderPath(): string | null {
  if (selectedTreeKind === "folder" && selectedTreePath !== null) {
    return selectedTreePath;
  }

  return null;
}

function resolveNewFilePath(rawInput: string): { relativePath: string | null; error: string | null } {
  if (!project) {
    return { relativePath: null, error: "Open a project first." };
  }

  let relativePath = normalizePathInput(rawInput);
  if (!relativePath) {
    return { relativePath: null, error: "File name cannot be empty." };
  }

  if (relativePath.endsWith("/")) {
    return { relativePath: null, error: "File path cannot end with '/'." };
  }

  const selectedFolder = getSelectedFolderPath();
  if (selectedFolder && !relativePath.includes("/")) {
    relativePath = `${selectedFolder}/${relativePath}`;
  }

  if (!/\.(txt|md|markdown|text|wxt)$/i.test(relativePath)) {
    const defaultExtension = normalizeDefaultFileExtensionValue(project.settings.defaultFileExtension);
    relativePath = `${relativePath}${defaultExtension}`;
  }

  const existingFile = project.files.find((filePath) => pathEquals(filePath, relativePath));
  if (existingFile) {
    return { relativePath: null, error: "A file with that path already exists." };
  }

  const existingFolder = project.folders.find((folderPath) => pathEquals(folderPath, relativePath));
  if (existingFolder) {
    return { relativePath: null, error: "A folder already exists at that path." };
  }

  return { relativePath, error: null };
}

function resolveNewFolderPath(rawInput: string): { relativePath: string | null; error: string | null } {
  if (!project) {
    return { relativePath: null, error: "Open a project first." };
  }

  let relativePath = normalizePathInput(rawInput);
  if (!relativePath) {
    return { relativePath: null, error: "Folder name cannot be empty." };
  }

  const selectedFolder = getSelectedFolderPath();
  if (selectedFolder && !relativePath.includes("/")) {
    relativePath = `${selectedFolder}/${relativePath}`;
  }

  const existingFolder = project.folders.find((folderPath) => pathEquals(folderPath, relativePath));
  if (existingFolder) {
    return { relativePath: null, error: "A folder with that path already exists." };
  }

  const existingFile = project.files.find((filePath) => pathEquals(filePath, relativePath));
  if (existingFile) {
    return { relativePath: null, error: "A file already exists at that path." };
  }

  return { relativePath, error: null };
}

function syncNewFileDialogValidation(): void {
  const validation = resolveNewFilePath(newFilePathInput.value);
  newFileError.textContent = validation.error ?? "";
  newFileCreateButton.disabled = validation.relativePath === null;
}

function syncNewFolderDialogValidation(): void {
  const validation = resolveNewFolderPath(newFolderPathInput.value);
  newFolderError.textContent = validation.error ?? "";
  newFolderCreateButton.disabled = validation.relativePath === null;
}

function renderStatusFooter(): void {
  const totalWords = project?.wordCount ?? 0;
  const totalWritingSeconds = project?.totalWritingSeconds ?? 0;

  wordCountLabel.textContent = `Words: ${totalWords.toLocaleString()}`;
  writingTimeLabel.textContent = `Writing: ${formatWritingTime(totalWritingSeconds)}`;

  if (project && !project.settings.showWordCount) {
    wordCountLabel.style.display = "none";
  } else {
    wordCountLabel.style.display = "inline";
  }

  if (project && !project.settings.showWritingTime) {
    writingTimeLabel.style.display = "none";
  } else {
    writingTimeLabel.style.display = "inline";
  }
}

function renderEditorHeaderVisibility(): void {
  editorHeader.hidden = Boolean(project && !project.settings.showCurrentFileBar);
}

function renderFileList(): void {
  fileList.innerHTML = "";

  if (!project) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Open a project to start writing.";
    emptyItem.className = "empty-state";
    fileList.appendChild(emptyItem);
    return;
  }

  renderRootTreeItem();

  if (project.files.length === 0 && project.folders.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No files yet. Create one with New File or add a folder.";
    emptyItem.className = "empty-state";
    fileList.appendChild(emptyItem);
    return;
  }

  renderTreeNodes(buildProjectTree(project.files, project.folders), 0);
}

function syncGitSnapshotsAvailability(): void {
  const repositoryAvailable = Boolean(project?.isGitRepository);
  const remotes = project?.gitRemotes ?? [];

  gitSnapshotsInput.disabled = !project || !repositoryAvailable;
  gitSnapshotsNotice.hidden = !project || repositoryAvailable;
  gitPushRemoteSelect.disabled = !project || !repositoryAvailable;

  if (!repositoryAvailable) {
    gitSnapshotsInput.checked = false;
    gitPushRemoteSelect.innerHTML = "";
    return;
  }

  gitPushRemoteSelect.innerHTML = "";
  const disabledOption = document.createElement("option");
  disabledOption.value = "";
  disabledOption.textContent = "Don't push";
  gitPushRemoteSelect.appendChild(disabledOption);

  for (const remoteName of remotes) {
    const option = document.createElement("option");
    option.value = remoteName;
    option.textContent = remoteName;
    gitPushRemoteSelect.appendChild(option);
  }
}

function syncSettingsInputs(settings: AppSettings): void {
  themeSelect.value = settings.theme;
  applyTheme(settings.theme);
  defaultFileExtensionSelect.value = settings.defaultFileExtension ?? ".txt";
  showWordCountInput.checked = settings.showWordCount;
  showWritingTimeInput.checked = settings.showWritingTime;
  showCurrentFileBarInput.checked = settings.showCurrentFileBar;
  smartQuotesInput.checked = settings.smartQuotes;
  gitSnapshotsInput.checked = settings.gitSnapshots && Boolean(project?.isGitRepository);
  autosaveIntervalInput.value = String(settings.autosaveIntervalSec);
  applyEditorLineHeight(settings.editorLineHeight);
  applyEditorParagraphSpacing(settings.editorParagraphSpacing ?? "none");
  applyEditorMaxWidth(settings.editorMaxWidthPx);
  setEditorZoomFromPercent(settings.editorZoomPercent, false);
  populateFontSelect(settings.editorFontFamily ?? DEFAULT_EDITOR_FONT);
  applyEditorFont(settings.editorFontFamily ?? DEFAULT_EDITOR_FONT);
  syncGitSnapshotsAvailability();
  gitPushRemoteSelect.value =
    settings.gitPushRemote && project?.gitRemotes.includes(settings.gitPushRemote)
      ? settings.gitPushRemote
      : "";
  renderEditorHeaderVisibility();
}

function applyProjectMetadata(metadata: ProjectMetadata): void {
  cancelPendingLiveWordCount();
  stopSidebarResize();
  resetTreeState();
  project = metadata;
  restoreCollapsedFolders();
  snapshotCreatedAtMs = metadata.latestSnapshotCreatedAt
    ? parseSnapshotTimestamp(metadata.latestSnapshotCreatedAt)
    : null;
  renderSnapshotLabel();
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
  liveWordCountRequestToken += 1;

  if (liveWordCountTimer) {
    window.clearTimeout(liveWordCountTimer);
    liveWordCountTimer = null;
  }
}

function scheduleLiveWordCountRefresh(): void {
  if (!project || !currentFilePath) {
    return;
  }

  cancelPendingLiveWordCount();

  const contentSnapshot = editor.getValue();
  const filePathSnapshot = currentFilePath;
  const requestToken = liveWordCountRequestToken;

  liveWordCountTimer = window.setTimeout(async () => {
    liveWordCountTimer = null;

    try {
      const nextWordCount = await window.witApi.countPreviewWords(contentSnapshot);

      if (requestToken !== liveWordCountRequestToken) {
        return;
      }

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
    } catch {
      // Keep typing responsive if preview count fails temporarily.
    }
  }, LIVE_WORD_COUNT_DEBOUNCE_MS);
}

async function persistCurrentFile(showStatus = true): Promise<boolean> {
  if (!project || !currentFilePath || !dirty) {
    return true;
  }

  try {
    cancelPendingLiveWordCount();
    const content = editor.getValue();
    await window.witApi.saveFile(currentFilePath, content);
    project.wordCount = await window.witApi.getWordCount();
    currentFileWordCount = await window.witApi.countPreviewWords(content);
    setDirty(false);
    renderStatusFooter();

    if (showStatus) {
      setStatus(`Saved ${currentFilePath}`, 1500);
    }

    return true;
  } catch {
    setStatus("Save failed. Try again.");
    return false;
  }
}

function saveCurrentFileSynchronously(): void {
  if (!project || !currentFilePath || !dirty) {
    return;
  }

  const saved = window.witApi.saveFileSync(currentFilePath, editor.getValue());
  if (saved) {
    setDirty(false);
  }
}

async function openFile(relativePath: string): Promise<void> {
  if (!project) {
    return;
  }

  const saved = await persistCurrentFile(false);
  if (!saved) {
    return;
  }

  try {
    cancelPendingLiveWordCount();
    const content = await window.witApi.openFile(relativePath);

    suppressDirtyEvents = true;
    editor.setValue(content);
    suppressDirtyEvents = false;

    currentFilePath = relativePath;
    selectedTreePath = relativePath;
    selectedTreeKind = "file";
    currentFileWordCount = await window.witApi.countPreviewWords(content);
    activeFileLabel.textContent = relativePath;
    activeFileLabel.title = relativePath;
    editor.setPlaceholder("");
    setDirty(false);
    setSidebarFaded(false);
    renderFileList();
    setEditorWritable(true);
    renderEmptyEditorState();
    editor.focus();
    setStatus(`Opened ${relativePath}`, 1200);
  } catch {
    setStatus("Could not open selected file.");
  }
}

function restartAutosaveTimer(): void {
  if (autosaveTimer) {
    window.clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

  if (!project) {
    return;
  }

  const intervalMs = project.settings.autosaveIntervalSec * 1000;
  autosaveTimer = window.setInterval(() => {
    void runAutosaveTick();
  }, intervalMs);
}

async function runAutosaveTick(): Promise<void> {
  if (!project || autosaveInFlight) {
    return;
  }

  autosaveInFlight = true;

  try {
    await persistCurrentFile(false);

    const activeSeconds = consumeActiveTypingSeconds();

    const result = await window.witApi.autosaveTick(activeSeconds);
    project.wordCount = result.wordCount;
    project.totalWritingSeconds = result.totalWritingSeconds;
    snapshotCreatedAtMs = parseSnapshotTimestamp(result.snapshotCreatedAt) ?? Date.now();
    renderSnapshotLabel();
    renderStatusFooter();

    setStatus(`Autosaved (${project.settings.autosaveIntervalSec}s interval)`, 2000);
  } catch {
    setStatus("Autosave tick failed.");
  } finally {
    autosaveInFlight = false;
  }
}

async function openProjectPicker(): Promise<void> {
  let selectedProject: ProjectMetadata | null = null;
  try {
    selectedProject = await window.witApi.selectProject();
  } catch {
    setStatus("Could not open project picker.");
    return;
  }

  if (!selectedProject) {
    return;
  }

  applyProjectMetadata(selectedProject);

  if (selectedProject.files.length > 0) {
    await openFile(selectedProject.files[0]);
  } else {
    resetActiveFile();
    setStatus("Project opened. Create your first file.", 2000);
  }
}

async function closeCurrentProject(): Promise<void> {
  closeTreeContextMenu();

  try {
    await persistCurrentFile(true);
    await window.witApi.closeProject();
    clearProjectState(true);
  } catch {
    setStatus("Could not close project.");
  }
}

function askForNewFilePath(defaultPath = ""): Promise<string | null> {
  if (typeof newFileDialog.showModal !== "function") {
    try {
      return Promise.resolve(window.prompt("New text file path", defaultPath));
    } catch {
      setStatus("New file dialog is unavailable.");
      return Promise.resolve(null);
    }
  }

  newFilePathInput.value = defaultPath;
  syncNewFileDialogValidation();

  if (!newFileDialog.open) {
    newFileDialog.showModal();
  }

  const handleInput = () => {
    syncNewFileDialogValidation();
  };
  newFilePathInput.addEventListener("input", handleInput);

  window.requestAnimationFrame(() => {
    newFilePathInput.focus();
    newFilePathInput.select();
  });

  return new Promise((resolve) => {
    newFileDialog.addEventListener(
      "close",
      () => {
        newFilePathInput.removeEventListener("input", handleInput);
        newFileError.textContent = "";
        newFileCreateButton.disabled = false;

        if (newFileDialog.returnValue === "create") {
          resolve(newFilePathInput.value);
          return;
        }

        resolve(null);
      },
      { once: true }
    );
  });
}

function askForNewFolderPath(defaultPath = ""): Promise<string | null> {
  if (typeof newFolderDialog.showModal !== "function") {
    try {
      return Promise.resolve(window.prompt("New folder path", defaultPath));
    } catch {
      setStatus("New folder dialog is unavailable.");
      return Promise.resolve(null);
    }
  }

  newFolderPathInput.value = defaultPath;
  syncNewFolderDialogValidation();

  if (!newFolderDialog.open) {
    newFolderDialog.showModal();
  }

  const handleInput = () => {
    syncNewFolderDialogValidation();
  };
  newFolderPathInput.addEventListener("input", handleInput);

  window.requestAnimationFrame(() => {
    newFolderPathInput.focus();
    newFolderPathInput.select();
  });

  return new Promise((resolve) => {
    newFolderDialog.addEventListener(
      "close",
      () => {
        newFolderPathInput.removeEventListener("input", handleInput);
        newFolderError.textContent = "";
        newFolderCreateButton.disabled = false;

        if (newFolderDialog.returnValue === "create") {
          resolve(newFolderPathInput.value);
          return;
        }

        resolve(null);
      },
      { once: true }
    );
  });
}

function askForRenameValue(kind: SelectedTreeKind, currentName: string): Promise<string | null> {
  if (typeof renameEntryDialog.showModal !== "function") {
    try {
      return Promise.resolve(window.prompt(`Rename ${kind}`, currentName));
    } catch {
      setStatus("Rename dialog is unavailable.");
      return Promise.resolve(null);
    }
  }

  renameEntryTitle.textContent = `Rename ${kind === "folder" ? "Folder" : "File"}`;
  renameEntryInput.value = currentName;
  renameEntryError.textContent = "";
  renameEntryConfirmButton.disabled = false;

  if (!renameEntryDialog.open) {
    renameEntryDialog.showModal();
  }

  const validate = () => {
    const value = renameEntryInput.value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const invalid = value.length === 0 || value.includes("/");
    renameEntryError.textContent = invalid ? "Use a single name without slashes." : "";
    renameEntryConfirmButton.disabled = invalid;
  };

  renameEntryInput.addEventListener("input", validate);
  validate();

  window.requestAnimationFrame(() => {
    renameEntryInput.focus();
    renameEntryInput.select();
  });

  return new Promise((resolve) => {
    renameEntryDialog.addEventListener(
      "close",
      () => {
        renameEntryInput.removeEventListener("input", validate);
        renameEntryError.textContent = "";
        renameEntryConfirmButton.disabled = false;

        if (renameEntryDialog.returnValue === "rename") {
          resolve(renameEntryInput.value);
          return;
        }

        resolve(null);
      },
      { once: true }
    );
  });
}

async function createNewFile(): Promise<void> {
  if (!project) {
    return;
  }

  const proposedName = await askForNewFilePath();
  if (!proposedName) {
    return;
  }

  const validation = resolveNewFilePath(proposedName);
  if (!validation.relativePath) {
    setStatus(validation.error ?? "Could not create file.");
    return;
  }

  const relativePath = validation.relativePath;

  try {
    const files = await window.witApi.newFile({ relativePath });
    project.files = files;
    renderFileList();
    await openFile(relativePath);
    setStatus(`Created ${relativePath}`, 2000);
  } catch {
    setStatus("Could not create file. Check the path and try again.");
  }
}

async function createNewFolder(): Promise<void> {
  if (!project) {
    return;
  }

  const proposedPath = await askForNewFolderPath();
  if (!proposedPath) {
    return;
  }

  const validation = resolveNewFolderPath(proposedPath);
  if (!validation.relativePath) {
    setStatus(validation.error ?? "Could not create folder.");
    return;
  }

  const relativePath = validation.relativePath;

  try {
    const folders = await window.witApi.newFolder({ relativePath });
    project.folders = folders;
    renderFileList();
    setStatus(`Created folder ${relativePath}`, 2000);
  } catch {
    setStatus("Could not create folder. Check the path and try again.");
  }
}

function currentFileWillBeDeleted(relativePath: string, kind: SelectedTreeKind): boolean {
  if (!currentFilePath) {
    return false;
  }

  if (kind === "file") {
    return pathEquals(currentFilePath, relativePath);
  }

  return pathEquals(currentFilePath, relativePath) || currentFilePath.startsWith(`${relativePath}/`);
}

function applyProjectMetadataAfterMutation(metadata: ProjectMetadata): void {
  if (!project) {
    return;
  }

  project.files = metadata.files;
  project.folders = metadata.folders;
  project.wordCount = metadata.wordCount;
  project.totalWritingSeconds = metadata.totalWritingSeconds;
  project.settings = metadata.settings;
  renderStatusFooter();
  renderFileList();
}

async function deleteEntryByPath(relativePath: string, kind: SelectedTreeKind): Promise<void> {
  if (!project) {
    return;
  }

  closeTreeContextMenu();
  const label = kind === "folder" ? "folder" : "file";

  const confirmed = window.confirm(
    `Delete ${label} "${relativePath}"?\n\nThis action cannot be undone.`
  );
  if (!confirmed) {
    return;
  }

  try {
    const metadata = await window.witApi.deleteEntry({ relativePath, kind });
    const deletingActiveFile = currentFileWillBeDeleted(relativePath, kind);

    selectedTreePath = null;
    selectedTreeKind = null;

    if (deletingActiveFile) {
      resetActiveFile();
      setSidebarFaded(false);
    }

    applyProjectMetadataAfterMutation(metadata);
    setStatus(`Deleted ${label} ${relativePath}`, 2000);
  } catch {
    setStatus("Could not delete selected item.");
  }
}

async function renameEntryByPath(relativePath: string, kind: SelectedTreeKind): Promise<void> {
  if (!project) {
    return;
  }

  closeTreeContextMenu();

  const currentName = getBaseName(relativePath);
  const proposedName = await askForRenameValue(kind, currentName);
  if (proposedName === null) {
    return;
  }

  const trimmedName = proposedName.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!trimmedName || trimmedName.includes("/")) {
    setStatus("Name must be a single file or folder name.");
    return;
  }

  const normalizedName =
    kind === "file" ? withOriginalFileExtension(trimmedName, relativePath) : trimmedName;
  const nextRelativePath = buildSiblingPath(relativePath, normalizedName);

  if (pathEquals(nextRelativePath, relativePath)) {
    setStatus("Name is unchanged.", 1200);
    return;
  }

  if (kind === "file" && dirty && currentFilePath && pathEquals(currentFilePath, relativePath)) {
    const saved = await persistCurrentFile(false);
    if (!saved) {
      setStatus("Save failed. Could not rename file.");
      return;
    }
  }

  try {
    const result = await window.witApi.renameEntry({ relativePath, kind, nextRelativePath });
    const previousCurrentFilePath = currentFilePath;
    const renamedPath = result.nextRelativePath;

    if (previousCurrentFilePath) {
      if (kind === "file" && pathEquals(previousCurrentFilePath, relativePath)) {
        currentFilePath = renamedPath;
      }

      if (kind === "folder" && (pathEquals(previousCurrentFilePath, relativePath) || previousCurrentFilePath.startsWith(`${relativePath}/`))) {
        const suffix = previousCurrentFilePath.slice(relativePath.length).replace(/^\/+/, "");
        currentFilePath = suffix.length > 0 ? `${renamedPath}/${suffix}` : renamedPath;
      }
    }

    if (currentFilePath) {
      activeFileLabel.textContent = currentFilePath;
      activeFileLabel.title = currentFilePath;
    }

    selectedTreePath = renamedPath;
    selectedTreeKind = kind;

    applyProjectMetadataAfterMutation(result.metadata);
    setStatus(`Renamed to ${normalizedName}`, 1700);
  } catch {
    setStatus("Could not rename item. Check for duplicate names.");
  }
}

async function moveFileToFolder(fromRelativePath: string, toFolderRelativePath: string): Promise<void> {
  if (!project) {
    return;
  }

  closeTreeContextMenu();

  const normalizedFrom = normalizePathInput(fromRelativePath);
  const normalizedToFolder = normalizePathInput(toFolderRelativePath);
  if (!normalizedFrom) {
    return;
  }

  const sourceParentPath = getParentFolderPath(normalizedFrom);
  if (
    (sourceParentPath && pathEquals(sourceParentPath, normalizedToFolder)) ||
    (!sourceParentPath && normalizedToFolder.length === 0)
  ) {
    setStatus("File is already in that folder.", 1200);
    return;
  }

  const fileName = getBaseName(normalizedFrom);
  const nextRelativePath =
    normalizedToFolder.length > 0 ? `${normalizedToFolder}/${fileName}` : fileName;
  if (pathEquals(normalizedFrom, nextRelativePath)) {
    setStatus("File is already in that folder.", 1200);
    return;
  }

  if (dirty && currentFilePath && pathEquals(currentFilePath, normalizedFrom)) {
    const saved = await persistCurrentFile(false);
    if (!saved) {
      setStatus("Save failed. Could not move file.");
      return;
    }
  }

  try {
    const result = await window.witApi.moveFile({
      fromRelativePath: normalizedFrom,
      toFolderRelativePath: normalizedToFolder
    });

    selectedTreePath = result.nextFilePath;
    selectedTreeKind = "file";

    if (currentFilePath && pathEquals(currentFilePath, normalizedFrom)) {
      currentFilePath = result.nextFilePath;
      activeFileLabel.textContent = result.nextFilePath;
      activeFileLabel.title = result.nextFilePath;
    }

    applyProjectMetadataAfterMutation(result.metadata);
    setStatus(`Moved ${fileName} to ${getDropDestinationLabel(normalizedToFolder)}`, 1700);
  } catch {
    setStatus("Could not move file. Check destination and file conflicts.");
  }
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

function insertSmartQuote(quoteCharacter: string): void {
  const { start, end } = editor.getSelection();
  const value = editor.getValue();

  const quotePair = quoteCharacter === "'" ? ["‘", "’"] : ["“", "”"];

  let replacement: string;

  if (start !== end) {
    const selected = value.slice(start, end);
    replacement = `${quotePair[0]}${selected}${quotePair[1]}`;
  } else {
    const previousCharacter = start > 0 ? value[start - 1] : "";
    const shouldUseOpeningQuote = start === 0 || /[\s([{<-]/.test(previousCharacter);
    replacement = shouldUseOpeningQuote ? quotePair[0] : quotePair[1];
  }

  // Use insertText to preserve the browser undo stack (Cmd/Ctrl+Z).
  suppressDirtyEvents = true;
  editor.replaceSelection(replacement);
  suppressDirtyEvents = false;

  recordTypingActivity();
  setDirty(true);
  scheduleLiveWordCountRefresh();
  setSidebarFaded(true);
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void persistCurrentFile(true);
    return;
  }

  if (!project?.settings.smartQuotes) {
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === "'" || event.key === '"') {
    event.preventDefault();
    insertSmartQuote(event.key);
  }
}

async function initialize(): Promise<void> {
  const platform = window.witApi.getPlatform();
  document.body.classList.add(`platform-${platform}`);
  await loadAboutInfo();

  loadSidebarWidthPreference();
  setProjectControlsEnabled(false);
  setActiveSettingsTab("writing");
  syncSidebarToggleButton();
  syncFullscreenToggleButton(false);
  setSidebarVisibility(false, false);
  setSidebarFaded(false);
  setEditorWritable(false);
  await loadSystemFonts();
  populateFontSelect(DEFAULT_EDITOR_FONT);
  applyTheme("light");
  applyEditorLineHeight(Number.parseFloat(lineHeightInput.value));
  applyEditorParagraphSpacing(normalizeParagraphSpacingValue(paragraphSpacingSelect.value));
  applyEditorMaxWidth(Number.parseInt(editorWidthInput.value, 10));
  applyEditorZoom(false);
  applyEditorFont(DEFAULT_EDITOR_FONT);
  renderSnapshotLabel();
  restartSnapshotLabelTimer();
  renderFileList();
  renderStatusFooter();
  renderEmptyEditorState();

  const activeProject = await window.witApi.getActiveProject();
  if (activeProject) {
    applyProjectMetadata(activeProject);

    if (activeProject.files.length > 0) {
      await openFile(activeProject.files[0]);
    }
  }

  subscriptions.push(
    window.witApi.onMenuOpenProject(() => {
      void openProjectPicker();
    })
  );

  subscriptions.push(
    window.witApi.onMenuNewFile(() => {
      void createNewFile();
    })
  );

  subscriptions.push(
    window.witApi.onMenuSaveCurrentFile(() => {
      void persistCurrentFile(true);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomInText(() => {
      stepEditorZoom(1);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomOutText(() => {
      stepEditorZoom(-1);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomResetText(() => {
      resetEditorZoom();
    })
  );

  subscriptions.push(
    window.witApi.onMenuToggleSidebar(() => {
      toggleSidebarVisibility();
    })
  );

  subscriptions.push(
    window.witApi.onFullscreenChanged((isFullscreen) => {
      syncFullscreenToggleButton(isFullscreen);
    })
  );
}

openProjectButton.addEventListener("click", () => {
  closeTreeContextMenu();
  void openProjectPicker();
});

emptyStatePrimaryButton.addEventListener("click", () => {
  closeTreeContextMenu();

  if (!project) {
    void openProjectPicker();
    return;
  }

  void createNewFile();
});

emptyStateSecondaryButton.addEventListener("click", () => {
  closeTreeContextMenu();

  if (!project) {
    return;
  }

  void createNewFolder();
});

newFileButton.addEventListener("click", () => {
  closeTreeContextMenu();
  void createNewFile();
});

newFolderButton.addEventListener("click", () => {
  closeTreeContextMenu();
  void createNewFolder();
});

newFileCancelButton.addEventListener("click", () => {
  if (newFileDialog.open) {
    newFileDialog.close("cancel");
  }
});

newFolderCancelButton.addEventListener("click", () => {
  if (newFolderDialog.open) {
    newFolderDialog.close("cancel");
  }
});

renameEntryCancelButton.addEventListener("click", () => {
  if (renameEntryDialog.open) {
    renameEntryDialog.close("cancel");
  }
});

settingsToggleButton.addEventListener("click", () => {
  closeTreeContextMenu();
  openSettingsDialog();
});

settingsTabWriting.addEventListener("click", () => {
  setActiveSettingsTab("writing");
});

settingsTabEditor.addEventListener("click", () => {
  setActiveSettingsTab("editor");
});

settingsTabAutosave.addEventListener("click", () => {
  setActiveSettingsTab("autosave");
});

settingsTabAbout.addEventListener("click", () => {
  setActiveSettingsTab("about");
});

toggleSidebarButton.addEventListener("click", () => {
  closeTreeContextMenu();
  toggleSidebarVisibility();
});

sidebarResizer.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  closeTreeContextMenu();
  beginSidebarResize(event.clientX);
});

sidebarResizer.addEventListener("keydown", (event) => {
  if (!project || !sidebarVisible) {
    return;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }

  event.preventDefault();
  closeTreeContextMenu();
  const delta = event.key === "ArrowLeft" ? -20 : 20;
  applySidebarWidth(sidebarWidthPx + delta);
});

fullscreenToggleButton.addEventListener("click", () => {
  closeTreeContextMenu();
  void (async () => {
    try {
      const isFullscreen = await window.witApi.toggleFullscreen();
      syncFullscreenToggleButton(isFullscreen);
    } catch {
      setStatus("Could not toggle fullscreen.");
    }
  })();
});

showWordCountInput.addEventListener("change", () => {
  void persistSettings({ showWordCount: showWordCountInput.checked });
});

showWritingTimeInput.addEventListener("change", () => {
  void persistSettings({ showWritingTime: showWritingTimeInput.checked });
});

showCurrentFileBarInput.addEventListener("change", () => {
  void persistSettings({ showCurrentFileBar: showCurrentFileBarInput.checked });
});

smartQuotesInput.addEventListener("change", () => {
  void persistSettings({ smartQuotes: smartQuotesInput.checked });
});

defaultFileExtensionSelect.addEventListener("change", () => {
  const selectedExtension = normalizeDefaultFileExtensionValue(defaultFileExtensionSelect.value);
  defaultFileExtensionSelect.value = selectedExtension;
  void persistSettings({ defaultFileExtension: selectedExtension });
});

gitSnapshotsInput.addEventListener("change", () => {
  void persistSettings({ gitSnapshots: gitSnapshotsInput.checked });
});

gitPushRemoteSelect.addEventListener("change", () => {
  void persistSettings({
    gitPushRemote: gitPushRemoteSelect.value || null
  });
});

autosaveIntervalInput.addEventListener("change", () => {
  const parsed = Number.parseInt(autosaveIntervalInput.value, 10);
  const safeValue = Number.isFinite(parsed) ? Math.max(10, parsed) : 60;
  void persistSettings({ autosaveIntervalSec: safeValue });
});

lineHeightInput.addEventListener("input", () => {
  const parsed = Number.parseFloat(lineHeightInput.value);
  if (!Number.isFinite(parsed)) {
    return;
  }

  applyEditorLineHeight(parsed);
});

lineHeightInput.addEventListener("change", () => {
  const parsed = Number.parseFloat(lineHeightInput.value);
  if (!Number.isFinite(parsed)) {
    return;
  }

  applyEditorLineHeight(parsed);
  void persistSettings({ editorLineHeight: normalizeLineHeightValue(parsed) });
});

paragraphSpacingSelect.addEventListener("change", () => {
  const selectedSpacing = normalizeParagraphSpacingValue(paragraphSpacingSelect.value);
  applyEditorParagraphSpacing(selectedSpacing);
  void persistSettings({ editorParagraphSpacing: selectedSpacing });
});

editorWidthInput.addEventListener("input", () => {
    applyEditorMaxWidth(Number.parseInt(editorWidthInput.value, 10));
    void persistSettings({ editorMaxWidthPx: Number.parseInt(editorWidthInput.value, 10) });
  });

  fontSelect.addEventListener("change", () => {
    const selectedFont = fontSelect.value;
    applyEditorFont(selectedFont);
    void persistSettings({ editorFontFamily: selectedFont });
  });

editorWidthInput.addEventListener("change", () => {
  const parsed = Number.parseInt(editorWidthInput.value, 10);
  if (!Number.isFinite(parsed)) {
    return;
  }

  const normalized = normalizeEditorMaxWidth(parsed);
  applyEditorMaxWidth(normalized);
  showEditorWidthGuides();
  void persistSettings({ editorMaxWidthPx: normalized });
});

textZoomSelect.addEventListener("change", () => {
  const selectedPercent = Number.parseInt(textZoomSelect.value, 10);
  if (!Number.isFinite(selectedPercent)) {
    return;
  }

  setEditorZoomFromPercent(selectedPercent);
});

themeSelect.addEventListener("change", () => {
  const selectedTheme = themeSelect.value === "dark" ? "dark" : "light";
  applyTheme(selectedTheme);
  void persistSettings({ theme: selectedTheme });
});

subscriptions.push(editor.onInput(() => {
  if (suppressDirtyEvents) {
    return;
  }

  recordTypingActivity();
  setDirty(true);
  scheduleLiveWordCountRefresh();
  setSidebarFaded(true);
}));

subscriptions.push(editor.onKeydown((event) => {
  handleEditorKeydown(event);
}));

subscriptions.push(editor.onBlur(() => {
  setSidebarFaded(false);
}));

sidebar.addEventListener("mouseenter", () => {
  setSidebarFaded(false);
});

sidebar.addEventListener("focusin", () => {
  setSidebarFaded(false);
});

fileList.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  const target = event.target as HTMLElement | null;
  const treeItem = target?.closest("button.tree-item") as HTMLButtonElement | null;

  if (!treeItem) {
    closeTreeContextMenu();
    return;
  }

  const itemKind = treeItem.dataset.itemKind;
  if (itemKind !== "file" && itemKind !== "folder" && itemKind !== "project") {
    closeTreeContextMenu();
    return;
  }

  const relativePath = treeItem.dataset.relativePath;
  if (relativePath === undefined) {
    closeTreeContextMenu();
    return;
  }

  if (itemKind === "project") {
    selectedTreePath = "";
    selectedTreeKind = "folder";
    renderFileList();
    setSidebarFaded(false);

    const testAction = consumeTestTreeContextAction();
    void (async () => {
      try {
        const action = await window.witApi.showTreeContextMenu({
          relativePath,
          kind: "project",
          x: event.clientX,
          y: event.clientY,
          testAction
        });

        if (action === "new-file") {
          await createNewFile();
          return;
        }

        if (action === "new-folder") {
          await createNewFolder();
          return;
        }

        if (action === "close-project") {
          await closeCurrentProject();
        }
      } catch {
        setStatus("Could not open project actions menu.");
      }
    })();
    return;
  }

  const kind: SelectedTreeKind = itemKind === "folder" ? "folder" : "file";
  selectedTreePath = relativePath;
  selectedTreeKind = kind;
  renderFileList();
  setSidebarFaded(false);

  const testAction = consumeTestTreeContextAction();
  void (async () => {
    try {
      const action = await window.witApi.showTreeContextMenu({
        relativePath,
        kind,
        x: event.clientX,
        y: event.clientY,
        testAction
      });

      if (action === "new-file") {
        await createNewFile();
        return;
      }

      if (action === "new-folder") {
        await createNewFolder();
        return;
      }

      if (action === "delete") {
        await deleteEntryByPath(relativePath, kind);
        return;
      }

      if (action === "rename") {
        await renameEntryByPath(relativePath, kind);
      }
    } catch {
      setStatus("Could not open file actions menu.");
    }
  })();
});

settingsDialog.addEventListener("close", () => {
  clearEditorWidthGuides();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    closeTreeContextMenu();
    void persistCurrentFile(true);
  }
});

document.addEventListener("dragend", () => {
  dragSourceFilePath = null;
  fileList.querySelectorAll(".drop-target").forEach((element) => {
    element.classList.remove("drop-target");
  });
});

document.addEventListener("drop", () => {
  dragSourceFilePath = null;
});

window.addEventListener("beforeunload", () => {
  cancelPendingLiveWordCount();
  saveCurrentFileSynchronously();
  stopSidebarResize();
  clearEditorWidthGuides();
  closeTreeContextMenu();

  if (autosaveTimer) {
    window.clearInterval(autosaveTimer);
  }

  if (snapshotLabelTimer) {
    window.clearInterval(snapshotLabelTimer);
  }

  for (const unsubscribe of subscriptions) {
    unsubscribe();
  }
});

window.addEventListener("error", () => {
  closeTreeContextMenu();
  setStatus("A UI error occurred. Check logs.");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled renderer rejection:", event.reason);
  closeTreeContextMenu();
  setStatus("An unexpected async error occurred.");
  event.preventDefault();
});

void initialize();
