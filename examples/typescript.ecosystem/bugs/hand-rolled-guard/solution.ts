import { z } from "zod";

const Click = z.object({ type: z.literal("click"), x: z.number().finite(), y: z.number().finite() });
const Purchase = z.object({ type: z.literal("purchase"), sku: z.string(), cents: z.number().int().positive() });
export const EventSchema = z.discriminatedUnion("type", [Click, Purchase]);

export type Event = z.infer<typeof EventSchema>;

// BUG (plausible alternative): a hand-rolled type guard instead of trusting the schema; it checks
// that sku exists but not that it is a non-empty string, and returns the raw object (extra fields kept).
function isEvent(v: any): v is Event {
  if (v?.type === "click") return Number.isFinite(v.x) && Number.isFinite(v.y);
  if (v?.type === "purchase") return "sku" in v && Number.isInteger(v.cents) && v.cents > 0;
  return false;
}

export function parseEvents(lines: string[]): { events: Event[]; rejected: number[] } {
  const events: Event[] = [];
  const rejected: number[] = [];
  lines.forEach((line, index) => {
    try {
      const value: unknown = JSON.parse(line);
      if (isEvent(value)) events.push(value);
      else rejected.push(index);
    } catch {
      rejected.push(index);
    }
  });
  return { events, rejected };
}
