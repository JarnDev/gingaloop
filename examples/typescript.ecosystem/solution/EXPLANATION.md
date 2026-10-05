# Parse analytics events: explanation

## Approach

One schema per event variant, combined with `z.discriminatedUnion("type", [...])`: zod reads `type`
first and validates against the matching variant only, which is faster and gives clearer errors
than trying every variant. The static type comes from the same schema
(`type Event = z.infer<typeof EventSchema>`), so the type and the runtime check can't drift apart.

Each line has two failure modes, handled separately: `JSON.parse` throws on malformed text (caught,
index rejected), and `safeParse` returns `success: false` for well-formed JSON that isn't an event.
Valid events come from `result.data`, which also drops unknown fields (zod's default object mode).

Trace: `'{"type":"purchase","sku":"","cents":5}'` parses as JSON, the union picks the purchase
variant by `type`, and `sku: min(1)` fails, so index 2 is rejected.

## Complexity

O(total input size). The schemas are built once at module load.

## Alternatives

- `z.union([Click, Purchase])` works too, but it tries each variant in turn, and its error says "no
  variant matched" instead of pointing at the field.
- Hand-written type guards (`v is Event`) duplicate the schema in code that TypeScript can't verify
  (see the bugs).
- Throwing on the first bad line is simpler, but one malformed event would then drop a whole batch.

## Common bugs

- **`cents` without `.int()`** (`bugs/cents-allow-floats`): `19.99` gets through. Caught by "cents
  must be a positive whole number".
- **No try/catch around `JSON.parse`** (`bugs/throws-on-bad-json`): one malformed line throws out of
  the whole batch. Caught by "invalid JSON lines are rejected, not thrown".
- **A hand-rolled type guard** (`bugs/hand-rolled-guard`): it checks `"sku" in v` but not that it's a
  non-empty string, and it returns the raw object with extra fields. Caught by "sku must be a
  non-empty string".

## Idioms

- `z.discriminatedUnion` for tagged unions, `z.infer` for the type.
- `safeParse` in loops: failures are values, not exceptions.
- `forEach((line, index) => …)` when the index is part of the result.

## Level up

1. Report *why* each line was rejected (`{ index, reason }`), using `error.issues[0].path`.
2. Add a `version` field and migrate v1 events to v2 with `z.preprocess` or `.transform`.
