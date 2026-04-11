/**
 * Owns: smart-quote replacement rules used while typing in the editor.
 * Out of scope: keybinding policy and editor mutation side effects.
 * Inputs/Outputs: quote character + text selection context in, replacement text out.
 * Side effects: none.
 */

export type SmartQuoteCharacter = "'" | '"';

/**
 * Returns whether a keyboard key should be treated as a smart-quote trigger.
 *
 * @param key Raw keyboard event key.
 * @returns `true` for single/double quote characters, else `false`.
 */
export function isSmartQuoteCharacter(key: string): key is SmartQuoteCharacter {
  return key === "'" || key === '"';
}

/**
 * Computes the text that should be inserted for smart quote behavior.
 *
 * @param options.text Current editor text.
 * @param options.start Selection start offset.
 * @param options.end Selection end offset.
 * @param options.quoteCharacter Triggering quote character.
 * @returns Replacement text to insert at the current selection.
 */
export function computeSmartQuoteReplacement(options: {
  text: string;
  start: number;
  end: number;
  quoteCharacter: SmartQuoteCharacter;
}): string {
  const quotePair = options.quoteCharacter === "'" ? ["‘", "’"] : ["“", "”"];

  if (options.start !== options.end) {
    const selected = options.text.slice(options.start, options.end);
    return `${quotePair[0]}${selected}${quotePair[1]}`;
  }

  const previousCharacter = options.start > 0 ? options.text[options.start - 1] : "";
  const shouldUseOpeningQuote = options.start === 0 || /[\s([{<-]/.test(previousCharacter);
  return shouldUseOpeningQuote ? quotePair[0] : quotePair[1];
}
