import type { AppSettings, ProjectMetadata } from "../../../shared/types";

export type ProjectStateApplicationController = {
  resetActiveFile: () => void;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
};

export function createProjectStateApplicationController(options: {
  defaultEditorPlaceholder: string;
  getIsWindowFullscreen: () => boolean;
  setProjectState: (nextProject: ProjectMetadata | null) => void;
  setCurrentFilePathState: (nextFilePath: string | null) => void;
  resetCurrentFileWordCount: () => void;
  clearActiveFileLabel: () => void;
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
  const resetActiveFile = (): void => {
    options.setCurrentFilePathState(null);
    options.resetCurrentFileWordCount();
    options.clearActiveFileLabel();
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
    options.setProjectState(metadata);
    options.restoreCollapsedFolders();
    options.updateSnapshotLabel(
      metadata.latestSnapshotCreatedAt ? options.parseSnapshotTimestamp(metadata.latestSnapshotCreatedAt) : null
    );
    resetActiveFile();

    options.syncProjectPathLabels(metadata.projectPath);
    options.setProjectControlsEnabled(true);
    options.syncSettingsInputs(metadata.settings);
    options.renderStatusFooter();
    options.renderFileList();
    options.setSidebarVisibility(!options.getIsWindowFullscreen(), false);
    options.setSidebarFaded(false);
    options.setEditorWritable(false);
    options.restartAutosaveTimer();
    options.renderEmptyEditorState();
  };

  return {
    resetActiveFile,
    applyProjectMetadata
  };
}
