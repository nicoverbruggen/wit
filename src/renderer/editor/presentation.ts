/**
 * Owns: editor presentation state such as theme, typography, width, and zoom.
 * Out of scope: file-session state and settings persistence queuing.
 * Inputs/Outputs: editor/panel DOM nodes and presentation callbacks in, presentation helpers out.
 * Side effects: mutates editor styling, body theme state, width-guide timers, and font select options.
 */
import type { AppSettings } from "../../shared/types";
import {
  normalizeEditorLineHeight,
  normalizeEditorMaxWidth,
  normalizeEditorZoomPercent
} from "../../shared/utils.js";
import {
  buildEditorFontStack,
  loadSystemFontFamilies,
  populateFontSelect as populateFontOptions
} from "../shared/fonts.js";

type EditorPresentationAdapter = {
  setDisabled: (disabled: boolean) => void;
  setLineHeight: (lineHeight: number) => void;
  setParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  setCursorStyle: (cursorStyle: AppSettings["editorCursorStyle"]) => void;
  setFontFamily: (fontFamily: string) => void;
  getComputedFontSize: () => number;
  setFontSize: (fontSize: number) => void;
};

/**
 * Exposes editor presentation helpers used by renderer actions and settings UI.
 */
export type EditorPresentationController = {
  showEditorWidthGuides: () => void;
  clearEditorWidthGuides: () => void;
  setEditorWritable: (enabled: boolean) => void;
  applyEditorLineHeight: (lineHeight: number) => void;
  applyEditorParagraphSpacing: (spacing: AppSettings["editorParagraphSpacing"]) => void;
  applyEditorCursorStyle: (cursorStyle: AppSettings["editorCursorStyle"]) => void;
  applyEditorMaxWidth: (editorWidth: number) => void;
  applyEditorFont: (fontFamily: string) => void;
  populateFontSelect: (selectedFont: string) => void;
  loadSystemFonts: () => Promise<void>;
  applyTheme: (theme: AppSettings["theme"]) => void;
  applyEditorZoom: (showStatus?: boolean) => void;
  setEditorZoomFromPercent: (percent: number, showStatus?: boolean) => void;
  stepEditorZoom: (direction: 1 | -1) => void;
  resetEditorZoom: () => void;
};

/**
 * Creates the editor presentation controller.
 *
 * @param options Editor styling adapters, DOM nodes, and status/persistence hooks.
 * @returns Helpers for applying typography, zoom, width, font, and theme changes.
 */
export function createEditorPresentationController(options: {
  editor: EditorPresentationAdapter;
  editorWrap: HTMLElement;
  lineHeightInput: HTMLInputElement;
  lineHeightValue: HTMLSpanElement;
  paragraphSpacingSelect: HTMLSelectElement;
  cursorStyleSelect: HTMLSelectElement;
  editorWidthInput: HTMLInputElement;
  editorWidthValue: HTMLSpanElement;
  textZoomInput: HTMLInputElement;
  textZoomValue: HTMLSpanElement;
  fontSelect: HTMLSelectElement;
  body: HTMLElement;
  builtInEditorFonts: readonly string[];
  defaultEditorFont: string;
  zoomPresets: number[];
  setStatus: (message: string, clearAfterMs?: number) => void;
  persistZoomPercent: (percent: number) => void;
}): EditorPresentationController {
  let systemFontFamilies: string[] = [];
  let editorBaseFontSizePx = 0;
  let editorZoomFactor = 1;
  let editorWidthGuideTimer: number | null = null;

  const showEditorWidthGuides = (): void => {
    options.editorWrap.classList.add("show-width-guides");

    if (editorWidthGuideTimer) {
      window.clearTimeout(editorWidthGuideTimer);
      editorWidthGuideTimer = null;
    }

    editorWidthGuideTimer = window.setTimeout(() => {
      options.editorWrap.classList.remove("show-width-guides");
      editorWidthGuideTimer = null;
    }, 900);
  };

  const clearEditorWidthGuides = (): void => {
    if (editorWidthGuideTimer) {
      window.clearTimeout(editorWidthGuideTimer);
      editorWidthGuideTimer = null;
    }

    options.editorWrap.classList.remove("show-width-guides");
  };

  const setEditorWritable = (enabled: boolean): void => {
    options.editor.setDisabled(!enabled);
  };

  const applyEditorLineHeight = (lineHeight: number): void => {
    const normalized = normalizeEditorLineHeight(lineHeight);
    options.editor.setLineHeight(normalized);
    options.lineHeightValue.textContent = normalized.toFixed(2);
    options.lineHeightInput.value = normalized.toFixed(2);
  };

  const applyEditorParagraphSpacing = (spacing: AppSettings["editorParagraphSpacing"]): void => {
    options.paragraphSpacingSelect.value = spacing;
    options.editor.setParagraphSpacing(spacing);
  };

  const applyEditorCursorStyle = (cursorStyle: AppSettings["editorCursorStyle"]): void => {
    options.cursorStyleSelect.value = cursorStyle;
    options.editor.setCursorStyle(cursorStyle);
  };

  const applyEditorMaxWidth = (editorWidth: number): void => {
    const normalized = normalizeEditorMaxWidth(editorWidth);
    const widthValue = `${normalized}px`;
    options.editorWrap.style.setProperty("--editor-max-width", widthValue);
    options.editorWidthValue.textContent = widthValue;
    options.editorWidthInput.value = String(normalized);
  };

  const applyEditorFont = (fontFamily: string): void => {
    const fontStack = buildEditorFontStack(fontFamily);
    options.editor.setFontFamily(fontStack);
    options.fontSelect.style.fontFamily = fontStack;
  };

  const populateFontSelect = (selectedFont: string): void => {
    const resolvedFont = populateFontOptions({
      select: options.fontSelect,
      builtInFonts: options.builtInEditorFonts,
      systemFontFamilies,
      selectedFont,
      defaultFont: options.defaultEditorFont
    });
    options.fontSelect.style.fontFamily = buildEditorFontStack(resolvedFont);
  };

  const loadSystemFonts = async (): Promise<void> => {
    systemFontFamilies = await loadSystemFontFamilies(window, options.builtInEditorFonts);
  };

  const applyTheme = (theme: AppSettings["theme"]): void => {
    options.body.dataset.theme = theme;
  };

  const ensureEditorBaseFontSize = (): void => {
    if (editorBaseFontSizePx > 0) {
      return;
    }

    const computedSize = options.editor.getComputedFontSize();
    editorBaseFontSizePx = Number.isFinite(computedSize) && computedSize > 0 ? computedSize : 20;
  };

  const syncZoomControlWithState = (): void => {
    const currentPercent = Math.round(editorZoomFactor * 100);
    options.textZoomInput.value = String(currentPercent);
    options.textZoomValue.textContent = `${currentPercent}%`;
  };

  const applyEditorZoom = (showStatus = true): void => {
    ensureEditorBaseFontSize();
    const nextFontSize = Number((editorBaseFontSizePx * editorZoomFactor).toFixed(2));
    options.editor.setFontSize(nextFontSize);
    syncZoomControlWithState();

    if (showStatus) {
      options.setStatus(`Text zoom ${Math.round(editorZoomFactor * 100)}%`, 1200);
    }
  };

  const setEditorZoomFromPercent = (percent: number, showStatus = true): void => {
    const bounded = normalizeEditorZoomPercent(percent);
    editorZoomFactor = bounded / 100;
    applyEditorZoom(showStatus);

    if (showStatus) {
      options.persistZoomPercent(bounded);
    }
  };

  const stepEditorZoom = (direction: 1 | -1): void => {
    const currentPercent = Math.round(editorZoomFactor * 100);

    if (direction > 0) {
      const next = options.zoomPresets.find((preset) => preset > currentPercent) ?? 250;
      setEditorZoomFromPercent(next);
      return;
    }

    const previous = [...options.zoomPresets].reverse().find((preset) => preset < currentPercent) ?? 50;
    setEditorZoomFromPercent(previous);
  };

  const resetEditorZoom = (): void => {
    setEditorZoomFromPercent(100);
  };

  return {
    showEditorWidthGuides,
    clearEditorWidthGuides,
    setEditorWritable,
    applyEditorLineHeight,
    applyEditorParagraphSpacing,
    applyEditorCursorStyle,
    applyEditorMaxWidth,
    applyEditorFont,
    populateFontSelect,
    loadSystemFonts,
    applyTheme,
    applyEditorZoom,
    setEditorZoomFromPercent,
    stepEditorZoom,
    resetEditorZoom
  };
}
