/**
 * Owns: shared normalization helpers used across the main process and renderer.
 * Out of scope: persistence, UI state, and project metadata assembly.
 * Inputs/Outputs: raw user or config values in, normalized primitives out.
 * Side effects: none.
 */
import type { AppSettings } from "./types";

/**
 * Trims a path-like input and normalizes path separators for project-relative use.
 *
 * @param input Raw path text from the UI or config.
 * @returns A slash-delimited relative path without leading or trailing separators.
 */
export function normalizePathInput(input: string): string {
  return input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

/**
 * Compares two project-relative paths case-insensitively.
 *
 * @param left First path to compare.
 * @param right Second path to compare.
 * @returns `true` when both normalized strings refer to the same logical path.
 */
export function pathEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Clamps editor line height to the supported range.
 *
 * @param value Requested line-height value.
 * @returns A rounded line height safe for persistence and rendering.
 */
export function normalizeEditorLineHeight(value: number): number {
  const bounded = Math.max(1.2, Math.min(2.4, value));
  return Number(bounded.toFixed(2));
}

/**
 * Clamps editor width to the supported pixel range.
 *
 * @param value Requested editor width.
 * @returns A whole-pixel width within the allowed bounds.
 */
export function normalizeEditorMaxWidth(value: number): number {
  return Math.max(360, Math.min(1200, Math.round(value)));
}

/**
 * Clamps editor zoom to the supported percentage range.
 *
 * @param value Requested zoom percent.
 * @returns A whole-number percent within the allowed bounds.
 */
export function normalizeEditorZoomPercent(value: number): number {
  return Math.max(50, Math.min(250, Math.round(value)));
}

/**
 * Normalizes paragraph spacing to one of the supported preset values.
 *
 * @param value Raw spacing value from persisted settings or UI.
 * @returns A valid paragraph-spacing preset.
 */
export function normalizeEditorParagraphSpacing(value: unknown): AppSettings["editorParagraphSpacing"] {
  switch (value) {
    case "tight":
    case "loose":
    case "very-loose":
      return value;
    default:
      return "none";
  }
}

/**
 * Normalizes the app theme to a supported value.
 *
 * @param value Raw theme candidate.
 * @returns `"dark"` when explicitly requested, otherwise `"light"`.
 */
export function normalizeTheme(value: unknown): AppSettings["theme"] {
  return value === "dark" ? "dark" : "light";
}

/**
 * Normalizes the default new-file extension to a supported value.
 *
 * @param value Raw extension candidate.
 * @returns A supported text-file extension.
 */
export function normalizeDefaultFileExtension(value: unknown): AppSettings["defaultFileExtension"] {
  switch (value) {
    case ".md":
    case ".wxt":
      return value;
    default:
      return ".txt";
  }
}
