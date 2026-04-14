/**
 * Owns: first-load renderer initialization after composition is created.
 * Out of scope: low-level DOM event binding and ongoing renderer action orchestration.
 * Inputs/Outputs: preload API, DOM defaults, and renderer callbacks in, initialized UI state out.
 * Side effects: mutates global body state, subscribes to menu events, and kicks off font discovery.
 */
import type { AppSettings, ProjectMetadata } from "../../shared/types";
import { FEATURES } from "../../shared/features.js";

type WitApiForInitialization = {
  getPlatform: () => string;
  getActiveProject: () => Promise<ProjectMetadata | null>;
  onMenuOpenProject: (handler: () => void) => () => void;
  onMenuCloseProject: (handler: () => void) => () => void;
  onMenuNewFile: (handler: () => void) => () => void;
  onMenuNewFolder: (handler: () => void) => () => void;
  onMenuProjectSettings: (handler: () => void) => () => void;
  onMenuSaveCurrentFile: (handler: () => void) => () => void;
  onMenuZoomInText: (handler: () => void) => () => void;
  onMenuZoomOutText: (handler: () => void) => () => void;
  onMenuZoomResetText: (handler: () => void) => () => void;
  onMenuToggleSidebar: (handler: () => void) => () => void;
  onFullscreenChanged: (handler: (isFullscreen: boolean) => void) => () => void;
};

/**
 * Performs one-time renderer initialization after bootstrap wiring is ready.
 *
 * @param options Renderer defaults, preload API access, and state/application hooks.
 */
export async function initializeApp(options: {
  body: HTMLElement;
  witApi: WitApiForInitialization;
  defaultEditorFont: string;
  lineHeightInput: HTMLInputElement;
  paragraphSpacingSelect: HTMLSelectElement;
  cursorStyleSelect: HTMLSelectElement;
  editorWidthInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  getProject: () => ProjectMetadata | null;
  loadAboutInfo: () => Promise<void>;
  loadSidebarWidthPreference: () => void;
  setProjectControlsEnabled: (enabled: boolean) => void;
  setSettingsTab: (tab: "writing") => void;
  syncSidebarToggleButton: () => void;
  syncFullscreenToggleButton: (isFullscreen: boolean) => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  setEditorWritable: (enabled: boolean) => void;
  populateFontSelect: (selectedFont: string) => void;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  normalizeEditorParagraphSpacing: (value: string) => AppSettings["editorParagraphSpacing"];
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorCursorStyle: (cursorStyle: AppSettings["editorCursorStyle"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  applyEditorZoom: (showStatus?: boolean) => void;
  applyEditorFont: (fontFamily: string) => void;
  renderSnapshotLabel: () => void;
  restartSnapshotLabelTimer: () => void;
  renderFileList: () => void;
  renderStatusFooter: () => void;
  renderEmptyEditorState: () => void;
  applyProjectMetadata: (metadata: ProjectMetadata) => void;
  openFile: (relativePath: string) => Promise<void>;
  resetActiveFile: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  addSubscription: (unsubscribe: () => void) => void;
  openProjectPicker: () => Promise<void>;
  closeCurrentProject: () => Promise<void>;
  createNewFile: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  openProjectSettings: () => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  stepEditorZoom: (direction: 1 | -1) => void;
  resetEditorZoom: () => void;
  toggleSidebarVisibility: () => void;
  loadSystemFonts: () => Promise<void>;
}): Promise<void> {
  options.body.dataset.appReady = "false";
  const platform = options.witApi.getPlatform();
  options.body.classList.add(`platform-${platform}`);

  if (!FEATURES.git) {
    const gitSection = document.getElementById("settings-section-git");
    if (gitSection) {
      gitSection.hidden = true;
    }
  }
  void options.loadAboutInfo();

  options.loadSidebarWidthPreference();
  options.setProjectControlsEnabled(false);
  options.setSettingsTab("writing");
  options.syncSidebarToggleButton();
  options.syncFullscreenToggleButton(false);
  options.setSidebarVisibility(false, false);
  options.setSidebarFaded(false);
  options.setEditorWritable(false);
  options.populateFontSelect(options.defaultEditorFont);
  options.applyTheme("light");
  options.applyEditorLineHeight(Number.parseFloat(options.lineHeightInput.value));
  options.applyEditorParagraphSpacing(options.normalizeEditorParagraphSpacing(options.paragraphSpacingSelect.value));
  options.applyEditorCursorStyle(options.cursorStyleSelect.value as AppSettings["editorCursorStyle"]);
  options.applyEditorMaxWidth(Number.parseInt(options.editorWidthInput.value, 10));
  options.applyEditorZoom(false);
  options.applyEditorFont(options.defaultEditorFont);
  options.renderSnapshotLabel();
  options.restartSnapshotLabelTimer();
  options.renderFileList();
  options.renderStatusFooter();
  options.renderEmptyEditorState();

  const activeProject = await options.witApi.getActiveProject();
  if (activeProject) {
    options.applyProjectMetadata(activeProject);

    const preferredFile =
      activeProject.lastOpenedFilePath && activeProject.files.includes(activeProject.lastOpenedFilePath)
        ? activeProject.lastOpenedFilePath
        : null;

    if (preferredFile) {
      await options.openFile(preferredFile);
    } else if (activeProject.files.length > 0 && activeProject.lastOpenedFilePath) {
      // Stored file was deleted externally — fall back to first available file.
      await options.openFile(activeProject.files[0]);
    } else if (activeProject.files.length > 0 && !activeProject.hasStoredLastOpenedFilePath) {
      // Fresh project with no history — auto-open first file.
      await options.openFile(activeProject.files[0]);
    }
  }

  options.addSubscription(
    options.witApi.onMenuOpenProject(() => {
      void options.openProjectPicker();
    })
  );

  options.addSubscription(
    options.witApi.onMenuCloseProject(() => {
      void options.closeCurrentProject();
    })
  );

  options.addSubscription(
    options.witApi.onMenuNewFile(() => {
      void options.createNewFile();
    })
  );

  options.addSubscription(
    options.witApi.onMenuNewFolder(() => {
      void options.createNewFolder();
    })
  );

  options.addSubscription(
    options.witApi.onMenuProjectSettings(() => {
      options.openProjectSettings();
    })
  );

  options.addSubscription(
    options.witApi.onMenuSaveCurrentFile(() => {
      void options.persistCurrentFile(true);
    })
  );

  options.addSubscription(
    options.witApi.onMenuZoomInText(() => {
      options.stepEditorZoom(1);
    })
  );

  options.addSubscription(
    options.witApi.onMenuZoomOutText(() => {
      options.stepEditorZoom(-1);
    })
  );

  options.addSubscription(
    options.witApi.onMenuZoomResetText(() => {
      options.resetEditorZoom();
    })
  );

  options.addSubscription(
    options.witApi.onMenuToggleSidebar(() => {
      options.toggleSidebarVisibility();
    })
  );

  options.addSubscription(
    options.witApi.onFullscreenChanged((isFullscreen) => {
      options.syncFullscreenToggleButton(isFullscreen);
    })
  );

  options.body.dataset.appReady = "true";

  // Font discovery can be slow; populate extra system fonts after initial UI is ready.
  void (async () => {
    await options.loadSystemFonts();
    const selectedFont = options.fontSelect.value || options.getProject()?.settings.editorFontFamily || options.defaultEditorFont;
    options.populateFontSelect(selectedFont);
    options.applyEditorFont(options.fontSelect.value);
  })();
}
