import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const execFileAsync = promisify(execFile);
const gzipAsync = promisify(gzip);
const MAX_SNAPSHOTS_TO_KEEP = 120;
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

  return snapshotName;
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

async function pruneSnapshots(snapshotDirectory: string): Promise<void> {
  const entries = await fs.readdir(snapshotDirectory, { withFileTypes: true });
  const snapshots = entries
    .filter((entry) => parseSnapshotTimestamp(entry.name) !== null)
    .map((entry) => entry.name)
    .sort();

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
    const names = entries
      .filter((entry) => parseSnapshotTimestamp(entry.name) !== null)
      .map((entry) => entry.name)
      .sort();
    if (names.length === 0) {
      return null;
    }

    return parseSnapshotTimestamp(names[names.length - 1]);
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
  const payload = await buildSnapshotPayload(options.projectPath, snapshotTimestamp, options.filePaths);
  await writeSnapshotArchive(options.snapshotDirectory, snapshotTimestamp, payload);

  await pruneSnapshots(options.snapshotDirectory);

  if (options.createGitCommit) {
    await commitSnapshotToGit(options.projectPath, snapshotTimestamp, options.filePaths);
  }

  return snapshotTimestamp;
}
