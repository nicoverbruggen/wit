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

async function commitSnapshotToGit(projectPath: string, snapshotTimestamp: string): Promise<void> {
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
    await execFileAsync("git", ["-C", projectPath, "add", "-A"]);
    await execFileAsync("git", ["-C", projectPath, "reset", "--quiet", "--", ".wit"]);
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

export async function createSnapshot(options: {
  projectPath: string;
  snapshotDirectory: string;
  filePaths: string[];
  createGitCommit: boolean;
}): Promise<string> {
  const snapshotDate = new Date();
  const snapshotTimestamp = timestampForFilename(snapshotDate);
  const snapshotRoot = path.join(options.snapshotDirectory, snapshotTimestamp);

  await ensureSnapshotDirectory(options.snapshotDirectory);

  for (const relativePath of options.filePaths) {
    try {
      await copyFileToSnapshot(options.projectPath, snapshotRoot, relativePath);
    } catch {
      // A file could have been removed between listing and snapshot creation.
    }
  }

  await pruneSnapshots(options.snapshotDirectory);

  if (options.createGitCommit) {
    await commitSnapshotToGit(options.projectPath, snapshotTimestamp);
  }

  return snapshotTimestamp;
}
