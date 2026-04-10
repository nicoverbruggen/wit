import type { RendererAppState } from "./state";

/**
 * Owns: read-only selectors for renderer app state.
 * Out of scope: mutations and side effects.
 * Inputs/Outputs: `RendererAppState` in, derived values out.
 * Side effects: none.
 */

/**
 * Returns active project metadata from renderer state.
 */
export function selectProject(state: RendererAppState) {
  return state.project;
}

/**
 * Returns active project-relative file path from renderer state.
 */
export function selectCurrentFilePath(state: RendererAppState): string | null {
  return state.currentFilePath;
}

/**
 * Returns whether the current file has unsaved changes.
 */
export function selectDirty(state: RendererAppState): boolean {
  return state.dirty;
}

/**
 * Returns whether the sidebar is currently visible.
 */
export function selectSidebarVisible(state: RendererAppState): boolean {
  return state.sidebarVisible;
}

/**
 * Returns current sidebar width in pixels.
 */
export function selectSidebarWidthPx(state: RendererAppState): number {
  return state.sidebarWidthPx;
}
