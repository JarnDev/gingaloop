import { z } from "zod";

const Click = z.object({ type: z.literal("click"), x: z.number().finite(), y: z.number().finite() });
const Purchase = z.object({ type: z.literal("purchase"), sku: z.string().min(1), cents: z.number().int().positive() });
export const EventSchema = z.discriminatedUnion("type", [Click, Purchase]);

export type Event = z.infer<typeof EventSchema>;

export function parseEvents(lines: string[]): { events: Event[]; rejected: number[] } {
  const events: Event[] = [];
  const rejected: number[] = [];
  lines.forEach((line, index) => {
    const value: unknown = JSON.parse(line); // BUG: a malformed line throws out of the whole batch
    const result = EventSchema.safeParse(value);
    if (result.success) events.push(result.data);
    else rejected.push(index);
  });
  return { events, rejected };
}
