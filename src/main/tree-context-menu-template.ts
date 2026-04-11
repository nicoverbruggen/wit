/**
 * Owns: native tree context-menu template assembly for project, folder, and file entries.
 * Out of scope: menu display orchestration and action execution.
 * Inputs/Outputs: selection metadata in, Electron menu item templates out.
 * Side effects: none.
 */
import type { MenuItemConstructorOptions } from "electron";
import type { ShowTreeContextMenuPayload, TreeContextAction } from "../shared/types";

/**
 * Builds the context-menu template for a project-tree selection.
 *
 * @param options Selection kind, current-file state, and action callback.
 * @returns An Electron menu template for the requested tree node.
 */
export function buildTreeContextMenuTemplate(options: {
  kind: ShowTreeContextMenuPayload["kind"];
  isCurrentFile?: boolean;
  onAction: (action: TreeContextAction) => void;
}): MenuItemConstructorOptions[] {
  if (options.kind === "project") {
    return [
      {
        label: "New File",
        click: () => {
          options.onAction("new-file");
        }
      },
      {
        label: "New Folder",
        click: () => {
          options.onAction("new-folder");
        }
      },
      { type: "separator" },
      {
        label: "Close Project",
        click: () => {
          options.onAction("close-project");
        }
      }
    ];
  }

  if (options.kind === "folder") {
    return [
      {
        label: "New File",
        click: () => {
          options.onAction("new-file");
        }
      },
      {
        label: "New Folder",
        click: () => {
          options.onAction("new-folder");
        }
      },
      { type: "separator" },
      {
        label: "Rename",
        click: () => {
          options.onAction("rename");
        }
      },
      { type: "separator" },
      {
        label: "Delete",
        click: () => {
          options.onAction("delete");
        }
      }
    ];
  }

  return [
    ...(options.isCurrentFile
      ? [
          {
            label: "Close",
            click: () => {
              options.onAction("close-file");
            }
          },
          { type: "separator" as const }
        ]
      : []),
    {
      label: "Rename",
      click: () => {
        options.onAction("rename");
      }
    },
    { type: "separator" },
    {
      label: "Delete",
      click: () => {
        options.onAction("delete");
      }
    }
  ];
}
