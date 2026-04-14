/**
 * Owns: Cmd/Ctrl+P quick-open palette for project files.
 * Out of scope: file tree rendering and IPC.
 * Inputs/Outputs: project file list in, fuzzy-filtered open action out.
 * Side effects: injects overlay DOM and binds a window keydown listener.
 */
import type { ProjectMetadata } from "../../shared/types";

export type CommandPaletteOptions = {
  getProject: () => ProjectMetadata | null;
  openFile: (relativePath: string) => Promise<void>;
};

export type CommandPaletteHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

type ScoredEntry = {
  path: string;
  score: number;
  matches: Set<number>;
};

const MAX_RESULTS = 50;

export function installCommandPalette(options: CommandPaletteOptions): CommandPaletteHandle {
  const overlay = document.createElement("div");
  overlay.id = "command-palette-overlay";
  overlay.className = "command-palette-overlay";
  overlay.hidden = true;

  const panel = document.createElement("div");
  panel.className = "command-palette";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Quick open file");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "command-palette-input";
  input.placeholder = "Type a file name…";
  input.autocomplete = "off";
  input.spellcheck = false;

  const list = document.createElement("ul");
  list.className = "command-palette-results";
  list.setAttribute("role", "listbox");

  const empty = document.createElement("p");
  empty.className = "command-palette-empty";
  empty.textContent = "No matches.";
  empty.hidden = true;

  panel.append(input, list, empty);
  overlay.append(panel);
  document.body.appendChild(overlay);

  let results: ScoredEntry[] = [];
  let selectedIndex = 0;

  const isOpen = (): boolean => !overlay.hidden;

  const render = (): void => {
    list.innerHTML = "";
    if (results.length === 0) {
      empty.hidden = input.value.trim().length === 0;
      return;
    }
    empty.hidden = true;

    for (let index = 0; index < results.length; index += 1) {
      const entry = results[index];
      const item = document.createElement("li");
      item.className = "command-palette-result";
      item.setAttribute("role", "option");
      if (index === selectedIndex) {
        item.classList.add("is-selected");
        item.setAttribute("aria-selected", "true");
      }

      const label = document.createElement("span");
      label.className = "command-palette-result-name";
      const basenameStart = Math.max(
        entry.path.lastIndexOf("/"),
        entry.path.lastIndexOf("\\")
      ) + 1;
      label.append(...renderMatches(entry.path.slice(basenameStart), entry.matches, basenameStart));

      const sub = document.createElement("span");
      sub.className = "command-palette-result-path";
      if (basenameStart > 0) {
        sub.append(...renderMatches(entry.path.slice(0, basenameStart - 1), entry.matches, 0));
      }

      item.append(label, sub);
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectedIndex = index;
        void commit();
      });
      list.appendChild(item);
    }
  };

  const updateResults = (): void => {
    const project = options.getProject();
    const query = input.value.trim();
    if (!project) {
      results = [];
    } else if (query.length === 0) {
      results = project.files.slice(0, MAX_RESULTS).map((path) => ({
        path,
        score: 0,
        matches: new Set<number>()
      }));
    } else {
      results = fuzzyFilter(project.files, query).slice(0, MAX_RESULTS);
    }
    selectedIndex = 0;
    render();
  };

  const open = (): void => {
    if (!options.getProject()) return;
    overlay.hidden = false;
    input.value = "";
    updateResults();
    requestAnimationFrame(() => input.focus());
  };

  const close = (): void => {
    overlay.hidden = true;
    input.value = "";
    list.innerHTML = "";
  };

  const commit = async (): Promise<void> => {
    const entry = results[selectedIndex];
    if (!entry) return;
    close();
    await options.openFile(entry.path);
  };

  input.addEventListener("input", updateResults);

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length > 0) {
        selectedIndex = (selectedIndex + 1) % results.length;
        render();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) {
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        render();
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });

  const toggle = (): void => {
    if (isOpen()) close();
    else open();
  };

  return {
    open,
    close,
    toggle
  };
}

function renderMatches(text: string, matches: Set<number>, offset: number): Node[] {
  const nodes: Node[] = [];
  let buffer = "";
  let bufferMatched = false;

  const flush = (): void => {
    if (buffer.length === 0) return;
    if (bufferMatched) {
      const span = document.createElement("span");
      span.className = "command-palette-match";
      span.textContent = buffer;
      nodes.push(span);
    } else {
      nodes.push(document.createTextNode(buffer));
    }
    buffer = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const matched = matches.has(offset + index);
    if (matched !== bufferMatched) {
      flush();
      bufferMatched = matched;
    }
    buffer += text[index];
  }
  flush();
  return nodes;
}

function fuzzyFilter(files: readonly string[], query: string): ScoredEntry[] {
  const lowerQuery = query.toLowerCase();
  const scored: ScoredEntry[] = [];

  for (const path of files) {
    const match = scorePath(path, lowerQuery);
    if (match) scored.push({ path, score: match.score, matches: match.matches });
  }

  scored.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path));
  return scored;
}

function scorePath(path: string, lowerQuery: string): { score: number; matches: Set<number> } | null {
  const lower = path.toLowerCase();
  const basenameStart = Math.max(lower.lastIndexOf("/"), lower.lastIndexOf("\\")) + 1;
  const matches = new Set<number>();
  let queryIndex = 0;
  let score = 0;
  let consecutive = 0;

  for (let pathIndex = 0; pathIndex < lower.length && queryIndex < lowerQuery.length; pathIndex += 1) {
    if (lower[pathIndex] === lowerQuery[queryIndex]) {
      matches.add(pathIndex);
      queryIndex += 1;
      consecutive += 1;
      score += 1 + consecutive;
      if (pathIndex >= basenameStart) score += 2;
      if (pathIndex === basenameStart) score += 4;
      if (pathIndex > 0 && (lower[pathIndex - 1] === "/" || lower[pathIndex - 1] === "\\" || lower[pathIndex - 1] === "-" || lower[pathIndex - 1] === "_" || lower[pathIndex - 1] === ".")) {
        score += 2;
      }
    } else {
      consecutive = 0;
    }
  }

  if (queryIndex < lowerQuery.length) return null;
  return { score, matches };
}
