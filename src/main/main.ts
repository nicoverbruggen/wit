/**
 * Owns: Electron main-process startup, window creation, menus, and IPC handler registration.
 * Out of scope: project service implementation details and renderer UI state.
 * Inputs/Outputs: Electron lifecycle events and IPC requests in, app windows and IPC responses out.
 * Side effects: creates windows, registers menus/context menus, and performs filesystem-backed project actions.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  app,
  BrowserWindow,
  type ContextMenuParams,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions
} from "electron";
import {
  calculateTotalWordCount,
  createProjectFile,
  createProjectFolder,
  deleteProjectEntry,
  getProjectMetadata,
  initializeGitRepository,
  listProjectFiles,
  listProjectFolders,
  moveProjectFile,
  renameProjectEntry,
  readProjectFile,
  saveLastOpenedFilePath,
  saveProjectFile,
  saveProjectFileSync,
  saveSettings
} from "./project-service";
import { createProjectSessionService } from "./project-session-service";
import { buildTreeContextMenuTemplate } from "./tree-context-menu-template";
import { countWordsUsingSystemTool } from "./word-count-service";
import type {
  AppInfo,
  DeleteEntryPayload,
  MoveFilePayload,
  NewFilePayload,
  NewFolderPayload,
  RenameEntryPayload,
  ShowTreeContextMenuPayload,
  TreeContextAction
} from "../shared/types";
import { IPC_CHANNELS } from "../shared/ipc";

let mainWindow: BrowserWindow | null = null;
const projectSession = createProjectSessionService({
  getUserDataPath: () => app.getPath("userData")
});

function resetWindowZoomToDefault(browserWindow: BrowserWindow): void {
  browserWindow.webContents.setZoomLevel(0);
  browserWindow.webContents.setZoomFactor(1);
}

function emitMenuChannel(channel: string): () => void {
  return () => {
    mainWindow?.webContents.send(channel);
  };
}

function withActiveProjectPath<Args extends unknown[], Result>(
  handler: (projectPath: string, ...args: Args) => Result | Promise<Result>
): (_event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result> {
  return (_event, ...args) => handler(projectSession.requireActiveProjectPath(), ...args);
}

function withActiveProjectMetadata<Args extends unknown[]>(
  handler: (projectPath: string, ...args: Args) => Promise<void>
): (_event: IpcMainInvokeEvent, ...args: Args) => Promise<Awaited<ReturnType<typeof getProjectMetadata>>> {
  return async (_event, ...args) => {
    const projectPath = projectSession.requireActiveProjectPath();
    await handler(projectPath, ...args);
    return getProjectMetadata(projectPath);
  };
}

async function getAppInfo(): Promise<AppInfo> {
  try {
    const packageJsonPath = path.join(app.getAppPath(), "package.json");
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      description?: unknown;
      author?: unknown;
      homepage?: unknown;
    };

    return {
      version: app.getVersion(),
      description:
        typeof parsed.description === "string" && parsed.description.trim().length > 0
          ? parsed.description.trim()
          : "Minimalist desktop writing app for plain text projects.",
      author:
        typeof parsed.author === "string" && parsed.author.trim().length > 0
          ? parsed.author.trim()
          : "Not specified",
      website:
        typeof parsed.homepage === "string" && parsed.homepage.trim().length > 0
          ? parsed.homepage.trim()
          : ""
    };
  } catch {
    return {
      version: app.getVersion(),
      description: "Minimalist desktop writing app for plain text projects.",
      author: "Not specified",
      website: ""
    };
  }
}

function buildEditableContextMenuTemplate(params: ContextMenuParams): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
    for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
      template.push({
        label: suggestion,
        click: () => {
          mainWindow?.webContents.replaceMisspelling(suggestion);
        }
      });
    }

    template.push({ type: "separator" });
  }

  template.push(
    { role: "undo" },
    { role: "redo" },
    { type: "separator" },
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    { role: "selectAll" }
  );

  return template;
}

function setupContextMenus(browserWindow: BrowserWindow): void {
  browserWindow.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable) {
      return;
    }

    const menu = Menu.buildFromTemplate(buildEditableContextMenuTemplate(params));
    menu.popup({ window: browserWindow });
  });
}

function setupWindowStateEvents(browserWindow: BrowserWindow): void {
  const emitFullscreenState = (): void => {
    browserWindow.webContents.send(IPC_CHANNELS.window.fullscreenChanged, browserWindow.isFullScreen());
  };

  browserWindow.on("enter-full-screen", emitFullscreenState);
  browserWindow.on("leave-full-screen", emitFullscreenState);
}

function createMainWindow(): BrowserWindow {
  const sharedWindowOptions = {
    width: 1240,
    height: 800,
    minWidth: 1040,
    minHeight: 700,
    title: "Wit",
    backgroundColor: "#f7f7f8",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };

  const titleBarOptions =
    process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 14 }
        }
      : {
          titleBarStyle: "hidden" as const,
          titleBarOverlay: {
            color: "#f6f6f8",
            symbolColor: "#4b5563",
            height: 36
          }
        };

  const browserWindow = new BrowserWindow({
    ...sharedWindowOptions,
    ...titleBarOptions
  });

  const entryHtml = path.join(__dirname, "../renderer/index.html");
  void browserWindow.loadFile(entryHtml);

  // Ensure app-wide webview zoom starts at 100%, independent from editor text zoom.
  resetWindowZoomToDefault(browserWindow);
  browserWindow.webContents.once("did-finish-load", () => {
    resetWindowZoomToDefault(browserWindow);
  });
  setupContextMenus(browserWindow);
  setupWindowStateEvents(browserWindow);

  return browserWindow;
}

function setupMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: emitMenuChannel(IPC_CHANNELS.menu.openProject)
        },
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: emitMenuChannel(IPC_CHANNELS.menu.newFile)
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: emitMenuChannel(IPC_CHANNELS.menu.saveCurrentFile)
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: emitMenuChannel(IPC_CHANNELS.menu.toggleSidebar)
        },
        { type: "separator" },
        {
          label: "Zoom In Editor Text",
          accelerator: "CmdOrCtrl+=",
          click: emitMenuChannel(IPC_CHANNELS.menu.zoomInText)
        },
        {
          label: "Zoom Out Editor Text",
          accelerator: "CmdOrCtrl+-",
          click: emitMenuChannel(IPC_CHANNELS.menu.zoomOutText)
        },
        {
          label: "Reset Editor Text Zoom",
          accelerator: "CmdOrCtrl+0",
          click: emitMenuChannel(IPC_CHANNELS.menu.zoomResetText)
        },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.project.select, async () => {
    if (!mainWindow) {
      return null;
    }

    const selection = await dialog.showOpenDialog(mainWindow, {
      title: "Select writing project",
      properties: ["openDirectory", "createDirectory"]
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const selectedPath = selection.filePaths[0];
    return projectSession.openProject(selectedPath);
  });

  ipcMain.handle(IPC_CHANNELS.project.getActive, async () => projectSession.getActiveProject());

  ipcMain.handle(
    IPC_CHANNELS.project.initializeGitRepository,
    withActiveProjectMetadata(async (projectPath) => {
      await initializeGitRepository(projectPath);
    })
  );

  ipcMain.handle(IPC_CHANNELS.project.close, async () => projectSession.closeProject());

  ipcMain.handle(IPC_CHANNELS.project.exitSnapshot, async () => {
    if (!projectSession.hasActiveProject()) {
      return;
    }

    await projectSession.runExitSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.window.toggleFullscreen, () => {
    if (!mainWindow) {
      return false;
    }

    const nextState = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(nextState);
    return nextState;
  });

  ipcMain.handle(IPC_CHANNELS.project.openPath, async (_event, projectPath: string) => {
    return projectSession.openProject(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.project.openFile, withActiveProjectPath(readProjectFile));

  ipcMain.handle(
    IPC_CHANNELS.project.saveFile,
    withActiveProjectPath(async (projectPath, relativePath: string, content: string) => {
      await saveProjectFile(projectPath, relativePath, content);
      return true;
    })
  );

  ipcMain.handle(IPC_CHANNELS.project.getWordCount, withActiveProjectPath(calculateTotalWordCount));

  ipcMain.handle(IPC_CHANNELS.project.countPreviewWords, async (_event, text: string) => {
    return countWordsUsingSystemTool(text);
  });

  ipcMain.on(IPC_CHANNELS.project.saveFileSync, (event, relativePath: string, content: string) => {
    try {
      saveProjectFileSync(projectSession.requireActiveProjectPath(), relativePath, content);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.project.newFile,
    withActiveProjectPath(async (projectPath, payload: NewFilePayload) => {
      await createProjectFile(projectPath, payload.relativePath, payload.initialContent ?? "");
      return listProjectFiles(projectPath);
    })
  );

  ipcMain.handle(
    IPC_CHANNELS.project.newFolder,
    withActiveProjectPath(async (projectPath, payload: NewFolderPayload) => {
      await createProjectFolder(projectPath, payload.relativePath);
      return listProjectFolders(projectPath);
    })
  );

  ipcMain.handle(
    IPC_CHANNELS.project.deleteEntry,
    withActiveProjectMetadata(async (projectPath, payload: DeleteEntryPayload) => {
      await deleteProjectEntry(projectPath, payload.relativePath, payload.kind);
    })
  );

  ipcMain.handle(IPC_CHANNELS.project.moveFile, async (_event, payload: MoveFilePayload) => {
    const projectPath = projectSession.requireActiveProjectPath();
    const nextFilePath = await moveProjectFile(
      projectPath,
      payload.fromRelativePath,
      payload.toFolderRelativePath
    );

    return {
      nextFilePath,
      metadata: await getProjectMetadata(projectPath)
    };
  });

  ipcMain.handle(IPC_CHANNELS.project.renameEntry, async (_event, payload: RenameEntryPayload) => {
    const projectPath = projectSession.requireActiveProjectPath();
    const nextRelativePath = await renameProjectEntry(
      projectPath,
      payload.relativePath,
      payload.kind,
      payload.nextRelativePath
    );

    return {
      nextRelativePath,
      metadata: await getProjectMetadata(projectPath)
    };
  });

  ipcMain.handle(IPC_CHANNELS.project.showTreeContextMenu, async (event, payload: ShowTreeContextMenuPayload) => {
    if (payload.testAction) {
      return payload.testAction;
    }

    const popupWindow = BrowserWindow.fromWebContents(event.sender);
    if (!popupWindow) {
      return null;
    }

    return new Promise<TreeContextAction | null>((resolve) => {
      let resolved = false;
      const resolveOnce = (action: TreeContextAction | null) => {
        if (resolved) {
          return;
        }

        resolved = true;
        resolve(action);
      };

      const menuTemplate = buildTreeContextMenuTemplate({
        kind: payload.kind,
        isCurrentFile: payload.isCurrentFile,
        onAction: resolveOnce
      });

      const menu = Menu.buildFromTemplate(menuTemplate);

      menu.popup({
        window: popupWindow,
        x: Math.round(payload.x),
        y: Math.round(payload.y),
        callback: () => {
          resolveOnce(null);
        }
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.project.updateSettings, withActiveProjectPath(saveSettings));

  ipcMain.handle(IPC_CHANNELS.project.setLastOpenedFilePath, withActiveProjectPath(saveLastOpenedFilePath));

  ipcMain.handle(IPC_CHANNELS.project.autosaveTick, async (_event, activeSeconds: number) => {
    return projectSession.runAutosaveTick(activeSeconds);
  });

  ipcMain.handle(IPC_CHANNELS.app.version, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.app.info, () => getAppInfo());
}

app.whenReady().then(async () => {
  setupIpcHandlers();
  setupMenu();
  await projectSession.restoreLastProjectFromDisk();

  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

let exitSnapshotDone = false;

app.on("before-quit", (event) => {
  if (exitSnapshotDone || !projectSession.hasActiveProject()) {
    return;
  }

  event.preventDefault();
  projectSession.runExitSnapshot().finally(() => {
    exitSnapshotDone = true;
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
