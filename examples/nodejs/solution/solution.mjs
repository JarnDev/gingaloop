import { createReadStream } from "node:fs";

const NEWLINE = 0x0a;

/**
 * Count the lines of a file without loading it into memory.
 * @param {string} path
 * @returns {Promise<number>}
 */
export async function countLines(path) {
  let count = 0;
  let lastByte = null;
  for await (const chunk of createReadStream(path)) {
    for (let i = chunk.indexOf(NEWLINE); i !== -1; i = chunk.indexOf(NEWLINE, i + 1)) count++;
    if (chunk.length > 0) lastByte = chunk[chunk.length - 1];
  }
  if (lastByte !== null && lastByte !== NEWLINE) count++;
  return count;
}
