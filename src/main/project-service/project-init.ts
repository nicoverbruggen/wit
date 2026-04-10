import path from "node:path";
import { promises as fs } from "node:fs";
import { SNAPSHOT_SYSTEM_VERSION, SNAPSHOT_VERSION_FILE_NAME } from "../snapshot-service";
import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_STATS,
  getConfigPath,
  getGitignorePath,
  getStatsPath,
  getWitDir,
  SNAPSHOT_DIR_NAME
} from "./project-paths";

const initializedProjects = new Set<string>();

async function ensureJsonFile<T>(filePath: string, fallback: T): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function ensureGitignoreFile(projectPath: string): Promise<void> {
  const gitignorePath = getGitignorePath(projectPath);

  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, ".wit/snapshots/\n", "utf8");
  }
}

export async function ensureProjectInitialized(projectPath: string): Promise<void> {
  const normalizedProjectPath = path.resolve(projectPath);
  if (initializedProjects.has(normalizedProjectPath)) {
    return;
  }

  const witDir = getWitDir(projectPath);
  const snapshotDir = path.join(witDir, SNAPSHOT_DIR_NAME);

  await fs.mkdir(witDir, { recursive: true });
  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotDir, SNAPSHOT_VERSION_FILE_NAME),
    `${JSON.stringify({ version: SNAPSHOT_SYSTEM_VERSION }, null, 2)}\n`,
    "utf8"
  );

  await ensureJsonFile(getConfigPath(projectPath), DEFAULT_PROJECT_CONFIG);
  await ensureJsonFile(getStatsPath(projectPath), DEFAULT_STATS);
  await ensureGitignoreFile(projectPath);
  initializedProjects.add(normalizedProjectPath);
}
