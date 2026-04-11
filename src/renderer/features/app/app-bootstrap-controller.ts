/**
 * Owns: top-level renderer bootstrap orchestration across event binding and first-load initialization.
 * Out of scope: project metadata persistence and low-level editor implementation.
 * Inputs/Outputs: composed renderer dependencies in, side-effectful bootstrap wiring out.
 * Side effects: binds global listeners and starts renderer initialization.
 */
import type { AppSettings, ProjectMetadata, TreeContextAction } from "../../../shared/types";
import type { ProjectTreeControllerState } from "../project-tree/project-tree-controller.js";
import type { ProjectTreeSelectionKind } from "../project-tree/project-tree-view.js";
import { bindAppEventBindings } from "./app-event-bindings.js";
import { initializeApp } from "./app-initializer.js";

type EditorEventAdapter = {
  onInput: (listener: () => void) => () => void;
  onKeydown: (listener: (event: KeyboardEvent) => void) => () => void;
  onBlur: (listener: () => void) => () => void;
  destroy: () => void;
};

type WitApiForBootstrap = {
  toggleFullscreen: () => Promise<boolean>;
  showTreeContextMenu: (payload: {
    relativePath: string;
    kind: "project" | "file" | "folder";
    x: number;
    y: number;
    isCurrentFile?: boolean;
    testAction?: TreeContextAction;
  }) => Promise<TreeContextAction | null>;
};

type WitApiForInitialization = {
  getPlatform: () => string;
  getActiveProject: () => Promise<ProjectMetadata | null>;
  onMenuOpenProject: (handler: () => void) => () => void;
  onMenuNewFile: (handler: () => void) => () => void;
  onMenuSaveCurrentFile: (handler: () => void) => () => void;
  onMenuZoomInText: (handler: () => void) => () => void;
  onMenuZoomOutText: (handler: () => void) => () => void;
  onMenuZoomResetText: (handler: () => void) => () => void;
  onMenuToggleSidebar: (handler: () => void) => () => void;
  onFullscreenChanged: (handler: (isFullscreen: boolean) => void) => () => void;
};

/**
 * Boots the renderer after composition and actions are available.
 *
 * @param options Composed renderer dependencies and callback adapters.
 */
export function bootstrapAppController(options: {
  body: HTMLElement;
  witApi: WitApiForBootstrap & WitApiForInitialization;
  openProjectButton: HTMLButtonElement;
  emptyStatePrimaryButton: HTMLButtonElement;
  emptyStateSecondaryButton: HTMLButtonElement;
  newFileButton: HTMLButtonElement;
  newFolderButton: HTMLButtonElement;
  toggleSidebarButton: HTMLButtonElement;
  sidebarResizer: HTMLDivElement;
  fullscreenToggleButton: HTMLButtonElement;
  sidebar: HTMLElement;
  fileList: HTMLUListElement;
  editor: EditorEventAdapter;
  projectTreeState: ProjectTreeControllerState;
  getProject: () => ProjectMetadata | null;
  onEditorInput: () => void;
  onEditorBlur: () => void;
  onEditorKeydown: (event: KeyboardEvent) => void;
  closeTreeContextMenu: () => void;
  openProjectPicker: () => Promise<void>;
  createNewFile: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  toggleSidebarVisibility: () => void;
  beginSidebarResize: (pointerClientX: number) => void;
  isSidebarVisible: () => boolean;
  adjustSidebarWidth: (delta: number) => void;
  syncFullscreenToggleButton: (isFullscreen: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  consumeTestTreeContextAction: () => TreeContextAction | undefined;
  closeCurrentProject: () => Promise<void>;
  deleteEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  closeCurrentFile: () => Promise<void>;
  renameEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  renderFileList: () => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  cancelPendingLiveWordCount: () => void;
  saveCurrentFileSynchronously: () => void;
  stopSidebarResize: () => void;
  clearEditorWidthGuides: () => void;
  stopAutosaveController: () => void;
  stopSnapshotLabelController: () => void;
  destroySettingsDialogController: () => void;
  destroyEntryDialogController: () => void;
  setDragSourceFilePath: (value: string | null) => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  defaultEditorFont: string;
  lineHeightInput: HTMLInputElement;
  paragraphSpacingSelect: HTMLSelectElement;
  editorWidthInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  loadAboutInfo: () => Promise<void>;
  loadSidebarWidthPreference: () => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  setSettingsTab: (tab: "writing") => void;
  syncSidebarToggleButton: () => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  setEditorWritable: (enabled: boolean) => void;
  populateFontSelect: (selectedFont: string) => void;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  normalizeEditorParagraphSpacing: (value: string) => AppSettings["editorParagraphSpacing"];
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  applyEditorZoom: (showStatus?: boolean) => void;
  applyEditorFont: (fontFamily: string) => void;
  renderSnapshotLabel: () => void;
  restartSnapshotLabelTimer: () => void;
  renderStatusFooter: () => void;
  renderEmptyEditorState: () => void;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
  openFile: (relativePath: string) => Promise<void>;
  resetActiveFile: () => void;
  stepEditorZoom: (direction: 1 | -1) => void;
  resetEditorZoom: () => void;
  loadSystemFonts: () => Promise<void>;
}): void {
  const subscriptions: Array<() => void> = [];
  const addSubscription = (unsubscribe: () => void): void => {
    subscriptions.push(unsubscribe);
  };

  bindAppEventBindings({
    openProjectButton: options.openProjectButton,
    emptyStatePrimaryButton: options.emptyStatePrimaryButton,
    emptyStateSecondaryButton: options.emptyStateSecondaryButton,
    newFileButton: options.newFileButton,
    newFolderButton: options.newFolderButton,
    toggleSidebarButton: options.toggleSidebarButton,
    sidebarResizer: options.sidebarResizer,
    fullscreenToggleButton: options.fullscreenToggleButton,
    sidebar: options.sidebar,
    fileList: options.fileList,
    editor: options.editor,
    getProject: options.getProject,
    onEditorInput: options.onEditorInput,
    onEditorBlur: options.onEditorBlur,
    onEditorKeydown: options.onEditorKeydown,
    projectTreeState: options.projectTreeState,
    closeTreeContextMenu: options.closeTreeContextMenu,
    openProjectPicker: options.openProjectPicker,
    createNewFile: options.createNewFile,
    createNewFolder: options.createNewFolder,
    toggleSidebarVisibility: options.toggleSidebarVisibility,
    beginSidebarResize: options.beginSidebarResize,
    isSidebarVisible: options.isSidebarVisible,
    adjustSidebarWidth: options.adjustSidebarWidth,
    toggleFullscreen: () => options.witApi.toggleFullscreen(),
    syncFullscreenToggleButton: options.syncFullscreenToggleButton,
    setSidebarFaded: options.setSidebarFaded,
    addSubscription,
    consumeTestTreeContextAction: options.consumeTestTreeContextAction,
    showTreeContextMenu: (payload) => options.witApi.showTreeContextMenu(payload),
    closeCurrentProject: options.closeCurrentProject,
    deleteEntryByPath: options.deleteEntryByPath,
    closeCurrentFile: options.closeCurrentFile,
    renameEntryByPath: options.renameEntryByPath,
    renderFileList: options.renderFileList,
    persistCurrentFile: options.persistCurrentFile,
    cancelPendingLiveWordCount: options.cancelPendingLiveWordCount,
    saveCurrentFileSynchronously: options.saveCurrentFileSynchronously,
    stopSidebarResize: options.stopSidebarResize,
    clearEditorWidthGuides: options.clearEditorWidthGuides,
    stopAutosaveController: options.stopAutosaveController,
    stopSnapshotLabelController: options.stopSnapshotLabelController,
    destroySettingsDialogController: options.destroySettingsDialogController,
    destroyEntryDialogController: options.destroyEntryDialogController,
    cleanupSubscriptions: () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    },
    setDragSourceFilePath: options.setDragSourceFilePath,
    setStatus: options.setStatus
  });

  void initializeApp({
    body: options.body,
    witApi: options.witApi,
    defaultEditorFont: options.defaultEditorFont,
    lineHeightInput: options.lineHeightInput,
    paragraphSpacingSelect: options.paragraphSpacingSelect,
    editorWidthInput: options.editorWidthInput,
    fontSelect: options.fontSelect,
    getProject: options.getProject,
    loadAboutInfo: options.loadAboutInfo,
    loadSidebarWidthPreference: options.loadSidebarWidthPreference,
    setProjectControlsEnabled: options.setProjectControlsEnabled,
    setSettingsTab: options.setSettingsTab,
    syncSidebarToggleButton: options.syncSidebarToggleButton,
    syncFullscreenToggleButton: options.syncFullscreenToggleButton,
    setSidebarVisibility: options.setSidebarVisibility,
    setSidebarFaded: options.setSidebarFaded,
    setEditorWritable: options.setEditorWritable,
    populateFontSelect: options.populateFontSelect,
    applyTheme: options.applyTheme,
    applyEditorLineHeight: options.applyEditorLineHeight,
    normalizeEditorParagraphSpacing: options.normalizeEditorParagraphSpacing,
    applyEditorParagraphSpacing: options.applyEditorParagraphSpacing,
    applyEditorMaxWidth: options.applyEditorMaxWidth,
    applyEditorZoom: options.applyEditorZoom,
    applyEditorFont: options.applyEditorFont,
    renderSnapshotLabel: options.renderSnapshotLabel,
    restartSnapshotLabelTimer: options.restartSnapshotLabelTimer,
    renderFileList: options.renderFileList,
    renderStatusFooter: options.renderStatusFooter,
    renderEmptyEditorState: options.renderEmptyEditorState,
    applyProjectMetadata: options.applyProjectMetadata,
    openFile: options.openFile,
    resetActiveFile: options.resetActiveFile,
    setStatus: options.setStatus,
    addSubscription,
    openProjectPicker: options.openProjectPicker,
    createNewFile: options.createNewFile,
    persistCurrentFile: options.persistCurrentFile,
    stepEditorZoom: options.stepEditorZoom,
    resetEditorZoom: options.resetEditorZoom,
    toggleSidebarVisibility: options.toggleSidebarVisibility,
    loadSystemFonts: options.loadSystemFonts
  });
}
