import { z } from "zod";

// TODO: replace with a type derived from your schema (z.infer).
export type Event = { type: string };

export function parseEvents(lines: string[]): { events: Event[]; rejected: number[] } {
  throw new Error("TODO: implement parseEvents");
}
