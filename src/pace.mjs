// Pace: how long a challenge should take YOU. Claude's estimate is the starting point, scaled by
// your pace: the median of actual ÷ estimated minutes over your recent clean solves (in that
// language once there are enough, else in all languages). A solve is then faster, on pace or
// slower than expected within a tolerance band, and a struggle when it is far above it.

export const PACE_DEFAULTS = Object.freeze({
  tolerance: 0.25, // ± band around the expected time that counts as "on pace"
  struggle: 0.5, // over expected by more than this → a struggle (the topic comes back as a review)
  minSolves: 5, // clean solves needed (all languages) before time alone can mean a struggle
  langSolves: 3, // clean solves in a language before its own pace replaces the overall one
  window: 10, // recent clean solves the median is taken over
});

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const round2 = (x) => Math.round(x * 100) / 100;

function estimateOf(generated, id) {
  const est = generated.get(id)?.estMinutes;
  return Number.isFinite(est) && est > 0 ? est : null;
}

/** A solve that says something about your normal pace: no hints, timed, with an estimate. */
function cleanRatio(e, generated) {
  if (e.type !== "solved" || e.afterGiveup || (e.hints ?? 0) > 0) return null;
  const est = estimateOf(generated, e.id);
  return est && Number.isFinite(e.minutes) && e.minutes > 0 ? { lang: e.lang, ratio: e.minutes / est } : null;
}

/**
 * Your pace in `lang` from `events` (all of them: pass only the events before a solve to judge
 * that solve). { factor, basis: "lang"|"all"|null, solves, calibrated }.
 */
export function paceFor(events, lang, opts = {}) {
  const o = { ...PACE_DEFAULTS, ...opts };
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const seen = new Set();
  const all = [];
  for (const e of events) {
    if (e.type !== "solved" || seen.has(e.id)) continue;
    seen.add(e.id);
    const r = cleanRatio(e, generated);
    if (r) all.push(r);
  }
  const own = all.filter((r) => r.lang === lang);
  const calibrated = all.length >= o.minSolves;
  if (own.length >= o.langSolves) return { factor: round2(median(own.slice(-o.window).map((r) => r.ratio))), basis: "lang", solves: own.length, calibrated };
  if (all.length) return { factor: round2(median(all.slice(-o.window).map((r) => r.ratio))), basis: "all", solves: all.length, calibrated };
  return { factor: 1, basis: null, solves: 0, calibrated: false };
}

/**
 * Where `minutes` falls against `expected`: faster | on pace | slower | struggle. Without a
 * calibrated pace, time alone never makes a struggle (the estimate may simply be off for you).
 */
export function band(minutes, expected, calibrated, opts = {}) {
  const o = { ...PACE_DEFAULTS, ...opts };
  const over = Math.round((minutes / expected - 1) * 1000) / 1000; // 22/20 - 1 is 0.10000000000000009
  if (over < -o.tolerance) return "faster";
  if (over <= o.tolerance) return "on pace";
  if (over > o.struggle && calibrated) return "struggle";
  return "slower";
}

/**
 * The pace facts of one solve: what was expected, what it took, the difference and the band.
 * Uses what `ginga done` stored on the event when present (history doesn't shift as your pace
 * changes), else works it out from the events before it. null when there's no time or estimate.
 */
export function solvePace(events, solved, opts = {}) {
  const o = { ...PACE_DEFAULTS, ...opts };
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const estimate = estimateOf(generated, solved.id);
  if (!estimate || !Number.isFinite(solved.minutes)) return null;
  let pace = solved.pace;
  let calibrated = solved.paceCalibrated;
  if (!Number.isFinite(pace)) {
    const at = events.indexOf(solved);
    const p = paceFor(at === -1 ? events : events.slice(0, at), solved.lang, o);
    pace = p.factor;
    calibrated = p.calibrated;
  }
  const expected = Math.round(estimate * pace);
  const diff = solved.minutes - expected;
  return {
    estimate, pace, calibrated: Boolean(calibrated), expected, minutes: solved.minutes, diff,
    pct: Math.round((diff / expected) * 100), band: band(solved.minutes, expected, calibrated, o),
  };
}

/**
 * A solve that should come back for review: 2+ hints, a promise caught only by accident
 * (write-the-tests), or a struggle against your own pace.
 */
export function isStruggle(events, solved, opts = {}) {
  if (solved.type !== "solved" || solved.afterGiveup) return false;
  if ((solved.hints ?? 0) >= 2 || solved.accidental?.length) return true;
  return solvePace(events, solved, opts)?.band === "struggle";
}

/** "×2.1", "×1.75*" (* = all languages: too few clean solves in this one), or "–". */
export function paceLabel(p) {
  return p.basis === "lang" ? `×${p.factor}` : p.basis === "all" ? `×${p.factor}*` : "–";
}

export const PACE_FOOTNOTE = "Pace = your time ÷ Claude's estimate (×2 = twice the estimate). * all languages: fewer than 3 clean solves in that one.";

const BAND_ICON = { faster: "🟢", "on pace": "🟢", slower: "🟡", struggle: "🔴" };

/** "42 min · expected 31 (+36%) 🟡" for tables. */
export function paceCell(p) {
  if (!p) return null;
  return `${p.minutes} min · exp ${p.expected} (${p.pct >= 0 ? "+" : ""}${p.pct}%) ${BAND_ICON[p.band]}`;
}

/** The block `ginga done` prints: numbers plus a bar with the band. */
export function paceReport(p, opts = {}) {
  const o = { ...PACE_DEFAULTS, ...opts };
  const pct = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
  const why = p.calibrated || p.pace !== 1
    ? `estimate ${p.estimate} × your pace ${p.pace}`
    : `Claude's estimate; your pace isn't calibrated yet`;
  // Scale: 0 … 2× expected, 30 cells; marks at the band edges and the struggle line.
  const W = 30;
  const cell = (ratio) => Math.max(0, Math.min(W - 1, Math.round((ratio / 2) * (W - 1))));
  const line = Array(W).fill("─");
  for (const r of [1 - o.tolerance, 1 + o.tolerance]) line[cell(r)] = "┆";
  line[cell(1 + o.struggle)] = "╎";
  line[cell(p.minutes / p.expected)] = "●";
  const verdict = {
    faster: "faster than your usual pace",
    "on pace": "on your usual pace",
    slower: "slower than usual (no review)",
    struggle: "a struggle: this topic comes back as a review",
  }[p.band];
  return [
    `  expected  ${String(p.expected).padStart(3)} min   (${why})`,
    `  took      ${String(p.minutes).padStart(3)} min   ${p.diff >= 0 ? "+" : ""}${p.diff} min (${p.pct >= 0 ? "+" : ""}${p.pct}%)`,
    `  0 ${line.join("")} 2×   ┆ on pace ±${Math.round(o.tolerance * 100)}%  ╎ struggle ${pct(o.struggle)}`,
    `  → ${verdict}${p.calibrated ? "" : " (time can't trigger a review until your pace is calibrated)"}`,
  ].join("\n");
}
