/**
 * Owns: the custom CodeMirror search panel DOM and synchronization with search state.
 * Out of scope: editor bootstrapping and non-search editor commands.
 * Inputs/Outputs: CodeMirror view and search state in, panel DOM and search command dispatches out.
 * Side effects: creates panel DOM, updates search state, and triggers search commands.
 */
import { EditorView, runScopeHandlers, type Panel, type ViewUpdate } from "@codemirror/view";
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  setSearchQuery
} from "@codemirror/search";

export function createWitSearchPanel(view: EditorView): Panel {
  return new WitSearchPanel(view);
}

class WitSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;

  private readonly view: EditorView;
  private query: SearchQuery;
  private readonly searchField: HTMLInputElement;
  private readonly matchCountLabel: HTMLSpanElement;

  constructor(view: EditorView) {
    this.view = view;
    this.query = getSearchQuery(view.state);

    this.searchField = this.createTextField("Find", "search", this.query.search, true);
    this.matchCountLabel = document.createElement("span");
    this.matchCountLabel.className = "wit-search-count";

    const findRow = document.createElement("div");
    findRow.className = "wit-search-row wit-search-row--find";
    const mainBar = document.createElement("div");
    mainBar.className = "wit-search-main-bar";
    mainBar.append(
      this.createLeadingIcon(),
      this.searchField,
      this.matchCountLabel,
      this.createActions([
        this.createIconButton("previous", "arrow_upward", () => findPrevious(this.view)),
        this.createIconButton("next", "arrow_downward", () => findNext(this.view)),
        this.createIconButton("close", "close", () => {
          closeSearchPanel(this.view);
        })
      ])
    );
    findRow.append(mainBar);

    this.dom = document.createElement("div");
    this.dom.className = "cm-search wit-search-panel";
    this.dom.addEventListener("keydown", (event) => this.onKeydown(event));
    this.dom.append(findRow);
    this.syncValidity();
  }

  mount(): void {
    this.searchField.select();
  }

  update(update: ViewUpdate): void {
    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
        }
      }
    }

    if (update.docChanged || update.selectionSet) {
      this.renderMatchCount();
    }
  }

  private createTextField(
    label: string,
    name: string,
    value: string,
    mainField = false
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.className = "cm-textfield wit-search-input";
    input.placeholder = this.phrase(label);
    input.setAttribute("aria-label", this.phrase(label));
    input.value = value;
    if (mainField) {
      input.setAttribute("main-field", "true");
    }
    input.addEventListener("input", () => this.commit());
    return input;
  }

  private createIconButton(label: string, iconName: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wit-search-icon-button";
    button.setAttribute("aria-label", this.phrase(label));
    button.textContent = iconName;
    button.addEventListener("click", action);
    return button;
  }

  private createLeadingIcon(): HTMLSpanElement {
    const icon = document.createElement("span");
    icon.className = "wit-search-leading-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "search";
    return icon;
  }

  private createActions(buttons: HTMLButtonElement[]): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "wit-search-actions";
    container.append(...buttons);
    return container;
  }

  private commit(): void {
    const nextQuery = new SearchQuery({
      search: this.searchField.value
    });

    if (!nextQuery.eq(this.query)) {
      this.query = nextQuery;
      this.view.dispatch({ effects: setSearchQuery.of(nextQuery) });
    }

    this.syncValidity();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (runScopeHandlers(this.view, event, "search-panel")) {
      event.preventDefault();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    if (event.target === this.searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
    }
  }

  private setQuery(query: SearchQuery): void {
    this.query = query;
    this.searchField.value = query.search;
    this.syncValidity();
  }

  private syncValidity(): void {
    this.searchField.toggleAttribute("aria-invalid", !this.query.valid);
    this.renderMatchCount();
  }

  private phrase(value: string): string {
    return this.view.state.phrase(value);
  }

  private renderMatchCount(): void {
    if (this.query.search.length === 0) {
      this.matchCountLabel.textContent = "";
      this.matchCountLabel.hidden = true;
      return;
    }

    if (!this.query.valid) {
      this.matchCountLabel.textContent = "invalid";
      this.matchCountLabel.hidden = false;
      return;
    }

    const { current, total } = this.getMatchStats();
    this.matchCountLabel.textContent = `${current}/${total}`;
    this.matchCountLabel.hidden = false;
  }

  private getMatchStats(): { current: number; total: number } {
    const selection = this.view.state.selection.main;
    const cursor = this.query.getCursor(this.view.state);
    let total = 0;
    let exact = 0;
    let nextAfterSelection = 0;

    while (true) {
      const result = cursor.next();
      if (result.done) {
        break;
      }

      total += 1;
      const match = result.value;
      if (match.from === selection.from && match.to === selection.to) {
        exact = total;
      }
      if (nextAfterSelection === 0 && match.from >= selection.to) {
        nextAfterSelection = total;
      }
    }

    if (total === 0) {
      return { current: 0, total: 0 };
    }

    return { current: exact || nextAfterSelection || 1, total };
  }
}
