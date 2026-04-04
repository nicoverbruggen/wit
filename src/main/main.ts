import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";
import {
  addWritingSeconds,
  calculateTotalWordCount,
  createProjectFile,
  createProjectFolder,
  deleteProjectEntry,
  ensureProjectInitialized,
  getProjectMetadata,
  getProjectStats,
  getSnapshotDirectory,
  listProjectFiles,
  listProjectFolders,
  loadSettings,
  moveProjectFile,
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
  ProjectMetadata
} from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let activeProjectPath: string | null = null;

function resetWindowZoomToDefault(browserWindow: BrowserWindow): void {
  browserWindow.webContents.setZoomLevel(0);
  browserWindow.webContents.setZoomFactor(1);
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
      sandbox: false
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
            height: 34
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
  return getProjectMetadata(projectPath);
}

async function runAutosaveTick(activeSeconds: number): Promise<AutosaveTickResult> {
  const projectPath = requireActiveProjectPath();

  if (activeSeconds > 0) {
    await addWritingSeconds(projectPath, activeSeconds);
  }

  const [settings, files] = await Promise.all([loadSettings(projectPath), listProjectFiles(projectPath)]);

  const snapshotCreatedAt = await createSnapshot({
    projectPath,
    snapshotDirectory: getSnapshotDirectory(projectPath),
    filePaths: files,
    createGitCommit: settings.gitSnapshots
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

  ipcMain.handle("project:update-settings", async (_event, settings: AppSettings) => {
    const saved = await saveSettings(requireActiveProjectPath(), settings);
    return saved;
  });

  ipcMain.handle("project:autosave-tick", async (_event, activeSeconds: number) => {
    return runAutosaveTick(activeSeconds);
  });

  ipcMain.handle("app:version", () => app.getVersion());
}

app.whenReady().then(() => {
  setupIpcHandlers();
  setupMenu();

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
