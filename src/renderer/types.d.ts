/**
 * Owns: global renderer ambient type declarations.
 * Out of scope: runtime API implementation.
 * Inputs/Outputs: ambient `window` typing for the preload API.
 * Side effects: none.
 */
import type { WitApi } from "../shared/ipc";

declare global {
  interface Window {
    witApi: WitApi;
  }
}

export {};
