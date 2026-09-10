import type { OverlayApi } from "./shared/types";

declare global {
  interface Window {
    overlay?: OverlayApi;
  }
}

export {};
