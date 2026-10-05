# Parse analytics events with a zod discriminated union

## Problem

An analytics collector receives one JSON event per line. Implement in `starter/solution.ts`:

```ts
export type Event = /* derived from your zod schema with z.infer */;
export function parseEvents(lines: string[]): { events: Event[]; rejected: number[] };
```

An event is one of:

- `{ "type": "click", "x": number, "y": number }`: coordinates are finite numbers.
- `{ "type": "purchase", "sku": string, "cents": number }`: `sku` is a non-empty string, `cents` a
  positive whole number.

Extra fields are ignored (dropped from the output). `events` keeps the valid events in input order;
`rejected` lists the **0-based indexes** of lines that are not valid JSON or not a valid event. The
function never throws.

## Examples

```ts
parseEvents([
  '{"type":"click","x":10,"y":4}',
  '{"type":"purchase","sku":"A-1","cents":1999,"debug":true}',
  '{"type":"purchase","sku":"","cents":5}',
  'not json',
])
// { events: [ { type: "click", x: 10, y: 4 }, { type: "purchase", sku: "A-1", cents: 1999 } ],
//   rejected: [2, 3] }
```

## Constraints

- The `Event` type must come from the schema (`z.infer`), not be written by hand.
- Libraries available: zod 3.23, vitest 2.1 (tests). The code must pass `tsc --strict`.

## How to run

- `ginga test` type-checks and runs the tests (vitest) against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
