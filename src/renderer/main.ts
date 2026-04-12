/**
 * Owns: renderer entrypoint setup after DOM load.
 * Out of scope: controller implementation details and preload IPC internals.
 * Inputs/Outputs: resolved DOM and preload API in, bootstrapped renderer runtime out.
 * Side effects: creates the editor, composition, actions, and bootstrap wiring.
 */
import type { ProjectMetadata } from "../shared/types";
import { normalizeEditorParagraphSpacing } from "../shared/utils.js";
import { formatRelativeElapsed, formatWritingTime, parseSnapshotTimestamp } from "./shared/formatting.js";
import { createCodeMirrorEditor } from "./editor/codemirror.js";
import { formatPrimaryShortcut } from "./shared/shortcuts.js";
import { bootstrapAppController } from "./bootstrap/run.js";
import { createRendererActions } from "./bootstrap/actions.js";
import { createRendererBootstrapOptions } from "./bootstrap/options.js";
import { createRendererComposition, type RendererComposition } from "./bootstrap/compose.js";
import { resolveRendererDom } from "./bootstrap/dom.js";

const dom = resolveRendererDom();
const editor = createCodeMirrorEditor(dom.editorElement);
const {
  configCorruptedBanner,
  configCorruptedDismissButton,
  openProjectButton,
  newFileButton,
  newFolderButton,
  toggleSidebarButton,
  sidebarResizer,
  fullscreenToggleButton,
  sidebar,
  emptyStatePrimaryButton,
  emptyStateSecondaryButton,
  fileList,
  lineHeightInput,
  paragraphSpacingSelect,
  cursorStyleSelect,
  editorWidthInput,
  fontSelect
} = dom;

const EDITOR_ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 150, 175, 200, 225, 250];
const LIVE_WORD_COUNT_DEBOUNCE_MS = 280;
const MAX_TREE_INDENT = 4;
const SNAPSHOT_LABEL_REFRESH_MS = 15_000;
const DEFAULT_EDITOR_PLACEHOLDER = "Open a project and choose a text file to begin writing.";
const DEFAULT_STATUS_MESSAGE = "";
const SIDEBAR_WIDTH_STORAGE_KEY = "wit.sidebar-width";
const MIN_SIDEBAR_WIDTH_PX = 220;
const MAX_SIDEBAR_WIDTH_PX = 420;
const DEFAULT_SIDEBAR_WIDTH_PX = 270;
const BUILT_IN_EDITOR_FONTS = ["Sourcerer", "Readerly", "iA Writer Mono", "iA Writer Duo", "iA Writer Quattro"] as const;
const DEFAULT_EDITOR_FONT = "Readerly";

let project: ProjectMetadata | null = null;
let currentFilePath: string | null = null;
const TYPING_IDLE_THRESHOLD_MS = 5_000;
const AUTOSAVE_LENIENCY_THRESHOLD_SEC = 60;
const AUTOSAVE_LENIENCY_MAX_MS = 5_000;
const AUTOSAVE_LENIENCY_POLL_MS = 500;
let suppressDirtyEvents = false;
let isWindowFullscreen = false;

let composition: RendererComposition | null = null;

const actions = createRendererActions({
  witApi: window.witApi,
  getProject: () => project,
  setProject: (nextProject) => {
    project = nextProject;
  },
  getCurrentFilePath: () => currentFilePath,
  setCurrentFilePath: (nextFilePath) => {
    currentFilePath = nextFilePath;
  },
  getComposition: () => composition,
  formatPrimaryShortcut,
  parseSnapshotTimestamp,
  autosaveLeniencyMaxMs: AUTOSAVE_LENIENCY_MAX_MS,
  autosaveLeniencyPollMs: AUTOSAVE_LENIENCY_POLL_MS
});

composition = createRendererComposition({
  dom,
  body: document.body,
  editor,
  witApi: window.witApi,
  config: {
    liveWordCountDebounceMs: LIVE_WORD_COUNT_DEBOUNCE_MS,
    typingIdleThresholdMs: TYPING_IDLE_THRESHOLD_MS,
    autosaveLeniencyThresholdSec: AUTOSAVE_LENIENCY_THRESHOLD_SEC,
    autosaveLeniencyMaxMs: AUTOSAVE_LENIENCY_MAX_MS,
    autosaveLeniencyPollMs: AUTOSAVE_LENIENCY_POLL_MS,
    snapshotLabelRefreshMs: SNAPSHOT_LABEL_REFRESH_MS,
    maxTreeIndent: MAX_TREE_INDENT,
    defaultEditorPlaceholder: DEFAULT_EDITOR_PLACEHOLDER,
    defaultStatusMessage: DEFAULT_STATUS_MESSAGE,
    sidebarWidthStorageKey: SIDEBAR_WIDTH_STORAGE_KEY,
    minSidebarWidthPx: MIN_SIDEBAR_WIDTH_PX,
    maxSidebarWidthPx: MAX_SIDEBAR_WIDTH_PX,
    defaultSidebarWidthPx: DEFAULT_SIDEBAR_WIDTH_PX,
    builtInEditorFonts: BUILT_IN_EDITOR_FONTS,
    defaultEditorFont: DEFAULT_EDITOR_FONT,
    editorZoomPresets: EDITOR_ZOOM_PRESETS
  },
  state: {
    getProject: actions.getProject,
    setProject: actions.setProjectState,
    getCurrentFilePath: actions.getCurrentFilePath,
    setCurrentFilePath: actions.setCurrentFilePathState,
    getSuppressDirtyEvents: () => suppressDirtyEvents,
    setSuppressDirtyEvents: (value) => {
      suppressDirtyEvents = value;
    },
    getIsWindowFullscreen: () => isWindowFullscreen,
    setIsWindowFullscreen: (nextValue) => {
      isWindowFullscreen = nextValue;
    }
  },
  callbacks: actions.compositionCallbacks,
  formatting: {
    formatRelativeElapsed,
    formatWritingTime
  }
});

bootstrapAppController(
  createRendererBootstrapOptions({
    body: document.body,
    witApi: window.witApi,
    dom: {
      configCorruptedBanner,
      configCorruptedDismissButton,
      openProjectButton,
      emptyStatePrimaryButton,
      emptyStateSecondaryButton,
      newFileButton,
      newFolderButton,
      toggleSidebarButton,
      sidebarResizer,
      fullscreenToggleButton,
      sidebar,
      fileList,
      lineHeightInput,
      paragraphSpacingSelect,
      cursorStyleSelect,
      editorWidthInput,
      fontSelect
    },
    editor,
    composition,
    actions,
    defaultEditorFont: DEFAULT_EDITOR_FONT,
    normalizeEditorParagraphSpacing
  })
);
