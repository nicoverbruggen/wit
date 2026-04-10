import type { ProjectMetadata } from "../../shared/types";
import type { RendererAppAction } from "./actions";

/**
 * Owns: renderer app state shape and pure state transitions.
 * Out of scope: side effects, DOM rendering, and event orchestration.
 * Inputs/Outputs: immutable state snapshots and typed renderer actions.
 * Side effects: none.
 */

export type RendererAppState = {
  project: ProjectMetadata | null;
  currentFilePath: string | null;
  dirty: boolean;
  sidebarVisible: boolean;
  sidebarWidthPx: number;
};

/**
 * Creates the initial renderer app state from startup values.
 *
 * @param initialState Initial values used to seed the store.
 * @returns Normalized renderer app state used by the reducer/store.
 */
export function createInitialRendererAppState(initialState: RendererAppState): RendererAppState {
  return { ...initialState };
}

/**
 * Applies a typed renderer action and returns the next app state.
 *
 * @param state Current app state snapshot.
 * @param action Action describing the requested state change.
 * @returns Next app state snapshot.
 */
export function reduceRendererAppState(
  state: RendererAppState,
  action: RendererAppAction
): RendererAppState {
  switch (action.type) {
    case "project/set":
      return {
        ...state,
        project: action.project
      };
    case "editor/set-current-file":
      return {
        ...state,
        currentFilePath: action.currentFilePath
      };
    case "editor/set-dirty":
      return {
        ...state,
        dirty: action.dirty
      };
    case "sidebar/set-visible":
      return {
        ...state,
        sidebarVisible: action.visible
      };
    case "sidebar/set-width":
      return {
        ...state,
        sidebarWidthPx: action.widthPx
      };
    default:
      return state;
  }
}
