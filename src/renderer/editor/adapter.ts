/**
 * Owns: the renderer-facing editor abstraction shared by CodeMirror and textarea fallbacks.
 * Out of scope: higher-level file session workflows and project UI state.
 * Inputs/Outputs: editor commands in, current text/selection and event subscriptions out.
 * Side effects: mutates the bound editor DOM element.
 */
/**
 * Represents the current editor selection range in document offsets.
 */
export type EditorSelection = {
  start: number;
  end: number;
};

/**
 * Defines the editor operations consumed by the renderer controllers.
 */
export type EditorAdapter = {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  setSyntaxForFile: (relativePath: string | null) => void;
  setPlaceholder: (value: string) => void;
  setDisabled: (disabled: boolean) => void;
  setLineHeight: (value: number | string) => void;
  setParagraphSpacing: (value: "none" | "tight" | "loose" | "very-loose") => void;
  setFontFamily: (value: string) => void;
  setFontSize: (value: number) => void;
  getComputedFontSize: () => number;
  getSelection: () => EditorSelection;
  replaceSelection: (value: string) => void;
  onInput: (listener: () => void) => () => void;
  onKeydown: (listener: (event: KeyboardEvent) => void) => () => void;
  onBlur: (listener: () => void) => () => void;
  destroy: () => void;
};

/**
 * Creates a minimal textarea-backed editor adapter.
 *
 * @param element Textarea host element to wrap.
 * @returns An `EditorAdapter` with the subset of behavior supported by plain textareas.
 */
export function createTextareaEditor(element: HTMLTextAreaElement): EditorAdapter {
  return {
    focus: () => {
      element.focus();
    },
    getValue: () => element.value,
    setValue: (value) => {
      element.value = value;
    },
    setSyntaxForFile: () => {},
    setPlaceholder: (value) => {
      element.placeholder = value;
    },
    setDisabled: (disabled) => {
      element.disabled = disabled;
    },
    setLineHeight: (value) => {
      element.style.lineHeight = String(value);
    },
    setParagraphSpacing: () => {},
    setFontFamily: (value) => {
      element.style.fontFamily = value;
    },
    setFontSize: (value) => {
      element.style.fontSize = `${value}px`;
    },
    getComputedFontSize: () => Number.parseFloat(window.getComputedStyle(element).fontSize),
    getSelection: () => ({
      start: element.selectionStart,
      end: element.selectionEnd
    }),
    replaceSelection: (value) => {
      element.focus();
      document.execCommand("insertText", false, value);
    },
    onInput: (listener) => {
      element.addEventListener("input", listener);
      return () => {
        element.removeEventListener("input", listener);
      };
    },
    onKeydown: (listener) => {
      element.addEventListener("keydown", listener);
      return () => {
        element.removeEventListener("keydown", listener);
      };
    },
    onBlur: (listener) => {
      element.addEventListener("blur", listener);
      return () => {
        element.removeEventListener("blur", listener);
      };
    },
    destroy: () => {}
  };
}
