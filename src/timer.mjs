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
    const step = STEPS[ENDS.has(e.type) ? "ended" : e.type]?.[t.state];
    if (step) step(t, Date.parse(e.ts));
  }
  if (t.state === "running") t.activeMs += now - t.since;
  return t;
}

const enter = (t, state, at) => Object.assign(t, { state, since: at });
const stopRunning = (t, at) => (t.activeMs += at - t.since);

// event type -> current state -> what it does; a missing entry means the event is ignored there.
const STEPS = {
  opened: { none: (t, at) => enter(Object.assign(t, { startedAt: at }), "running", at) },
  paused: {
    none: (t, at) => enter(Object.assign(t, { startedAt: at }), "paused", at),
    running: (t, at) => {
      stopRunning(t, at);
      t.pauses++;
      enter(t, "paused", at);
    },
  },
  resumed: {
    paused: (t, at) => {
      if (t.pauses) t.pausedMs += at - t.since; // paused before any open: not a break
      enter(t, "running", at);
    },
  },
  ended: {
    none: (t, at) => enter(t, "ended", at),
    paused: (t, at) => enter(t, "ended", at),
    running: (t, at) => {
      stopRunning(t, at);
      enter(t, "ended", at);
    },
  },
};

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
