const LEVELS = ["ERROR", "WARN", "INFO", "DEBUG"];

/**
 * Counts log lines per level. Malformed lines are skipped.
 * @param {string[]} lines
 * @returns {Record<string, number>}
 */
export function summarizeLog(lines) {
  // WRONG FIX (plausible alternative): drop the regex and check a list of known levels instead;
  // the symptom goes away, but levels like AUDIT are no longer counted.
  const counts = {};
  for (const line of lines) {
    const level = LEVELS.find((l) => line.startsWith(`${l} `) && line.length > l.length + 1);
    if (level) counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}
