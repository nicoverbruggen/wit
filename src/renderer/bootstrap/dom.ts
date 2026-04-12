/**
 * Owns: DOM lookup and typed element resolution for the renderer shell.
 * Out of scope: event binding and UI state synchronization.
 * Inputs/Outputs: document IDs/selectors in, typed DOM references out.
 * Side effects: throws when required renderer elements are missing.
 */
/**
 * Captures the required renderer DOM elements.
 */
export type RendererDom = {
  openProjectButton: HTMLButtonElement;
  openProjectWrap: HTMLElement;
  newFileButton: HTMLButtonElement;
  newFolderButton: HTMLButtonElement;
  projectActions: HTMLElement;
  settingsToggleButton: HTMLButtonElement;
  fullscreenToggleButton: HTMLButtonElement;
  settingsDialog: HTMLDialogElement;
  settingsTabWriting: HTMLButtonElement;
  settingsTabEditor: HTMLButtonElement;
  settingsTabAutosave: HTMLButtonElement;
  settingsTabAbout: HTMLButtonElement;
  settingsPanelWriting: HTMLElement;
  settingsPanelEditor: HTMLElement;
  settingsPanelAutosave: HTMLElement;
  settingsPanelAbout: HTMLElement;
  appShell: HTMLElement;
  toggleSidebarButton: HTMLButtonElement;
  sidebarResizer: HTMLDivElement;
  sidebar: HTMLElement;
  configCorruptedBanner: HTMLDivElement;
  configCorruptedDismissButton: HTMLButtonElement;
  editorWrap: HTMLElement;
  editorHeader: HTMLElement;
  statusBar: HTMLElement;
  emptyStateScreen: HTMLDivElement;
  emptyStateEyebrow: HTMLParagraphElement;
  emptyStateTitle: HTMLHeadingElement;
  emptyStateDescription: HTMLParagraphElement;
  emptyStatePrimaryButton: HTMLButtonElement;
  emptyStateSecondaryButton: HTMLButtonElement;
  emptyStateShortcutsLabel: HTMLParagraphElement;
  emptyStateShortcutsList: HTMLUListElement;
  sidebarProjectTitle: HTMLHeadingElement;
  fileList: HTMLUListElement;
  newFileDialog: HTMLDialogElement;
  newFilePathInput: HTMLInputElement;
  newFilePreview: HTMLParagraphElement;
  newFileCancelButton: HTMLButtonElement;
  newFileCreateButton: HTMLButtonElement;
  newFileError: HTMLParagraphElement;
  newFolderDialog: HTMLDialogElement;
  newFolderPathInput: HTMLInputElement;
  newFolderPreview: HTMLParagraphElement;
  newFolderCancelButton: HTMLButtonElement;
  newFolderCreateButton: HTMLButtonElement;
  newFolderError: HTMLParagraphElement;
  renameEntryDialog: HTMLDialogElement;
  renameEntryTitle: HTMLHeadingElement;
  renameEntryInput: HTMLInputElement;
  renameEntryCancelButton: HTMLButtonElement;
  renameEntryConfirmButton: HTMLButtonElement;
  renameEntryError: HTMLParagraphElement;
  editorElement: HTMLDivElement;
  projectPathLabel: HTMLSpanElement;
  activeFileLabel: HTMLSpanElement;
  dirtyIndicator: HTMLSpanElement;
  statusMessage: HTMLSpanElement;
  wordCountLabel: HTMLSpanElement;
  writingTimeLabel: HTMLSpanElement;
  snapshotLabel: HTMLSpanElement;
  showWordCountInput: HTMLInputElement;
  showWritingTimeInput: HTMLInputElement;
  showCurrentFileBarInput: HTMLInputElement;
  smartQuotesInput: HTMLInputElement;
  defaultFileExtensionSelect: HTMLSelectElement;
  gitSnapshotsInput: HTMLInputElement;
  gitPushRemoteSelect: HTMLSelectElement;
  initializeGitRepoCard: HTMLDivElement;
  initializeGitRepoButton: HTMLButtonElement;
  gitSnapshotsNotice: HTMLParagraphElement;
  autosaveIntervalInput: HTMLInputElement;
  snapshotMaxSizeInput: HTMLInputElement;
  lineHeightInput: HTMLInputElement;
  lineHeightValue: HTMLSpanElement;
  paragraphSpacingSelect: HTMLSelectElement;
  cursorStyleSelect: HTMLSelectElement;
  editorWidthInput: HTMLInputElement;
  editorWidthValue: HTMLSpanElement;
  textZoomInput: HTMLInputElement;
  textZoomValue: HTMLSpanElement;
  themeSelect: HTMLSelectElement;
  fontSelect: HTMLSelectElement;
  aboutVersion: HTMLSpanElement;
  aboutDescription: HTMLParagraphElement;
  aboutAuthor: HTMLSpanElement;
  aboutWebsite: HTMLAnchorElement;
};

type ShellDom = Pick<
  RendererDom,
  | "openProjectButton"
  | "openProjectWrap"
  | "newFileButton"
  | "newFolderButton"
  | "projectActions"
  | "settingsToggleButton"
  | "fullscreenToggleButton"
  | "appShell"
  | "toggleSidebarButton"
  | "sidebarResizer"
  | "sidebar"
  | "sidebarProjectTitle"
  | "fileList"
  | "projectPathLabel"
  | "activeFileLabel"
  | "dirtyIndicator"
>;

type EmptyStateDom = Pick<
  RendererDom,
  | "emptyStateScreen"
  | "emptyStateEyebrow"
  | "emptyStateTitle"
  | "emptyStateDescription"
  | "emptyStatePrimaryButton"
  | "emptyStateSecondaryButton"
  | "emptyStateShortcutsLabel"
  | "emptyStateShortcutsList"
>;

type EntryDialogDom = Pick<
  RendererDom,
  | "newFileDialog"
  | "newFilePathInput"
  | "newFilePreview"
  | "newFileCancelButton"
  | "newFileCreateButton"
  | "newFileError"
  | "newFolderDialog"
  | "newFolderPathInput"
  | "newFolderPreview"
  | "newFolderCancelButton"
  | "newFolderCreateButton"
  | "newFolderError"
  | "renameEntryDialog"
  | "renameEntryTitle"
  | "renameEntryInput"
  | "renameEntryCancelButton"
  | "renameEntryConfirmButton"
  | "renameEntryError"
>;

type EditorDom = Pick<
  RendererDom,
  | "configCorruptedBanner"
  | "configCorruptedDismissButton"
  | "editorWrap"
  | "editorHeader"
  | "editorElement"
  | "statusBar"
  | "statusMessage"
  | "wordCountLabel"
  | "writingTimeLabel"
  | "snapshotLabel"
>;

type SettingsDom = Pick<
  RendererDom,
  | "settingsDialog"
  | "settingsTabWriting"
  | "settingsTabEditor"
  | "settingsTabAutosave"
  | "settingsTabAbout"
  | "settingsPanelWriting"
  | "settingsPanelEditor"
  | "settingsPanelAutosave"
  | "settingsPanelAbout"
  | "showWordCountInput"
  | "showWritingTimeInput"
  | "showCurrentFileBarInput"
  | "smartQuotesInput"
  | "defaultFileExtensionSelect"
  | "gitSnapshotsInput"
  | "gitPushRemoteSelect"
  | "initializeGitRepoCard"
  | "initializeGitRepoButton"
  | "gitSnapshotsNotice"
  | "autosaveIntervalInput"
  | "snapshotMaxSizeInput"
  | "lineHeightInput"
  | "lineHeightValue"
  | "paragraphSpacingSelect"
  | "cursorStyleSelect"
  | "editorWidthInput"
  | "editorWidthValue"
  | "textZoomInput"
  | "textZoomValue"
  | "themeSelect"
  | "fontSelect"
>;

type AboutDom = Pick<RendererDom, "aboutVersion" | "aboutDescription" | "aboutAuthor" | "aboutWebsite">;

function getById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as T;
}

function getBySelector<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element as T;
}

function resolveShellDom(): ShellDom {
  return {
    openProjectButton: getById("open-project-btn"),
    openProjectWrap: getBySelector(".open-project-wrap"),
    newFileButton: getById("new-file-btn"),
    newFolderButton: getById("new-folder-btn"),
    projectActions: getById("project-actions"),
    settingsToggleButton: getById("settings-toggle-btn"),
    fullscreenToggleButton: getById("toggle-fullscreen-btn"),
    appShell: getById("app-shell"),
    toggleSidebarButton: getById("toggle-sidebar-btn"),
    sidebarResizer: getById("sidebar-resizer"),
    sidebar: getBySelector(".sidebar"),
    sidebarProjectTitle: getById("sidebar-project-title"),
    fileList: getById("file-list"),
    projectPathLabel: getById("project-path"),
    activeFileLabel: getById("active-file-label"),
    dirtyIndicator: getById("dirty-indicator")
  };
}

function resolveEmptyStateDom(): EmptyStateDom {
  return {
    emptyStateScreen: getById("empty-state-screen"),
    emptyStateEyebrow: getById("empty-state-eyebrow"),
    emptyStateTitle: getById("empty-state-title"),
    emptyStateDescription: getById("empty-state-description"),
    emptyStatePrimaryButton: getById("empty-state-primary-btn"),
    emptyStateSecondaryButton: getById("empty-state-secondary-btn"),
    emptyStateShortcutsLabel: getBySelector(".empty-state-shortcuts-label"),
    emptyStateShortcutsList: getById("empty-state-shortcuts-list")
  };
}

function resolveEntryDialogDom(): EntryDialogDom {
  return {
    newFileDialog: getById("new-file-dialog"),
    newFilePathInput: getById("new-file-path-input"),
    newFilePreview: getById("new-file-preview"),
    newFileCancelButton: getById("new-file-cancel-btn"),
    newFileCreateButton: getById("new-file-create-btn"),
    newFileError: getById("new-file-error"),
    newFolderDialog: getById("new-folder-dialog"),
    newFolderPathInput: getById("new-folder-path-input"),
    newFolderPreview: getById("new-folder-preview"),
    newFolderCancelButton: getById("new-folder-cancel-btn"),
    newFolderCreateButton: getById("new-folder-create-btn"),
    newFolderError: getById("new-folder-error"),
    renameEntryDialog: getById("rename-entry-dialog"),
    renameEntryTitle: getById("rename-entry-title"),
    renameEntryInput: getById("rename-entry-input"),
    renameEntryCancelButton: getById("rename-entry-cancel-btn"),
    renameEntryConfirmButton: getById("rename-entry-confirm-btn"),
    renameEntryError: getById("rename-entry-error")
  };
}

function resolveEditorDom(): EditorDom {
  return {
    configCorruptedBanner: getById("config-corrupted-banner"),
    configCorruptedDismissButton: getById("config-corrupted-dismiss-btn"),
    editorWrap: getBySelector(".editor-wrap"),
    editorHeader: getBySelector(".editor-header"),
    editorElement: getById("editor"),
    statusBar: getBySelector(".status-bar"),
    statusMessage: getById("status-message"),
    wordCountLabel: getById("word-count"),
    writingTimeLabel: getById("writing-time"),
    snapshotLabel: getById("snapshot-label")
  };
}

function resolveSettingsDom(): SettingsDom {
  return {
    settingsDialog: getById("settings-dialog"),
    settingsTabWriting: getById("settings-tab-writing"),
    settingsTabEditor: getById("settings-tab-editor"),
    settingsTabAutosave: getById("settings-tab-autosave"),
    settingsTabAbout: getById("settings-tab-about"),
    settingsPanelWriting: getById("settings-panel-writing"),
    settingsPanelEditor: getById("settings-panel-editor"),
    settingsPanelAutosave: getById("settings-panel-autosave"),
    settingsPanelAbout: getById("settings-panel-about"),
    showWordCountInput: getById("show-word-count-input"),
    showWritingTimeInput: getById("show-writing-time-input"),
    showCurrentFileBarInput: getById("show-current-file-bar-input"),
    smartQuotesInput: getById("smart-quotes-input"),
    defaultFileExtensionSelect: getById("default-file-extension-select"),
    gitSnapshotsInput: getById("git-snapshots-input"),
    gitPushRemoteSelect: getById("git-push-remote-select"),
    initializeGitRepoCard: getById("initialize-git-repo-card"),
    initializeGitRepoButton: getById("initialize-git-repo-btn"),
    gitSnapshotsNotice: getById("git-snapshots-notice"),
    autosaveIntervalInput: getById("autosave-interval-input"),
    snapshotMaxSizeInput: getById("snapshot-max-size-input"),
    lineHeightInput: getById("line-height-input"),
    lineHeightValue: getById("line-height-value"),
    paragraphSpacingSelect: getById("paragraph-spacing-select"),
    cursorStyleSelect: getById("cursor-style-select"),
    editorWidthInput: getById("editor-width-input"),
    editorWidthValue: getById("editor-width-value"),
    textZoomInput: getById("text-zoom-input"),
    textZoomValue: getById("text-zoom-value"),
    themeSelect: getById("theme-select"),
    fontSelect: getById("font-select")
  };
}

function resolveAboutDom(): AboutDom {
  return {
    aboutVersion: getById("about-version"),
    aboutDescription: getById("about-description"),
    aboutAuthor: getById("about-author"),
    aboutWebsite: getById("about-website")
  };
}

/**
 * Resolves and validates the renderer DOM structure.
 *
 * @returns Typed references to all required renderer elements.
 * @throws When any required element is missing from the document.
 */
export function resolveRendererDom(): RendererDom {
  return {
    ...resolveShellDom(),
    ...resolveEmptyStateDom(),
    ...resolveEntryDialogDom(),
    ...resolveEditorDom(),
    ...resolveSettingsDom(),
    ...resolveAboutDom()
  };
}
