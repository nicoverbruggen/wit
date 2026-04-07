import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_SNAPSHOTS_TO_KEEP = 120;

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[.:]/g, "-");
}

async function ensureSnapshotDirectory(snapshotDirectory: string): Promise<void> {
  await fs.mkdir(snapshotDirectory, { recursive: true });
}

async function copyFileToSnapshot(
  projectPath: string,
  snapshotRoot: string,
  relativePath: string
): Promise<void> {
  const sourcePath = path.resolve(projectPath, relativePath);
  const destinationPath = path.join(snapshotRoot, relativePath);

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function pruneSnapshots(snapshotDirectory: string): Promise<void> {
  const entries = await fs.readdir(snapshotDirectory, { withFileTypes: true });
  const snapshots = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  if (snapshots.length <= MAX_SNAPSHOTS_TO_KEEP) {
    return;
  }

  const staleSnapshots = snapshots.slice(0, snapshots.length - MAX_SNAPSHOTS_TO_KEEP);

  await Promise.all(
    staleSnapshots.map((snapshotName) =>
      fs.rm(path.join(snapshotDirectory, snapshotName), { recursive: true, force: true })
    )
  );
}

async function commitSnapshotToGit(
  projectPath: string,
  snapshotTimestamp: string,
  filePaths: string[]
): Promise<void> {
  const gitDirectoryPath = path.join(projectPath, ".git");

  try {
    const directoryStat = await fs.stat(gitDirectoryPath);
    if (!directoryStat.isDirectory()) {
      return;
    }
  } catch {
    return;
  }

  try {
    if (filePaths.length > 0) {
      await execFileAsync("git", ["-C", projectPath, "add", "--", ...filePaths]);
    }
    await execFileAsync("git", [
      "-C",
      projectPath,
      "commit",
      "-m",
      `wit snapshot ${snapshotTimestamp}`,
      "--quiet"
    ]);
  } catch (error) {
    const message = `${error}`;
    if (!message.includes("nothing to commit")) {
      console.warn("Git snapshot commit failed.", error);
    }
  }
}

async function getLatestSnapshotTimestamp(snapshotDirectory: string): Promise<Date | null> {
  try {
    const entries = await fs.readdir(snapshotDirectory, { withFileTypes: true });
    const names = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    if (names.length === 0) {
      return null;
    }

    const latest = names[names.length - 1];
    const parsed = latest.replace(/-/g, (m, offset: number) => {
      if (offset === 4 || offset === 7) return "-";
      if (offset === 10) return "T";
      if (offset === 13 || offset === 16) return ":";
      if (offset === 19) return ".";
      return m;
    }).replace(/Z$/, "Z");

    const date = new Date(parsed);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
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

export async function createSnapshot(options: {
  projectPath: string;
  snapshotDirectory: string;
  filePaths: string[];
  createGitCommit: boolean;
}): Promise<string> {
  await ensureSnapshotDirectory(options.snapshotDirectory);

  const lastSnapshotDate = await getLatestSnapshotTimestamp(options.snapshotDirectory);
  if (lastSnapshotDate && !(await anyFileModifiedSince(options.projectPath, options.filePaths, lastSnapshotDate))) {
    return timestampForFilename(lastSnapshotDate);
  }

  const snapshotDate = new Date();
  const snapshotTimestamp = timestampForFilename(snapshotDate);
  const snapshotRoot = path.join(options.snapshotDirectory, snapshotTimestamp);

  for (const relativePath of options.filePaths) {
    try {
      await copyFileToSnapshot(options.projectPath, snapshotRoot, relativePath);
    } catch {
      // A file could have been removed between listing and snapshot creation.
    }
  }

  await pruneSnapshots(options.snapshotDirectory);

  if (options.createGitCommit) {
    await commitSnapshotToGit(options.projectPath, snapshotTimestamp, options.filePaths);
  }

  return snapshotTimestamp;
}
