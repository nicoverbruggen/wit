import { promises as fs } from "node:fs";
import { ensureProjectInitialized } from "./project-init";
import { DEFAULT_STATS, getStatsPath, type ProjectStats } from "./project-paths";

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

export async function addWritingSeconds(projectPath: string, seconds: number): Promise<ProjectStats> {
  const stats = await getProjectStats(projectPath);
  const nextStats: ProjectStats = {
    totalWritingSeconds: Math.max(0, stats.totalWritingSeconds + Math.floor(seconds))
  };

  await fs.writeFile(getStatsPath(projectPath), `${JSON.stringify(nextStats, null, 2)}\n`, "utf8");

  return nextStats;
}
