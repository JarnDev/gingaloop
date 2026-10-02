// Append-only event log: <workspace>/progress.jsonl
// Event types: generated | hint | solved | gaveup
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { today } from "./workspace.mjs";

export function progressPath(ws) {
  return join(ws, "progress.jsonl");
}

const warned = new Set();

export function readEvents(ws) {
  const path = progressPath(ws);
  if (!existsSync(path)) return [];
  const events = [];
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    try {
      events.push(JSON.parse(line));
    } catch {
      // e.g. a crash mid-append; skipping beats bricking every command
      if (!warned.has(`${path}:${i}`)) {
        warned.add(`${path}:${i}`);
        console.error(`ginga: skipping unreadable line ${i + 1} of ${path}`);
      }
    }
  });
  return events;
}

export function appendEvent(ws, event) {
  // `date` is the user's local calendar day; `ts` is UTC and can be a day off.
  const full = { ts: new Date().toISOString(), date: today(), ...event };
  appendFileSync(progressPath(ws), JSON.stringify(full) + "\n");
  return full;
}

/** Local day of an event (older events may only have the UTC ts). */
export function eventDate(e) {
  return e.date ?? e.ts.slice(0, 10);
}

/** Status of one challenge: open | solved | gaveup, plus hints used. */
export function challengeStatus(events, id) {
  let status = "open";
  let hints = 0;
  for (const e of events) {
    if (e.id !== id) continue;
    if (e.type === "hint") hints++;
    if (e.type === "solved") status = "solved";
    if (e.type === "gaveup" && status !== "solved") status = "gaveup";
  }
  return { status, hints };
}
