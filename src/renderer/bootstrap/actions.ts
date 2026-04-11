/**
 * Owns: the renderer action surface that translates composition internals into stable operations.
 * Out of scope: DOM event binding and controller construction.
 * Inputs/Outputs: composition/state readers in, imperative renderer actions out.
 * Side effects: delegates to composed controllers and mutates renderer state through them.
 */
import type { AppSettings, ProjectMetadata, TreeContextAction } from "../../shared/types";
import type { RendererComposition } from "./compose.js";
import type { RendererCompositionCallbacks } from "./contracts.js";

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

  const appShellUi = () => requireComposition().appShellUiController;
  const snapshotLabel = () => requireComposition().snapshotLabelController;
  const editorPresentation = () => requireComposition().editorPresentationController;
  const typingActivity = () => requireComposition().typingActivityTracker;
  const editorDirtyState = () => requireComposition().editorDirtyStateController;
  const projectPersistence = () => requireComposition().projectPersistenceController;
  const sidebarUi = () => requireComposition().sidebarUiController;
  const projectStateApplication = () => requireComposition().projectStateApplicationController;
  const projectLifecycle = () => requireComposition().projectLifecycleController;
  const emptyEditorState = () => requireComposition().emptyEditorStateController;
  const projectUi = () => requireComposition().projectUiController;
  const projectTreeState = () => requireComposition().projectTreeStateController;
  const fileSession = () => requireComposition().fileSessionController;
  const autosave = () => requireComposition().autosaveController;

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
    appShellUi().setStatus(message, clearAfterMs);
  };

  const renderSnapshotLabel = (): void => {
    snapshotLabel().render();
  };

  const restartSnapshotLabelTimer = (): void => {
    snapshotLabel().start();
  };

  const showEditorWidthGuides = (): void => {
    editorPresentation().showEditorWidthGuides();
  };

  const clearEditorWidthGuides = (): void => {
    editorPresentation().clearEditorWidthGuides();
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
    return typingActivity().consumeActiveSeconds();
  };

  const setDirty = (nextDirty: boolean): void => {
    editorDirtyState().setDirty(nextDirty);
  };

  const persistLastOpenedFilePath = async (relativePath: string | null): Promise<void> => {
    await projectPersistence().persistLastOpenedFilePath(relativePath);
  };

  const refreshEditorLayout = (): void => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  };

  const setProjectControlsEnabled = (enabled: boolean): void => {
    appShellUi().setProjectControlsEnabled(enabled);
  };

  const setSidebarFaded = (nextFaded: boolean): void => {
    sidebarUi().setSidebarFaded(nextFaded);
  };

  const loadSidebarWidthPreference = (): void => {
    sidebarUi().loadSidebarWidthPreference();
  };

  const syncSidebarToggleButton = (): void => {
    sidebarUi().syncSidebarToggleButton();
  };

  const syncFullscreenToggleButton = (isFullscreen: boolean): void => {
    sidebarUi().syncFullscreenToggleButton(isFullscreen);
  };

  const setSidebarVisibility = (nextVisible: boolean, showStatus = true): void => {
    sidebarUi().setSidebarVisibility(nextVisible, showStatus);
  };

  const toggleSidebarVisibility = (): void => {
    sidebarUi().toggleSidebarVisibility();
  };

  const stopSidebarResize = (): void => {
    sidebarUi().stopSidebarResize();
  };

  const beginSidebarResize = (pointerClientX: number): void => {
    sidebarUi().beginSidebarResize(pointerClientX);
  };

  const loadAboutInfo = async (): Promise<void> => {
    await appShellUi().loadAboutInfo();
  };

  const setEditorWritable = (enabled: boolean): void => {
    editorPresentation().setEditorWritable(enabled);
  };

  const applyEditorLineHeight = (lineHeight: number): void => {
    editorPresentation().applyEditorLineHeight(lineHeight);
  };

  const applyEditorParagraphSpacing = (spacing: AppSettings["editorParagraphSpacing"]): void => {
    editorPresentation().applyEditorParagraphSpacing(spacing);
  };

  const applyEditorMaxWidth = (editorWidth: number): void => {
    editorPresentation().applyEditorMaxWidth(editorWidth);
  };

  const applyEditorFont = (fontFamily: string): void => {
    editorPresentation().applyEditorFont(fontFamily);
  };

  const populateFontSelect = (selectedFont: string): void => {
    editorPresentation().populateFontSelect(selectedFont);
  };

  const loadSystemFonts = async (): Promise<void> => {
    await editorPresentation().loadSystemFonts();
  };

  const applyTheme = (theme: AppSettings["theme"]): void => {
    editorPresentation().applyTheme(theme);
  };

  const applyEditorZoom = (showStatus = true): void => {
    editorPresentation().applyEditorZoom(showStatus);
  };

  const setEditorZoomFromPercent = (percent: number, showStatus = true): void => {
    editorPresentation().setEditorZoomFromPercent(percent, showStatus);
  };

  const stepEditorZoom = (direction: 1 | -1): void => {
    editorPresentation().stepEditorZoom(direction);
  };

  const resetEditorZoom = (): void => {
    editorPresentation().resetEditorZoom();
  };

  const getProjectDisplayTitle = (projectPath: string): string => {
    const trimmed = projectPath.replace(/[\\/]+$/, "");
    const segments = trimmed.split(/[\\/]/).filter((segment) => segment.length > 0);
    return segments.at(-1) ?? projectPath;
  };

  const resetActiveFile = (): void => {
    projectStateApplication().resetActiveFile();
  };

  const closeCurrentFile = async (): Promise<void> => {
    await projectLifecycle().closeCurrentFile();
  };

  const renderEmptyEditorState = (): void => {
    emptyEditorState().renderEmptyEditorState();
  };

  const syncProjectPathLabels = (projectPath: string): void => {
    projectUi().syncProjectPathLabels(projectPath, options.getProject());
  };

  const renderStatusFooter = (): void => {
    projectUi().renderStatusFooter(options.getProject());
  };

  const renderEditorHeaderVisibility = (): void => {
    projectUi().renderEditorHeaderVisibility(options.getProject());
  };

  const renderFileList = (): void => {
    projectTreeState().renderFileList();
  };

  const syncSettingsInputs = (settings: AppSettings): void => {
    projectUi().syncSettingsInputs(settings, options.getProject());
  };

  const applyProjectMetadata = (metadata: ProjectMetadata): void => {
    projectStateApplication().applyProjectMetadata(metadata);
  };

  const cancelPendingLiveWordCount = (): void => {
    fileSession().cancelPendingLiveWordCount();
  };

  const scheduleLiveWordCountRefresh = (): void => {
    fileSession().scheduleLiveWordCountRefresh();
  };

  const persistCurrentFile = async (showStatus = true): Promise<boolean> => {
    return fileSession().persistCurrentFile(showStatus);
  };

  const saveCurrentFileSynchronously = (): void => {
    fileSession().saveCurrentFileSynchronously();
  };

  const openFile = async (relativePath: string): Promise<void> => {
    await fileSession().openFile(relativePath);
  };

  const isUserTyping = (): boolean => {
    return typingActivity().isTyping();
  };

  const waitForTypingPause = (): Promise<void> => {
    return typingActivity().waitForPause({
      maxWaitMs: options.autosaveLeniencyMaxMs,
      pollMs: options.autosaveLeniencyPollMs
    });
  };

  const restartAutosaveTimer = (): void => {
    autosave().restart();
  };

  const runAutosaveTick = async (): Promise<void> => {
    await fileSession().runAutosaveTick();
  };

  const openProjectPicker = async (): Promise<void> => {
    await projectLifecycle().openProjectPicker();
  };

  const closeCurrentProject = async (): Promise<void> => {
    await projectLifecycle().closeCurrentProject();
  };

  const persistSettings = async (update: Partial<AppSettings>): Promise<void> => {
    return projectPersistence().persistSettings(update);
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
