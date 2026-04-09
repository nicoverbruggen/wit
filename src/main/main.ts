import path from "node:path";
import { promises as fs } from "node:fs";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions
} from "electron";
import {
  addWritingSeconds,
  calculateTotalWordCount,
  createProjectFile,
  createProjectFolder,
  deleteProjectEntry,
  ensureProjectInitialized,
  getProjectMetadata,
  getProjectStats,
  getGitRepositoryStatus,
  getSnapshotDirectory,
  listProjectFiles,
  listProjectFolders,
  loadSettings,
  moveProjectFile,
  renameProjectEntry,
  readProjectFile,
  saveProjectFile,
  saveProjectFileSync,
  saveSettings
} from "./project-service";
import { createSnapshot } from "./snapshot-service";
import { countWordsUsingSystemTool } from "./word-count-service";
import type {
  AppSettings,
  AutosaveTickResult,
  DeleteEntryPayload,
  MoveFilePayload,
  NewFilePayload,
  NewFolderPayload,
  ProjectMetadata,
  RenameEntryPayload,
  ShowTreeContextMenuPayload,
  TreeContextAction
} from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let activeProjectPath: string | null = null;
const LAST_PROJECT_STATE_FILE_NAME = "last-project.json";

function getLastProjectStatePath(): string {
  return path.join(app.getPath("userData"), LAST_PROJECT_STATE_FILE_NAME);
}

async function saveLastProjectPath(projectPath: string): Promise<void> {
  const statePath = getLastProjectStatePath();
  const payload = { projectPath };
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function clearLastProjectPath(): Promise<void> {
  try {
    await fs.rm(getLastProjectStatePath(), { force: true });
  } catch {
    // Ignore best-effort cleanup failures.
  }
}

async function loadLastProjectPath(): Promise<string | null> {
  try {
    const raw = await fs.readFile(getLastProjectStatePath(), "utf8");
    const parsed = JSON.parse(raw) as { projectPath?: unknown };

    if (typeof parsed.projectPath === "string" && parsed.projectPath.trim().length > 0) {
      return parsed.projectPath;
    }
  } catch {
    // Ignore malformed/missing state and start without an active project.
  }

  return null;
}

function resetWindowZoomToDefault(browserWindow: BrowserWindow): void {
  browserWindow.webContents.setZoomLevel(0);
  browserWindow.webContents.setZoomFactor(1);
}

function buildEditableContextMenuTemplate(params: Electron.ContextMenuParams): MenuItemConstructorOptions[] {
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
    browserWindow.webContents.send("window:fullscreen-changed", browserWindow.isFullScreen());
  };

  browserWindow.on("enter-full-screen", emitFullscreenState);
  browserWindow.on("leave-full-screen", emitFullscreenState);
}

function createMainWindow(): BrowserWindow {
  const sharedWindowOptions = {
    width: 1240,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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
      ? { titleBarStyle: "hiddenInset" as const }
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
  const emitMenuEvent = (channel: string): void => {
    mainWindow?.webContents.send(channel);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            emitMenuEvent("menu:open-project");
          }
        },
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            emitMenuEvent("menu:new-file");
          }
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            emitMenuEvent("menu:save-current-file");
          }
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
          click: () => {
            emitMenuEvent("menu:toggle-sidebar");
          }
        },
        { type: "separator" },
        {
          label: "Zoom In Editor Text",
          accelerator: "CmdOrCtrl+=",
          click: () => {
            emitMenuEvent("menu:zoom-in-text");
          }
        },
        {
          label: "Zoom Out Editor Text",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            emitMenuEvent("menu:zoom-out-text");
          }
        },
        {
          label: "Reset Editor Text Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            emitMenuEvent("menu:zoom-reset-text");
          }
        },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

function requireActiveProjectPath(): string {
  if (!activeProjectPath) {
    throw new Error("No project is currently open.");
  }

  return activeProjectPath;
}

async function openProject(projectPath: string): Promise<ProjectMetadata> {
  await ensureProjectInitialized(projectPath);
  activeProjectPath = projectPath;
  void saveLastProjectPath(projectPath).catch(() => {
    // Non-blocking persistence; keep project opening even if write fails.
  });
  return getProjectMetadata(projectPath);
}

async function restoreLastProjectFromDisk(): Promise<void> {
  const lastProjectPath = await loadLastProjectPath();
  if (!lastProjectPath) {
    return;
  }

  try {
    const stats = await fs.stat(lastProjectPath);
    if (!stats.isDirectory()) {
      await clearLastProjectPath();
      return;
    }
  } catch {
    await clearLastProjectPath();
    return;
  }

  try {
    await openProject(lastProjectPath);
  } catch {
    await clearLastProjectPath();
  }
}

async function runAutosaveTick(activeSeconds: number): Promise<AutosaveTickResult> {
  const projectPath = requireActiveProjectPath();

  if (activeSeconds > 0) {
    await addWritingSeconds(projectPath, activeSeconds);
  }

  const [settings, files, gitRepository] = await Promise.all([
    loadSettings(projectPath),
    listProjectFiles(projectPath),
    getGitRepositoryStatus(projectPath)
  ]);

  const snapshotCreatedAt = await createSnapshot({
    projectPath,
    snapshotDirectory: getSnapshotDirectory(projectPath),
    filePaths: files,
    createGitCommit: settings.gitSnapshots && gitRepository
  });

  const [wordCount, stats] = await Promise.all([
    calculateTotalWordCount(projectPath),
    getProjectStats(projectPath)
  ]);

  return {
    wordCount,
    totalWritingSeconds: stats.totalWritingSeconds,
    snapshotCreatedAt
  };
}

function setupIpcHandlers(): void {
  ipcMain.handle("project:select", async () => {
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
    return openProject(selectedPath);
  });

  ipcMain.handle("project:get-active", async () => {
    if (!activeProjectPath) {
      return null;
    }

    return getProjectMetadata(activeProjectPath);
  });

  ipcMain.handle("project:close", async () => {
    activeProjectPath = null;
    await clearLastProjectPath();
    return null;
  });

  ipcMain.handle("window:toggle-fullscreen", () => {
    if (!mainWindow) {
      return false;
    }

    const nextState = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(nextState);
    return nextState;
  });

  ipcMain.handle("project:open-path", async (_event, projectPath: string) => {
    return openProject(projectPath);
  });

  ipcMain.handle("project:open-file", async (_event, relativePath: string) => {
    return readProjectFile(requireActiveProjectPath(), relativePath);
  });

  ipcMain.handle("project:save-file", async (_event, relativePath: string, content: string) => {
    await saveProjectFile(requireActiveProjectPath(), relativePath, content);
    return true;
  });

  ipcMain.handle("project:get-word-count", async () => {
    return calculateTotalWordCount(requireActiveProjectPath());
  });

  ipcMain.handle("project:count-preview-words", async (_event, text: string) => {
    return countWordsUsingSystemTool(text);
  });

  ipcMain.on("project:save-file-sync", (event, relativePath: string, content: string) => {
    try {
      saveProjectFileSync(requireActiveProjectPath(), relativePath, content);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.handle("project:new-file", async (_event, payload: NewFilePayload) => {
    await createProjectFile(requireActiveProjectPath(), payload.relativePath, payload.initialContent ?? "");
    return listProjectFiles(requireActiveProjectPath());
  });

  ipcMain.handle("project:new-folder", async (_event, payload: NewFolderPayload) => {
    await createProjectFolder(requireActiveProjectPath(), payload.relativePath);
    return listProjectFolders(requireActiveProjectPath());
  });

  ipcMain.handle("project:delete-entry", async (_event, payload: DeleteEntryPayload) => {
    const projectPath = requireActiveProjectPath();
    await deleteProjectEntry(projectPath, payload.relativePath, payload.kind);
    return getProjectMetadata(projectPath);
  });

  ipcMain.handle("project:move-file", async (_event, payload: MoveFilePayload) => {
    const projectPath = requireActiveProjectPath();
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

  ipcMain.handle("project:rename-entry", async (_event, payload: RenameEntryPayload) => {
    const projectPath = requireActiveProjectPath();
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

  ipcMain.handle("project:show-tree-context-menu", async (event, payload: ShowTreeContextMenuPayload) => {
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

      const menuTemplate: MenuItemConstructorOptions[] =
        payload.kind === "project"
          ? [
              {
                label: "New File",
                click: () => {
                  resolveOnce("new-file");
                }
              },
              {
                label: "New Folder",
                click: () => {
                  resolveOnce("new-folder");
                }
              },
              { type: "separator" },
              {
                label: "Close Project",
                click: () => {
                  resolveOnce("close-project");
                }
              }
            ]
          : payload.kind === "folder"
            ? [
                {
                  label: "New File",
                  click: () => {
                    resolveOnce("new-file");
                  }
                },
                {
                  label: "New Folder",
                  click: () => {
                    resolveOnce("new-folder");
                  }
                },
                { type: "separator" },
                {
                  label: "Rename",
                  click: () => {
                    resolveOnce("rename");
                  }
                },
                { type: "separator" },
                {
                  label: "Delete",
                  click: () => {
                    resolveOnce("delete");
                  }
                }
              ]
          : [
              {
                label: "Rename",
                click: () => {
                  resolveOnce("rename");
                }
              },
              { type: "separator" },
              {
                label: "Delete",
                click: () => {
                  resolveOnce("delete");
                }
              }
            ];

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

  ipcMain.handle("project:update-settings", async (_event, settings: AppSettings) => {
    const saved = await saveSettings(requireActiveProjectPath(), settings);
    return saved;
  });

  ipcMain.handle("project:autosave-tick", async (_event, activeSeconds: number) => {
    return runAutosaveTick(activeSeconds);
  });

  ipcMain.handle("app:version", () => app.getVersion());
}

app.whenReady().then(async () => {
  setupIpcHandlers();
  setupMenu();
  await restoreLastProjectFromDisk();

  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
