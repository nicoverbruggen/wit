/**
 * Owns: queued persistence of project settings and last-opened-file state.
 * Out of scope: settings dialog event wiring and metadata loading.
 * Inputs/Outputs: persistence callbacks and project state readers in, persistence actions out.
 * Side effects: writes persisted project state and mutates the active in-memory project metadata.
 */
import type { AppSettings, ProjectMetadata } from "../../../shared/types";

/**
 * Exposes persistence helpers for project-bound settings state.
 */
export type ProjectPersistenceController = {
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  persistSettings: (update: Partial<AppSettings>) => Promise<void>;
};

/**
 * Creates the project persistence controller.
 *
 * @param options Persistence APIs and renderer sync hooks.
 * @returns Actions for persisting settings and last-opened-file state.
 */
export function createProjectPersistenceController(options: {
  getProject: () => ProjectMetadata | null;
  setLastOpenedFilePath: (relativePath: string | null) => Promise<string | null>;
  updateSettings: (nextSettings: AppSettings) => Promise<AppSettings>;
  syncSettingsInputs: (settings: AppSettings) => void;
  renderStatusFooter: () => void;
  restartAutosaveTimer: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
}): ProjectPersistenceController {
  let settingsPersistQueue: Promise<void> = Promise.resolve();

  const persistLastOpenedFilePath = async (relativePath: string | null): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }

    try {
      const savedPath = await options.setLastOpenedFilePath(relativePath);
      const activeProject = options.getProject();
      if (activeProject) {
        activeProject.lastOpenedFilePath = savedPath;
        activeProject.hasStoredLastOpenedFilePath = true;
      }
    } catch {
      options.setStatus("Could not update last opened file.");
    }
  };

  const persistSettings = async (update: Partial<AppSettings>): Promise<void> => {
    settingsPersistQueue = settingsPersistQueue
      .then(async () => {
        const project = options.getProject();
        if (!project) {
          return;
        }

        const nextSettings: AppSettings = {
          ...project.settings,
          ...update
        };

        const savedSettings = await options.updateSettings(nextSettings);
        const activeProject = options.getProject();
        if (!activeProject) {
          return;
        }

        activeProject.settings = savedSettings;
        options.syncSettingsInputs(savedSettings);
        options.renderStatusFooter();
        options.restartAutosaveTimer();
        options.setStatus("Settings saved.", 1300);
      })
      .catch(() => {
        options.setStatus("Could not save settings.");
      });

    return settingsPersistQueue;
  };

  return {
    persistLastOpenedFilePath,
    persistSettings
  };
}
