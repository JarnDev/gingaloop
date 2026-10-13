// Review cycles. A give-up or a struggle (see pace.mjs) starts ONE cycle per topic: reviews at
// `reviewAfterDays` (3, 7, 21 by default) counted from that day. A review challenge belongs to the
// cycle of the challenge it reviews (followed back to the original), never starts its own, and
// struggling with it or giving it up adds one more step `reviewExtendDays` after the last
// (3/7/21 → 3/7/21/35). A day without a review only delays it.
import { isStruggle } from "./pace.mjs";
import { challengeStatus, eventDate, withoutDiscarded } from "./progress.mjs";
import { daysBetween, today } from "./workspace.mjs";

export const REVIEW_EXTEND_DAYS = 14;

/** The original challenge a review (of a review…) goes back to. */
export function rootOf(generated, id) {
  const seen = new Set();
  let cur = id;
  while (generated.get(cur)?.reviewOf && !seen.has(cur)) {
    seen.add(cur);
    cur = generated.get(cur).reviewOf;
  }
  return cur;
}

/** Every topic's review cycle: { root, trigger, steps, done, due } in the order they started. */
export function reviewCycles(events, reviewAfterDays, date, { extendDays = REVIEW_EXTEND_DAYS, pace = {} } = {}) {
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const cycles = new Map();
  const counted = new Set(); // challenges whose (first) give-up or struggle was already used
  events.forEach((e, i) => {
    if (e.type === "generated" && e.reviewOf) {
      const c = cycles.get(rootOf(generated, e.id));
      if (c) c.done++; // reviews made before the cycle started (older rules) don't count
      return;
    }
    if (counted.has(e.id)) return;
    if (e.type !== "gaveup" && !(e.type === "solved" && isStruggle(events, e, pace))) return;
    counted.add(e.id);
    const root = rootOf(generated, e.id);
    const c = cycles.get(root);
    if (!c) cycles.set(root, { root, trigger: e, index: i, extensions: 0, done: 0 });
    else if (e.id !== root) c.extensions++;
  });
  return [...cycles.values()].map((c) => {
    const steps = [...reviewAfterDays];
    for (let k = 0; k < c.extensions; k++) steps.push((steps.at(-1) ?? 0) + extendDays);
    const age = daysBetween(eventDate(c.trigger), date);
    const reached = steps.filter((n) => age >= n).length;
    return { root: c.root, trigger: c.trigger, steps, done: c.done, due: c.done < reached, next: steps[c.done] ?? null };
  });
}

/** The oldest review that is due, as the challenge to review; null when none is. */
export function dueReview(events, reviewAfterDays, date, opts = {}) {
  const generated = new Map(events.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const c = reviewCycles(events, reviewAfterDays, date, opts).find((x) => x.due);
  if (!c) return null;
  const g = generated.get(c.root);
  const e = c.trigger;
  return {
    id: c.root, lang: g?.lang ?? e.lang, level: g?.level ?? e.level, title: g?.title ?? c.root,
    topics: g?.topics ?? e.topics ?? [], ...(g?.area ? { area: g.area } : {}),
  };
}

/** The review challenge you haven't finished yet (solved, given up or discarded), if any. */
export function openReview(events) {
  return events.filter((e) => e.type === "generated" && e.reviewOf).reverse()
    .find((e) => challengeStatus(events, e.id).status === "open") ?? null;
}

/** Options for the review cycles from the config. */
export function reviewOpts(config) {
  return { extendDays: config.reviewExtendDays ?? REVIEW_EXTEND_DAYS, pace: config.pace };
}

/** "🔁 Review open: …" / "🔁 Review due: …" / "🔁 Next review: …", or null with no review cycle. */
export function reviewSummary(events, config, date = today()) {
  const live = withoutDiscarded(events);
  const open = openReview(live);
  const title = (id) => live.find((e) => e.type === "generated" && e.id === id)?.title ?? id;
  if (open) return `🔁 Review open (optional): ${open.title ?? open.id}`;
  const cycles = reviewCycles(live, config.reviewAfterDays, date, reviewOpts(config));
  const due = cycles.find((c) => c.due);
  if (due) return `🔁 Review due: ${title(due.root)}, comes with the next daily`;
  const next = cycles.filter((c) => c.next != null)
    .map((c) => ({ c, at: addDaysIso(eventDate(c.trigger), c.next) }))
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return next ? `🔁 Next review: ${title(next.c.root)} on ${next.at}` : null;
}

function addDaysIso(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
