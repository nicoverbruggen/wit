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
  type Range,
  StateField,
  RangeSetBuilder,
  type Transaction
} from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentMore, insertTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  type DecorationSet
} from "@codemirror/view";
import type { AppSettings } from "../../shared/types";
import type { EditorAdapter } from "./adapter";

const newlineSpacingDecoration = Decoration.line({
  attributes: {
    class: "cm-wit-newline-spaced"
  }
});

function isMarkdownListLine(text: string): boolean {
  return /^\s*(?:[-+*]|\d+[.)])\s+/.test(text);
}

type LineRange = {
  startLine: number;
  endLine: number;
};

type PositionRange = {
  from: number;
  to: number;
};

function shouldDecorateLineBreak(state: EditorState, lineNumber: number): boolean {
  return lineNumber >= 2 && lineNumber <= state.doc.lines;
}

function buildLineSpacingDecorationRanges(
  state: EditorState,
  startLine = 2,
  endLine = state.doc.lines
): Range<Decoration>[] {
  const ranges: Range<Decoration>[] = [];

  const safeStartLine = Math.max(2, startLine);
  const safeEndLine = Math.min(state.doc.lines, endLine);
  for (let lineNumber = safeStartLine; lineNumber <= safeEndLine; lineNumber += 1) {
    if (!shouldDecorateLineBreak(state, lineNumber)) {
      continue;
    }

    ranges.push(newlineSpacingDecoration.range(state.doc.line(lineNumber).from));
  }

  return ranges;
}

function buildLineSpacingDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of buildLineSpacingDecorationRanges(state)) {
    builder.add(range.from, range.to, range.value);
  }

  return builder.finish();
}

function mergeLineRanges(ranges: LineRange[]): LineRange[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const sorted = [...ranges].sort((left, right) => left.startLine - right.startLine);
  const merged: LineRange[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const currentRange = sorted[index];
    const previousRange = merged[merged.length - 1];

    if (currentRange.startLine <= previousRange.endLine + 1) {
      previousRange.endLine = Math.max(previousRange.endLine, currentRange.endLine);
      continue;
    }

    merged.push(currentRange);
  }

  return merged;
}

function getAffectedLineRanges(state: EditorState, transaction: Transaction): LineRange[] {
  const ranges: LineRange[] = [];

  transaction.changes.iterChangedRanges((_fromA: number, _toA: number, fromB: number, toB: number) => {
    if (state.doc.lines < 2) {
      return;
    }

    const startPosition = Math.min(fromB, state.doc.length);
    const endPosition = Math.min(Math.max(fromB, toB), state.doc.length);
    const startLine = state.doc.lineAt(startPosition).number;
    const endLine = state.doc.lineAt(endPosition).number;
    const affectedStartLine = Math.max(2, startLine);
    const affectedEndLine = Math.min(state.doc.lines, Math.max(2, endLine + 1));

    if (affectedStartLine <= affectedEndLine) {
      ranges.push({ startLine: affectedStartLine, endLine: affectedEndLine });
    }
  });

  return mergeLineRanges(ranges);
}

function toPositionRanges(state: EditorState, ranges: LineRange[]): PositionRange[] {
  return ranges.map(({ startLine, endLine }) => ({
    from: state.doc.line(startLine).from,
    to: state.doc.line(endLine).from
  }));
}

function isOutsidePositionRanges(position: number, ranges: PositionRange[]): boolean {
  return !ranges.some(({ from, to }) => position >= from && position <= to);
}

const lineSpacingField = StateField.define<DecorationSet>({
  create(state) {
    return buildLineSpacingDecorations(state);
  },
  update(decorations, transaction) {
    if (!transaction.docChanged) {
      return decorations;
    }

    const affectedLineRanges = getAffectedLineRanges(transaction.state, transaction);
    if (affectedLineRanges.length === 0) {
      return decorations.map(transaction.changes);
    }

    const affectedPositionRanges = toPositionRanges(transaction.state, affectedLineRanges);
    return decorations.map(transaction.changes).update({
      filter: (from) => isOutsidePositionRanges(from, affectedPositionRanges),
      add: affectedLineRanges.flatMap(({ startLine, endLine }) =>
        buildLineSpacingDecorationRanges(transaction.state, startLine, endLine)
      ),
      sort: true
    });
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
  const lineSpacingCompartment = new Compartment();
  const inputListeners = new Set<() => void>();
  const keydownListeners = new Set<(event: KeyboardEvent) => void>();
  const blurListeners = new Set<() => void>();
  let markdownSyntaxEnabled = false;

  const handleTabKey = (): boolean => {
    const currentLine = view.state.doc.lineAt(view.state.selection.main.head);
    if (markdownSyntaxEnabled && isMarkdownListLine(currentLine.text)) {
      return indentMore(view);
    }

    return insertTab(view);
  };

  host.dataset.paragraphSpacing = "none";
  host.dataset.cursorStyle = "wit-default";

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: "",
      extensions: [
        EditorView.lineWrapping,
        drawSelection(),
        history(),
        keymap.of([{ key: "Tab", run: handleTabKey }, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        lineSpacingCompartment.of([]),
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
    markdownSyntaxEnabled = isMarkdown;

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
      view.dispatch({
        effects: lineSpacingCompartment.reconfigure(value === "none" ? [] : lineSpacingField)
      });
    },
    setCursorStyle: (value: AppSettings["editorCursorStyle"]) => {
      host.dataset.cursorStyle = value;
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
    setSelection: (start, end = start) => {
      const docLength = view.state.doc.length;
      const safeStart = Math.max(0, Math.min(start, docLength));
      const safeEnd = Math.max(0, Math.min(end, docLength));
      view.dispatch({
        selection: CodeMirrorSelection.range(safeStart, safeEnd),
        scrollIntoView: true
      });
    },
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
