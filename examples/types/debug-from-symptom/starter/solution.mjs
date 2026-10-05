// A log line: an uppercase level, one space, then the message.
const LINE = /^([A-Z]+) (.+)$/g;

/**
 * Counts log lines per level. Malformed lines are skipped.
 * @param {string[]} lines
 * @returns {Record<string, number>}
 */
export function summarizeLog(lines) {
  const counts = {};
  for (const line of lines) {
    const match = LINE.exec(line);
    if (!match) continue;
    counts[match[1]] = (counts[match[1]] ?? 0) + 1;
  }
  return counts;
}
