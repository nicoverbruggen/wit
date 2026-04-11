/**
 * Owns: empty-editor state rendering for no-project and no-file states.
 * Out of scope: empty-state button event handling and project lifecycle decisions.
 * Inputs/Outputs: project/file state and DOM nodes in, empty-state render helper out.
 * Side effects: mutates empty-state copy, buttons, and layout classes.
 */
import type { ProjectMetadata } from "../../shared/types";
import {
  renderEmptyStateShortcutRows as renderShortcutRows,
  type EmptyStateShortcut
} from "../shared/shortcuts.js";

export type EmptyEditorStateController = {
  renderEmptyEditorState: () => void;
};

/**
 * Creates the empty-editor state controller.
 *
 * @param options Empty-state DOM nodes and renderer state readers.
 * @returns A renderer helper that refreshes the empty-state presentation.
 */
export function createEmptyEditorStateController(options: {
  editorWrap: HTMLElement;
  emptyStateScreen: HTMLDivElement;
  emptyStateEyebrow: HTMLParagraphElement;
  emptyStateTitle: HTMLHeadingElement;
  emptyStateDescription: HTMLParagraphElement;
  emptyStatePrimaryButton: HTMLButtonElement;
  emptyStateSecondaryButton: HTMLButtonElement;
  emptyStateShortcutsLabel: HTMLParagraphElement;
  emptyStateShortcutsList: HTMLUListElement;
  getProject: () => ProjectMetadata | null;
  getCurrentFilePath: () => string | null;
  getProjectDisplayTitle: (projectPath: string) => string;
  primaryShortcutLabel: (key: string) => string;
}): EmptyEditorStateController {
  const renderEmptyStateShortcutRows = (shortcuts: EmptyStateShortcut[]): void => {
    renderShortcutRows(options.emptyStateShortcutsList, shortcuts);
  };

  const renderEmptyEditorState = (): void => {
    const project = options.getProject();
    const currentFilePath = options.getCurrentFilePath();
    const showEmptyState = !project || !currentFilePath;
    options.editorWrap.classList.toggle("show-empty-state", showEmptyState);
    options.emptyStateScreen.hidden = !showEmptyState;

    if (!showEmptyState) {
      return;
    }

    if (!project) {
      options.emptyStateScreen.dataset.mode = "no-project";
      options.emptyStateEyebrow.hidden = false;
      options.emptyStateTitle.hidden = false;
      options.emptyStateDescription.hidden = false;
      options.emptyStateEyebrow.textContent = "Wit";
      options.emptyStateTitle.textContent = "Start by opening a project folder";
      options.emptyStateDescription.textContent =
        "Use a command below to open a folder, browse commands, or jump straight into a writing workspace.";
      options.emptyStatePrimaryButton.textContent = "Open Project";
      options.emptyStatePrimaryButton.hidden = false;
      options.emptyStateSecondaryButton.hidden = true;
      options.emptyStateShortcutsLabel.hidden = false;
      renderEmptyStateShortcutRows([
        { label: "Open project", key: options.primaryShortcutLabel("O") },
        { label: "Toggle fullscreen", key: "F11" }
      ]);
      return;
    }

    options.emptyStateScreen.dataset.mode = "project";
    options.emptyStateEyebrow.hidden = false;
    options.emptyStateTitle.hidden = false;
    options.emptyStateDescription.hidden = false;
    options.emptyStateShortcutsLabel.hidden = false;
    options.emptyStateEyebrow.textContent = options.getProjectDisplayTitle(project.projectPath);
    options.emptyStateTitle.textContent = "Write something wonderful";
    options.emptyStateDescription.textContent =
      "Select a document in the sidebar, or create a new file or folder to begin drafting in this project.";
    options.emptyStatePrimaryButton.textContent = "New File";
    options.emptyStatePrimaryButton.hidden = false;
    options.emptyStateSecondaryButton.hidden = false;
    options.emptyStateSecondaryButton.textContent = "New Folder";
    renderEmptyStateShortcutRows([
      { label: "New file", key: options.primaryShortcutLabel("N") },
      { label: "Save file", key: options.primaryShortcutLabel("S") },
      { label: "Toggle sidebar", key: options.primaryShortcutLabel("B") },
      { label: "Text zoom", key: `${options.primaryShortcutLabel("+")} / ${options.primaryShortcutLabel("-")}` }
    ]);
  };

  return {
    renderEmptyEditorState
  };
}
