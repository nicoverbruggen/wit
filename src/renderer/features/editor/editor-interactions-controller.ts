import { computeSmartQuoteReplacement, isSmartQuoteCharacter } from "./smart-quotes.js";

export type EditorInteractionsController = {
  onEditorInput: () => void;
  onEditorBlur: () => void;
  onEditorKeydown: (event: KeyboardEvent) => void;
};

export function createEditorInteractionsController(options: {
  getSuppressDirtyEvents: () => boolean;
  setSuppressDirtyEvents: (value: boolean) => void;
  getSmartQuotesEnabled: () => boolean;
  getEditorSelection: () => { start: number; end: number };
  getEditorValue: () => string;
  replaceEditorSelection: (value: string) => void;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  handleUserEdit: () => void;
  setSidebarFaded: (nextFaded: boolean) => void;
}): EditorInteractionsController {
  const insertSmartQuote = (quoteCharacter: string): void => {
    const { start, end } = options.getEditorSelection();
    const value = options.getEditorValue();
    if (!isSmartQuoteCharacter(quoteCharacter)) {
      return;
    }

    const replacement = computeSmartQuoteReplacement({
      text: value,
      start,
      end,
      quoteCharacter
    });

    // Use replaceSelection while suppressing dirty events to preserve browser undo behavior.
    options.setSuppressDirtyEvents(true);
    options.replaceEditorSelection(replacement);
    options.setSuppressDirtyEvents(false);
    options.handleUserEdit();
  };

  const onEditorInput = (): void => {
    if (options.getSuppressDirtyEvents()) {
      return;
    }

    options.handleUserEdit();
  };

  const onEditorBlur = (): void => {
    options.setSidebarFaded(false);
  };

  const onEditorKeydown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void options.persistCurrentFile(true);
      return;
    }

    if (!options.getSmartQuotesEnabled()) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isSmartQuoteCharacter(event.key)) {
      event.preventDefault();
      insertSmartQuote(event.key);
    }
  };

  return {
    onEditorInput,
    onEditorBlur,
    onEditorKeydown
  };
}
