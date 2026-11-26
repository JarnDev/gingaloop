# Parse analytics events with a zod discriminated union

## Problem

An analytics collector receives one JSON event on each line. Write this in `starter/solution.ts`:

```ts
export type Event = /* derived from your zod schema with z.infer */;
export function parseEvents(lines: string[]): { events: Event[]; rejected: number[] };
```

An event has one of these two forms:

- `{ "type": "click", "x": number, "y": number }`: the coordinates are finite numbers.
- `{ "type": "purchase", "sku": string, "cents": number }`: `sku` is a string that is not empty.
  `cents` is a positive whole number.

The function removes extra fields from the output. They do not make an event invalid.

- `events` contains the valid events, in their input order.
- `rejected` contains the **0-based indexes** of the lines that are not valid JSON or not a valid
  event.
- The function never throws.

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

- Get the `Event` type from the schema with `z.infer`. Do not write the type yourself.
- The available libraries are zod 3.23 and vitest 2.1 (for the tests).
- The code must pass `tsc --strict`.

## How to run

- `ginga test` type-checks and runs the tests (vitest) against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
