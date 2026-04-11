/**
 * Owns: top-level app-shell control enablement, status messaging, and About panel population.
 * Out of scope: project metadata retrieval and settings dialog event handling.
 * Inputs/Outputs: shell DOM nodes and app-info callbacks in, shell UI helpers out.
 * Side effects: mutates control disabled states, status timers, and About panel content.
 */
import type { ProjectMetadata } from "../../shared/types";

type AppInfo = {
  version: string;
  description: string;
  author: string;
  website: string;
};

export type AppShellUiController = {
  setStatus: (message: string, clearAfterMs?: number) => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  loadAboutInfo: () => Promise<void>;
};

/**
 * Creates the top-level shell UI controller.
 *
 * @param options Shell DOM nodes and app/project state readers.
 * @returns Helpers for status messaging, control enablement, and About data loading.
 */
export function createAppShellUiController(options: {
  projectActions: HTMLElement;
  openProjectWrap: HTMLElement;
  settingsToggleButton: HTMLButtonElement;
  newFileButton: HTMLButtonElement;
  newFolderButton: HTMLButtonElement;
  showWordCountInput: HTMLInputElement;
  showWritingTimeInput: HTMLInputElement;
  showCurrentFileBarInput: HTMLInputElement;
  smartQuotesInput: HTMLInputElement;
  gitSnapshotsInput: HTMLInputElement;
  gitPushRemoteSelect: HTMLSelectElement;
  initializeGitRepoButton: HTMLButtonElement;
  initializeGitRepoCard: HTMLDivElement;
  gitSnapshotsNotice: HTMLParagraphElement;
  autosaveIntervalInput: HTMLInputElement;
  snapshotMaxSizeInput: HTMLInputElement;
  lineHeightInput: HTMLInputElement;
  editorWidthInput: HTMLInputElement;
  themeSelect: HTMLSelectElement;
  fontSelect: HTMLSelectElement;
  statusMessage: HTMLSpanElement;
  defaultStatusMessage: string;
  aboutVersion: HTMLSpanElement;
  aboutDescription: HTMLParagraphElement;
  aboutAuthor: HTMLSpanElement;
  aboutWebsite: HTMLAnchorElement;
  getProject: () => ProjectMetadata | null;
  getAppInfo: () => Promise<AppInfo>;
}): AppShellUiController {
  let statusResetTimer: number | null = null;

  const setStatus = (message: string, clearAfterMs?: number): void => {
    options.statusMessage.textContent = message;

    if (statusResetTimer) {
      window.clearTimeout(statusResetTimer);
      statusResetTimer = null;
    }

    if (clearAfterMs) {
      statusResetTimer = window.setTimeout(() => {
        options.statusMessage.textContent = options.defaultStatusMessage;
        statusResetTimer = null;
      }, clearAfterMs);
    }
  };

  const setProjectControlsEnabled = (enabled: boolean): void => {
    const project = options.getProject();
    options.projectActions.classList.toggle("project-open", enabled);
    options.openProjectWrap.classList.toggle("project-open", enabled);
    options.settingsToggleButton.hidden = !enabled;
    options.newFileButton.disabled = !enabled;
    options.newFolderButton.disabled = !enabled;
    options.showWordCountInput.disabled = !enabled;
    options.showWritingTimeInput.disabled = !enabled;
    options.showCurrentFileBarInput.disabled = !enabled;
    options.smartQuotesInput.disabled = !enabled;
    options.gitSnapshotsInput.disabled = !enabled || !project?.isGitRepository || !project?.hasGitInitialCommit;
    options.gitPushRemoteSelect.disabled = true;
    options.initializeGitRepoButton.disabled = !enabled || Boolean(project?.isGitRepository);
    options.initializeGitRepoCard.hidden = !enabled || Boolean(project?.isGitRepository);
    options.autosaveIntervalInput.disabled = !enabled;
    options.snapshotMaxSizeInput.disabled = !enabled;
    options.lineHeightInput.disabled = !enabled;
    options.editorWidthInput.disabled = !enabled;
    options.themeSelect.disabled = !enabled;
    options.fontSelect.disabled = !enabled;
    options.gitSnapshotsNotice.hidden = !enabled || Boolean(project?.isGitRepository && project?.hasGitInitialCommit);
  };

  const loadAboutInfo = async (): Promise<void> => {
    try {
      const info = await options.getAppInfo();
      options.aboutVersion.textContent = info.version;
      options.aboutDescription.textContent = info.description;
      options.aboutAuthor.textContent = info.author;
      options.aboutWebsite.textContent = info.website || "Not specified";
      options.aboutWebsite.href = info.website || "#";
      options.aboutWebsite.hidden = info.website.length === 0;
    } catch {
      options.aboutVersion.textContent = "--";
      options.aboutDescription.textContent = "Minimalist desktop writing app for plain text projects.";
      options.aboutAuthor.textContent = "Nico Verbruggen";
      options.aboutWebsite.textContent = "https://nicoverbruggen.be";
      options.aboutWebsite.href = "https://nicoverbruggen.be";
      options.aboutWebsite.hidden = false;
    }
  };

  return {
    setStatus,
    setProjectControlsEnabled,
    loadAboutInfo
  };
}
