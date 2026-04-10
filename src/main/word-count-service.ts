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

export async function countWordsUsingSystemTool(text: string): Promise<number> {
  return countWordsInText(text);
}

export async function countWordsInFilesUsingSystemTool(filePaths: string[]): Promise<number> {
  if (filePaths.length === 0) {
    return 0;
  }

  return countWordsInFiles(filePaths);
}
