export type EmptyStateShortcut = {
  label: string;
  key: string;
};

export function formatPrimaryShortcut(key: string, platform: string): string {
  return platform === "darwin" ? `Cmd+${key}` : `Ctrl+${key}`;
}

function parseShortcutAlternatives(shortcut: string): string[][] {
  return shortcut.split(" / ").map((alternative) => {
    const tokens: string[] = [];
    let currentToken = "";

    for (const character of alternative) {
      if (character === "+") {
        if (currentToken.trim().length > 0) {
          tokens.push(currentToken.trim());
          currentToken = "";
        } else {
          tokens.push("+");
        }

        continue;
      }

      currentToken += character;
    }

    if (currentToken.trim().length > 0) {
      tokens.push(currentToken.trim());
    }

    return tokens;
  });
}

export function renderEmptyStateShortcutRows(
  listElement: HTMLUListElement,
  shortcuts: EmptyStateShortcut[]
): void {
  listElement.innerHTML = "";

  for (const shortcut of shortcuts) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const key = document.createElement("span");
    const alternatives = parseShortcutAlternatives(shortcut.key);

    label.className = "empty-state-shortcut-label";
    label.textContent = shortcut.label;
    key.className = "empty-state-shortcut-key";

    alternatives.forEach((parts, alternativeIndex) => {
      parts.forEach((part, index) => {
        const keycap = document.createElement("span");
        keycap.className = "empty-state-shortcut-keycap";
        keycap.textContent = part;
        key.appendChild(keycap);

        if (index < parts.length - 1) {
          const separator = document.createElement("span");
          separator.className = "empty-state-shortcut-plus";
          separator.textContent = "+";
          key.appendChild(separator);
        }
      });

      if (alternativeIndex < alternatives.length - 1) {
        const separator = document.createElement("span");
        separator.className = "empty-state-shortcut-slash";
        separator.textContent = "/";
        key.appendChild(separator);
      }
    });

    item.append(label, key);
    listElement.appendChild(item);
  }
}
