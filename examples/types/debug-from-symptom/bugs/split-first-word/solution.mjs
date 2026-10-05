/**
 * Counts log lines per level. Malformed lines are skipped.
 * @param {string[]} lines
 * @returns {Record<string, number>}
 */
export function summarizeLog(lines) {
  // WRONG FIX (plausible alternative): take the first word and keep it if it's uppercase; the
  // symptom goes away, but "ERROR" with no message now counts.
  const counts = {};
  for (const line of lines) {
    const level = line.split(" ")[0];
    if (/^[A-Z]+$/.test(level)) counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}
