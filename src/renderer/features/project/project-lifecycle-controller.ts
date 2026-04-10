import type { AppSettings, ProjectMetadata } from "../../../shared/types";

export type ProjectLifecycleController = {
  closeCurrentFile: () => Promise<void>;
  clearProjectState: (showStatusMessage?: boolean) => void;
  openProjectPicker: () => Promise<void>;
  closeCurrentProject: () => Promise<void>;
};

export function createProjectLifecycleController(options: {
  getCurrentFilePath: () => string | null;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  resetActiveFile: () => void;
  setProjectState: (nextProject: ProjectMetadata | null) => void;
  stopSidebarResize: () => void;
  resetTreeState: () => void;
  updateSnapshotLabel: (nextTimestamp: number | null) => void;
  syncProjectPathLabels: (projectPath: string) => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  setThemeValue: (theme: string) => void;
  applyTheme: (theme: AppSettings["theme"]) => void;
  renderStatusFooter: () => void;
  renderFileList: () => void;
  restartAutosaveTimer: () => void;
  renderEmptyEditorState: () => void;
  closeTreeContextMenu: () => void;
  closeProject: () => Promise<unknown>;
  selectProject: () => Promise<ProjectMetadata | null>;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
  openFile: (relativePath: string) => Promise<void>;
  setStatus: (message: string, clearAfterMs?: number) => void;
}): ProjectLifecycleController {
  const closeCurrentFile = async (): Promise<void> => {
    if (!options.getCurrentFilePath()) {
      return;
    }

    const saved = await options.persistCurrentFile(false);
    if (!saved) {
      return;
    }

    await options.persistLastOpenedFilePath(null);
    options.resetActiveFile();
    options.setStatus("Closed current file.", 1200);
  };

  const clearProjectState = (showStatusMessage = false): void => {
    options.setProjectState(null);
    options.stopSidebarResize();
    options.resetTreeState();
    options.resetActiveFile();
    options.updateSnapshotLabel(null);
    options.syncProjectPathLabels("No project selected");
    options.setProjectControlsEnabled(false);
    options.setSidebarVisibility(false, false);
    options.setSidebarFaded(false);
    options.setThemeValue("light");
    options.applyTheme("light");
    options.renderStatusFooter();
    options.renderFileList();
    options.restartAutosaveTimer();
    options.renderEmptyEditorState();

    if (showStatusMessage) {
      options.setStatus("Project closed.", 2000);
    }
  };

  const openProjectPicker = async (): Promise<void> => {
    let selectedProject: ProjectMetadata | null = null;
    try {
      selectedProject = await options.selectProject();
    } catch {
      options.setStatus("Could not open project picker.");
      return;
    }

    if (!selectedProject) {
      return;
    }

    options.applyProjectMetadata(selectedProject);

    const preferredFile =
      selectedProject.lastOpenedFilePath && selectedProject.files.includes(selectedProject.lastOpenedFilePath)
        ? selectedProject.lastOpenedFilePath
        : null;

    if (preferredFile) {
      await options.openFile(preferredFile);
    } else if (!selectedProject.hasStoredLastOpenedFilePath && selectedProject.files.length > 0) {
      await options.openFile(selectedProject.files[0]);
    } else {
      options.resetActiveFile();

      if (selectedProject.files.length === 0) {
        options.setStatus("Project opened. Create your first file.", 2000);
      }
    }
  };

  const closeCurrentProject = async (): Promise<void> => {
    options.closeTreeContextMenu();

    try {
      await options.persistCurrentFile(true);
      await options.closeProject();
      clearProjectState(true);
    } catch {
      options.setStatus("Could not close project.");
    }
  };

  return {
    closeCurrentFile,
    clearProjectState,
    openProjectPicker,
    closeCurrentProject
  };
}
