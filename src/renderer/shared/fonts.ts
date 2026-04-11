/**
 * Owns: editor font stack construction and font select population/discovery helpers.
 * Out of scope: applying fonts to editor UI or persisting font choices.
 * Inputs/Outputs: font family names and select elements in, resolved options and family lists out.
 * Side effects: mutates the provided font select element.
 */
/**
 * Builds the CSS font-family stack used for a selected editor font.
 *
 * @param fontFamily Primary editor font family.
 * @returns A serif fallback stack prefixed with the requested family.
 */
export function buildEditorFontStack(fontFamily: string): string {
  return `"${fontFamily}", "Palatino", "Times New Roman", serif`;
}

/**
 * Populates the editor font select with built-in and discovered system fonts.
 *
 * @param options Select population inputs and current selection state.
 * @returns The resolved selected font after population.
 */
export function populateFontSelect(options: {
  select: HTMLSelectElement;
  builtInFonts: readonly string[];
  systemFontFamilies: string[];
  selectedFont: string;
  defaultFont: string;
}): string {
  const { select, builtInFonts, systemFontFamilies, selectedFont, defaultFont } = options;
  select.innerHTML = "";

  const seenValues = new Set<string>();
  const appendOption = (value: string, label = value): void => {
    if (seenValues.has(value)) {
      return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.style.fontFamily = buildEditorFontStack(value);
    select.appendChild(option);
    seenValues.add(value);
  };

  for (const fontName of builtInFonts) {
    appendOption(fontName);
  }

  if (systemFontFamilies.length > 0) {
    const separator = document.createElement("option");
    separator.disabled = true;
    separator.textContent = "\u2014\u2014 System Fonts \u2014\u2014";
    separator.style.fontFamily = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
    select.appendChild(separator);

    for (const fontName of systemFontFamilies) {
      appendOption(fontName);
    }
  }

  if (selectedFont && !seenValues.has(selectedFont)) {
    appendOption(selectedFont, `${selectedFont} (Current)`);
  }

  const resolvedFont = seenValues.has(selectedFont) ? selectedFont : defaultFont;
  select.value = resolvedFont;
  select.style.fontFamily = buildEditorFontStack(resolvedFont);
  return resolvedFont;
}

type LocalFontData = {
  family: string;
};

type WindowWithLocalFonts = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

/**
 * Loads local font family names when the browser environment supports it.
 *
 * @param windowRef Window used to query local fonts.
 * @param builtInFonts Built-in font names that should be excluded from the system section.
 * @returns Sorted unique system font families, or an empty list when unavailable.
 */
export async function loadSystemFontFamilies(
  windowRef: Window,
  builtInFonts: readonly string[]
): Promise<string[]> {
  const fontWindow = windowRef as WindowWithLocalFonts;
  if (typeof fontWindow.queryLocalFonts !== "function") {
    return [];
  }

  try {
    const localFonts = await fontWindow.queryLocalFonts();
    const uniqueFamilies = new Set<string>();

    for (const font of localFonts) {
      if (typeof font.family !== "string") {
        continue;
      }

      const normalizedFamily = font.family.trim();
      if (!normalizedFamily || builtInFonts.includes(normalizedFamily)) {
        continue;
      }

      uniqueFamilies.add(normalizedFamily);
    }

    return [...uniqueFamilies].sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
