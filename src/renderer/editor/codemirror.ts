/**
 * Owns: CodeMirror editor construction, syntax mode switching, and low-level editor events.
 * Out of scope: file lifecycle, autosave, and project-level UI state.
 * Inputs/Outputs: host DOM element in, `EditorAdapter` commands and subscriptions out.
 * Side effects: creates a CodeMirror view and mutates host dataset/style state.
 */
import {
  Compartment,
  EditorSelection as CodeMirrorSelection,
  EditorState,
  StateField,
  RangeSetBuilder
} from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  WidgetType,
  type DecorationSet
} from "@codemirror/view";
import type { AppSettings } from "../../shared/types";
import type { EditorAdapter } from "./adapter";

class ParagraphSpacerWidget extends WidgetType {
  toDOM(): HTMLElement {
    const spacer = document.createElement("div");
    spacer.className = "cm-wit-paragraph-spacer";
    spacer.setAttribute("aria-hidden", "true");
    return spacer;
  }
}

const paragraphStartDecoration = Decoration.widget({
  widget: new ParagraphSpacerWidget(),
  block: true,
  side: -1
});

function isBlankLine(text: string): boolean {
  return text.trim().length === 0;
}

function buildParagraphDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let lineNumber = 2; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (isBlankLine(line.text)) {
      continue;
    }

    const previousLine = state.doc.line(lineNumber - 1);
    if (isBlankLine(previousLine.text)) {
      continue;
    }

    builder.add(line.from, line.from, paragraphStartDecoration);
  }

  return builder.finish();
}

const paragraphSpacingField = StateField.define<DecorationSet>({
  create(state) {
    return buildParagraphDecorations(state);
  },
  update(decorations, transaction) {
    if (!transaction.docChanged) {
      return decorations;
    }

    return buildParagraphDecorations(transaction.state);
  },
  provide: (field) => EditorView.decorations.from(field)
});

/**
 * Creates the CodeMirror-backed editor adapter used by the renderer.
 *
 * @param host Host element that receives the CodeMirror view.
 * @returns An `EditorAdapter` bridged onto the CodeMirror instance.
 */
export function createCodeMirrorEditor(host: HTMLElement): EditorAdapter {
  const placeholderCompartment = new Compartment();
  const editableCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const inputListeners = new Set<() => void>();
  const keydownListeners = new Set<(event: KeyboardEvent) => void>();
  const blurListeners = new Set<() => void>();

  host.dataset.paragraphSpacing = "none";

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: "",
      extensions: [
        EditorView.lineWrapping,
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        paragraphSpacingField,
        languageCompartment.of([]),
        editableCompartment.of(EditorView.editable.of(false)),
        readOnlyCompartment.of(EditorState.readOnly.of(true)),
        placeholderCompartment.of(placeholder("")),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }

          for (const listener of inputListeners) {
            listener();
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            const keyboardEvent = event as KeyboardEvent;
            for (const listener of keydownListeners) {
              listener(keyboardEvent);
            }

            return keyboardEvent.defaultPrevented;
          },
          blur: () => {
            for (const listener of blurListeners) {
              listener();
            }

            return false;
          }
        })
      ]
    })
  });

  host.classList.add("codemirror-editor-host");

  const setSyntaxForFile = (relativePath: string | null): void => {
    const normalizedPath = relativePath?.toLowerCase() ?? "";
    const extension = normalizedPath.slice(normalizedPath.lastIndexOf("."));
    const isMarkdown = extension === ".md" || extension === ".markdown";
    const language = isMarkdown ? markdown() : [];

    view.dispatch({
      effects: languageCompartment.reconfigure(language)
    });
    host.dataset.syntax = isMarkdown ? "markdown" : "plain";
  };

  setSyntaxForFile(null);

  return {
    focus: () => {
      view.focus();
    },
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        selection: CodeMirrorSelection.cursor(0)
      });
    },
    setSyntaxForFile,
    setPlaceholder: (value) => {
      view.dispatch({
        effects: placeholderCompartment.reconfigure(placeholder(value))
      });
    },
    setDisabled: (disabled) => {
      view.dispatch({
        effects: [
          editableCompartment.reconfigure(EditorView.editable.of(!disabled)),
          readOnlyCompartment.reconfigure(EditorState.readOnly.of(disabled))
        ]
      });
      host.dataset.disabled = disabled ? "true" : "false";
    },
    setLineHeight: (value) => {
      host.style.setProperty("--editor-line-height", String(value));
    },
    setParagraphSpacing: (value: AppSettings["editorParagraphSpacing"]) => {
      host.dataset.paragraphSpacing = value;
    },
    setFontFamily: (value) => {
      host.style.setProperty("--editor-font-family", value);
    },
    setFontSize: (value) => {
      host.style.setProperty("--editor-font-size", `${value}px`);
    },
    getComputedFontSize: () => Number.parseFloat(window.getComputedStyle(view.contentDOM).fontSize),
    getSelection: () => ({
      start: view.state.selection.main.from,
      end: view.state.selection.main.to
    }),
    replaceSelection: (value) => {
      const selection = view.state.changeByRange((range) => ({
        changes: { from: range.from, to: range.to, insert: value },
        range: CodeMirrorSelection.cursor(range.from + value.length)
      }));

      view.dispatch(view.state.update(selection, { scrollIntoView: true, userEvent: "input" }));
    },
    onInput: (listener) => {
      inputListeners.add(listener);
      return () => {
        inputListeners.delete(listener);
      };
    },
    onKeydown: (listener) => {
      keydownListeners.add(listener);
      return () => {
        keydownListeners.delete(listener);
      };
    },
    onBlur: (listener) => {
      blurListeners.add(listener);
      return () => {
        blurListeners.delete(listener);
      };
    },
    destroy: () => {
      inputListeners.clear();
      keydownListeners.clear();
      blurListeners.clear();
      view.destroy();
    }
  };
}
