/**
 * Owns: the renderer action surface that translates composition internals into stable operations.
 * Out of scope: DOM event binding and controller construction.
 * Inputs/Outputs: composition/state readers in, imperative renderer actions out.
 * Side effects: delegates to composed controllers and mutates renderer state through them.
 */
import type { AppSettings, ProjectMetadata, TreeContextAction } from "../../../shared/types";
import type { RendererComposition } from "./renderer-composition.js";
import type { RendererCompositionCallbacks } from "./renderer-composition-contracts.js";

type TestWindowWithContextAction = Window & {
  __WIT_TEST_TREE_ACTION?: TreeContextAction;
};

type RendererActionsOptions = {
  witApi: {
    getPlatform: () => string;
  };
  getProject: () => ProjectMetadata | null;
  setProject: (nextProject: ProjectMetadata | null) => void;
  getCurrentFilePath: () => string | null;
  setCurrentFilePath: (nextFilePath: string | null) => void;
  getComposition: () => RendererComposition | null;
  formatPrimaryShortcut: (key: string, platform: string) => string;
  parseSnapshotTimestamp: (snapshotName: string) => number | null;
  autosaveLeniencyMaxMs: number;
  autosaveLeniencyPollMs: number;
};

/**
 * Exposes the normalized action surface used across renderer bootstrap and composition.
 */
export type RendererActions = {
  getProject: () => ProjectMetadata | null;
  setProjectState: (nextProject: ProjectMetadata | null) => void;
  getCurrentFilePath: () => string | null;
  setCurrentFilePathState: (nextFilePath: string | null) => void;
  primaryShortcutLabel: (key: string) => string;
  getProjectDisplayTitle: (projectPath: string) => string;
  setStatus: (message: string, clearAfterMs?: number) => void;
  renderSnapshotLabel: () => void;
  restartSnapshotLabelTimer: () => void;
  showEditorWidthGuides: () => void;
  clearEditorWidthGuides: () => void;
  closeTreeContextMenu: () => void;
  consumeTestTreeContextAction: () => TreeContextAction | undefined;
  consumeActiveTypingSeconds: () => number;
  setDirty: (nextDirty: boolean) => void;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  refreshEditorLayout: () => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  loadSidebarWidthPreference: () => void;
  syncSidebarToggleButton: () => void;
  syncFullscreenToggleButton: (isFullscreen: boolean) => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  toggleSidebarVisibility: () => void;
  stopSidebarResize: () => void;
  beginSidebarResize: (pointerClientX: number) => void;
  loadAboutInfo: () => Promise<void>;
  setEditorWritable: (enabled: boolean) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  applyEditorFont: (fontFamily: string) => void;
  populateFontSelect: (selectedFont: string) => void;
  loadSystemFonts: () => Promise<void>;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorZoom: (showStatus?: boolean) => void;
  setEditorZoomFromPercent: (percent: number, showStatus?: boolean) => void;
  stepEditorZoom: (direction: 1 | -1) => void;
  resetEditorZoom: () => void;
  resetActiveFile: () => void;
  closeCurrentFile: () => Promise<void>;
  renderEmptyEditorState: () => void;
  syncProjectPathLabels: (projectPath: string) => void;
  renderStatusFooter: () => void;
  renderEditorHeaderVisibility: () => void;
  renderFileList: () => void;
  syncSettingsInputs: (settings: AppSettings) => void;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
  cancelPendingLiveWordCount: () => void;
  scheduleLiveWordCountRefresh: () => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  saveCurrentFileSynchronously: () => void;
  openFile: (relativePath: string) => Promise<void>;
  isUserTyping: () => boolean;
  waitForTypingPause: () => Promise<void>;
  restartAutosaveTimer: () => void;
  runAutosaveTick: () => Promise<void>;
  openProjectPicker: () => Promise<void>;
  closeCurrentProject: () => Promise<void>;
  persistSettings: (update: Partial<AppSettings>) => Promise<void>;
  parseSnapshotTimestamp: (snapshotName: string) => number | null;
  compositionCallbacks: RendererCompositionCallbacks;
};

/**
 * Creates the renderer action facade over the composed controllers.
 *
 * @param options Renderer state readers, composition access, and formatting helpers.
 * @returns Stable renderer actions plus callback adapters for composition wiring.
 */
export function createRendererActions(options: RendererActionsOptions): RendererActions {
  const requireComposition = (): RendererComposition => {
    const composition = options.getComposition();
    if (!composition) {
      throw new Error("Renderer composition not ready");
    }

    return composition;
  };

  const setProjectState = (nextProject: ProjectMetadata | null): void => {
    options.setProject(nextProject);
  };

  const setCurrentFilePathState = (nextFilePath: string | null): void => {
    options.setCurrentFilePath(nextFilePath);
  };

  const primaryShortcutLabel = (key: string): string => {
    return options.formatPrimaryShortcut(key, options.witApi.getPlatform());
  };

  const setStatus = (message: string, clearAfterMs?: number): void => {
    requireComposition().appShellUiController.setStatus(message, clearAfterMs);
  };

  const renderSnapshotLabel = (): void => {
    requireComposition().snapshotLabelController.render();
  };

  const restartSnapshotLabelTimer = (): void => {
    requireComposition().snapshotLabelController.start();
  };

  const showEditorWidthGuides = (): void => {
    requireComposition().editorPresentationController.showEditorWidthGuides();
  };

  const clearEditorWidthGuides = (): void => {
    requireComposition().editorPresentationController.clearEditorWidthGuides();
  };

  const closeTreeContextMenu = (): void => {
    // Native context menus are managed by the operating system.
  };

  const consumeTestTreeContextAction = (): TreeContextAction | undefined => {
    const testWindow = window as TestWindowWithContextAction;
    const action = testWindow.__WIT_TEST_TREE_ACTION;
    delete testWindow.__WIT_TEST_TREE_ACTION;
    return action;
  };

  const consumeActiveTypingSeconds = (): number => {
    return requireComposition().typingActivityTracker.consumeActiveSeconds();
  };

  const setDirty = (nextDirty: boolean): void => {
    requireComposition().editorDirtyStateController.setDirty(nextDirty);
  };

  const persistLastOpenedFilePath = async (relativePath: string | null): Promise<void> => {
    await requireComposition().projectPersistenceController.persistLastOpenedFilePath(relativePath);
  };

  const refreshEditorLayout = (): void => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  };

  const setProjectControlsEnabled = (enabled: boolean): void => {
    requireComposition().appShellUiController.setProjectControlsEnabled(enabled);
  };

  const setSidebarFaded = (nextFaded: boolean): void => {
    requireComposition().sidebarUiController.setSidebarFaded(nextFaded);
  };

  const loadSidebarWidthPreference = (): void => {
    requireComposition().sidebarUiController.loadSidebarWidthPreference();
  };

  const syncSidebarToggleButton = (): void => {
    requireComposition().sidebarUiController.syncSidebarToggleButton();
  };

  const syncFullscreenToggleButton = (isFullscreen: boolean): void => {
    requireComposition().sidebarUiController.syncFullscreenToggleButton(isFullscreen);
  };

  const setSidebarVisibility = (nextVisible: boolean, showStatus = true): void => {
    requireComposition().sidebarUiController.setSidebarVisibility(nextVisible, showStatus);
  };

  const toggleSidebarVisibility = (): void => {
    requireComposition().sidebarUiController.toggleSidebarVisibility();
  };

  const stopSidebarResize = (): void => {
    requireComposition().sidebarUiController.stopSidebarResize();
  };

  const beginSidebarResize = (pointerClientX: number): void => {
    requireComposition().sidebarUiController.beginSidebarResize(pointerClientX);
  };

  const loadAboutInfo = async (): Promise<void> => {
    await requireComposition().appShellUiController.loadAboutInfo();
  };

  const setEditorWritable = (enabled: boolean): void => {
    requireComposition().editorPresentationController.setEditorWritable(enabled);
  };

  const applyEditorLineHeight = (lineHeight: number): void => {
    requireComposition().editorPresentationController.applyEditorLineHeight(lineHeight);
  };

  const applyEditorParagraphSpacing = (spacing: AppSettings["editorParagraphSpacing"]): void => {
    requireComposition().editorPresentationController.applyEditorParagraphSpacing(spacing);
  };

  const applyEditorMaxWidth = (editorWidth: number): void => {
    requireComposition().editorPresentationController.applyEditorMaxWidth(editorWidth);
  };

  const applyEditorFont = (fontFamily: string): void => {
    requireComposition().editorPresentationController.applyEditorFont(fontFamily);
  };

  const populateFontSelect = (selectedFont: string): void => {
    requireComposition().editorPresentationController.populateFontSelect(selectedFont);
  };

  const loadSystemFonts = async (): Promise<void> => {
    await requireComposition().editorPresentationController.loadSystemFonts();
  };

  const applyTheme = (theme: AppSettings["theme"]): void => {
    requireComposition().editorPresentationController.applyTheme(theme);
  };

  const applyEditorZoom = (showStatus = true): void => {
    requireComposition().editorPresentationController.applyEditorZoom(showStatus);
  };

  const setEditorZoomFromPercent = (percent: number, showStatus = true): void => {
    requireComposition().editorPresentationController.setEditorZoomFromPercent(percent, showStatus);
  };

  const stepEditorZoom = (direction: 1 | -1): void => {
    requireComposition().editorPresentationController.stepEditorZoom(direction);
  };

  const resetEditorZoom = (): void => {
    requireComposition().editorPresentationController.resetEditorZoom();
  };

  const getProjectDisplayTitle = (projectPath: string): string => {
    const trimmed = projectPath.replace(/[\\/]+$/, "");
    const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
    return segments.at(-1) ?? projectPath;
  };

  const resetActiveFile = (): void => {
    requireComposition().projectStateApplicationController.resetActiveFile();
  };

  const closeCurrentFile = async (): Promise<void> => {
    await requireComposition().projectLifecycleController.closeCurrentFile();
  };

  const renderEmptyEditorState = (): void => {
    requireComposition().emptyEditorStateController.renderEmptyEditorState();
  };

  const syncProjectPathLabels = (projectPath: string): void => {
    requireComposition().projectUiController.syncProjectPathLabels(projectPath, options.getProject());
  };

  const renderStatusFooter = (): void => {
    requireComposition().projectUiController.renderStatusFooter(options.getProject());
  };

  const renderEditorHeaderVisibility = (): void => {
    requireComposition().projectUiController.renderEditorHeaderVisibility(options.getProject());
  };

  const renderFileList = (): void => {
    requireComposition().projectTreeStateController.renderFileList();
  };

  const syncSettingsInputs = (settings: AppSettings): void => {
    requireComposition().projectUiController.syncSettingsInputs(settings, options.getProject());
  };

  const applyProjectMetadata = (metadata: ProjectMetadata): void => {
    requireComposition().projectStateApplicationController.applyProjectMetadata(metadata);
  };

  const cancelPendingLiveWordCount = (): void => {
    requireComposition().fileSessionController.cancelPendingLiveWordCount();
  };

  const scheduleLiveWordCountRefresh = (): void => {
    requireComposition().fileSessionController.scheduleLiveWordCountRefresh();
  };

  const persistCurrentFile = async (showStatus = true): Promise<boolean> => {
    return requireComposition().fileSessionController.persistCurrentFile(showStatus);
  };

  const saveCurrentFileSynchronously = (): void => {
    requireComposition().fileSessionController.saveCurrentFileSynchronously();
  };

  const openFile = async (relativePath: string): Promise<void> => {
    await requireComposition().fileSessionController.openFile(relativePath);
  };

  const isUserTyping = (): boolean => {
    return requireComposition().typingActivityTracker.isTyping();
  };

  const waitForTypingPause = (): Promise<void> => {
    return requireComposition().typingActivityTracker.waitForPause({
      maxWaitMs: options.autosaveLeniencyMaxMs,
      pollMs: options.autosaveLeniencyPollMs
    });
  };

  const restartAutosaveTimer = (): void => {
    requireComposition().autosaveController.restart();
  };

  const runAutosaveTick = async (): Promise<void> => {
    await requireComposition().fileSessionController.runAutosaveTick();
  };

  const openProjectPicker = async (): Promise<void> => {
    await requireComposition().projectLifecycleController.openProjectPicker();
  };

  const closeCurrentProject = async (): Promise<void> => {
    await requireComposition().projectLifecycleController.closeCurrentProject();
  };

  const persistSettings = async (update: Partial<AppSettings>): Promise<void> => {
    return requireComposition().projectPersistenceController.persistSettings(update);
  };

  const parseSnapshotTimestamp = (snapshotName: string): number | null => {
    return options.parseSnapshotTimestamp(snapshotName);
  };

  const compositionCallbacks: RendererCompositionCallbacks = {
    setStatus,
    syncSettingsInputs,
    renderStatusFooter,
    renderEditorHeaderVisibility,
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
  };

  return {
    getProject: options.getProject,
    setProjectState,
    getCurrentFilePath: options.getCurrentFilePath,
    setCurrentFilePathState,
    primaryShortcutLabel,
    getProjectDisplayTitle,
    setStatus,
    renderSnapshotLabel,
    restartSnapshotLabelTimer,
    showEditorWidthGuides,
    clearEditorWidthGuides,
    closeTreeContextMenu,
    consumeTestTreeContextAction,
    consumeActiveTypingSeconds,
    setDirty,
    persistLastOpenedFilePath,
    refreshEditorLayout,
    setProjectControlsEnabled,
    setSidebarFaded,
    loadSidebarWidthPreference,
    syncSidebarToggleButton,
    syncFullscreenToggleButton,
    setSidebarVisibility,
    toggleSidebarVisibility,
    stopSidebarResize,
    beginSidebarResize,
    loadAboutInfo,
    setEditorWritable,
    applyEditorLineHeight,
    applyEditorParagraphSpacing,
    applyEditorMaxWidth,
    applyEditorFont,
    populateFontSelect,
    loadSystemFonts,
    applyTheme,
    applyEditorZoom,
    setEditorZoomFromPercent,
    stepEditorZoom,
    resetEditorZoom,
    resetActiveFile,
    closeCurrentFile,
    renderEmptyEditorState,
    syncProjectPathLabels,
    renderStatusFooter,
    renderEditorHeaderVisibility,
    renderFileList,
    syncSettingsInputs,
    applyProjectMetadata,
    cancelPendingLiveWordCount,
    scheduleLiveWordCountRefresh,
    persistCurrentFile,
    saveCurrentFileSynchronously,
    openFile,
    isUserTyping,
    waitForTypingPause,
    restartAutosaveTimer,
    runAutosaveTick,
    openProjectPicker,
    closeCurrentProject,
    persistSettings,
    parseSnapshotTimestamp,
    compositionCallbacks
  };
}
