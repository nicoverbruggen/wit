import type { MenuItemConstructorOptions } from "electron";
import type { ShowTreeContextMenuPayload, TreeContextAction } from "../shared/types";

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
