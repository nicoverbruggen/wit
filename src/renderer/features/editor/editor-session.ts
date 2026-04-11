import type { ProjectMetadata } from "../../../shared/types";

/**
 * Owns: editor-session workflows for file open/save and write-through synchronization.
 * Out of scope: UI event wiring, autosave scheduling, and global renderer state ownership.
 * Inputs/Outputs: explicit dependency callbacks in, status/result side effects out.
 * Side effects: calls IPC-bound file APIs and updates provided state sinks.
 */

/**
 * Persists the active file when it is dirty.
 *
 * @param options Session dependencies and current editor state.
 * @returns `true` when no save is needed or save succeeds; `false` on save failure.
 */
export async function persistCurrentFileInSession(options: {
  project: ProjectMetadata | null;
  currentFilePath: string | null;
  dirty: boolean;
  showStatus?: boolean;
  editorValue: string;
  cancelPendingLiveWordCount: () => void;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  getWordCount: () => Promise<number>;
  countPreviewWords: (text: string) => Promise<number>;
  setProjectWordCount: (wordCount: number) => void;
  setCurrentFileWordCount: (wordCount: number) => void;
  setDirty: (dirty: boolean) => void;
  renderStatusFooter: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
}): Promise<boolean> {
  const showStatus = options.showStatus ?? true;

  if (!options.project || !options.currentFilePath || !options.dirty) {
    return true;
  }

  try {
    options.cancelPendingLiveWordCount();
    await options.saveFile(options.currentFilePath, options.editorValue);
    options.setProjectWordCount(await options.getWordCount());
    options.setCurrentFileWordCount(await options.countPreviewWords(options.editorValue));
    options.setDirty(false);
    options.renderStatusFooter();

    if (showStatus) {
      options.setStatus(`Saved ${options.currentFilePath}`, 1500);
    }

    return true;
  } catch {
    options.setStatus("Save failed. Try again.");
    return false;
  }
}

/**
 * Performs synchronous best-effort persistence for the current file.
 *
 * @param options Session dependencies and current editor state.
 */
export function saveCurrentFileSynchronouslyInSession(options: {
  project: ProjectMetadata | null;
  currentFilePath: string | null;
  dirty: boolean;
  editorValue: string;
  saveFileSync: (relativePath: string, content: string) => boolean;
  setDirty: (dirty: boolean) => void;
}): void {
  if (!options.project || !options.currentFilePath || !options.dirty) {
    return;
  }

  const saved = options.saveFileSync(options.currentFilePath, options.editorValue);
  if (saved) {
    options.setDirty(false);
  }
}

/**
 * Opens a file into the editor and updates associated session/UI state.
 *
 * @param options Session dependencies and state mutators.
 */
export async function openFileInEditorSession(options: {
  relativePath: string;
  project: ProjectMetadata | null;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  cancelPendingLiveWordCount: () => void;
  openFile: (relativePath: string) => Promise<string>;
  countPreviewWords: (text: string) => Promise<number>;
  setEditorSyntaxForFile: (relativePath: string | null) => void;
  setEditorValueSilently: (content: string) => void;
  setCurrentFilePath: (relativePath: string) => void;
  setSelectedTreeToFile: (relativePath: string) => void;
  setCurrentFileWordCount: (wordCount: number) => void;
  setActiveFileLabel: (relativePath: string) => void;
  setEditorPlaceholder: (value: string) => void;
  setDirty: (dirty: boolean) => void;
  setSidebarFaded: (faded: boolean) => void;
  renderFileList: () => void;
  setEditorWritable: (enabled: boolean) => void;
  renderEmptyEditorState: () => void;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  focusEditor: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
}): Promise<void> {
  if (!options.project) {
    return;
  }

  const saved = await options.persistCurrentFile(false);
  if (!saved) {
    return;
  }

  try {
    options.cancelPendingLiveWordCount();
    const content = await options.openFile(options.relativePath);

    options.setEditorSyntaxForFile(options.relativePath);
    options.setEditorValueSilently(content);
    options.setCurrentFilePath(options.relativePath);
    options.setSelectedTreeToFile(options.relativePath);
    options.setCurrentFileWordCount(await options.countPreviewWords(content));
    options.setActiveFileLabel(options.relativePath);
    options.setEditorPlaceholder("");
    options.setDirty(false);
    options.setSidebarFaded(false);
    options.renderFileList();
    options.setEditorWritable(true);
    options.renderEmptyEditorState();
    await options.persistLastOpenedFilePath(options.relativePath);
    options.focusEditor();
    options.setStatus(`Opened ${options.relativePath}`, 1200);
  } catch {
    options.setStatus("Could not open selected file.");
  }
}
