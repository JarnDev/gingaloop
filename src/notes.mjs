// NOTES.md: the template every new challenge gets, and the fields `ginga done` / `giveup` fill in.

export const NOTE_FIELDS = ["Time spent", "Hints used", "Result", "What tripped me up", "What I'd do differently"];

export function notesTemplate(title) {
  return `# Notes: ${title}\n\n${NOTE_FIELDS.map((f) => `- ${f}:`).join("\n")}\n`;
}

const fieldLine = (field) => new RegExp(`^- ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:[ \\t]*$`, "m");

/**
 * Fill the empty `- Field:` lines of a NOTES.md with `values` ({ "Time spent": "…" }). A field that
 * already has text is left alone, so nothing you wrote is overwritten. A missing "Result" line
 * (notes made before it existed) goes after "Hints used". Only the part above the first "## " heading
 * is read. Returns the new text and what was filled.
 */
export function fillNotes(text, values) {
  // Only the fields at the top: reviews appended below may contain look-alike lines.
  const cut = text.search(/^## /m);
  let out = cut === -1 ? text : text.slice(0, cut);
  const rest = cut === -1 ? "" : text.slice(cut);
  const filled = [];
  for (const [field, value] of Object.entries(values)) {
    if (!value) continue;
    const re = fieldLine(field);
    const next = re.test(out) ? out.replace(re, `- ${field}: ${value}`) : field === "Result" ? withResultLine(out, value) : out;
    if (next !== out) filled.push(field);
    out = next;
  }
  return { text: out + rest, filled };
}

/** Notes made before the Result field: add it after "Hints used" (unless it's there, filled). */
function withResultLine(text, value) {
  const hints = /^- Hints used:.*$/m.exec(text);
  if (!hints || /^- Result:/m.test(text)) return text;
  const at = hints.index + hints[0].length;
  return `${text.slice(0, at)}\n- Result: ${value}${text.slice(at)}`;
}

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const BAND = { faster: "faster than expected", "on pace": "on pace", slower: "slower than expected", struggle: "a struggle" };

/**
 * The values `ginga done` / `giveup` write:
 *   outcome  { kind: "solved"|"gaveup", date, points?, review? }
 *   minutes, minutesSource ("timer"|"typed"|"flag"), timer (timerMinutes), pace (solvePace),
 *   hintsUsed (hint numbers), hintsTotal, startedAt (ms, the first open)
 */
export function noteValues({ outcome, minutes, minutesSource, timer, pace, hintsUsed = [], hintsTotal = null, startedAt = null }) {
  const time = outcome.kind === "solved" ? solvedTime(minutes, minutesSource, timer, pace) : gaveUpTime(timer);
  return {
    ...(time ? { "Time spent": time } : {}),
    "Hints used": hintsLine(hintsUsed, hintsTotal),
    Result: resultLine(outcome, startedAt),
  };
}

const SOURCE = { timer: "timer", flag: "--minutes", typed: "typed" };

/** "30 min (timer; 1 pause, 15 min) · expected 27 (+11%), on pace" */
function solvedTime(minutes, minutesSource, timer, pace) {
  if (!Number.isFinite(minutes)) return "not recorded";
  const how = [SOURCE[minutesSource]];
  if (minutesSource === "timer" && timer?.pauses) how.push(`${timer.pauses} pause${timer.pauses === 1 ? "" : "s"}, ${timer.pausedMinutes} min`);
  const src = how.filter(Boolean).join("; ");
  const exp = pace ? ` · expected ${pace.expected} (${pace.pct >= 0 ? "+" : ""}${pace.pct}%), ${BAND[pace.band]}` : "";
  return `${minutes} min${src ? ` (${src})` : ""}${exp}`;
}

const gaveUpTime = (timer) => (timer?.measured != null ? `${timer.measured} min on the timer before giving up` : null);

/** "1 of 3 (hint 1)", "0 of 3" */
function hintsLine(used, total) {
  const of = Number.isFinite(total) && total > 0 ? ` of ${total}` : "";
  if (!used.length) return `0${of}`;
  return `${used.length}${of} (${used.length === 1 ? "hint" : "hints"} ${used.join(", ")})`;
}

/** "solved 2026-10-19 · +85 pts · opened 2026-10-19 15:07 · comes back as a review" */
function resultLine(outcome, startedAt) {
  const parts = [outcome.kind === "solved" ? `solved ${outcome.date}` : `gave up ${outcome.date}`];
  if (Number.isFinite(outcome.points)) parts.push(`+${outcome.points} pts`);
  if (startedAt != null) parts.push(`opened ${localDate(startedAt)} ${hhmm(startedAt)}`);
  if (outcome.review) parts.push("comes back as a review");
  return parts.join(" · ");
}
