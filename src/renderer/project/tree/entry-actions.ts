/**
 * Owns: file and folder creation, rename, delete, and move actions from the project tree.
 * Out of scope: dialog UI implementation and low-level filesystem APIs.
 * Inputs/Outputs: project state hooks and mutation APIs in, entry-action methods out.
 * Side effects: mutates active project metadata, active-file state, and status messages.
 */
import type { ProjectMetadata } from "../../../shared/types";
import { normalizePathInput, pathEquals } from "../../../shared/utils.js";
import {
  buildSiblingPath,
  getBaseName,
  getDropDestinationLabel,
  getParentFolderPath,
  withOriginalFileExtension
} from "../../shared/paths.js";
import { currentFileWillBeDeleted, resolveNewFilePath, resolveNewFolderPath } from "../path-rules.js";
import type { ProjectTreeSelectionKind } from "./view.js";

type RenameMoveResult = {
  nextRelativePath: string;
  metadata: ProjectMetadata;
};

type MoveFileResult = {
  nextFilePath: string;
  metadata: ProjectMetadata;
};

/**
 * Exposes project-tree entry actions.
 */
export type ProjectEntryActionsController = {
  createNewFile: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  deleteEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  renameEntryByPath: (relativePath: string, kind: ProjectTreeSelectionKind) => Promise<void>;
  moveFileToFolder: (fromRelativePath: string, toFolderRelativePath: string) => Promise<void>;
};

/**
 * Creates the project entry actions controller.
 *
 * @param options Project state accessors, dialogs, and mutation APIs.
 * @returns Actions for creating, deleting, renaming, and moving entries.
 */
export function createProjectEntryActionsController(options: {
  getProject: () => ProjectMetadata | null;
  getCurrentFilePath: () => string | null;
  setCurrentFilePath: (nextPath: string | null) => void;
  getDirty: () => boolean;
  setSelectedTree: (relativePath: string | null, kind: ProjectTreeSelectionKind | null) => void;
  getSelectedFolderPath: () => string | null;
  closeTreeContextMenu: () => void;
  askForNewFilePath: () => Promise<string | null>;
  askForNewFolderPath: () => Promise<string | null>;
  askForRenameValue: (kind: ProjectTreeSelectionKind, currentName: string) => Promise<string | null>;
  openFile: (relativePath: string) => Promise<void>;
  persistCurrentFile: (showStatus?: boolean) => Promise<boolean>;
  persistLastOpenedFilePath: (relativePath: string | null) => Promise<void>;
  resetActiveFile: () => void;
  setSidebarFaded: (nextFaded: boolean) => void;
  setActiveFileLabel: (label: string) => void;
  renderFileList: () => void;
  renderStatusFooter: () => void;
  setStatus: (message: string, clearAfterMs?: number) => void;
  newFile: (payload: { relativePath: string }) => Promise<string[]>;
  newFolder: (payload: { relativePath: string }) => Promise<string[]>;
  deleteEntry: (payload: { relativePath: string; kind: ProjectTreeSelectionKind }) => Promise<ProjectMetadata>;
  renameEntry: (payload: {
    relativePath: string;
    kind: ProjectTreeSelectionKind;
    nextRelativePath: string;
  }) => Promise<RenameMoveResult>;
  moveFile: (payload: {
    fromRelativePath: string;
    toFolderRelativePath: string;
  }) => Promise<MoveFileResult>;
}): ProjectEntryActionsController {
  const applyProjectMetadataAfterMutation = (metadata: ProjectMetadata): void => {
    const project = options.getProject();
    if (!project) {
      return;
    }

    project.files = metadata.files;
    project.folders = metadata.folders;
    project.wordCount = metadata.wordCount;
    project.totalWritingSeconds = metadata.totalWritingSeconds;
    project.settings = metadata.settings;
    options.renderStatusFooter();
    options.renderFileList();
  };

  const createNewFile = async (): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }

    const proposedName = await options.askForNewFilePath();
    if (!proposedName) {
      return;
    }

    const validation = resolveNewFilePath(project, proposedName, options.getSelectedFolderPath());
    if (!validation.relativePath) {
      options.setStatus(validation.error ?? "Could not create file.");
      return;
    }

    const relativePath = validation.relativePath;

    try {
      const files = await options.newFile({ relativePath });
      project.files = files;
      options.renderFileList();
      await options.openFile(relativePath);
      options.setStatus(`Created ${relativePath}`, 2000);
    } catch {
      options.setStatus("Could not create file. Check the path and try again.");
    }
  };

  const createNewFolder = async (): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }

    const proposedPath = await options.askForNewFolderPath();
    if (!proposedPath) {
      return;
    }

    const validation = resolveNewFolderPath(project, proposedPath, options.getSelectedFolderPath());
    if (!validation.relativePath) {
      options.setStatus(validation.error ?? "Could not create folder.");
      return;
    }

    const relativePath = validation.relativePath;

    try {
      const folders = await options.newFolder({ relativePath });
      project.folders = folders;
      options.renderFileList();
      options.setStatus(`Created folder ${relativePath}`, 2000);
    } catch {
      options.setStatus("Could not create folder. Check the path and try again.");
    }
  };

  const deleteEntryByPath = async (relativePath: string, kind: ProjectTreeSelectionKind): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }
    options.closeTreeContextMenu();

    const label = kind === "folder" ? "folder" : "file";

    const confirmed = window.confirm(
      `Delete ${label} "${relativePath}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      const metadata = await options.deleteEntry({ relativePath, kind });
      const currentFilePath = options.getCurrentFilePath();
      const deletingActiveFile = currentFileWillBeDeleted(currentFilePath, relativePath, kind);
      const deletingRememberedFile =
        project.lastOpenedFilePath !== null &&
        (kind === "file"
          ? pathEquals(project.lastOpenedFilePath, relativePath)
          : pathEquals(project.lastOpenedFilePath, relativePath) ||
            project.lastOpenedFilePath.startsWith(`${relativePath}/`));

      options.setSelectedTree(null, null);

      if (deletingActiveFile) {
        await options.persistLastOpenedFilePath(null);
        options.resetActiveFile();
        options.setSidebarFaded(false);
      } else if (deletingRememberedFile) {
        await options.persistLastOpenedFilePath(null);
      }

      applyProjectMetadataAfterMutation(metadata);
      options.setStatus(`Deleted ${label} ${relativePath}`, 2000);
    } catch {
      options.setStatus("Could not delete selected item.");
    }
  };

  const renameEntryByPath = async (relativePath: string, kind: ProjectTreeSelectionKind): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }
    options.closeTreeContextMenu();

    const currentName = getBaseName(relativePath);
    const proposedName = await options.askForRenameValue(kind, currentName);
    if (proposedName === null) {
      return;
    }

    const trimmedName = proposedName.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!trimmedName || trimmedName.includes("/")) {
      options.setStatus("Name must be a single file or folder name.");
      return;
    }

    const normalizedName = kind === "file" ? withOriginalFileExtension(trimmedName, relativePath) : trimmedName;
    const nextRelativePath = buildSiblingPath(relativePath, normalizedName);

    if (pathEquals(nextRelativePath, relativePath)) {
      options.setStatus("Name is unchanged.", 1200);
      return;
    }

    const currentFilePath = options.getCurrentFilePath();
    if (kind === "file" && options.getDirty() && currentFilePath && pathEquals(currentFilePath, relativePath)) {
      const saved = await options.persistCurrentFile(false);
      if (!saved) {
        options.setStatus("Save failed. Could not rename file.");
        return;
      }
    }

    try {
      const result = await options.renameEntry({ relativePath, kind, nextRelativePath });
      const previousCurrentFilePath = options.getCurrentFilePath();
      const previousLastOpenedFilePath = project.lastOpenedFilePath;
      const renamedPath = result.nextRelativePath;

      if (previousCurrentFilePath) {
        if (kind === "file" && pathEquals(previousCurrentFilePath, relativePath)) {
          options.setCurrentFilePath(renamedPath);
        }

        if (
          kind === "folder" &&
          (pathEquals(previousCurrentFilePath, relativePath) || previousCurrentFilePath.startsWith(`${relativePath}/`))
        ) {
          const suffix = previousCurrentFilePath.slice(relativePath.length).replace(/^\/+/, "");
          options.setCurrentFilePath(suffix.length > 0 ? `${renamedPath}/${suffix}` : renamedPath);
        }
      }

      const nextCurrentFilePath = options.getCurrentFilePath();
      if (nextCurrentFilePath) {
        options.setActiveFileLabel(nextCurrentFilePath);
      }

      if (previousLastOpenedFilePath) {
        if (kind === "file" && pathEquals(previousLastOpenedFilePath, relativePath)) {
          await options.persistLastOpenedFilePath(renamedPath);
        }

        if (
          kind === "folder" &&
          (pathEquals(previousLastOpenedFilePath, relativePath) ||
            previousLastOpenedFilePath.startsWith(`${relativePath}/`))
        ) {
          const suffix = previousLastOpenedFilePath.slice(relativePath.length).replace(/^\/+/, "");
          await options.persistLastOpenedFilePath(suffix.length > 0 ? `${renamedPath}/${suffix}` : renamedPath);
        }
      }

      options.setSelectedTree(renamedPath, kind);
      applyProjectMetadataAfterMutation(result.metadata);
      options.setStatus(`Renamed to ${normalizedName}`, 1700);
    } catch {
      options.setStatus("Could not rename item. Check for duplicate names.");
    }
  };

  const moveFileToFolder = async (fromRelativePath: string, toFolderRelativePath: string): Promise<void> => {
    const project = options.getProject();
    if (!project) {
      return;
    }
    options.closeTreeContextMenu();

    const normalizedFrom = normalizePathInput(fromRelativePath);
    const normalizedToFolder = normalizePathInput(toFolderRelativePath);
    if (!normalizedFrom) {
      return;
    }

    const sourceParentPath = getParentFolderPath(normalizedFrom);
    if (
      (sourceParentPath && pathEquals(sourceParentPath, normalizedToFolder)) ||
      (!sourceParentPath && normalizedToFolder.length === 0)
    ) {
      options.setStatus("File is already in that folder.", 1200);
      return;
    }

    const fileName = getBaseName(normalizedFrom);
    const nextRelativePath = normalizedToFolder.length > 0 ? `${normalizedToFolder}/${fileName}` : fileName;
    if (pathEquals(normalizedFrom, nextRelativePath)) {
      options.setStatus("File is already in that folder.", 1200);
      return;
    }

    const currentFilePath = options.getCurrentFilePath();
    if (options.getDirty() && currentFilePath && pathEquals(currentFilePath, normalizedFrom)) {
      const saved = await options.persistCurrentFile(false);
      if (!saved) {
        options.setStatus("Save failed. Could not move file.");
        return;
      }
    }

    try {
      const result = await options.moveFile({
        fromRelativePath: normalizedFrom,
        toFolderRelativePath: normalizedToFolder
      });
      const previousLastOpenedFilePath = project.lastOpenedFilePath;

      options.setSelectedTree(result.nextFilePath, "file");

      if (currentFilePath && pathEquals(currentFilePath, normalizedFrom)) {
        options.setCurrentFilePath(result.nextFilePath);
        options.setActiveFileLabel(result.nextFilePath);
      }

      if (previousLastOpenedFilePath && pathEquals(previousLastOpenedFilePath, normalizedFrom)) {
        await options.persistLastOpenedFilePath(result.nextFilePath);
      }

      applyProjectMetadataAfterMutation(result.metadata);
      options.setStatus(`Moved ${fileName} to ${getDropDestinationLabel(normalizedToFolder)}`, 1700);
    } catch {
      options.setStatus("Could not move file. Check destination and file conflicts.");
    }
  };

  return {
    createNewFile,
    createNewFolder,
    deleteEntryByPath,
    renameEntryByPath,
    moveFileToFolder
  };
}
