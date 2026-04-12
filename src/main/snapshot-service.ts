/**
 * Owns: project snapshot archive creation, pruning, and optional Git snapshot commits.
 * Out of scope: project metadata loading and autosave scheduling decisions.
 * Inputs/Outputs: snapshot options and filesystem paths in, snapshot timestamps out.
 * Side effects: reads project files, writes compressed archives, prunes old snapshots, and may invoke Git.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { hasGitInitialCommit } from "./project-service/project-git";

const execFileAsync = promisify(execFile);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const SNAPSHOT_FILE_EXTENSION = ".json.gz";
export const SNAPSHOT_VERSION_FILE_NAME = "version.json";
export const SNAPSHOT_SYSTEM_VERSION = 2;

type SnapshotPayload = {
  version: 1;
  createdAt: string;
  files: Record<string, string>;
};

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[.:]/g, "-");
}

async function ensureSnapshotDirectory(snapshotDirectory: string): Promise<void> {
  await fs.mkdir(snapshotDirectory, { recursive: true });
  await fs.writeFile(
    path.join(snapshotDirectory, SNAPSHOT_VERSION_FILE_NAME),
    `${JSON.stringify({ version: SNAPSHOT_SYSTEM_VERSION }, null, 2)}\n`,
    "utf8"
  );
}

function getSnapshotBaseName(snapshotName: string): string | null {
  if (snapshotName.endsWith(SNAPSHOT_FILE_EXTENSION)) {
    return snapshotName.slice(0, -SNAPSHOT_FILE_EXTENSION.length);
  }

  return null;
}

function parseSnapshotTimestamp(snapshotName: string): Date | null {
  const baseName = getSnapshotBaseName(snapshotName);
  if (!baseName) {
    return null;
  }

  const matches = baseName.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/
  );
  if (!matches) {
    return null;
  }

  const [, year, month, day, hour, minute, second, millisecond] = matches;
  const date = new Date(
    Date.UTC(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10),
      Number.parseInt(millisecond ?? "0", 10)
    )
  );

  return Number.isFinite(date.getTime()) ? date : null;
}

async function buildSnapshotPayload(
  projectPath: string,
  snapshotTimestamp: string,
  filePaths: string[]
): Promise<SnapshotPayload> {
  const files: Record<string, string> = {};

  for (const relativePath of filePaths) {
    try {
      files[relativePath] = await fs.readFile(path.resolve(projectPath, relativePath), "utf8");
    } catch {
      // A file could have been removed between listing and snapshot creation.
    }
  }

  return {
    version: 1,
    createdAt: snapshotTimestamp,
    files
  };
}

async function writeSnapshotArchive(snapshotDirectory: string, snapshotTimestamp: string, payload: SnapshotPayload) {
  const snapshotPath = path.join(snapshotDirectory, `${snapshotTimestamp}${SNAPSHOT_FILE_EXTENSION}`);
  const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload), "utf8"));
  await fs.writeFile(snapshotPath, compressed);
}

async function listSnapshotNames(snapshotDirectory: string): Promise<string[]> {
  const entries = await fs.readdir(snapshotDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => parseSnapshotTimestamp(entry.name) !== null)
    .map((entry) => entry.name)
    .sort();
}

async function pruneSnapshots(snapshotDirectory: string, maxSizeBytes: number): Promise<void> {
  const snapshotNames = await listSnapshotNames(snapshotDirectory);

  if (snapshotNames.length === 0) {
    return;
  }

  const sizes: { name: string; size: number }[] = [];
  let totalSize = 0;

  for (const name of snapshotNames) {
    try {
      const stat = await fs.stat(path.join(snapshotDirectory, name));
      sizes.push({ name, size: stat.size });
      totalSize += stat.size;
    } catch {
      // File may have been removed between readdir and stat.
    }
  }

  if (totalSize <= maxSizeBytes) {
    return;
  }

  // Remove oldest snapshots first, but always keep at least the latest one.
  for (let i = 0; i < sizes.length - 1 && totalSize > maxSizeBytes; i++) {
    await fs.rm(path.join(snapshotDirectory, sizes[i].name), { recursive: true, force: true });
    totalSize -= sizes[i].size;
  }
}

async function isPathGitignored(projectPath: string, relativePath: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["-C", projectPath, "check-ignore", "-q", relativePath]);
    return true;
  } catch {
    return false;
  }
}

async function getCommittableWitMetaFiles(projectPath: string): Promise<string[]> {
  const metaFiles = [".wit/config.json", ".wit/stats.json"];
  const results: string[] = [];

  for (const file of metaFiles) {
    const fullPath = path.join(projectPath, file);
    try {
      await fs.access(fullPath);
    } catch {
      continue;
    }

    if (!(await isPathGitignored(projectPath, file))) {
      results.push(file);
    }
  }

  return results;
}

async function commitSnapshotToGit(
  projectPath: string,
  commitMessage: string,
  filePaths: string[]
): Promise<boolean> {
  if (!(await hasGitInitialCommit(projectPath))) {
    return false;
  }

  try {
    const deletedWritingFiles = await getDeletedTrackedWritingFiles(projectPath);
    const stagedWritingPaths = [...new Set([...filePaths, ...deletedWritingFiles])];

    if (stagedWritingPaths.length === 0) {
      return false;
    }

    await execFileAsync("git", ["-C", projectPath, "add", "-A", "--", ...stagedWritingPaths]);

    const witMetaFiles = await getCommittableWitMetaFiles(projectPath);
    if (witMetaFiles.length > 0) {
      await execFileAsync("git", ["-C", projectPath, "add", "--", ...witMetaFiles]);
    }

    await execFileAsync("git", [
      "-C",
      projectPath,
      "commit",
      "-m",
      commitMessage,
      "--quiet"
    ]);
    return true;
  } catch (error) {
    const message = `${error}`;
    if (!message.includes("nothing to commit")) {
      console.warn("Git snapshot commit failed.", error);
    }
    return false;
  }
}

async function getDeletedTrackedWritingFiles(projectPath: string): Promise<string[]> {
  try {
    const result = await execFileAsync("git", [
      "-C",
      projectPath,
      "ls-files",
      "--deleted",
      "--",
      "*.txt",
      "*.md"
      // "*.wxt"
    ]);

    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

async function pushSnapshotToGitRemote(projectPath: string, remoteName: string): Promise<void> {
  try {
    await execFileAsync("git", ["-C", projectPath, "push", remoteName, "HEAD", "--quiet"]);
  } catch (error) {
    console.warn(`Git snapshot push to remote "${remoteName}" failed.`, error);
  }
}

async function getLatestSnapshotTimestamp(snapshotDirectory: string): Promise<Date | null> {
  try {
    const names = await listSnapshotNames(snapshotDirectory);
    if (names.length === 0) {
      return null;
    }

    return parseSnapshotTimestamp(names[names.length - 1]);
  } catch {
    return null;
  }
}

/**
 * Returns the latest snapshot base name from the snapshot directory.
 *
 * @param snapshotDirectory Absolute snapshot directory path.
 * @returns The latest snapshot timestamp string, or `null` when none exist.
 */
export async function getLatestSnapshotName(snapshotDirectory: string): Promise<string | null> {
  try {
    const names = await listSnapshotNames(snapshotDirectory);
    if (names.length === 0) {
      return null;
    }

    return getSnapshotBaseName(names[names.length - 1]);
  } catch {
    return null;
  }
}

async function getLatestSnapshotFilePaths(snapshotDirectory: string): Promise<string[] | null> {
  try {
    const names = await listSnapshotNames(snapshotDirectory);
    if (names.length === 0) {
      return null;
    }

    const latestPath = path.join(snapshotDirectory, names[names.length - 1]);
    const compressed = await fs.readFile(latestPath);
    const payload: SnapshotPayload = JSON.parse((await gunzipAsync(compressed)).toString("utf8"));
    return Object.keys(payload.files).sort();
  } catch {
    return null;
  }
}

async function hasFileListChanged(snapshotDirectory: string, currentFilePaths: string[]): Promise<boolean> {
  const previousPaths = await getLatestSnapshotFilePaths(snapshotDirectory);
  if (previousPaths === null) {
    return false;
  }

  const sorted = [...currentFilePaths].sort();
  if (sorted.length !== previousPaths.length) {
    return true;
  }

  return sorted.some((p, i) => p !== previousPaths[i]);
}

async function anyFileModifiedSince(projectPath: string, filePaths: string[], since: Date): Promise<boolean> {
  for (const relativePath of filePaths) {
    try {
      const stat = await fs.stat(path.resolve(projectPath, relativePath));
      if (stat.mtimeMs > since.getTime()) {
        return true;
      }
    } catch {
      // File may have been removed; treat as changed.
      return true;
    }
  }

  return false;
}

/**
 * Creates a snapshot archive and optional Git snapshot commit for the current project state.
 *
 * @param options Snapshot creation inputs including file paths and Git behavior flags.
 * @returns The created or reused snapshot timestamp string.
 */
export async function createSnapshot(options: {
  projectPath: string;
  snapshotDirectory: string;
  filePaths: string[];
  snapshotMaxSizeMb: number;
  createGitCommit: boolean;
  pushGitCommit: boolean;
  gitPushRemote: string | null;
  commitMessage?: string;
}): Promise<string> {
  await ensureSnapshotDirectory(options.snapshotDirectory);

  const lastSnapshotDate = await getLatestSnapshotTimestamp(options.snapshotDirectory);
  if (
    lastSnapshotDate &&
    !(await anyFileModifiedSince(options.projectPath, options.filePaths, lastSnapshotDate)) &&
    !(await hasFileListChanged(options.snapshotDirectory, options.filePaths))
  ) {
    return timestampForFilename(lastSnapshotDate);
  }

  const snapshotDate = new Date();
  const snapshotTimestamp = timestampForFilename(snapshotDate);
  const payload = await buildSnapshotPayload(options.projectPath, snapshotTimestamp, options.filePaths);
  await writeSnapshotArchive(options.snapshotDirectory, snapshotTimestamp, payload);

  await pruneSnapshots(options.snapshotDirectory, options.snapshotMaxSizeMb * 1024 * 1024);

  if (options.createGitCommit) {
    const message = options.commitMessage ?? `automatic snapshot`;
    const committed = await commitSnapshotToGit(options.projectPath, message, options.filePaths);
    if (committed && options.pushGitCommit && options.gitPushRemote) {
      await pushSnapshotToGitRemote(options.projectPath, options.gitPushRemote);
    }
  }

  return snapshotTimestamp;
}
