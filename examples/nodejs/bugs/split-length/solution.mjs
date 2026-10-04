import { readFile } from "node:fs/promises";

/**
 * Count the lines of a file without loading it into memory.
 * @param {string} path
 * @returns {Promise<number>}
 */
export async function countLines(path) {
  // BUG (plausible alternative): split().length counts an extra empty "line" after a final
  // "\n" and returns 1 for an empty file (and it loads the whole file into memory).
  const text = await readFile(path, "utf8");
  return text.split("\n").length;
}
