import path from "node:path";
import { getLatestSnapshotName } from "../snapshot-service";
import type { ProjectMetadata } from "../../shared/types";
import { countWordsInFilesUsingSystemTool } from "../word-count-service";
import { getLastOpenedFilePath, hasStoredLastOpenedFilePath, loadSettings } from "./project-config";
import { hasGitInitialCommit, listGitRemotes, isGitRepository } from "./project-git";
import { ensureProjectInitialized } from "./project-init";
import { listProjectFiles, listProjectFolders } from "./project-files";
import { getSnapshotDirectory } from "./project-paths";
import { getProjectStats } from "./project-stats";

export async function calculateTotalWordCount(projectPath: string): Promise<number> {
  const relativeFiles = await listProjectFiles(projectPath);
  const absoluteFiles = relativeFiles.map((filePath) => path.resolve(projectPath, filePath));
  return countWordsInFilesUsingSystemTool(absoluteFiles);
}

export async function getProjectMetadata(projectPath: string): Promise<ProjectMetadata> {
  await ensureProjectInitialized(projectPath);

  const [
    files,
    folders,
    settings,
    lastOpenedFilePath,
    hasStoredPath,
    wordCount,
    stats,
    gitRepository,
    gitInitialCommit,
    gitRemotes,
    latestSnapshotCreatedAt
  ] = await Promise.all([
    listProjectFiles(projectPath),
    listProjectFolders(projectPath),
    loadSettings(projectPath),
    getLastOpenedFilePath(projectPath),
    hasStoredLastOpenedFilePath(projectPath),
    calculateTotalWordCount(projectPath),
    getProjectStats(projectPath),
    isGitRepository(projectPath),
    hasGitInitialCommit(projectPath),
    listGitRemotes(projectPath),
    getLatestSnapshotName(getSnapshotDirectory(projectPath))
  ]);

  return {
    projectPath,
    files,
    folders,
    wordCount,
    totalWritingSeconds: stats.totalWritingSeconds,
    latestSnapshotCreatedAt,
    isGitRepository: gitRepository,
    hasGitInitialCommit: gitInitialCommit,
    gitRemotes,
    settings,
    lastOpenedFilePath,
    hasStoredLastOpenedFilePath: hasStoredPath
  };
}

export async function getGitRepositoryStatus(projectPath: string): Promise<boolean> {
  return isGitRepository(projectPath);
}
