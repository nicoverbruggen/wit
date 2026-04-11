/**
 * Owns: applying project metadata into renderer state and resetting file-specific editor state.
 * Out of scope: project selection, persistence, and entry mutation workflows.
 * Inputs/Outputs: metadata/state hooks in, project-state application actions out.
 * Side effects: mutates renderer state, editor presentation state, and sidebar visibility.
 */
import type { AppSettings, ProjectMetadata } from "../../shared/types";

/**
 * Exposes renderer actions that replace or refresh project-bound UI state.
 */
export type ProjectStateApplicationController = {
  resetActiveFile: () => void;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
  refreshProjectMetadata: (metadata: ProjectMetadata) => void;
};

/**
 * Creates the controller responsible for applying project metadata to the renderer.
 *
 * @param options Renderer state setters and UI synchronization callbacks.
 * @returns Actions for full project application and lighter metadata refreshes.
 */
export function createProjectStateApplicationController(options: {
  defaultEditorPlaceholder: string;
  getIsWindowFullscreen: () => boolean;
  setProjectState: (nextProject: ProjectMetadata | null) => void;
  setCurrentFilePathState: (nextFilePath: string | null) => void;
  resetCurrentFileWordCount: () => void;
  clearActiveFileLabel: () => void;
  setEditorSyntaxForFile: (relativePath: string | null) => void;
  clearEditorValueSilently: () => void;
  setEditorPlaceholder: (value: string) => void;
  setDirty: (nextDirty: boolean) => void;
  setEditorWritable: (enabled: boolean) => void;
  renderEmptyEditorState: () => void;
  renderFileList: () => void;
  cancelPendingLiveWordCount: () => void;
  stopSidebarResize: () => void;
  resetTreeState: () => void;
  restoreCollapsedFolders: () => void;
  updateSnapshotLabel: (nextTimestamp: number | null) => void;
  parseSnapshotTimestamp: (snapshotName: string) => number | null;
  syncProjectPathLabels: (projectPath: string) => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  syncSettingsInputs: (settings: AppSettings) => void;
  renderStatusFooter: () => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  restartAutosaveTimer: () => void;
}): ProjectStateApplicationController {
  const applyCommonProjectMetadata = (metadata: ProjectMetadata): void => {
    options.setProjectState(metadata);
    options.restoreCollapsedFolders();
    options.updateSnapshotLabel(
      metadata.latestSnapshotCreatedAt ? options.parseSnapshotTimestamp(metadata.latestSnapshotCreatedAt) : null
    );
  };

  const syncProjectMetadataUi = (metadata: ProjectMetadata): void => {
    options.syncProjectPathLabels(metadata.projectPath);
    options.setProjectControlsEnabled(true);
    options.syncSettingsInputs(metadata.settings);
    options.renderStatusFooter();
    options.renderFileList();
    options.restartAutosaveTimer();
  };

  const resetActiveFile = (): void => {
    options.setCurrentFilePathState(null);
    options.resetCurrentFileWordCount();
    options.clearActiveFileLabel();
    options.setEditorSyntaxForFile(null);
    options.clearEditorValueSilently();
    options.setEditorPlaceholder(options.defaultEditorPlaceholder);
    options.setDirty(false);
    options.setEditorWritable(false);
    options.renderEmptyEditorState();
    options.renderFileList();
  };

  const applyProjectMetadata = (metadata: ProjectMetadata): void => {
    options.cancelPendingLiveWordCount();
    options.stopSidebarResize();
    options.resetTreeState();
    applyCommonProjectMetadata(metadata);
    resetActiveFile();
    syncProjectMetadataUi(metadata);
    options.setSidebarVisibility(!options.getIsWindowFullscreen(), false);
    options.setSidebarFaded(false);
    options.setEditorWritable(false);
    options.renderEmptyEditorState();
  };

  const refreshProjectMetadata = (metadata: ProjectMetadata): void => {
    applyCommonProjectMetadata(metadata);
    syncProjectMetadataUi(metadata);
  };

  return {
    resetActiveFile,
    applyProjectMetadata,
    refreshProjectMetadata
  };
}
