import path from "node:path";
import { promises as fs } from "node:fs";
import {
  addWritingSeconds,
  calculateTotalWordCount,
  ensureProjectInitialized,
  getGitRepositoryStatus,
  getProjectMetadata,
  getProjectStats,
  getSnapshotDirectory,
  listProjectFiles,
  loadSettings
} from "./project-service";
import { createSnapshot } from "./snapshot-service";
import type { AppSettings, AutosaveTickResult, ProjectMetadata } from "../shared/types";

const LAST_PROJECT_STATE_FILE_NAME = "last-project.json";

type ProjectSessionServiceOptions = {
  getUserDataPath: () => string;
};

function getLastProjectStatePath(getUserDataPath: () => string): string {
  return path.join(getUserDataPath(), LAST_PROJECT_STATE_FILE_NAME);
}

async function saveLastProjectPath(getUserDataPath: () => string, projectPath: string): Promise<void> {
  const statePath = getLastProjectStatePath(getUserDataPath);
  const payload = { projectPath };
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function clearLastProjectPath(getUserDataPath: () => string): Promise<void> {
  try {
    await fs.rm(getLastProjectStatePath(getUserDataPath), { force: true });
  } catch {
    // Ignore best-effort cleanup failures.
  }
}

async function loadLastProjectPath(getUserDataPath: () => string): Promise<string | null> {
  try {
    const raw = await fs.readFile(getLastProjectStatePath(getUserDataPath), "utf8");
    const parsed = JSON.parse(raw) as { projectPath?: unknown };

    if (typeof parsed.projectPath === "string" && parsed.projectPath.trim().length > 0) {
      return parsed.projectPath;
    }
  } catch {
    // Ignore malformed/missing state and start without an active project.
  }

  return null;
}

function buildSnapshotOptions(
  projectPath: string,
  settings: AppSettings,
  files: string[],
  gitRepository: boolean,
  commitMessage: string
): Parameters<typeof createSnapshot>[0] {
  return {
    projectPath,
    snapshotDirectory: getSnapshotDirectory(projectPath),
    filePaths: files,
    snapshotMaxSizeMb: settings.snapshotMaxSizeMb,
    createGitCommit: settings.gitSnapshots && gitRepository,
    pushGitCommit: settings.gitSnapshots && settings.gitPushRemote !== null && gitRepository,
    gitPushRemote: settings.gitPushRemote,
    commitMessage
  };
}

export function createProjectSessionService(options: ProjectSessionServiceOptions) {
  let activeProjectPath: string | null = null;

  function requireActiveProjectPath(): string {
    if (!activeProjectPath) {
      throw new Error("No project is currently open.");
    }

    return activeProjectPath;
  }

  async function openProject(projectPath: string): Promise<ProjectMetadata> {
    await ensureProjectInitialized(projectPath);
    activeProjectPath = projectPath;
    void saveLastProjectPath(options.getUserDataPath, projectPath).catch(() => {
      // Non-blocking persistence; keep project opening even if write fails.
    });
    return getProjectMetadata(projectPath);
  }

  async function getActiveProject(): Promise<ProjectMetadata | null> {
    if (!activeProjectPath) {
      return null;
    }

    return getProjectMetadata(activeProjectPath);
  }

  async function closeProject(): Promise<null> {
    if (activeProjectPath) {
      await runExitSnapshot(activeProjectPath);
    }

    activeProjectPath = null;
    await clearLastProjectPath(options.getUserDataPath);
    return null;
  }

  async function restoreLastProjectFromDisk(): Promise<void> {
    const lastProjectPath = await loadLastProjectPath(options.getUserDataPath);
    if (!lastProjectPath) {
      return;
    }

    try {
      const stats = await fs.stat(lastProjectPath);
      if (!stats.isDirectory()) {
        await clearLastProjectPath(options.getUserDataPath);
        return;
      }
    } catch {
      await clearLastProjectPath(options.getUserDataPath);
      return;
    }

    try {
      await openProject(lastProjectPath);
    } catch {
      await clearLastProjectPath(options.getUserDataPath);
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

    const snapshotCreatedAt = await createSnapshot(
      buildSnapshotOptions(projectPath, settings, files, gitRepository, "automatic snapshot")
    );

    const [wordCount, stats] = await Promise.all([calculateTotalWordCount(projectPath), getProjectStats(projectPath)]);

    return {
      wordCount,
      totalWritingSeconds: stats.totalWritingSeconds,
      snapshotCreatedAt
    };
  }

  async function runExitSnapshot(projectPath = requireActiveProjectPath()): Promise<void> {
    try {
      const [settings, files, gitRepository] = await Promise.all([
        loadSettings(projectPath),
        listProjectFiles(projectPath),
        getGitRepositoryStatus(projectPath)
      ]);

      await createSnapshot(buildSnapshotOptions(projectPath, settings, files, gitRepository, "exit snapshot"));
    } catch (error) {
      console.warn("Exit snapshot failed.", error);
    }
  }

  return {
    requireActiveProjectPath,
    openProject,
    getActiveProject,
    closeProject,
    restoreLastProjectFromDisk,
    runAutosaveTick,
    runExitSnapshot,
    hasActiveProject: (): boolean => activeProjectPath !== null,
    getActiveProjectPath: (): string | null => activeProjectPath
  };
}
