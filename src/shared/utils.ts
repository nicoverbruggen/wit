import type { AppSettings } from "./types";

export function normalizePathInput(input: string): string {
  return input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

export function pathEquals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function normalizeEditorLineHeight(value: number): number {
  const bounded = Math.max(1.2, Math.min(2.4, value));
  return Number(bounded.toFixed(2));
}

export function normalizeEditorMaxWidth(value: number): number {
  return Math.max(360, Math.min(1200, Math.round(value)));
}

export function normalizeEditorZoomPercent(value: number): number {
  return Math.max(50, Math.min(250, Math.round(value)));
}

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

export function normalizeTheme(value: unknown): AppSettings["theme"] {
  return value === "dark" ? "dark" : "light";
}

export function normalizeDefaultFileExtension(value: unknown): AppSettings["defaultFileExtension"] {
  switch (value) {
    case ".md":
    case ".wxt":
      return value;
    default:
      return ".txt";
  }
}
