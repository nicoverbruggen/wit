import { pathEquals } from "../../../shared/utils.js";

export type EditorDirtyStateController = {
  getDirty: () => boolean;
  setDirty: (nextDirty: boolean) => void;
};

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
