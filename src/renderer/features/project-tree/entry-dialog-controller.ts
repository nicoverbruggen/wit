import type { ProjectMetadata } from "../../../shared/types";
import { resolveNewFilePath, resolveNewFolderPath } from "../../project-path-rules.js";

export type EntryKind = "file" | "folder";

export type EntryDialogController = {
  askForNewFilePath: (defaultPath?: string) => Promise<string | null>;
  askForNewFolderPath: (defaultPath?: string) => Promise<string | null>;
  askForRenameValue: (kind: EntryKind, currentName: string) => Promise<string | null>;
  destroy: () => void;
};

export function createEntryDialogController(options: {
  getProject: () => ProjectMetadata | null;
  getSelectedFolderPath: () => string | null;
  setStatus: (message: string, clearAfterMs?: number) => void;
  newFileDialog: HTMLDialogElement;
  newFilePathInput: HTMLInputElement;
  newFileCancelButton: HTMLButtonElement;
  newFileCreateButton: HTMLButtonElement;
  newFileError: HTMLParagraphElement;
  newFolderDialog: HTMLDialogElement;
  newFolderPathInput: HTMLInputElement;
  newFolderCancelButton: HTMLButtonElement;
  newFolderCreateButton: HTMLButtonElement;
  newFolderError: HTMLParagraphElement;
  renameEntryDialog: HTMLDialogElement;
  renameEntryTitle: HTMLHeadingElement;
  renameEntryInput: HTMLInputElement;
  renameEntryCancelButton: HTMLButtonElement;
  renameEntryConfirmButton: HTMLButtonElement;
  renameEntryError: HTMLParagraphElement;
}): EntryDialogController {
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

  const syncNewFileDialogValidation = (): void => {
    const validation = resolveNewFilePath(
      options.getProject(),
      options.newFilePathInput.value,
      options.getSelectedFolderPath()
    );
    options.newFileError.textContent = validation.error ?? "";
    options.newFileCreateButton.disabled = validation.relativePath === null;
  };

  const syncNewFolderDialogValidation = (): void => {
    const validation = resolveNewFolderPath(
      options.getProject(),
      options.newFolderPathInput.value,
      options.getSelectedFolderPath()
    );
    options.newFolderError.textContent = validation.error ?? "";
    options.newFolderCreateButton.disabled = validation.relativePath === null;
  };

  addListener(options.newFileCancelButton, "click", () => {
    if (options.newFileDialog.open) {
      options.newFileDialog.close("cancel");
    }
  });

  addListener(options.newFolderCancelButton, "click", () => {
    if (options.newFolderDialog.open) {
      options.newFolderDialog.close("cancel");
    }
  });

  addListener(options.renameEntryCancelButton, "click", () => {
    if (options.renameEntryDialog.open) {
      options.renameEntryDialog.close("cancel");
    }
  });

  const askForNewFilePath = (defaultPath = ""): Promise<string | null> => {
    if (typeof options.newFileDialog.showModal !== "function") {
      try {
        return Promise.resolve(window.prompt("New text file path", defaultPath));
      } catch {
        options.setStatus("New file dialog is unavailable.");
        return Promise.resolve(null);
      }
    }

    options.newFilePathInput.value = defaultPath;
    syncNewFileDialogValidation();

    if (!options.newFileDialog.open) {
      options.newFileDialog.showModal();
    }

    const handleInput = () => {
      syncNewFileDialogValidation();
    };
    options.newFilePathInput.addEventListener("input", handleInput);

    window.requestAnimationFrame(() => {
      options.newFilePathInput.focus();
      options.newFilePathInput.select();
    });

    return new Promise((resolve) => {
      options.newFileDialog.addEventListener(
        "close",
        () => {
          options.newFilePathInput.removeEventListener("input", handleInput);
          options.newFileError.textContent = "";
          options.newFileCreateButton.disabled = false;

          if (options.newFileDialog.returnValue === "create") {
            resolve(options.newFilePathInput.value);
            return;
          }

          resolve(null);
        },
        { once: true }
      );
    });
  };

  const askForNewFolderPath = (defaultPath = ""): Promise<string | null> => {
    if (typeof options.newFolderDialog.showModal !== "function") {
      try {
        return Promise.resolve(window.prompt("New folder path", defaultPath));
      } catch {
        options.setStatus("New folder dialog is unavailable.");
        return Promise.resolve(null);
      }
    }

    options.newFolderPathInput.value = defaultPath;
    syncNewFolderDialogValidation();

    if (!options.newFolderDialog.open) {
      options.newFolderDialog.showModal();
    }

    const handleInput = () => {
      syncNewFolderDialogValidation();
    };
    options.newFolderPathInput.addEventListener("input", handleInput);

    window.requestAnimationFrame(() => {
      options.newFolderPathInput.focus();
      options.newFolderPathInput.select();
    });

    return new Promise((resolve) => {
      options.newFolderDialog.addEventListener(
        "close",
        () => {
          options.newFolderPathInput.removeEventListener("input", handleInput);
          options.newFolderError.textContent = "";
          options.newFolderCreateButton.disabled = false;

          if (options.newFolderDialog.returnValue === "create") {
            resolve(options.newFolderPathInput.value);
            return;
          }

          resolve(null);
        },
        { once: true }
      );
    });
  };

  const askForRenameValue = (kind: EntryKind, currentName: string): Promise<string | null> => {
    if (typeof options.renameEntryDialog.showModal !== "function") {
      try {
        return Promise.resolve(window.prompt(`Rename ${kind}`, currentName));
      } catch {
        options.setStatus("Rename dialog is unavailable.");
        return Promise.resolve(null);
      }
    }

    options.renameEntryTitle.textContent = `Rename ${kind === "folder" ? "Folder" : "File"}`;
    options.renameEntryInput.value = currentName;
    options.renameEntryError.textContent = "";
    options.renameEntryConfirmButton.disabled = false;

    if (!options.renameEntryDialog.open) {
      options.renameEntryDialog.showModal();
    }

    const validate = () => {
      const value = options.renameEntryInput.value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
      const invalid = value.length === 0 || value.includes("/");
      options.renameEntryError.textContent = invalid ? "Use a single name without slashes." : "";
      options.renameEntryConfirmButton.disabled = invalid;
    };

    options.renameEntryInput.addEventListener("input", validate);
    validate();

    window.requestAnimationFrame(() => {
      options.renameEntryInput.focus();
      options.renameEntryInput.select();
    });

    return new Promise((resolve) => {
      options.renameEntryDialog.addEventListener(
        "close",
        () => {
          options.renameEntryInput.removeEventListener("input", validate);
          options.renameEntryError.textContent = "";
          options.renameEntryConfirmButton.disabled = false;

          if (options.renameEntryDialog.returnValue === "rename") {
            resolve(options.renameEntryInput.value);
            return;
          }

          resolve(null);
        },
        { once: true }
      );
    });
  };

  return {
    askForNewFilePath,
    askForNewFolderPath,
    askForRenameValue,
    destroy: () => {
      for (const listenerCleanup of cleanup) {
        listenerCleanup();
      }
      cleanup.length = 0;
    }
  };
}
