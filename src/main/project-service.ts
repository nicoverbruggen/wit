export { ensureProjectInitialized } from "./project-service/project-init";

export {
  createProjectFile,
  createProjectFolder,
  deleteProjectEntry,
  listProjectFiles,
  listProjectFolders,
  moveProjectFile,
  readProjectFile,
  renameProjectEntry,
  saveProjectFile,
  saveProjectFileSync
} from "./project-service/project-files";

export {
  getLastOpenedFilePath,
  loadSettings,
  saveLastOpenedFilePath,
  saveSettings
} from "./project-service/project-config";

export { addWritingSeconds, getProjectStats } from "./project-service/project-stats";

export {
  calculateTotalWordCount,
  getGitRepositoryStatus,
  getProjectMetadata
} from "./project-service/project-metadata";

export {
  hasGitInitialCommit,
  initializeGitRepository,
  listGitRemotes
} from "./project-service/project-git";

export { getSnapshotDirectory } from "./project-service/project-paths";
