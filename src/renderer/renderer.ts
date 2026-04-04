import type { AppSettings, ProjectMetadata } from "../shared/types";

const openProjectButton = document.getElementById("open-project-btn") as HTMLButtonElement;
const newFileButton = document.getElementById("new-file-btn") as HTMLButtonElement;
const fileList = document.getElementById("file-list") as HTMLUListElement;
const newFileDialog = document.getElementById("new-file-dialog") as HTMLDialogElement;
const newFilePathInput = document.getElementById("new-file-path-input") as HTMLInputElement;
const editor = document.getElementById("editor") as HTMLTextAreaElement;
const projectPathLabel = document.getElementById("project-path") as HTMLSpanElement;
const activeFileLabel = document.getElementById("active-file-label") as HTMLSpanElement;
const dirtyIndicator = document.getElementById("dirty-indicator") as HTMLSpanElement;
const statusMessage = document.getElementById("status-message") as HTMLSpanElement;
const wordCountLabel = document.getElementById("word-count") as HTMLSpanElement;
const writingTimeLabel = document.getElementById("writing-time") as HTMLSpanElement;
const snapshotLabel = document.getElementById("snapshot-label") as HTMLSpanElement;
const showWordCountInput = document.getElementById("show-word-count-input") as HTMLInputElement;
const smartQuotesInput = document.getElementById("smart-quotes-input") as HTMLInputElement;
const gitSnapshotsInput = document.getElementById("git-snapshots-input") as HTMLInputElement;
const autosaveIntervalInput = document.getElementById("autosave-interval-input") as HTMLInputElement;
const zoomOutButton = document.getElementById("zoom-out-btn") as HTMLButtonElement;
const zoomResetButton = document.getElementById("zoom-reset-btn") as HTMLButtonElement;
const zoomInButton = document.getElementById("zoom-in-btn") as HTMLButtonElement;

const EDITOR_ZOOM_MIN = 0.7;
const EDITOR_ZOOM_MAX = 2.2;
const EDITOR_ZOOM_STEP = 0.1;

let project: ProjectMetadata | null = null;
let currentFilePath: string | null = null;
let dirty = false;
let typedSinceLastTick = false;
let autosaveTimer: number | null = null;
let autosaveInFlight = false;
let statusResetTimer: number | null = null;
let suppressDirtyEvents = false;
let editorBaseFontSizePx = 0;
let editorZoomFactor = 1;

const subscriptions: Array<() => void> = [];

function formatWritingTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function setStatus(message: string, clearAfterMs?: number): void {
  statusMessage.textContent = message;

  if (statusResetTimer) {
    window.clearTimeout(statusResetTimer);
    statusResetTimer = null;
  }

  if (clearAfterMs) {
    statusResetTimer = window.setTimeout(() => {
      statusMessage.textContent = "Ready";
      statusResetTimer = null;
    }, clearAfterMs);
  }
}

function setDirty(nextDirty: boolean): void {
  dirty = nextDirty;
  dirtyIndicator.hidden = !nextDirty;
}

function setProjectControlsEnabled(enabled: boolean): void {
  newFileButton.disabled = !enabled;
  showWordCountInput.disabled = !enabled;
  smartQuotesInput.disabled = !enabled;
  gitSnapshotsInput.disabled = !enabled;
  autosaveIntervalInput.disabled = !enabled;
}

function setEditorWritable(enabled: boolean): void {
  editor.disabled = !enabled;
}

function ensureEditorBaseFontSize(): void {
  if (editorBaseFontSizePx > 0) {
    return;
  }

  const computedSize = Number.parseFloat(window.getComputedStyle(editor).fontSize);
  editorBaseFontSizePx = Number.isFinite(computedSize) && computedSize > 0 ? computedSize : 20;
}

function applyEditorZoom(showStatus = true): void {
  ensureEditorBaseFontSize();
  const nextFontSize = Number((editorBaseFontSizePx * editorZoomFactor).toFixed(2));
  editor.style.fontSize = `${nextFontSize}px`;

  if (showStatus) {
    setStatus(`Text zoom ${Math.round(editorZoomFactor * 100)}%`, 1200);
  }
}

function adjustEditorZoom(delta: number): void {
  const nextFactor = Math.max(
    EDITOR_ZOOM_MIN,
    Math.min(EDITOR_ZOOM_MAX, Number((editorZoomFactor + delta).toFixed(2)))
  );
  editorZoomFactor = nextFactor;
  applyEditorZoom();
}

function resetEditorZoom(): void {
  editorZoomFactor = 1;
  applyEditorZoom();
}

function renderStatusFooter(): void {
  const totalWords = project?.wordCount ?? 0;
  const totalWritingSeconds = project?.totalWritingSeconds ?? 0;

  wordCountLabel.textContent = `Words: ${totalWords.toLocaleString()}`;
  writingTimeLabel.textContent = `Writing: ${formatWritingTime(totalWritingSeconds)}`;

  if (project && !project.settings.showWordCount) {
    wordCountLabel.style.display = "none";
  } else {
    wordCountLabel.style.display = "inline";
  }
}

function renderFileList(): void {
  fileList.innerHTML = "";

  if (!project) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Open a project to start writing.";
    emptyItem.className = "empty-state";
    fileList.appendChild(emptyItem);
    return;
  }

  if (project.files.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No text files yet. Create one with New File.";
    emptyItem.className = "empty-state";
    fileList.appendChild(emptyItem);
    return;
  }

  for (const relativePath of project.files) {
    const listItem = document.createElement("li");
    const fileButton = document.createElement("button");

    fileButton.className = `file-button ${relativePath === currentFilePath ? "active" : ""}`;
    fileButton.textContent = relativePath;
    fileButton.type = "button";

    fileButton.addEventListener("click", () => {
      void openFile(relativePath);
    });

    listItem.appendChild(fileButton);
    fileList.appendChild(listItem);
  }
}

function syncSettingsInputs(settings: AppSettings): void {
  showWordCountInput.checked = settings.showWordCount;
  smartQuotesInput.checked = settings.smartQuotes;
  gitSnapshotsInput.checked = settings.gitSnapshots;
  autosaveIntervalInput.value = String(settings.autosaveIntervalSec);
}

function applyProjectMetadata(metadata: ProjectMetadata): void {
  project = metadata;
  currentFilePath = null;
  setDirty(false);

  projectPathLabel.textContent = metadata.projectPath;
  syncSettingsInputs(metadata.settings);
  renderStatusFooter();
  renderFileList();
  setProjectControlsEnabled(true);
  setEditorWritable(false);
  restartAutosaveTimer();
}

async function persistCurrentFile(showStatus = true): Promise<boolean> {
  if (!project || !currentFilePath || !dirty) {
    return true;
  }

  try {
    await window.witApi.saveFile(currentFilePath, editor.value);
    project.wordCount = await window.witApi.getWordCount();
    setDirty(false);
    renderStatusFooter();

    if (showStatus) {
      setStatus(`Saved ${currentFilePath}`, 1500);
    }

    return true;
  } catch {
    setStatus("Save failed. Try again.");
    return false;
  }
}

function saveCurrentFileSynchronously(): void {
  if (!project || !currentFilePath || !dirty) {
    return;
  }

  const saved = window.witApi.saveFileSync(currentFilePath, editor.value);
  if (saved) {
    setDirty(false);
  }
}

async function openFile(relativePath: string): Promise<void> {
  if (!project) {
    return;
  }

  const saved = await persistCurrentFile(false);
  if (!saved) {
    return;
  }

  try {
    const content = await window.witApi.openFile(relativePath);

    suppressDirtyEvents = true;
    editor.value = content;
    suppressDirtyEvents = false;

    currentFilePath = relativePath;
    activeFileLabel.textContent = relativePath;
    setDirty(false);
    renderFileList();
    setEditorWritable(true);
    editor.focus();
    setStatus(`Opened ${relativePath}`, 1200);
  } catch {
    setStatus("Could not open selected file.");
  }
}

function restartAutosaveTimer(): void {
  if (autosaveTimer) {
    window.clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

  if (!project) {
    return;
  }

  const intervalMs = project.settings.autosaveIntervalSec * 1000;
  autosaveTimer = window.setInterval(() => {
    void runAutosaveTick();
  }, intervalMs);
}

async function runAutosaveTick(): Promise<void> {
  if (!project || autosaveInFlight) {
    return;
  }

  autosaveInFlight = true;

  try {
    await persistCurrentFile(false);

    const activeSeconds = typedSinceLastTick ? project.settings.autosaveIntervalSec : 0;
    typedSinceLastTick = false;

    const result = await window.witApi.autosaveTick(activeSeconds);
    project.wordCount = result.wordCount;
    project.totalWritingSeconds = result.totalWritingSeconds;
    snapshotLabel.textContent = `Snapshot: ${result.snapshotCreatedAt}`;
    renderStatusFooter();

    setStatus(`Autosaved (${project.settings.autosaveIntervalSec}s interval)`, 2000);
  } catch {
    setStatus("Autosave tick failed.");
  } finally {
    autosaveInFlight = false;
  }
}

async function openProjectPicker(): Promise<void> {
  let selectedProject: ProjectMetadata | null = null;
  try {
    selectedProject = await window.witApi.selectProject();
  } catch {
    setStatus("Could not open project picker.");
    return;
  }

  if (!selectedProject) {
    return;
  }

  applyProjectMetadata(selectedProject);

  if (selectedProject.files.length > 0) {
    await openFile(selectedProject.files[0]);
  } else {
    activeFileLabel.textContent = "No file selected";
    suppressDirtyEvents = true;
    editor.value = "";
    suppressDirtyEvents = false;
    setEditorWritable(false);
    setStatus("Project opened. Create your first file.", 2000);
  }
}

function askForNewFilePath(defaultPath: string): Promise<string | null> {
  if (typeof newFileDialog.showModal !== "function") {
    try {
      return Promise.resolve(window.prompt("New text file path", defaultPath));
    } catch {
      setStatus("New file dialog is unavailable.");
      return Promise.resolve(null);
    }
  }

  newFilePathInput.value = defaultPath;

  if (!newFileDialog.open) {
    newFileDialog.showModal();
  }

  window.requestAnimationFrame(() => {
    newFilePathInput.focus();
    newFilePathInput.select();
  });

  return new Promise((resolve) => {
    newFileDialog.addEventListener(
      "close",
      () => {
        if (newFileDialog.returnValue === "create") {
          resolve(newFilePathInput.value);
          return;
        }

        resolve(null);
      },
      { once: true }
    );
  });
}

async function createNewFile(): Promise<void> {
  if (!project) {
    return;
  }

  const proposedName = await askForNewFilePath("chapter-01.txt");
  if (!proposedName) {
    return;
  }

  let relativePath = proposedName.trim().replaceAll("\\", "/");

  if (!relativePath) {
    setStatus("File name cannot be empty.");
    return;
  }

  if (!/\.(txt|md|markdown|text)$/i.test(relativePath)) {
    relativePath = `${relativePath}.txt`;
  }

  try {
    const files = await window.witApi.newFile({ relativePath });
    project.files = files;
    renderFileList();
    await openFile(relativePath);
    setStatus(`Created ${relativePath}`, 2000);
  } catch {
    setStatus("Could not create file. Check the path and try again.");
  }
}

async function persistSettings(update: Partial<AppSettings>): Promise<void> {
  if (!project) {
    return;
  }

  const nextSettings: AppSettings = {
    ...project.settings,
    ...update
  };

  try {
    const savedSettings = await window.witApi.updateSettings(nextSettings);
    project.settings = savedSettings;
    syncSettingsInputs(savedSettings);
    renderStatusFooter();
    restartAutosaveTimer();
    setStatus("Settings saved.", 1300);
  } catch {
    setStatus("Could not save settings.");
  }
}

function insertSmartQuote(quoteCharacter: string): void {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;

  const quotePair = quoteCharacter === "'" ? ["‘", "’"] : ["“", "”"];

  let replacement = quotePair[0];
  let nextCursor = start + 1;

  if (start !== end) {
    const selected = value.slice(start, end);
    replacement = `${quotePair[0]}${selected}${quotePair[1]}`;
    nextCursor = start + replacement.length;
  } else {
    const previousCharacter = start > 0 ? value[start - 1] : "";
    const shouldUseOpeningQuote = start === 0 || /[\s([{<-]/.test(previousCharacter);
    replacement = shouldUseOpeningQuote ? quotePair[0] : quotePair[1];
  }

  const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

  suppressDirtyEvents = true;
  editor.value = nextValue;
  suppressDirtyEvents = false;
  editor.setSelectionRange(nextCursor, nextCursor);

  typedSinceLastTick = true;
  setDirty(true);
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void persistCurrentFile(true);
    return;
  }

  if (!project?.settings.smartQuotes) {
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === "'" || event.key === '"') {
    event.preventDefault();
    insertSmartQuote(event.key);
  }
}

async function initialize(): Promise<void> {
  setProjectControlsEnabled(false);
  setEditorWritable(false);
  applyEditorZoom(false);
  renderFileList();
  renderStatusFooter();

  const activeProject = await window.witApi.getActiveProject();
  if (activeProject) {
    applyProjectMetadata(activeProject);

    if (activeProject.files.length > 0) {
      await openFile(activeProject.files[0]);
    }
  }

  subscriptions.push(
    window.witApi.onMenuOpenProject(() => {
      void openProjectPicker();
    })
  );

  subscriptions.push(
    window.witApi.onMenuSaveCurrentFile(() => {
      void persistCurrentFile(true);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomInText(() => {
      adjustEditorZoom(EDITOR_ZOOM_STEP);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomOutText(() => {
      adjustEditorZoom(-EDITOR_ZOOM_STEP);
    })
  );

  subscriptions.push(
    window.witApi.onMenuZoomResetText(() => {
      resetEditorZoom();
    })
  );
}

openProjectButton.addEventListener("click", () => {
  void openProjectPicker();
});

newFileButton.addEventListener("click", () => {
  void createNewFile();
});

showWordCountInput.addEventListener("change", () => {
  void persistSettings({ showWordCount: showWordCountInput.checked });
});

smartQuotesInput.addEventListener("change", () => {
  void persistSettings({ smartQuotes: smartQuotesInput.checked });
});

gitSnapshotsInput.addEventListener("change", () => {
  void persistSettings({ gitSnapshots: gitSnapshotsInput.checked });
});

autosaveIntervalInput.addEventListener("change", () => {
  const parsed = Number.parseInt(autosaveIntervalInput.value, 10);
  const safeValue = Number.isFinite(parsed) ? Math.max(10, parsed) : 60;
  void persistSettings({ autosaveIntervalSec: safeValue });
});

zoomOutButton.addEventListener("click", () => {
  adjustEditorZoom(-EDITOR_ZOOM_STEP);
});

zoomResetButton.addEventListener("click", () => {
  resetEditorZoom();
});

zoomInButton.addEventListener("click", () => {
  adjustEditorZoom(EDITOR_ZOOM_STEP);
});

editor.addEventListener("input", () => {
  if (suppressDirtyEvents) {
    return;
  }

  typedSinceLastTick = true;
  setDirty(true);
});

editor.addEventListener("keydown", (event) => {
  handleEditorKeydown(event);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void persistCurrentFile(true);
  }
});

window.addEventListener("beforeunload", () => {
  saveCurrentFileSynchronously();

  if (autosaveTimer) {
    window.clearInterval(autosaveTimer);
  }

  for (const unsubscribe of subscriptions) {
    unsubscribe();
  }
});

window.addEventListener("error", () => {
  setStatus("A UI error occurred. Check logs.");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled renderer rejection:", event.reason);
  setStatus("An unexpected async error occurred.");
  event.preventDefault();
});

void initialize();
