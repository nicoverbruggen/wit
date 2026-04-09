import type { WitApi } from "../shared/ipc";

declare global {
  interface Window {
    witApi: WitApi;
  }
}

export {};
