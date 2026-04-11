/**
 * Owns: creation and wiring of the renderer's controller graph.
 * Out of scope: initial bootstrap sequencing and raw DOM resolution.
 * Inputs/Outputs: DOM nodes, editor adapter, renderer state hooks, and callbacks in, composed controllers out.
 * Side effects: constructs controller instances that bind timers, DOM state, and persistence callbacks together.
 */
import type { AppSettings, ProjectMetadata } from "../../../shared/types";
import type { RendererDom } from "./renderer-dom.js";
import type { EditorAdapter } from "../../editor-adapter.js";
import { createProjectTreeStateController } from "../project-tree/project-tree-state-controller.js";
import { createEntryDialogController } from "../project-tree/entry-dialog-controller.js";
import { createProjectEntryActionsController } from "../project-tree/project-entry-actions-controller.js";
import { createLiveWordCountTracker } from "../editor/live-word-count.js";
import { createEditorInteractionsController } from "../editor/editor-interactions-controller.js";
import { createEditorPresentationController } from "../editor/editor-presentation-controller.js";
import { createEditorDirtyStateController } from "../editor/editor-dirty-state-controller.js";
import { createFileSessionController } from "../editor/file-session-controller.js";
import { createTypingActivityTracker } from "../editor/typing-activity.js";
import { createAutosaveController } from "../autosave/autosave-controller.js";
import { createSnapshotLabelController } from "../autosave/snapshot-label-controller.js";
import { createSidebarController } from "../sidebar/sidebar-controller.js";
import { createSidebarUiController } from "../sidebar/sidebar-ui-controller.js";
import { createAppShellUiController } from "./app-shell-ui-controller.js";
import { createSettingsDialogController } from "../settings/settings-dialog-controller.js";
import { createProjectUiController } from "../project/project-ui-controller.js";
import { createProjectLifecycleController } from "../project/project-lifecycle-controller.js";
import { createProjectPersistenceController } from "../project/project-persistence-controller.js";
import { createProjectStateApplicationController } from "../project/project-state-application-controller.js";
import { createEmptyEditorStateController } from "../project/empty-editor-state-controller.js";

type WitApiForComposition = {
  getActiveProject: () => Promise<ProjectMetadata | null>;
  getAppInfo: () => Promise<{ version: string; description: string; author: string; website: string }>;
  initializeGitRepository: () => Promise<ProjectMetadata>;
  setLastOpenedFilePath: (relativePath: string | null) => Promise<string | null>;
  updateSettings: (nextSettings: AppSettings) => Promise<AppSettings>;
  newFile: (payload: { relativePath: string }) => Promise<string[]>;
  newFolder: (payload: { relativePath: string }) => Promise<string[]>;
  deleteEntry: (payload: { relativePath: string; kind: "file" | "folder" }) => Promise<ProjectMetadata>;
  renameEntry: (payload: {
    relativePath: string;
    kind: "file" | "folder";
    nextRelativePath: string;
  }) => Promise<{ nextRelativePath: string; metadata: ProjectMetadata }>;
  moveFile: (payload: {
    fromRelativePath: string;
    toFolderRelativePath: string;
  }) => Promise<{ nextFilePath: string; metadata: ProjectMetadata }>;
  closeProject: () => Promise<unknown>;
  selectProject: () => Promise<ProjectMetadata | null>;
  countPreviewWords: (text: string) => Promise<number>;
  getWordCount: () => Promise<number>;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  saveFileSync: (relativePath: string, content: string) => boolean;
  openFile: (relativePath: string) => Promise<string>;
  autosaveTick: (activeSeconds: number) => Promise<{
    wordCount: number;
    totalWritingSeconds: number;
    snapshotCreatedAt: string | null;
  }>;
  getPlatform: () => string;
};

/**
 * Creates the full renderer controller composition.
 *
 * @param options DOM references, editor adapter, renderer state hooks, and formatting callbacks.
 * @returns The composed controller graph used by renderer actions and bootstrap.
 */
export function createRendererComposition(options: {
  dom: RendererDom;
  body: HTMLElement;
  editor: EditorAdapter;
  witApi: WitApiForComposition;
  config: {
    liveWordCountDebounceMs: number;
    typingIdleThresholdMs: number;
    autosaveLeniencyThresholdSec: number;
    autosaveLeniencyMaxMs: number;
    autosaveLeniencyPollMs: number;
    snapshotLabelRefreshMs: number;
    maxTreeIndent: number;
    defaultEditorPlaceholder: string;
    defaultStatusMessage: string;
    sidebarWidthStorageKey: string;
    minSidebarWidthPx: number;
    maxSidebarWidthPx: number;
    defaultSidebarWidthPx: number;
    builtInEditorFonts: readonly string[];
    defaultEditorFont: string;
    editorZoomPresets: readonly number[];
  };
  state: {
    getProject: () => ProjectMetadata | null;
    setProject: (nextProject: ProjectMetadata | null) => void;
    getCurrentFilePath: () => string | null;
    setCurrentFilePath: (nextFilePath: string | null) => void;
    getSuppressDirtyEvents: () => boolean;
    setSuppressDirtyEvents: (value: boolean) => void;
    getIsWindowFullscreen: () => boolean;
    setIsWindowFullscreen: (nextValue: boolean) => void;
  };
  callbacks: {
    setStatus: (message: string, clearAfterMs?: number) => void;
    syncSettingsInputs: (settings: AppSettings) => void;
    renderStatusFooter: () => void;
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
  formatting: {
    formatRelativeElapsed: (value: number) => string;
    formatWritingTime: (totalWritingSeconds: number) => string;
  };
}): RendererComposition {
  let projectEntryActionsController!: ReturnType<typeof createProjectEntryActionsController>;
  let fileSessionController!: ReturnType<typeof createFileSessionController>;

  const appShellUiController = createAppShellUiController({
    projectActions: options.dom.projectActions,
    openProjectWrap: options.dom.openProjectWrap,
    settingsToggleButton: options.dom.settingsToggleButton,
    newFileButton: options.dom.newFileButton,
    newFolderButton: options.dom.newFolderButton,
    showWordCountInput: options.dom.showWordCountInput,
    showWritingTimeInput: options.dom.showWritingTimeInput,
    showCurrentFileBarInput: options.dom.showCurrentFileBarInput,
    smartQuotesInput: options.dom.smartQuotesInput,
    gitSnapshotsInput: options.dom.gitSnapshotsInput,
    gitPushRemoteSelect: options.dom.gitPushRemoteSelect,
    initializeGitRepoCard: options.dom.initializeGitRepoCard,
    initializeGitRepoButton: options.dom.initializeGitRepoButton,
    gitSnapshotsNotice: options.dom.gitSnapshotsNotice,
    autosaveIntervalInput: options.dom.autosaveIntervalInput,
    snapshotMaxSizeInput: options.dom.snapshotMaxSizeInput,
    lineHeightInput: options.dom.lineHeightInput,
    editorWidthInput: options.dom.editorWidthInput,
    themeSelect: options.dom.themeSelect,
    fontSelect: options.dom.fontSelect,
    statusMessage: options.dom.statusMessage,
    defaultStatusMessage: options.config.defaultStatusMessage,
    aboutVersion: options.dom.aboutVersion,
    aboutDescription: options.dom.aboutDescription,
    aboutAuthor: options.dom.aboutAuthor,
    aboutWebsite: options.dom.aboutWebsite,
    getProject: options.state.getProject,
    getAppInfo: () => options.witApi.getAppInfo()
  });

  const projectPersistenceController = createProjectPersistenceController({
    getProject: options.state.getProject,
    setLastOpenedFilePath: (relativePath) => options.witApi.setLastOpenedFilePath(relativePath),
    updateSettings: (nextSettings) => options.witApi.updateSettings(nextSettings),
    syncSettingsInputs: options.callbacks.syncSettingsInputs,
    renderStatusFooter: options.callbacks.renderStatusFooter,
    restartAutosaveTimer: options.callbacks.restartAutosaveTimer,
    setStatus: options.callbacks.setStatus
  });

  const editorDirtyStateController = createEditorDirtyStateController({
    dirtyIndicator: options.dom.dirtyIndicator,
    fileList: options.dom.fileList,
    getCurrentFilePath: options.state.getCurrentFilePath
  });

  const liveWordCountTracker = createLiveWordCountTracker(options.config.liveWordCountDebounceMs);
  const typingActivityTracker = createTypingActivityTracker(options.config.typingIdleThresholdMs);
  const snapshotLabelController = createSnapshotLabelController({
    element: options.dom.snapshotLabel,
    refreshMs: options.config.snapshotLabelRefreshMs,
    formatRelativeElapsed: options.formatting.formatRelativeElapsed
  });

  const autosaveController = createAutosaveController({
    getIntervalSec: () => {
      const project = options.state.getProject();
      return project ? project.settings.autosaveIntervalSec : null;
    },
    leniencyThresholdSec: options.config.autosaveLeniencyThresholdSec,
    isTyping: options.callbacks.isUserTyping,
    waitForPause: options.callbacks.waitForTypingPause,
    onTick: options.callbacks.runAutosaveTick
  });

  const sidebarController = createSidebarController({
    appShell: options.dom.appShell,
    toggleButton: options.dom.toggleSidebarButton,
    minWidthPx: options.config.minSidebarWidthPx,
    maxWidthPx: options.config.maxSidebarWidthPx,
    defaultWidthPx: options.config.defaultSidebarWidthPx,
    widthStorageKey: options.config.sidebarWidthStorageKey
  });

  const sidebarUiController = createSidebarUiController({
    sidebarController,
    fullscreenToggleButton: options.dom.fullscreenToggleButton,
    getProject: options.state.getProject,
    getCurrentFilePath: options.state.getCurrentFilePath,
    getIsWindowFullscreen: options.state.getIsWindowFullscreen,
    setIsWindowFullscreen: options.state.setIsWindowFullscreen,
    setStatus: options.callbacks.setStatus,
    applyEditorZoom: (showStatus = true) => {
      editorPresentationController.applyEditorZoom(showStatus);
    }
  });

  const editorPresentationController = createEditorPresentationController({
    editor: options.editor,
    editorWrap: options.dom.editorWrap,
    lineHeightInput: options.dom.lineHeightInput,
    lineHeightValue: options.dom.lineHeightValue,
    paragraphSpacingSelect: options.dom.paragraphSpacingSelect,
    editorWidthInput: options.dom.editorWidthInput,
    editorWidthValue: options.dom.editorWidthValue,
    textZoomInput: options.dom.textZoomInput,
    textZoomValue: options.dom.textZoomValue,
    fontSelect: options.dom.fontSelect,
    body: options.body,
    builtInEditorFonts: options.config.builtInEditorFonts,
    defaultEditorFont: options.config.defaultEditorFont,
    zoomPresets: [...options.config.editorZoomPresets],
    setStatus: options.callbacks.setStatus,
    persistZoomPercent: (percent) => {
      void options.callbacks.persistSettings({ editorZoomPercent: percent });
    }
  });

  const projectTreeStateController = createProjectTreeStateController({
    fileList: options.dom.fileList,
    maxTreeIndent: options.config.maxTreeIndent,
    getProject: options.state.getProject,
    getCurrentFilePath: options.state.getCurrentFilePath,
    getDirty: () => editorDirtyStateController.getDirty(),
    getProjectDisplayTitle: options.callbacks.getProjectDisplayTitle,
    closeTreeContextMenu: options.callbacks.closeTreeContextMenu,
    setSidebarFaded: options.callbacks.setSidebarFaded,
    closeCurrentFile: options.callbacks.closeCurrentFile,
    openFile: options.callbacks.openFile,
    moveFileToFolder: (sourcePath, toFolderRelativePath) =>
      projectEntryActionsController.moveFileToFolder(sourcePath, toFolderRelativePath)
  });

  const entryDialogController = createEntryDialogController({
    getProject: options.state.getProject,
    getSelectedFolderPath: () => projectTreeStateController.getSelectedFolderPath(),
    setStatus: options.callbacks.setStatus,
    newFileDialog: options.dom.newFileDialog,
    newFilePathInput: options.dom.newFilePathInput,
    newFileCancelButton: options.dom.newFileCancelButton,
    newFileCreateButton: options.dom.newFileCreateButton,
    newFileError: options.dom.newFileError,
    newFolderDialog: options.dom.newFolderDialog,
    newFolderPathInput: options.dom.newFolderPathInput,
    newFolderCancelButton: options.dom.newFolderCancelButton,
    newFolderCreateButton: options.dom.newFolderCreateButton,
    newFolderError: options.dom.newFolderError,
    renameEntryDialog: options.dom.renameEntryDialog,
    renameEntryTitle: options.dom.renameEntryTitle,
    renameEntryInput: options.dom.renameEntryInput,
    renameEntryCancelButton: options.dom.renameEntryCancelButton,
    renameEntryConfirmButton: options.dom.renameEntryConfirmButton,
    renameEntryError: options.dom.renameEntryError
  });

  projectEntryActionsController = createProjectEntryActionsController({
    getProject: options.state.getProject,
    getCurrentFilePath: options.state.getCurrentFilePath,
    setCurrentFilePath: options.state.setCurrentFilePath,
    getDirty: () => editorDirtyStateController.getDirty(),
    setSelectedTree: projectTreeStateController.setSelectedTree,
    getSelectedFolderPath: projectTreeStateController.getSelectedFolderPath,
    closeTreeContextMenu: options.callbacks.closeTreeContextMenu,
    askForNewFilePath: () => entryDialogController.askForNewFilePath(),
    askForNewFolderPath: () => entryDialogController.askForNewFolderPath(),
    askForRenameValue: (kind, currentName) => entryDialogController.askForRenameValue(kind, currentName),
    openFile: options.callbacks.openFile,
    persistCurrentFile: options.callbacks.persistCurrentFile,
    persistLastOpenedFilePath: options.callbacks.persistLastOpenedFilePath,
    resetActiveFile: options.callbacks.resetActiveFile,
    setSidebarFaded: options.callbacks.setSidebarFaded,
    setActiveFileLabel: (label) => {
      options.dom.activeFileLabel.textContent = label;
      options.dom.activeFileLabel.title = label;
    },
    renderFileList: options.callbacks.renderFileList,
    renderStatusFooter: options.callbacks.renderStatusFooter,
    setStatus: options.callbacks.setStatus,
    newFile: (payload) => options.witApi.newFile(payload),
    newFolder: (payload) => options.witApi.newFolder(payload),
    deleteEntry: (payload) => options.witApi.deleteEntry(payload),
    renameEntry: (payload) => options.witApi.renameEntry(payload),
    moveFile: (payload) => options.witApi.moveFile(payload)
  });

  const projectUiController = createProjectUiController({
    sidebarProjectTitle: options.dom.sidebarProjectTitle,
    projectPathLabel: options.dom.projectPathLabel,
    statusBar: options.dom.statusBar,
    statusMessage: options.dom.statusMessage,
    wordCountLabel: options.dom.wordCountLabel,
    writingTimeLabel: options.dom.writingTimeLabel,
    snapshotLabel: options.dom.snapshotLabel,
    editorHeader: options.dom.editorHeader,
    themeSelect: options.dom.themeSelect,
    defaultFileExtensionSelect: options.dom.defaultFileExtensionSelect,
    showWordCountInput: options.dom.showWordCountInput,
    showWritingTimeInput: options.dom.showWritingTimeInput,
    showCurrentFileBarInput: options.dom.showCurrentFileBarInput,
    smartQuotesInput: options.dom.smartQuotesInput,
    gitSnapshotsInput: options.dom.gitSnapshotsInput,
    gitPushRemoteSelect: options.dom.gitPushRemoteSelect,
    initializeGitRepoCard: options.dom.initializeGitRepoCard,
    initializeGitRepoButton: options.dom.initializeGitRepoButton,
    gitSnapshotsNotice: options.dom.gitSnapshotsNotice,
    autosaveIntervalInput: options.dom.autosaveIntervalInput,
    snapshotMaxSizeInput: options.dom.snapshotMaxSizeInput,
    applyTheme: options.callbacks.applyTheme,
    applyEditorLineHeight: options.callbacks.applyEditorLineHeight,
    applyEditorParagraphSpacing: options.callbacks.applyEditorParagraphSpacing,
    applyEditorMaxWidth: options.callbacks.applyEditorMaxWidth,
    setEditorZoomFromPercent: options.callbacks.setEditorZoomFromPercent,
    populateFontSelect: options.callbacks.populateFontSelect,
    applyEditorFont: options.callbacks.applyEditorFont,
    getProjectDisplayTitle: options.callbacks.getProjectDisplayTitle,
    formatWritingTime: options.formatting.formatWritingTime,
    defaultEditorFont: options.config.defaultEditorFont
  });

  const projectStateApplicationController = createProjectStateApplicationController({
    defaultEditorPlaceholder: options.config.defaultEditorPlaceholder,
    getIsWindowFullscreen: options.state.getIsWindowFullscreen,
    setProjectState: options.state.setProject,
    setCurrentFilePathState: options.state.setCurrentFilePath,
    resetCurrentFileWordCount: () => fileSessionController.resetCurrentFileWordCount(),
    clearActiveFileLabel: () => {
      options.dom.activeFileLabel.textContent = "No file selected";
      options.dom.activeFileLabel.removeAttribute("title");
    },
    setEditorSyntaxForFile: (relativePath) => {
      options.editor.setSyntaxForFile(relativePath);
    },
    clearEditorValueSilently: () => {
      options.state.setSuppressDirtyEvents(true);
      options.editor.setValue("");
      options.state.setSuppressDirtyEvents(false);
    },
    setEditorPlaceholder: (value) => {
      options.editor.setPlaceholder(value);
    },
    setDirty: options.callbacks.setDirty,
    setEditorWritable: options.callbacks.setEditorWritable,
    renderEmptyEditorState: options.callbacks.renderEmptyEditorState,
    renderFileList: options.callbacks.renderFileList,
    cancelPendingLiveWordCount: options.callbacks.cancelPendingLiveWordCount,
    stopSidebarResize: options.callbacks.stopSidebarResize,
    resetTreeState: () => projectTreeStateController.resetTreeState(),
    restoreCollapsedFolders: () => projectTreeStateController.restoreCollapsedFolders(),
    updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
    parseSnapshotTimestamp: options.callbacks.parseSnapshotTimestamp,
    syncProjectPathLabels: options.callbacks.syncProjectPathLabels,
    setProjectControlsEnabled: options.callbacks.setProjectControlsEnabled,
    syncSettingsInputs: options.callbacks.syncSettingsInputs,
    renderStatusFooter: options.callbacks.renderStatusFooter,
    setSidebarVisibility: options.callbacks.setSidebarVisibility,
    setSidebarFaded: options.callbacks.setSidebarFaded,
    restartAutosaveTimer: options.callbacks.restartAutosaveTimer
  });

  const projectLifecycleController = createProjectLifecycleController({
    getCurrentFilePath: options.state.getCurrentFilePath,
    persistCurrentFile: options.callbacks.persistCurrentFile,
    persistLastOpenedFilePath: options.callbacks.persistLastOpenedFilePath,
    resetActiveFile: () => projectStateApplicationController.resetActiveFile(),
    setProjectState: options.state.setProject,
    stopSidebarResize: options.callbacks.stopSidebarResize,
    resetTreeState: () => projectTreeStateController.resetTreeState(),
    updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
    syncProjectPathLabels: options.callbacks.syncProjectPathLabels,
    setProjectControlsEnabled: options.callbacks.setProjectControlsEnabled,
    setSidebarVisibility: options.callbacks.setSidebarVisibility,
    setSidebarFaded: options.callbacks.setSidebarFaded,
    setThemeValue: (theme) => {
      options.dom.themeSelect.value = theme;
    },
    applyTheme: options.callbacks.applyTheme,
    renderStatusFooter: options.callbacks.renderStatusFooter,
    renderFileList: options.callbacks.renderFileList,
    restartAutosaveTimer: options.callbacks.restartAutosaveTimer,
    renderEmptyEditorState: options.callbacks.renderEmptyEditorState,
    closeTreeContextMenu: options.callbacks.closeTreeContextMenu,
    closeProject: () => options.witApi.closeProject(),
    selectProject: () => options.witApi.selectProject(),
    applyProjectMetadata: (metadata) => projectStateApplicationController.applyProjectMetadata(metadata),
    openFile: options.callbacks.openFile,
    setStatus: options.callbacks.setStatus
  });

  const settingsDialogController = createSettingsDialogController({
    dialog: options.dom.settingsDialog,
    toggleButton: options.dom.settingsToggleButton,
    tabs: {
      writing: { button: options.dom.settingsTabWriting, panel: options.dom.settingsPanelWriting },
      editor: { button: options.dom.settingsTabEditor, panel: options.dom.settingsPanelEditor },
      autosave: { button: options.dom.settingsTabAutosave, panel: options.dom.settingsPanelAutosave },
      about: { button: options.dom.settingsTabAbout, panel: options.dom.settingsPanelAbout }
    },
    inputs: {
      showWordCountInput: options.dom.showWordCountInput,
      showWritingTimeInput: options.dom.showWritingTimeInput,
      showCurrentFileBarInput: options.dom.showCurrentFileBarInput,
      smartQuotesInput: options.dom.smartQuotesInput,
      defaultFileExtensionSelect: options.dom.defaultFileExtensionSelect,
      gitSnapshotsInput: options.dom.gitSnapshotsInput,
      gitPushRemoteSelect: options.dom.gitPushRemoteSelect,
      initializeGitRepoButton: options.dom.initializeGitRepoButton,
      autosaveIntervalInput: options.dom.autosaveIntervalInput,
      snapshotMaxSizeInput: options.dom.snapshotMaxSizeInput,
      lineHeightInput: options.dom.lineHeightInput,
      paragraphSpacingSelect: options.dom.paragraphSpacingSelect,
      editorWidthInput: options.dom.editorWidthInput,
      textZoomInput: options.dom.textZoomInput,
      themeSelect: options.dom.themeSelect,
      fontSelect: options.dom.fontSelect
    },
    closeTreeContextMenu: options.callbacks.closeTreeContextMenu,
    persistSettings: options.callbacks.persistSettings,
    applyEditorLineHeight: options.callbacks.applyEditorLineHeight,
    applyEditorParagraphSpacing: options.callbacks.applyEditorParagraphSpacing,
    applyEditorMaxWidth: options.callbacks.applyEditorMaxWidth,
    applyEditorFont: options.callbacks.applyEditorFont,
    setEditorZoomFromPercent: options.callbacks.setEditorZoomFromPercent,
    applyTheme: options.callbacks.applyTheme,
    refreshEditorLayout: options.callbacks.refreshEditorLayout,
    showEditorWidthGuides: options.callbacks.showEditorWidthGuides,
    clearEditorWidthGuides: options.callbacks.clearEditorWidthGuides,
    beforeOpen: async () => {
      const metadata = await options.witApi.getActiveProject();
      if (metadata) {
        projectStateApplicationController.refreshProjectMetadata(metadata);
      }
    },
    initializeGitRepository: async () => {
      try {
        const metadata = await options.witApi.initializeGitRepository();
        projectStateApplicationController.refreshProjectMetadata(metadata);
        options.callbacks.setStatus("Git repository initialized.", 1800);
      } catch {
        options.callbacks.setStatus("Could not initialize Git repository.");
      }
    },
    setStatus: options.callbacks.setStatus,
    initialTab: "writing"
  });

  const emptyEditorStateController = createEmptyEditorStateController({
    editorWrap: options.dom.editorWrap,
    emptyStateScreen: options.dom.emptyStateScreen,
    emptyStateEyebrow: options.dom.emptyStateEyebrow,
    emptyStateTitle: options.dom.emptyStateTitle,
    emptyStateDescription: options.dom.emptyStateDescription,
    emptyStatePrimaryButton: options.dom.emptyStatePrimaryButton,
    emptyStateSecondaryButton: options.dom.emptyStateSecondaryButton,
    emptyStateShortcutsLabel: options.dom.emptyStateShortcutsLabel,
    emptyStateShortcutsList: options.dom.emptyStateShortcutsList,
    getProject: options.state.getProject,
    getCurrentFilePath: options.state.getCurrentFilePath,
    getProjectDisplayTitle: options.callbacks.getProjectDisplayTitle,
    primaryShortcutLabel: options.callbacks.primaryShortcutLabel
  });

  const editorInteractionsController = createEditorInteractionsController({
    getSuppressDirtyEvents: options.state.getSuppressDirtyEvents,
    setSuppressDirtyEvents: options.state.setSuppressDirtyEvents,
    getSmartQuotesEnabled: () => Boolean(options.state.getProject()?.settings.smartQuotes),
    getEditorSelection: () => options.editor.getSelection(),
    getEditorValue: () => options.editor.getValue(),
    replaceEditorSelection: (value) => {
      options.editor.replaceSelection(value);
    },
    persistCurrentFile: options.callbacks.persistCurrentFile,
    handleUserEdit: () => {
      typingActivityTracker.recordTypingActivity();
      options.callbacks.setDirty(true);
      options.callbacks.scheduleLiveWordCountRefresh();
      options.callbacks.setSidebarFaded(true);
    },
    setSidebarFaded: options.callbacks.setSidebarFaded
  });

  fileSessionController = createFileSessionController({
    liveWordCountTracker,
    getProject: options.state.getProject,
    getCurrentFilePath: options.state.getCurrentFilePath,
    getDirty: () => editorDirtyStateController.getDirty(),
    getEditorValue: () => options.editor.getValue(),
    setEditorSyntaxForFile: (relativePath) => {
      options.editor.setSyntaxForFile(relativePath);
    },
    setEditorValueSilently: (content) => {
      options.state.setSuppressDirtyEvents(true);
      options.editor.setValue(content);
      options.state.setSuppressDirtyEvents(false);
    },
    setCurrentFilePath: options.state.setCurrentFilePath,
    setSelectedTreeToFile: projectTreeStateController.setSelectedTreeToFile,
    setActiveFileLabel: (nextPath) => {
      options.dom.activeFileLabel.textContent = nextPath;
      options.dom.activeFileLabel.title = nextPath;
    },
    setEditorPlaceholder: (value) => {
      options.editor.setPlaceholder(value);
    },
    setDirty: options.callbacks.setDirty,
    setSidebarFaded: options.callbacks.setSidebarFaded,
    renderFileList: options.callbacks.renderFileList,
    setEditorWritable: options.callbacks.setEditorWritable,
    renderEmptyEditorState: options.callbacks.renderEmptyEditorState,
    persistLastOpenedFilePath: options.callbacks.persistLastOpenedFilePath,
    focusEditor: () => {
      options.editor.focus();
    },
    setStatus: options.callbacks.setStatus,
    countPreviewWords: (text) => options.witApi.countPreviewWords(text),
    getWordCount: () => options.witApi.getWordCount(),
    saveFile: (relativePath, content) => options.witApi.saveFile(relativePath, content),
    saveFileSync: (relativePath, content) => options.witApi.saveFileSync(relativePath, content),
    openFileApi: (nextPath) => options.witApi.openFile(nextPath),
    autosaveTick: (activeSeconds) => options.witApi.autosaveTick(activeSeconds),
    consumeActiveTypingSeconds: options.callbacks.consumeActiveTypingSeconds,
    parseSnapshotTimestamp: (value) => (value ? options.callbacks.parseSnapshotTimestamp(value) : null),
    updateSnapshotLabel: (nextTimestamp) => snapshotLabelController.update(nextTimestamp),
    renderStatusFooter: options.callbacks.renderStatusFooter
  });

  return {
    appShellUiController,
    projectPersistenceController,
    editorDirtyStateController,
    liveWordCountTracker,
    typingActivityTracker,
    snapshotLabelController,
    autosaveController,
    sidebarController,
    sidebarUiController,
    editorPresentationController,
    settingsDialogController,
    projectTreeStateController,
    entryDialogController,
    projectEntryActionsController,
    projectUiController,
    projectStateApplicationController,
    projectLifecycleController,
    emptyEditorStateController,
    editorInteractionsController,
    fileSessionController
  };
}

/**
 * Groups the controller instances that make up the renderer runtime.
 */
export type RendererComposition = {
  appShellUiController: ReturnType<typeof createAppShellUiController>;
  projectPersistenceController: ReturnType<typeof createProjectPersistenceController>;
  editorDirtyStateController: ReturnType<typeof createEditorDirtyStateController>;
  liveWordCountTracker: ReturnType<typeof createLiveWordCountTracker>;
  typingActivityTracker: ReturnType<typeof createTypingActivityTracker>;
  snapshotLabelController: ReturnType<typeof createSnapshotLabelController>;
  autosaveController: ReturnType<typeof createAutosaveController>;
  sidebarController: ReturnType<typeof createSidebarController>;
  sidebarUiController: ReturnType<typeof createSidebarUiController>;
  editorPresentationController: ReturnType<typeof createEditorPresentationController>;
  settingsDialogController: ReturnType<typeof createSettingsDialogController>;
  projectTreeStateController: ReturnType<typeof createProjectTreeStateController>;
  entryDialogController: ReturnType<typeof createEntryDialogController>;
  projectEntryActionsController: ReturnType<typeof createProjectEntryActionsController>;
  projectUiController: ReturnType<typeof createProjectUiController>;
  projectStateApplicationController: ReturnType<typeof createProjectStateApplicationController>;
  projectLifecycleController: ReturnType<typeof createProjectLifecycleController>;
  emptyEditorStateController: ReturnType<typeof createEmptyEditorStateController>;
  editorInteractionsController: ReturnType<typeof createEditorInteractionsController>;
  fileSessionController: ReturnType<typeof createFileSessionController>;
};
