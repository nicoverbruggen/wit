/**
 * Owns: loading and updating project writing-time statistics.
 * Out of scope: autosave scheduling and broader project metadata assembly.
 * Inputs/Outputs: project roots and second deltas in, normalized stats objects out.
 * Side effects: reads and writes `.wit/stats.json`.
 */
import { promises as fs } from "node:fs";
import { ensureProjectInitialized } from "./project-init";
import { DEFAULT_STATS, getStatsPath, type ProjectStats } from "./project-paths";

/**
 * Loads normalized project writing-time statistics.
 *
 * @param projectPath Absolute project root.
 * @returns Project stats with defaults applied.
 */
export async function getProjectStats(projectPath: string): Promise<ProjectStats> {
  await ensureProjectInitialized(projectPath);

  const raw = await fs.readFile(getStatsPath(projectPath), "utf8");
  const parsed = JSON.parse(raw) as Partial<ProjectStats>;

  return {
    totalWritingSeconds:
      typeof parsed.totalWritingSeconds === "number" && parsed.totalWritingSeconds >= 0
        ? Math.floor(parsed.totalWritingSeconds)
        : DEFAULT_STATS.totalWritingSeconds
  };
}

/**
 * Adds tracked writing time to the project's stats.
 *
 * @param projectPath Absolute project root.
 * @param seconds Additional tracked seconds to add.
 * @returns The updated normalized stats object.
 */
export async function addWritingSeconds(projectPath: string, seconds: number): Promise<ProjectStats> {
  const stats = await getProjectStats(projectPath);
  const nextStats: ProjectStats = {
    totalWritingSeconds: Math.max(0, stats.totalWritingSeconds + Math.floor(seconds))
  };

  await fs.writeFile(getStatsPath(projectPath), `${JSON.stringify(nextStats, null, 2)}\n`, "utf8");

  return nextStats;
}
