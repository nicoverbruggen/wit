import type { ProjectMetadata } from "../../../shared/types";

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
    options.gitSnapshotsInput.disabled = !enabled || !project?.isGitRepository;
    options.gitPushRemoteSelect.disabled = true;
    options.autosaveIntervalInput.disabled = !enabled;
    options.snapshotMaxSizeInput.disabled = !enabled;
    options.lineHeightInput.disabled = !enabled;
    options.editorWidthInput.disabled = !enabled;
    options.themeSelect.disabled = !enabled;
    options.fontSelect.disabled = !enabled;
    options.gitSnapshotsNotice.hidden = !enabled || Boolean(project?.isGitRepository);
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
