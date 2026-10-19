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
    if (re.test(out)) {
      out = out.replace(re, `- ${field}: ${value}`);
      filled.push(field);
    } else if (field === "Result" && !new RegExp(`^- Result:`, "m").test(out)) {
      const hints = /^- Hints used:.*$/m.exec(out);
      if (!hints) continue;
      const at = hints.index + hints[0].length;
      out = `${out.slice(0, at)}\n- Result: ${value}${out.slice(at)}`;
      filled.push(field);
    }
  }
  return { text: out + rest, filled };
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
  const values = {};
  if (outcome.kind === "solved") {
    if (Number.isFinite(minutes)) {
      const how = [minutesSource === "timer" ? "timer" : minutesSource === "flag" ? "--minutes" : minutesSource === "typed" ? "typed" : null];
      if (minutesSource === "timer" && timer?.pauses) how.push(`${timer.pauses} pause${timer.pauses === 1 ? "" : "s"}, ${timer.pausedMinutes} min`);
      const src = how.filter(Boolean).join("; ");
      const exp = pace ? ` · expected ${pace.expected} (${pace.pct >= 0 ? "+" : ""}${pace.pct}%), ${BAND[pace.band]}` : "";
      values["Time spent"] = `${minutes} min${src ? ` (${src})` : ""}${exp}`;
    } else values["Time spent"] = "not recorded";
  } else if (timer?.measured != null) {
    values["Time spent"] = `${timer.measured} min on the timer before giving up`;
  }
  const n = hintsUsed.length;
  const of = Number.isFinite(hintsTotal) && hintsTotal > 0 ? ` of ${hintsTotal}` : "";
  values["Hints used"] = n ? `${n}${of} (${n === 1 ? "hint" : "hints"} ${hintsUsed.join(", ")})` : `0${of}`;
  const parts = [outcome.kind === "solved" ? `solved ${outcome.date}` : `gave up ${outcome.date}`];
  if (Number.isFinite(outcome.points)) parts.push(`+${outcome.points} pts`);
  if (startedAt != null) parts.push(`opened ${localDate(startedAt)} ${hhmm(startedAt)}`);
  if (outcome.review) parts.push("comes back as a review");
  values.Result = parts.join(" · ");
  return values;
}
