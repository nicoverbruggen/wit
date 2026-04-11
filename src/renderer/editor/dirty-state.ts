/**
 * Owns: dirty-state tracking for the active editor and corresponding sidebar markers.
 * Out of scope: file persistence and editor content changes.
 * Inputs/Outputs: current-file readers and DOM nodes in, dirty-state getters/setters out.
 * Side effects: mutates dirty indicators in the editor header and file list.
 */
import { pathEquals } from "../../shared/utils.js";

/**
 * Exposes current dirty-state queries and updates.
 */
export type EditorDirtyStateController = {
  getDirty: () => boolean;
  setDirty: (nextDirty: boolean) => void;
};

/**
 * Creates the editor dirty-state controller.
 *
 * @param options Dirty indicator DOM nodes and active-file path reader.
 * @returns Dirty-state getters and setters for the active editor session.
 */
export function createEditorDirtyStateController(options: {
  dirtyIndicator: HTMLSpanElement;
  fileList: HTMLUListElement;
  getCurrentFilePath: () => string | null;
}): EditorDirtyStateController {
  let dirty = false;

  const syncActiveFileMarkerState = (): void => {
    const markers = options.fileList.querySelectorAll(".file-button .active-file-marker");
    const currentFilePath = options.getCurrentFilePath();

    markers.forEach((element) => {
      const marker = element as HTMLElement;
      const fileButton = marker.closest(".file-button") as HTMLElement | null;
      const relativePath = fileButton?.dataset.relativePath;
      const isCurrentFile = Boolean(relativePath && currentFilePath && pathEquals(relativePath, currentFilePath));
      marker.hidden = !isCurrentFile;
      marker.dataset.dirty = String(isCurrentFile && dirty);
    });
  };

  const setDirty = (nextDirty: boolean): void => {
    dirty = nextDirty;
    options.dirtyIndicator.hidden = !nextDirty;
    syncActiveFileMarkerState();
  };

  return {
    getDirty: () => dirty,
    setDirty
  };
}
