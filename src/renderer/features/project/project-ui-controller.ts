/**
 * Owns: project-scoped UI synchronization for labels, footer stats, and settings availability.
 * Out of scope: project metadata fetching and editor file session logic.
 * Inputs/Outputs: DOM nodes plus project/settings data in, sync/render helpers out.
 * Side effects: mutates visible labels, notice text, and settings control availability.
 */
import type { AppSettings, ProjectMetadata } from "../../../shared/types";

/**
 * Exposes project UI synchronization helpers used across the renderer.
 */
export type ProjectUiController = {
  syncProjectPathLabels: (projectPath: string, project: ProjectMetadata | null) => void;
  renderStatusFooter: (project: ProjectMetadata | null) => void;
  renderEditorHeaderVisibility: (project: ProjectMetadata | null) => void;
  syncGitSnapshotsAvailability: (project: ProjectMetadata | null) => void;
  syncSettingsInputs: (settings: AppSettings, project: ProjectMetadata | null) => void;
};

/**
 * Creates the controller that maps project metadata into sidebar, footer, and settings UI.
 *
 * @param options Project-related DOM nodes and formatting/render hooks.
 * @returns UI synchronization methods for the active project.
 */
export function createProjectUiController(options: {
  sidebarProjectTitle: HTMLHeadingElement;
  projectPathLabel: HTMLSpanElement;
  statusBar: HTMLElement;
  statusMessage: HTMLSpanElement;
  wordCountLabel: HTMLSpanElement;
  writingTimeLabel: HTMLSpanElement;
  snapshotLabel: HTMLSpanElement;
  editorHeader: HTMLElement;
  themeSelect: HTMLSelectElement;
  defaultFileExtensionSelect: HTMLSelectElement;
  showWordCountInput: HTMLInputElement;
  showWritingTimeInput: HTMLInputElement;
  showCurrentFileBarInput: HTMLInputElement;
  smartQuotesInput: HTMLInputElement;
  gitSnapshotsInput: HTMLInputElement;
  gitPushRemoteSelect: HTMLSelectElement;
  initializeGitRepoCard: HTMLDivElement;
  initializeGitRepoButton: HTMLButtonElement;
  gitSnapshotsNotice: HTMLParagraphElement;
  autosaveIntervalInput: HTMLInputElement;
  snapshotMaxSizeInput: HTMLInputElement;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  setEditorZoomFromPercent: (percent: number, showStatus?: boolean) => void;
  populateFontSelect: (selectedFont: string) => void;
  applyEditorFont: (fontFamily: string) => void;
  getProjectDisplayTitle: (projectPath: string) => string;
  formatWritingTime: (totalWritingSeconds: number) => string;
  defaultEditorFont: string;
}): ProjectUiController {
  const syncProjectPathLabels = (projectPath: string, project: ProjectMetadata | null): void => {
    if (!project) {
      options.sidebarProjectTitle.textContent = "No Project";
      options.sidebarProjectTitle.title = "";
      options.projectPathLabel.textContent = "No project selected";
      options.projectPathLabel.title = "";
      return;
    }

    const displayName = options.getProjectDisplayTitle(projectPath);
    options.sidebarProjectTitle.textContent = displayName;
    options.sidebarProjectTitle.title = projectPath;
    options.projectPathLabel.textContent = displayName;
    options.projectPathLabel.title = projectPath;
  };

  const renderStatusFooter = (project: ProjectMetadata | null): void => {
    if (!project) {
      options.statusBar.classList.add("status-bar--empty");
      options.statusMessage.textContent = "";
      options.wordCountLabel.hidden = true;
      options.writingTimeLabel.hidden = true;
      options.snapshotLabel.hidden = true;
      return;
    }

    options.statusBar.classList.remove("status-bar--empty");
    options.wordCountLabel.hidden = false;
    options.writingTimeLabel.hidden = false;
    options.snapshotLabel.hidden = false;

    const totalWords = project.wordCount;
    const totalWritingSeconds = project.totalWritingSeconds;

    options.wordCountLabel.textContent = `Words: ${totalWords.toLocaleString()}`;
    options.writingTimeLabel.textContent = `Writing: ${options.formatWritingTime(totalWritingSeconds)}`;

    options.wordCountLabel.style.display = project.settings.showWordCount ? "inline" : "none";
    options.writingTimeLabel.style.display = project.settings.showWritingTime ? "inline" : "none";
  };

  const renderEditorHeaderVisibility = (project: ProjectMetadata | null): void => {
    options.editorHeader.hidden = Boolean(project && !project.settings.showCurrentFileBar);
  };

  const syncGitSnapshotsAvailability = (project: ProjectMetadata | null): void => {
    const repositoryAvailable = Boolean(project?.isGitRepository);
    const gitSnapshotsReady = Boolean(project?.isGitRepository && project?.hasGitInitialCommit);
    const remotes = project?.gitRemotes ?? [];

    options.gitSnapshotsInput.disabled = !project || !gitSnapshotsReady;
    options.gitSnapshotsNotice.hidden = !project || gitSnapshotsReady;
    options.gitPushRemoteSelect.disabled = !project || !gitSnapshotsReady;
    options.initializeGitRepoCard.hidden = !project || repositoryAvailable;
    options.initializeGitRepoButton.disabled = !project || repositoryAvailable;

    if (!project) {
      options.gitSnapshotsNotice.textContent = "";
    } else if (!repositoryAvailable) {
      options.gitSnapshotsNotice.textContent =
        "Git snapshots are unavailable because this project is not a Git repository.";
    } else if (!project.hasGitInitialCommit) {
      options.gitSnapshotsNotice.textContent =
        "Git snapshots are unavailable because this repository does not have an initial commit yet.";
    }

    if (!repositoryAvailable) {
      options.gitSnapshotsInput.checked = false;
      options.gitPushRemoteSelect.innerHTML = "";
      return;
    }

    options.gitPushRemoteSelect.innerHTML = "";
    const disabledOption = document.createElement("option");
    disabledOption.value = "";
    disabledOption.textContent = "Don't push";
    options.gitPushRemoteSelect.appendChild(disabledOption);

    for (const remoteName of remotes) {
      const option = document.createElement("option");
      option.value = remoteName;
      option.textContent = remoteName;
      options.gitPushRemoteSelect.appendChild(option);
    }
  };

  const syncSettingsInputs = (settings: AppSettings, project: ProjectMetadata | null): void => {
    options.themeSelect.value = settings.theme;
    options.applyTheme(settings.theme);
    options.defaultFileExtensionSelect.value = settings.defaultFileExtension ?? ".txt";
    options.showWordCountInput.checked = settings.showWordCount;
    options.showWritingTimeInput.checked = settings.showWritingTime;
    options.showCurrentFileBarInput.checked = settings.showCurrentFileBar;
    options.smartQuotesInput.checked = settings.smartQuotes;
    options.gitSnapshotsInput.checked =
      settings.gitSnapshots && Boolean(project?.isGitRepository && project?.hasGitInitialCommit);
    options.autosaveIntervalInput.value = String(settings.autosaveIntervalSec);
    options.snapshotMaxSizeInput.value = String(settings.snapshotMaxSizeMb);
    options.applyEditorLineHeight(settings.editorLineHeight);
    options.applyEditorParagraphSpacing(settings.editorParagraphSpacing ?? "none");
    options.applyEditorMaxWidth(settings.editorMaxWidthPx);
    options.setEditorZoomFromPercent(settings.editorZoomPercent, false);
    options.populateFontSelect(settings.editorFontFamily ?? options.defaultEditorFont);
    options.applyEditorFont(settings.editorFontFamily ?? options.defaultEditorFont);
    syncGitSnapshotsAvailability(project);
    options.gitPushRemoteSelect.value =
      settings.gitPushRemote && project?.gitRemotes.includes(settings.gitPushRemote) ? settings.gitPushRemote : "";
    renderEditorHeaderVisibility(project);
  };

  return {
    syncProjectPathLabels,
    renderStatusFooter,
    renderEditorHeaderVisibility,
    syncGitSnapshotsAvailability,
    syncSettingsInputs
  };
}
