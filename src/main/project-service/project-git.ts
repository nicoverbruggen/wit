import path from "node:path";
import { promises as fs } from "node:fs";

export async function isGitRepository(projectPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path.join(projectPath, ".git"));
    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

export async function listGitRemotes(projectPath: string): Promise<string[]> {
  if (!(await isGitRepository(projectPath))) {
    return [];
  }

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const result = await execFileAsync("git", ["-C", projectPath, "remote"]);

    return result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
