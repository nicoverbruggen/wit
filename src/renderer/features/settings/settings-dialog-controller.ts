/**
 * Owns: settings dialog tab state, input wiring, and settings-triggered side effects.
 * Out of scope: project metadata fetching and persistence implementation details.
 * Inputs/Outputs: dialog DOM nodes and callbacks in, dialog control methods out.
 * Side effects: mutates dialog visibility, editor presentation settings, and persisted project settings.
 */
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
  initializeGitRepoButton: HTMLButtonElement;
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

type SettingsTab = {
  key: SettingsTabKey;
  button: HTMLButtonElement;
  panel: HTMLElement;
};

type BooleanSettingsKey =
  | "showWordCount"
  | "showWritingTime"
  | "showCurrentFileBar"
  | "smartQuotes"
  | "gitSnapshots";

/**
 * Creates the settings dialog controller and binds its UI events.
 *
 * @param options Dialog DOM, settings inputs, and persistence/render hooks.
 * @returns Imperative settings dialog controls used by the renderer composition.
 */
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
  beforeOpen?: () => Promise<void>;
  initializeGitRepository?: () => Promise<void>;
  setStatus: (message: string, clearAfterMs?: number) => void;
  initialTab?: SettingsTabKey;
}): SettingsDialogController {
  let activeTab: SettingsTabKey = options.initialTab ?? "writing";
  const cleanup: Array<() => void> = [];
  const tabs: SettingsTab[] = [
    { key: "writing", button: options.tabs.writing.button, panel: options.tabs.writing.panel },
    { key: "editor", button: options.tabs.editor.button, panel: options.tabs.editor.panel },
    { key: "autosave", button: options.tabs.autosave.button, panel: options.tabs.autosave.panel },
    { key: "about", button: options.tabs.about.button, panel: options.tabs.about.panel }
  ];

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

  const persistSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    requestPersist({ [key]: value } as Pick<AppSettings, K>);
  };

  const parseFiniteInputValue = (
    input: HTMLInputElement,
    parse: (value: string) => number
  ): number | null => {
    const parsed = parse(input.value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseFiniteIntegerInputValue = (input: HTMLInputElement): number | null => {
    return parseFiniteInputValue(input, (value) => Number.parseInt(value, 10));
  };

  const parseFiniteFloatInputValue = (input: HTMLInputElement): number | null => {
    return parseFiniteInputValue(input, Number.parseFloat);
  };

  const bindCheckboxSetting = (input: HTMLInputElement, key: BooleanSettingsKey): void => {
    addListener(input, "change", () => {
      persistSetting(key, input.checked);
    });
  };

  const setActiveTab = (nextTab: SettingsTabKey): void => {
    activeTab = nextTab;

    for (const tab of tabs) {
      const isActive = tab.key === nextTab;
      tab.button.setAttribute("aria-selected", String(isActive));
      tab.button.tabIndex = isActive ? 0 : -1;
      tab.panel.hidden = !isActive;
    }
  };

  const openDialog = async (): Promise<void> => {
    if (options.toggleButton.disabled) {
      return;
    }

    if (typeof options.dialog.showModal !== "function") {
      options.setStatus("Settings dialog is unavailable.");
      return;
    }

    try {
      await options.beforeOpen?.();
    } catch {
      options.setStatus("Could not refresh project settings.");
    }

    if (!options.dialog.open) {
      setActiveTab(activeTab);
      options.dialog.showModal();
    }
  };

  const open = (): void => {
    void openDialog();
  };

  addListener(options.toggleButton, "click", () => {
    options.closeTreeContextMenu();
    open();
  });

  for (const tab of tabs) {
    addListener(tab.button, "click", () => {
      setActiveTab(tab.key);
    });
  }

  bindCheckboxSetting(options.inputs.showWordCountInput, "showWordCount");
  bindCheckboxSetting(options.inputs.showWritingTimeInput, "showWritingTime");
  bindCheckboxSetting(options.inputs.showCurrentFileBarInput, "showCurrentFileBar");
  bindCheckboxSetting(options.inputs.smartQuotesInput, "smartQuotes");
  bindCheckboxSetting(options.inputs.gitSnapshotsInput, "gitSnapshots");

  addListener(options.inputs.defaultFileExtensionSelect, "change", () => {
    const selectedExtension = normalizeDefaultFileExtension(options.inputs.defaultFileExtensionSelect.value);
    options.inputs.defaultFileExtensionSelect.value = selectedExtension;
    persistSetting("defaultFileExtension", selectedExtension);
  });
  addListener(options.inputs.gitPushRemoteSelect, "change", () => {
    persistSetting("gitPushRemote", options.inputs.gitPushRemoteSelect.value || null);
  });
  addListener(options.inputs.initializeGitRepoButton, "click", () => {
    if (!options.initializeGitRepository || options.inputs.initializeGitRepoButton.disabled) {
      return;
    }

    options.inputs.initializeGitRepoButton.disabled = true;
    void options.initializeGitRepository().finally(() => {
      if (options.dialog.open) {
        options.inputs.initializeGitRepoButton.disabled = false;
      }
    });
  });
  addListener(options.inputs.autosaveIntervalInput, "change", () => {
    const parsed = parseFiniteIntegerInputValue(options.inputs.autosaveIntervalInput);
    persistSetting("autosaveIntervalSec", parsed === null ? 60 : Math.max(5, parsed));
  });
  addListener(options.inputs.snapshotMaxSizeInput, "change", () => {
    const parsed = parseFiniteIntegerInputValue(options.inputs.snapshotMaxSizeInput);
    persistSetting("snapshotMaxSizeMb", parsed === null ? 10 : Math.max(1, parsed));
  });

  addListener(options.inputs.lineHeightInput, "input", () => {
    const parsed = parseFiniteFloatInputValue(options.inputs.lineHeightInput);
    if (parsed === null) {
      return;
    }

    options.applyEditorLineHeight(parsed);
  });
  addListener(options.inputs.lineHeightInput, "change", () => {
    const parsed = parseFiniteFloatInputValue(options.inputs.lineHeightInput);
    if (parsed === null) {
      return;
    }

    options.applyEditorLineHeight(parsed);
    persistSetting("editorLineHeight", normalizeEditorLineHeight(parsed));
  });

  addListener(options.inputs.paragraphSpacingSelect, "change", () => {
    const selectedSpacing = normalizeEditorParagraphSpacing(options.inputs.paragraphSpacingSelect.value);
    options.applyEditorParagraphSpacing(selectedSpacing);
    options.refreshEditorLayout();
    persistSetting("editorParagraphSpacing", selectedSpacing);
  });

  addListener(options.inputs.editorWidthInput, "input", () => {
    const parsed = parseFiniteIntegerInputValue(options.inputs.editorWidthInput);
    if (parsed === null) {
      return;
    }

    options.applyEditorMaxWidth(parsed);
  });
  addListener(options.inputs.editorWidthInput, "change", () => {
    const parsed = parseFiniteIntegerInputValue(options.inputs.editorWidthInput);
    if (parsed === null) {
      return;
    }

    const normalized = normalizeEditorMaxWidth(parsed);
    options.applyEditorMaxWidth(normalized);
    options.showEditorWidthGuides();
    persistSetting("editorMaxWidthPx", normalized);
  });

  addListener(options.inputs.fontSelect, "change", () => {
    const selectedFont = options.inputs.fontSelect.value;
    options.applyEditorFont(selectedFont);
    options.refreshEditorLayout();
    persistSetting("editorFontFamily", selectedFont);
  });

  addListener(options.inputs.textZoomInput, "input", () => {
    const selectedPercent = parseFiniteIntegerInputValue(options.inputs.textZoomInput);
    if (selectedPercent === null) {
      return;
    }

    options.setEditorZoomFromPercent(selectedPercent);
    options.refreshEditorLayout();
  });

  addListener(options.inputs.themeSelect, "change", () => {
    const selectedTheme = normalizeTheme(options.inputs.themeSelect.value);
    options.applyTheme(selectedTheme);
    persistSetting("theme", selectedTheme);
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
