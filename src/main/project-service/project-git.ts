/**
 * Owns: Git repository detection and lightweight Git setup for a project path.
 * Out of scope: project metadata aggregation and snapshot orchestration.
 * Inputs/Outputs: project-root paths in, repository state or remote names out.
 * Side effects: reads `.git`, runs Git commands, and may write local Git config/commits.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function execGit(projectPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", ["-C", projectPath, ...args]);
}

export async function isGitRepository(projectPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path.join(projectPath, ".git"));
    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Reports whether the repository at `projectPath` already has a reachable `HEAD`.
 *
 * @param projectPath Absolute project root to inspect.
 * @returns `true` only when the path is a Git repository with at least one commit.
 */
export async function hasGitInitialCommit(projectPath: string): Promise<boolean> {
  if (!(await isGitRepository(projectPath))) {
    return false;
  }

  try {
    await execGit(projectPath, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function ensureGitIdentity(projectPath: string): Promise<void> {
  try {
    const userName = await execGit(projectPath, ["config", "--get", "user.name"]);
    if (userName.stdout.trim().length === 0) {
      await execGit(projectPath, ["config", "user.name", "Wit"]);
    }
  } catch {
    await execGit(projectPath, ["config", "user.name", "Wit"]);
  }

  try {
    const userEmail = await execGit(projectPath, ["config", "--get", "user.email"]);
    if (userEmail.stdout.trim().length === 0) {
      await execGit(projectPath, ["config", "user.email", "wit@localhost"]);
    }
  } catch {
    await execGit(projectPath, ["config", "user.email", "wit@localhost"]);
  }
}

async function createInitialCommit(projectPath: string): Promise<void> {
  if (await hasGitInitialCommit(projectPath)) {
    return;
  }

  await ensureGitIdentity(projectPath);
  await execGit(projectPath, ["add", "-A", "--", "."]);
  await execGit(projectPath, ["commit", "--allow-empty", "-m", "Initial commit", "--quiet"]);
}

/**
 * Initializes Git for the project and ensures an initial commit exists.
 *
 * @param projectPath Absolute project root to initialize.
 * @returns Resolves when the repository and initial commit are ready for snapshot commits.
 */
export async function initializeGitRepository(projectPath: string): Promise<void> {
  if (!(await isGitRepository(projectPath))) {
    await execGit(projectPath, ["init", "--quiet"]);
  }

  await createInitialCommit(projectPath);
}

/**
 * Lists configured Git remotes for a project in stable alphabetical order.
 *
 * @param projectPath Absolute project root to inspect.
 * @returns Remote names, or an empty list when Git is unavailable or unconfigured.
 */
export async function listGitRemotes(projectPath: string): Promise<string[]> {
  if (!(await isGitRepository(projectPath))) {
    return [];
  }

  try {
    const result = await execGit(projectPath, ["remote"]);

    return result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
