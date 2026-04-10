import type { ProjectMetadata } from "../../shared/types";

/**
 * Owns: typed renderer app actions and action creators for core UI state.
 * Out of scope: reducer logic and store implementation.
 * Inputs/Outputs: strongly typed payloads consumed by the app state reducer.
 * Side effects: none.
 */

export type RendererAppAction =
  | { type: "project/set"; project: ProjectMetadata | null }
  | { type: "editor/set-current-file"; currentFilePath: string | null }
  | { type: "editor/set-dirty"; dirty: boolean }
  | { type: "sidebar/set-visible"; visible: boolean }
  | { type: "sidebar/set-width"; widthPx: number };

/**
 * Creates an action that replaces the active project metadata snapshot.
 *
 * @param project Next active project metadata, or `null` when no project is open.
 * @returns A typed `project/set` action.
 */
export function setProjectAction(project: ProjectMetadata | null): RendererAppAction {
  return { type: "project/set", project };
}

/**
 * Creates an action that updates the current open file path.
 *
 * @param currentFilePath Project-relative file path, or `null` if no file is open.
 * @returns A typed `editor/set-current-file` action.
 */
export function setCurrentFilePathAction(currentFilePath: string | null): RendererAppAction {
  return { type: "editor/set-current-file", currentFilePath };
}

/**
 * Creates an action that updates dirty-editor status for the active file.
 *
 * @param dirty Whether editor content has unsaved changes.
 * @returns A typed `editor/set-dirty` action.
 */
export function setDirtyAction(dirty: boolean): RendererAppAction {
  return { type: "editor/set-dirty", dirty };
}

/**
 * Creates an action that toggles sidebar visibility.
 *
 * @param visible Whether the sidebar is visible.
 * @returns A typed `sidebar/set-visible` action.
 */
export function setSidebarVisibleAction(visible: boolean): RendererAppAction {
  return { type: "sidebar/set-visible", visible };
}

/**
 * Creates an action that updates the sidebar width in pixels.
 *
 * @param widthPx Sidebar width in pixels.
 * @returns A typed `sidebar/set-width` action.
 */
export function setSidebarWidthAction(widthPx: number): RendererAppAction {
  return { type: "sidebar/set-width", widthPx };
}
