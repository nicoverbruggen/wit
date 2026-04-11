/**
 * Owns: editor file-session orchestration for open/save/autosave behavior.
 * Out of scope: editor rendering internals and project metadata loading.
 * Inputs/Outputs: session callbacks and state accessors in, file-session actions out.
 * Side effects: updates editor state, project counters, autosave status, and persisted file selection.
 */
import type { ProjectMetadata } from "../../shared/types";
import { openFileInEditorSession, persistCurrentFileInSession, saveCurrentFileSynchronouslyInSession } from "./session.js";

type LiveWordCountTracker = {
  cancelPending: () => void;
  schedule: (options: {
    contentSnapshot: string;
    filePathSnapshot: string;
    countPreviewWords: (text: string) => Promise<number>;
    shouldApply: (snapshotPath: string) => boolean;
    onApply: (nextWordCount: number) => void;
  }) => void;
};

export type FileSessionController = {
  resetCurrentFileWordCount: () => void;
  cancelPendingLiveWordCount: () => void;
  scheduleLiveWordCountRefresh: () => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  saveCurrentFileSynchronously: () => void;
  openFile: (relativePath: string) => Promise<void>;
  runAutosaveTick: () => Promise<void>;
};

/**
 * Creates the file-session controller that coordinates editor persistence and file switching.
 *
 * @param options Session dependencies and renderer state hooks.
 * @returns File-session actions used by the renderer composition.
 */
export function createFileSessionController(options: {
  liveWordCountTracker: LiveWordCountTracker;
  getProject: () => ProjectMetadata | null;
  getCurrentFilePath: () => string | null;
  getDirty: () => boolean;
  getEditorValue: () => string;
  setEditorSyntaxForFile: (relativePath: string | null) => void;
  setEditorValueSilently: (content: string) => void;
  setCurrentFilePath: (nextPath: string | null) => void;
  setSelectedTreeToFile: (nextPath: string) => void;
  setActiveFileLabel: (nextPath: string) => void;
  setEditorPlaceholder: (value: string) => void;
  setDirty: (nextDirty: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  renderFileList: () => void;
  setEditorWritable: (enabled: boolean) => void;
  renderEmptyEditorState: () => void;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  focusEditor: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  renderStatusFooter: () => void;
  countPreviewWords: (text: string) => Promise<number>;
  getWordCount: () => Promise<number>;
  saveFile: (relativePath: string, content: string) => Promise<boolean>;
  saveFileSync: (relativePath: string, content: string) => boolean;
  openFileApi: (nextPath: string) => Promise<string>;
  autosaveTick: (activeSeconds: number) => Promise<{
    wordCount: number;
    totalWritingSeconds: number;
    snapshotCreatedAt: string | null;
  }>;
  consumeActiveTypingSeconds: () => number;
  parseSnapshotTimestamp: (value: string | null | undefined) => number | null;
  updateSnapshotLabel: (nextTimestamp: number | null) => void;
}): FileSessionController {
  let currentFileWordCount = 0;

  const resetCurrentFileWordCount = (): void => {
    currentFileWordCount = 0;
  };

  const cancelPendingLiveWordCount = (): void => {
    options.liveWordCountTracker.cancelPending();
  };

  const scheduleLiveWordCountRefresh = (): void => {
    const project = options.getProject();
    const currentFilePath = options.getCurrentFilePath();
    if (!project || !currentFilePath) {
      return;
    }

    const contentSnapshot = options.getEditorValue();
    const filePathSnapshot = currentFilePath;
    options.liveWordCountTracker.schedule({
      contentSnapshot,
      filePathSnapshot,
      countPreviewWords: options.countPreviewWords,
      shouldApply: (snapshotPath) => Boolean(options.getProject() && options.getCurrentFilePath() === snapshotPath),
      onApply: (nextWordCount) => {
        const liveProject = options.getProject();
        if (!liveProject || options.getCurrentFilePath() !== filePathSnapshot) {
          return;
        }

        const delta = nextWordCount - currentFileWordCount;
        if (delta === 0) {
          return;
        }

        liveProject.wordCount = Math.max(0, liveProject.wordCount + delta);
        currentFileWordCount = nextWordCount;
        options.renderStatusFooter();
      }
    });
  };

  const persistCurrentFile = async (showStatus = true): Promise<boolean> => {
    return persistCurrentFileInSession({
      project: options.getProject(),
      currentFilePath: options.getCurrentFilePath(),
      dirty: options.getDirty(),
      showStatus,
      editorValue: options.getEditorValue(),
      cancelPendingLiveWordCount,
      saveFile: options.saveFile,
      getWordCount: options.getWordCount,
      countPreviewWords: options.countPreviewWords,
      setProjectWordCount: (wordCount) => {
        const project = options.getProject();
        if (!project) {
          return;
        }

        project.wordCount = wordCount;
      },
      setCurrentFileWordCount: (wordCount) => {
        currentFileWordCount = wordCount;
      },
      setDirty: options.setDirty,
      renderStatusFooter: options.renderStatusFooter,
      setStatus: options.setStatus
    });
  };

  const saveCurrentFileSynchronously = (): void => {
    saveCurrentFileSynchronouslyInSession({
      project: options.getProject(),
      currentFilePath: options.getCurrentFilePath(),
      dirty: options.getDirty(),
      editorValue: options.getEditorValue(),
      saveFileSync: options.saveFileSync,
      setDirty: options.setDirty
    });
  };

  const openFile = async (relativePath: string): Promise<void> => {
    await openFileInEditorSession({
      relativePath,
      project: options.getProject(),
      persistCurrentFile,
      cancelPendingLiveWordCount,
      openFile: options.openFileApi,
      countPreviewWords: options.countPreviewWords,
      setEditorSyntaxForFile: options.setEditorSyntaxForFile,
      setEditorValueSilently: options.setEditorValueSilently,
      setCurrentFilePath: (nextPath) => {
        options.setCurrentFilePath(nextPath);
      },
      setSelectedTreeToFile: options.setSelectedTreeToFile,
      setCurrentFileWordCount: (wordCount) => {
        currentFileWordCount = wordCount;
      },
      setActiveFileLabel: options.setActiveFileLabel,
      setEditorPlaceholder: options.setEditorPlaceholder,
      setDirty: options.setDirty,
      setSidebarFaded: options.setSidebarFaded,
      renderFileList: options.renderFileList,
      setEditorWritable: options.setEditorWritable,
      renderEmptyEditorState: options.renderEmptyEditorState,
      persistLastOpenedFilePath: options.persistLastOpenedFilePath,
      focusEditor: options.focusEditor,
      setStatus: options.setStatus
    });
  };

  const runAutosaveTick = async (): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }

    try {
      await persistCurrentFile(false);

      const activeSeconds = options.consumeActiveTypingSeconds();

      const result = await options.autosaveTick(activeSeconds);
      project.wordCount = result.wordCount;
      project.totalWritingSeconds = result.totalWritingSeconds;
      options.updateSnapshotLabel(options.parseSnapshotTimestamp(result.snapshotCreatedAt) ?? Date.now());
      options.renderStatusFooter();

      options.setStatus(`Autosaved (${project.settings.autosaveIntervalSec}s interval)`, 2000);
    } catch {
      options.setStatus("Autosave tick failed.");
    }
  };

  return {
    resetCurrentFileWordCount,
    cancelPendingLiveWordCount,
    scheduleLiveWordCountRefresh,
    persistCurrentFile,
    saveCurrentFileSynchronously,
    openFile,
    runAutosaveTick
  };
}
