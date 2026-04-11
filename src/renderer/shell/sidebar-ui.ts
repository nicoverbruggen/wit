/**
 * Owns: project-aware sidebar UI behavior and fullscreen toggle synchronization.
 * Out of scope: low-level resize mechanics and shell control rendering.
 * Inputs/Outputs: sidebar controller state plus project/fullscreen readers in, sidebar UI helpers out.
 * Side effects: mutates sidebar visibility/fade state and fullscreen button attributes.
 */
import type { ProjectMetadata } from "../../shared/types";
import type { SidebarController } from "./sidebar.js";

/**
 * Exposes sidebar UI helpers used by renderer actions.
 */
export type SidebarUiController = {
  setSidebarFaded: (nextFaded: boolean) => void;
  loadSidebarWidthPreference: () => void;
  syncSidebarToggleButton: () => void;
  syncFullscreenToggleButton: (isFullscreen: boolean) => void;
  setSidebarVisibility: (nextVisible: boolean, showStatus?: boolean) => void;
  toggleSidebarVisibility: () => void;
  stopSidebarResize: () => void;
  beginSidebarResize: (pointerClientX: number) => void;
};

/**
 * Creates the sidebar UI controller.
 *
 * @param options Sidebar controller, shell buttons, and project/fullscreen state hooks.
 * @returns Project-aware sidebar visibility and fullscreen helpers.
 */
export function createSidebarUiController(options: {
  sidebarController: SidebarController;
  fullscreenToggleButton: HTMLButtonElement;
  getProject: () => ProjectMetadata | null;
  getCurrentFilePath: () => string | null;
  getIsWindowFullscreen: () => boolean;
  setIsWindowFullscreen: (nextValue: boolean) => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  applyEditorZoom: (showStatus?: boolean) => void;
}): SidebarUiController {
  const setSidebarFaded = (nextFaded: boolean): void => {
    const shouldFade = Boolean(
      options.sidebarController.isVisible() && options.getProject() && options.getCurrentFilePath() && nextFaded
    );
    options.sidebarController.setFaded(shouldFade);
  };

  const setSidebarVisibility = (nextVisible: boolean, showStatus = true): void => {
    options.sidebarController.setVisibility(nextVisible, {
      showStatus,
      setStatus: options.setStatus,
      projectAvailable: Boolean(options.getProject())
    });
  };

  const toggleSidebarVisibility = (): void => {
    options.sidebarController.toggleVisibility(Boolean(options.getProject()), {
      setStatus: options.setStatus
    });
  };

  const syncFullscreenToggleButton = (isFullscreen: boolean): void => {
    const wasFullscreen = options.getIsWindowFullscreen();
    options.setIsWindowFullscreen(isFullscreen);
    const nextActionLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";

    options.fullscreenToggleButton.title = nextActionLabel;
    options.fullscreenToggleButton.setAttribute("aria-label", nextActionLabel);
    options.fullscreenToggleButton.setAttribute("aria-pressed", String(isFullscreen));

    if (isFullscreen && !wasFullscreen) {
      options.sidebarController.setVisibleBeforeFullscreen(options.sidebarController.isVisible());
      setSidebarVisibility(false, false);
    } else if (!isFullscreen && wasFullscreen) {
      setSidebarVisibility(options.sidebarController.getVisibleBeforeFullscreen(), false);
    }

    options.applyEditorZoom(false);
  };

  return {
    setSidebarFaded,
    loadSidebarWidthPreference: () => {
      options.sidebarController.loadWidthPreference();
    },
    syncSidebarToggleButton: () => {
      options.sidebarController.syncToggleButton(Boolean(options.getProject()));
    },
    syncFullscreenToggleButton,
    setSidebarVisibility,
    toggleSidebarVisibility,
    stopSidebarResize: () => {
      options.sidebarController.stopResize();
    },
    beginSidebarResize: (pointerClientX) => {
      options.sidebarController.beginResize(pointerClientX, Boolean(options.getProject()));
    }
  };
}
