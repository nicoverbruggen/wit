/**
 * Owns: word-count helpers used by project metadata and live editor updates.
 * Out of scope: editor session orchestration and filesystem discovery.
 * Inputs/Outputs: raw text or file paths in, word counts out.
 * Side effects: reads file contents from disk when counting files.
 */
import { promises as fs } from "node:fs";
function countWordsInText(text: string): number {
  const tokens = text.trim().match(/\S+/g);
  return tokens?.length ?? 0;
}

async function countWordsInFiles(filePaths: string[]): Promise<number> {
  let total = 0;

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf8");
    total += countWordsInText(content);
  }

  return total;
}

/**
 * Counts words in a text blob using the app's whitespace tokenization rules.
 *
 * @param text Raw text to count.
 * @returns The number of whitespace-delimited tokens.
 */
export async function countWordsUsingSystemTool(text: string): Promise<number> {
  return countWordsInText(text);
}

/**
 * Counts words across multiple text files.
 *
 * @param filePaths Absolute file paths to read and count.
 * @returns The total token count across all files.
 */
export async function countWordsInFilesUsingSystemTool(filePaths: string[]): Promise<number> {
  if (filePaths.length === 0) {
    return 0;
  }

  return countWordsInFiles(filePaths);
}
