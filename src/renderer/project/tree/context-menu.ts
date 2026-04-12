/**
 * Owns: context-menu target resolution for project tree DOM elements.
 * Out of scope: menu action execution and IPC calls.
 * Inputs/Outputs: raw `contextmenu` events in, typed tree target callbacks out.
 * Side effects: attaches/removes one DOM listener on the provided list element.
 */

export type ProjectTreeNodeKind = "file" | "folder";

export type ProjectTreeContextMenuBindings = {
  listElement: HTMLUListElement;
  onEmptyAreaTarget: (payload: { x: number; y: number }) => void;
  onProjectTarget: (payload: { relativePath: string; x: number; y: number }) => void;
  onNodeTarget: (payload: {
    relativePath: string;
    kind: ProjectTreeNodeKind;
    x: number;
    y: number;
  }) => void;
};

/**
 * Binds project-tree context-menu handling and returns an unsubscribe function.
 *
 * @param options DOM element and callbacks for resolved target types.
 * @returns Cleanup function that removes the registered listener.
 */
export function bindProjectTreeContextMenu(options: ProjectTreeContextMenuBindings): () => void {
  const handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();

    const target = event.target as HTMLElement | null;
    const treeItem = target?.closest("button.tree-item") as HTMLButtonElement | null;

    if (!treeItem) {
      options.onEmptyAreaTarget({ x: event.clientX, y: event.clientY });
      return;
    }

    const itemKind = treeItem.dataset.itemKind;
    if (itemKind !== "file" && itemKind !== "folder" && itemKind !== "project") {
      return;
    }

    const relativePath = treeItem.dataset.relativePath;
    if (relativePath === undefined) {
      return;
    }

    if (itemKind === "project") {
      options.onProjectTarget({
        relativePath,
        x: event.clientX,
        y: event.clientY
      });
      return;
    }

    options.onNodeTarget({
      relativePath,
      kind: itemKind === "folder" ? "folder" : "file",
      x: event.clientX,
      y: event.clientY
    });
  };

  options.listElement.addEventListener("contextmenu", handleContextMenu);
  return () => {
    options.listElement.removeEventListener("contextmenu", handleContextMenu);
  };
}
