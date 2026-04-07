import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function fallbackCountWordsInText(text: string): number {
  const tokens = text.trim().match(/\S+/g);
  return tokens?.length ?? 0;
}

async function fallbackCountWordsInFiles(filePaths: string[]): Promise<number> {
  let total = 0;

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf8");
    total += fallbackCountWordsInText(content);
  }

  return total;
}

function parseWcCount(stdout: string): number {
  const lines = stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return 0;
  }

  const lastLine = lines[lines.length - 1];
  const match = lastLine.match(/^(\d+)/);

  if (!match) {
    throw new Error("Unable to parse wc output.");
  }

  return Number.parseInt(match[1], 10);
}

async function runWcForText(text: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("wc", ["-w"]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`wc exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        resolve(parseWcCount(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}

export async function countWordsUsingSystemTool(text: string): Promise<number> {
  if (process.platform === "win32") {
    return fallbackCountWordsInText(text);
  }

  try {
    return await runWcForText(text);
  } catch {
    return fallbackCountWordsInText(text);
  }
}

const WC_BATCH_SIZE = 200;

export async function countWordsInFilesUsingSystemTool(filePaths: string[]): Promise<number> {
  if (filePaths.length === 0) {
    return 0;
  }

  if (process.platform === "win32") {
    return fallbackCountWordsInFiles(filePaths);
  }

  try {
    let total = 0;

    for (let i = 0; i < filePaths.length; i += WC_BATCH_SIZE) {
      const batch = filePaths.slice(i, i + WC_BATCH_SIZE);
      const { stdout } = await execFileAsync("wc", ["-w", ...batch], {
        maxBuffer: 10_000_000
      });

      total += parseWcCount(stdout);
    }

    return total;
  } catch {
    return fallbackCountWordsInFiles(filePaths);
  }
}
