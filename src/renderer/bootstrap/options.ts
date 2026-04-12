/**
 * Owns: assembly of the option bag passed into renderer bootstrap.
 * Out of scope: bootstrap execution and event handling logic itself.
 * Inputs/Outputs: composition, actions, and DOM subsets in, a normalized bootstrap options object out.
 * Side effects: none.
 */
import type { AppSettings, ProjectMetadata, TreeContextAction } from "../../shared/types";
import type { ProjectTreeSelectionKind } from "../project/tree/view.js";
import type { EditorAdapter } from "../editor/adapter.js";
import type { RendererComposition } from "./compose.js";
import type { RendererActions } from "./actions.js";
import type { RendererDom } from "./dom.js";

/**
 * Builds the normalized bootstrap options used to wire the renderer.
 *
 * @param options Composition, actions, DOM references, and formatting helpers.
 * @returns A single object consumed by `bootstrapAppController`.
 */
export function createRendererBootstrapOptions(options: {
  body: HTMLElement;
  witApi: {
    toggleFullscreen: () => Promise<boolean>;
    showTreeContextMenu: (payload: {
      relativePath: string;
      kind: "project" | "file" | "folder";
      x: number;
      y: number;
      isCurrentFile?: boolean;
      testAction?: TreeContextAction;
    }) => Promise<TreeContextAction | null>;
    getPlatform: () => string;
    getActiveProject: () => Promise<ProjectMetadata | null>;
    onMenuOpenProject: (handler: () => void) => () => void;
    onMenuCloseProject: (handler: () => void) => () => void;
    onMenuNewFile: (handler: () => void) => () => void;
    onMenuNewFolder: (handler: () => void) => () => void;
    onMenuProjectSettings: (handler: () => void) => () => void;
    onMenuSaveCurrentFile: (handler: () => void) => () => void;
    onMenuZoomInText: (handler: () => void) => () => void;
    onMenuZoomOutText: (handler: () => void) => () => void;
    onMenuZoomResetText: (handler: () => void) => () => void;
    onMenuToggleSidebar: (handler: () => void) => () => void;
    onFullscreenChanged: (handler: (isFullscreen: boolean) => void) => () => void;
  };
  dom: Pick<
    RendererDom,
    | "configCorruptedBanner"
    | "configCorruptedDismissButton"
    | "openProjectButton"
    | "emptyStatePrimaryButton"
    | "emptyStateSecondaryButton"
    | "newFileButton"
    | "newFolderButton"
    | "toggleSidebarButton"
    | "sidebarResizer"
    | "fullscreenToggleButton"
    | "sidebar"
    | "fileList"
    | "lineHeightInput"
    | "paragraphSpacingSelect"
    | "editorWidthInput"
    | "fontSelect"
  >;
  editor: EditorAdapter;
  composition: RendererComposition;
  actions: RendererActions;
  defaultEditorFont: string;
  normalizeEditorParagraphSpacing: (value: string) => AppSettings["editorParagraphSpacing"];
}) {
  return {
    body: options.body,
    witApi: options.witApi,
    configCorruptedBanner: options.dom.configCorruptedBanner,
    configCorruptedDismissButton: options.dom.configCorruptedDismissButton,
    openProjectButton: options.dom.openProjectButton,
    emptyStatePrimaryButton: options.dom.emptyStatePrimaryButton,
    emptyStateSecondaryButton: options.dom.emptyStateSecondaryButton,
    newFileButton: options.dom.newFileButton,
    newFolderButton: options.dom.newFolderButton,
    toggleSidebarButton: options.dom.toggleSidebarButton,
    sidebarResizer: options.dom.sidebarResizer,
    fullscreenToggleButton: options.dom.fullscreenToggleButton,
    sidebar: options.dom.sidebar,
    fileList: options.dom.fileList,
    editor: options.editor,
    projectTreeState: options.composition.projectTreeStateController.state,
    getProject: options.actions.getProject,
    onEditorInput: () => options.composition.editorInteractionsController.onEditorInput(),
    onEditorBlur: () => options.composition.editorInteractionsController.onEditorBlur(),
    onEditorKeydown: (event: KeyboardEvent) => options.composition.editorInteractionsController.onEditorKeydown(event),
    closeTreeContextMenu: options.actions.closeTreeContextMenu,
    openProjectPicker: options.actions.openProjectPicker,
    createNewFile: () => options.composition.projectEntryActionsController.createNewFile(),
    openProjectSettings: () => options.composition.settingsDialogController.open(),
    createNewFolder: () => options.composition.projectEntryActionsController.createNewFolder(),
    toggleSidebarVisibility: options.actions.toggleSidebarVisibility,
    beginSidebarResize: options.actions.beginSidebarResize,
    isSidebarVisible: () => options.composition.sidebarController.isVisible(),
    adjustSidebarWidth: (delta: number) => options.composition.sidebarController.adjustWidth(delta),
    syncFullscreenToggleButton: options.actions.syncFullscreenToggleButton,
    setSidebarFaded: options.actions.setSidebarFaded,
    consumeTestTreeContextAction: options.actions.consumeTestTreeContextAction,
    closeCurrentProject: options.actions.closeCurrentProject,
    deleteEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) =>
      options.composition.projectEntryActionsController.deleteEntryByPath(relativePath, kind),
    closeCurrentFile: options.actions.closeCurrentFile,
    renameEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) =>
      options.composition.projectEntryActionsController.renameEntryByPath(relativePath, kind),
    renderFileList: options.actions.renderFileList,
    persistCurrentFile: options.actions.persistCurrentFile,
    cancelPendingLiveWordCount: options.actions.cancelPendingLiveWordCount,
    saveCurrentFileSynchronously: options.actions.saveCurrentFileSynchronously,
    stopSidebarResize: options.actions.stopSidebarResize,
    clearEditorWidthGuides: options.actions.clearEditorWidthGuides,
    stopAutosaveController: () => options.composition.autosaveController.stop(),
    stopSnapshotLabelController: () => options.composition.snapshotLabelController.stop(),
    destroySettingsDialogController: () => options.composition.settingsDialogController.destroy(),
    destroyEntryDialogController: () => options.composition.entryDialogController.destroy(),
    setDragSource: options.composition.projectTreeStateController.setDragSource,
    setStatus: options.actions.setStatus,
    defaultEditorFont: options.defaultEditorFont,
    lineHeightInput: options.dom.lineHeightInput,
    paragraphSpacingSelect: options.dom.paragraphSpacingSelect,
    editorWidthInput: options.dom.editorWidthInput,
    fontSelect: options.dom.fontSelect,
    loadAboutInfo: options.actions.loadAboutInfo,
    loadSidebarWidthPreference: options.actions.loadSidebarWidthPreference,
    setProjectControlsEnabled: options.actions.setProjectControlsEnabled,
    setSettingsTab: (tab: "writing") => options.composition.settingsDialogController.setActiveTab(tab),
    syncSidebarToggleButton: options.actions.syncSidebarToggleButton,
    setSidebarVisibility: options.actions.setSidebarVisibility,
    setEditorWritable: options.actions.setEditorWritable,
    populateFontSelect: options.actions.populateFontSelect,
    applyTheme: options.actions.applyTheme,
    applyEditorLineHeight: options.actions.applyEditorLineHeight,
    normalizeEditorParagraphSpacing: options.normalizeEditorParagraphSpacing,
    applyEditorParagraphSpacing: options.actions.applyEditorParagraphSpacing,
    applyEditorMaxWidth: options.actions.applyEditorMaxWidth,
    applyEditorZoom: options.actions.applyEditorZoom,
    applyEditorFont: options.actions.applyEditorFont,
    renderSnapshotLabel: options.actions.renderSnapshotLabel,
    restartSnapshotLabelTimer: options.actions.restartSnapshotLabelTimer,
    renderStatusFooter: options.actions.renderStatusFooter,
    renderEmptyEditorState: options.actions.renderEmptyEditorState,
    applyProjectMetadata: options.actions.applyProjectMetadata,
    openFile: options.actions.openFile,
    resetActiveFile: options.actions.resetActiveFile,
    stepEditorZoom: options.actions.stepEditorZoom,
    resetEditorZoom: options.actions.resetEditorZoom,
    loadSystemFonts: options.actions.loadSystemFonts
  };
}
