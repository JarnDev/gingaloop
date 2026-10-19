// The challenge timer, kept as events in progress.jsonl: the first `ginga open` starts it,
// `ginga pause` / `ginga resume` stop and restart it, and a solve, give-up or discard ends it.
// What it reports is active time: the spans between a start or resume and the next pause (or now).

/** Longest active time still trusted as a default; beyond it, unrecorded breaks are likely included. */
export const TIMER_CAP_MINUTES = 240;

const ENDS = new Set(["solved", "gaveup", "discarded"]);

/**
 * The timer of challenge `id` at `now`:
 * { state: "none"|"running"|"paused"|"ended", activeMs, pausedMs, pauses, startedAt, since }.
 * `since` is when the current state began (the last start, resume or pause). A pause before any
 * open starts the timer paused; repeated pauses or resumes are ignored.
 */
export function timerState(events, id, now = Date.now()) {
  const t = { state: "none", activeMs: 0, pausedMs: 0, pauses: 0, startedAt: null, since: null };
  for (const e of events) {
    if (e.id !== id) continue;
    const at = Date.parse(e.ts);
    if (e.type === "opened" && t.state === "none") {
      Object.assign(t, { state: "running", startedAt: at, since: at });
    } else if (e.type === "paused" && (t.state === "running" || t.state === "none")) {
      if (t.state === "running") {
        t.activeMs += at - t.since;
        t.pauses++;
      } else t.startedAt = at;
      Object.assign(t, { state: "paused", since: at });
    } else if (e.type === "resumed" && t.state === "paused") {
      if (t.pauses) t.pausedMs += at - t.since;
      Object.assign(t, { state: "running", since: at });
    } else if (ENDS.has(e.type) && t.state !== "ended") {
      if (t.state === "running") t.activeMs += at - t.since;
      Object.assign(t, { state: "ended", since: at });
    }
  }
  if (t.state === "running") t.activeMs += now - t.since;
  return t;
}

/**
 * Active minutes for `ginga done`. `suggest` is null when the timer never started, or when the time
 * is over the cap (opened in the morning, solved at night, without a pause).
 */
export function timerMinutes(events, id, now = Date.now(), cap = TIMER_CAP_MINUTES) {
  const t = timerState(events, id, now);
  if (t.state === "none") return { measured: null, suggest: null, pauses: 0, pausedMinutes: 0 };
  const measured = Math.max(1, Math.round(t.activeMs / 60_000));
  return { measured, suggest: measured <= cap ? measured : null, pauses: t.pauses, pausedMinutes: Math.round(t.pausedMs / 60_000) };
}

export function humanMinutes(m) {
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
