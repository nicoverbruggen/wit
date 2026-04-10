import type { AppSettings } from "../../../shared/types";
import {
  normalizeDefaultFileExtension,
  normalizeEditorLineHeight,
  normalizeEditorMaxWidth,
  normalizeEditorParagraphSpacing,
  normalizeTheme
} from "../../../shared/utils.js";

export type SettingsTabKey = "writing" | "editor" | "autosave" | "about";

type SettingsTabs = {
  writing: { button: HTMLButtonElement; panel: HTMLElement };
  editor: { button: HTMLButtonElement; panel: HTMLElement };
  autosave: { button: HTMLButtonElement; panel: HTMLElement };
  about: { button: HTMLButtonElement; panel: HTMLElement };
};

type SettingsInputs = {
  showWordCountInput: HTMLInputElement;
  showWritingTimeInput: HTMLInputElement;
  showCurrentFileBarInput: HTMLInputElement;
  smartQuotesInput: HTMLInputElement;
  defaultFileExtensionSelect: HTMLSelectElement;
  gitSnapshotsInput: HTMLInputElement;
  gitPushRemoteSelect: HTMLSelectElement;
  autosaveIntervalInput: HTMLInputElement;
  snapshotMaxSizeInput: HTMLInputElement;
  lineHeightInput: HTMLInputElement;
  paragraphSpacingSelect: HTMLSelectElement;
  editorWidthInput: HTMLInputElement;
  textZoomInput: HTMLInputElement;
  themeSelect: HTMLSelectElement;
  fontSelect: HTMLSelectElement;
};

export type SettingsDialogController = {
  open: () => void;
  setActiveTab: (tab: SettingsTabKey) => void;
  getActiveTab: () => SettingsTabKey;
  destroy: () => void;
};

export function createSettingsDialogController(options: {
  dialog: HTMLDialogElement;
  toggleButton: HTMLButtonElement;
  tabs: SettingsTabs;
  inputs: SettingsInputs;
  closeTreeContextMenu: () => void;
  persistSettings: (update: Partial<AppSettings>) => Promise<void>;
  applyEditorLineHeight: (lineHeight: number) => void;
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  applyEditorFont: (fontFamily: string) => void;
  setEditorZoomFromPercent: (percent: number) => void;
  applyTheme: (theme: AppSettings["theme"]) => void;
  refreshEditorLayout: () => void;
  showEditorWidthGuides: () => void;
  clearEditorWidthGuides: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  initialTab?: SettingsTabKey;
}): SettingsDialogController {
  let activeTab: SettingsTabKey = options.initialTab ?? "writing";
  const cleanup: Array<() => void> = [];

  const addListener = <T extends EventTarget>(
    target: T,
    eventName: string,
    listener: () => void
  ): void => {
    target.addEventListener(eventName, listener);
    cleanup.push(() => {
      target.removeEventListener(eventName, listener);
    });
  };

  const requestPersist = (update: Partial<AppSettings>): void => {
    void options.persistSettings(update);
  };

  const setActiveTab = (nextTab: SettingsTabKey): void => {
    activeTab = nextTab;
    const tabs: Array<{ key: SettingsTabKey; button: HTMLButtonElement; panel: HTMLElement }> = [
      { key: "writing", button: options.tabs.writing.button, panel: options.tabs.writing.panel },
      { key: "editor", button: options.tabs.editor.button, panel: options.tabs.editor.panel },
      { key: "autosave", button: options.tabs.autosave.button, panel: options.tabs.autosave.panel },
      { key: "about", button: options.tabs.about.button, panel: options.tabs.about.panel }
    ];

    for (const tab of tabs) {
      const isActive = tab.key === nextTab;
      tab.button.setAttribute("aria-selected", String(isActive));
      tab.button.tabIndex = isActive ? 0 : -1;
      tab.panel.hidden = !isActive;
    }
  };

  const open = (): void => {
    if (options.toggleButton.disabled) {
      return;
    }

    if (typeof options.dialog.showModal !== "function") {
      options.setStatus("Settings dialog is unavailable.");
      return;
    }

    if (!options.dialog.open) {
      setActiveTab(activeTab);
      options.dialog.showModal();
    }
  };

  addListener(options.toggleButton, "click", () => {
    options.closeTreeContextMenu();
    open();
  });

  addListener(options.tabs.writing.button, "click", () => {
    setActiveTab("writing");
  });
  addListener(options.tabs.editor.button, "click", () => {
    setActiveTab("editor");
  });
  addListener(options.tabs.autosave.button, "click", () => {
    setActiveTab("autosave");
  });
  addListener(options.tabs.about.button, "click", () => {
    setActiveTab("about");
  });

  addListener(options.inputs.showWordCountInput, "change", () => {
    requestPersist({ showWordCount: options.inputs.showWordCountInput.checked });
  });
  addListener(options.inputs.showWritingTimeInput, "change", () => {
    requestPersist({ showWritingTime: options.inputs.showWritingTimeInput.checked });
  });
  addListener(options.inputs.showCurrentFileBarInput, "change", () => {
    requestPersist({ showCurrentFileBar: options.inputs.showCurrentFileBarInput.checked });
  });
  addListener(options.inputs.smartQuotesInput, "change", () => {
    requestPersist({ smartQuotes: options.inputs.smartQuotesInput.checked });
  });

  addListener(options.inputs.defaultFileExtensionSelect, "change", () => {
    const selectedExtension = normalizeDefaultFileExtension(options.inputs.defaultFileExtensionSelect.value);
    options.inputs.defaultFileExtensionSelect.value = selectedExtension;
    requestPersist({ defaultFileExtension: selectedExtension });
  });
  addListener(options.inputs.gitSnapshotsInput, "change", () => {
    requestPersist({ gitSnapshots: options.inputs.gitSnapshotsInput.checked });
  });
  addListener(options.inputs.gitPushRemoteSelect, "change", () => {
    requestPersist({ gitPushRemote: options.inputs.gitPushRemoteSelect.value || null });
  });
  addListener(options.inputs.autosaveIntervalInput, "change", () => {
    const parsed = Number.parseInt(options.inputs.autosaveIntervalInput.value, 10);
    const safeValue = Number.isFinite(parsed) ? Math.max(5, parsed) : 60;
    requestPersist({ autosaveIntervalSec: safeValue });
  });
  addListener(options.inputs.snapshotMaxSizeInput, "change", () => {
    const parsed = Number.parseInt(options.inputs.snapshotMaxSizeInput.value, 10);
    const safeValue = Number.isFinite(parsed) ? Math.max(1, parsed) : 10;
    requestPersist({ snapshotMaxSizeMb: safeValue });
  });

  addListener(options.inputs.lineHeightInput, "input", () => {
    const parsed = Number.parseFloat(options.inputs.lineHeightInput.value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    options.applyEditorLineHeight(parsed);
  });
  addListener(options.inputs.lineHeightInput, "change", () => {
    const parsed = Number.parseFloat(options.inputs.lineHeightInput.value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    options.applyEditorLineHeight(parsed);
    requestPersist({ editorLineHeight: normalizeEditorLineHeight(parsed) });
  });

  addListener(options.inputs.paragraphSpacingSelect, "change", () => {
    const selectedSpacing = normalizeEditorParagraphSpacing(options.inputs.paragraphSpacingSelect.value);
    options.applyEditorParagraphSpacing(selectedSpacing);
    options.refreshEditorLayout();
    requestPersist({ editorParagraphSpacing: selectedSpacing });
  });

  addListener(options.inputs.editorWidthInput, "input", () => {
    options.applyEditorMaxWidth(Number.parseInt(options.inputs.editorWidthInput.value, 10));
  });
  addListener(options.inputs.editorWidthInput, "change", () => {
    const parsed = Number.parseInt(options.inputs.editorWidthInput.value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const normalized = normalizeEditorMaxWidth(parsed);
    options.applyEditorMaxWidth(normalized);
    options.showEditorWidthGuides();
    requestPersist({ editorMaxWidthPx: normalized });
  });

  addListener(options.inputs.fontSelect, "change", () => {
    const selectedFont = options.inputs.fontSelect.value;
    options.applyEditorFont(selectedFont);
    options.refreshEditorLayout();
    requestPersist({ editorFontFamily: selectedFont });
  });

  addListener(options.inputs.textZoomInput, "input", () => {
    const selectedPercent = Number.parseInt(options.inputs.textZoomInput.value, 10);
    if (!Number.isFinite(selectedPercent)) {
      return;
    }

    options.setEditorZoomFromPercent(selectedPercent);
    options.refreshEditorLayout();
  });

  addListener(options.inputs.themeSelect, "change", () => {
    const selectedTheme = normalizeTheme(options.inputs.themeSelect.value);
    options.applyTheme(selectedTheme);
    requestPersist({ theme: selectedTheme });
  });

  addListener(options.dialog, "close", () => {
    options.clearEditorWidthGuides();
  });

  return {
    open,
    setActiveTab,
    getActiveTab: () => activeTab,
    destroy: () => {
      for (const listenerCleanup of cleanup) {
        listenerCleanup();
      }
      cleanup.length = 0;
    }
  };
}
