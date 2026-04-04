import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";
import {
  addWritingSeconds,
  calculateTotalWordCount,
  createProjectFile,
  ensureProjectInitialized,
  getProjectMetadata,
  getProjectStats,
  getSnapshotDirectory,
  listProjectFiles,
  loadSettings,
  readProjectFile,
  saveProjectFile,
  saveProjectFileSync,
  saveSettings
} from "./project-service";
import { createSnapshot } from "./snapshot-service";
import type { AppSettings, AutosaveTickResult, NewFilePayload, ProjectMetadata } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let activeProjectPath: string | null = null;

function createMainWindow(): BrowserWindow {
  const browserWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Wit",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const entryHtml = path.join(__dirname, "../renderer/index.html");
  void browserWindow.loadFile(entryHtml);

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
