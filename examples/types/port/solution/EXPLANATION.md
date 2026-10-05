# Port bucket counts: explanation

## Approach

Port the *behavior*, then express it in idiomatic TypeScript:

| Python | Pitfall | TypeScript |
|---|---|---|
| `v // size` (floor) | `Math.trunc` / `| 0` round toward zero | `Math.floor(v / size)` |
| `Counter` | object keys become strings | `Map<number, number>` |
| `sorted(items)` (tuples, numeric) | `.sort()` compares as strings | `.sort((a, b) => a[0] - b[0])` |
| `raise ValueError(...)` | | `throw new Error(...)` with the same message |

Trace: `[-1, 0, 9, 10, 25]` with size 10 gives floor quotients `-1, 0, 0, 1, 2`, so the counts are
`{-1:1, 0:2, 1:1, 2:1}`, sorted as `[[-1,1],[0,2],[1,1],[2,1]]`. A literal port with `Math.trunc`
would put `-1` in bucket `0`.

## Complexity

O(n + k log k): one pass to count, then sort the k distinct buckets (same as the Python version).

## Alternatives

- `((v % size) + size) % size` gives Python's modulo, and `(v - mod) / size` the floor quotient:
  correct but harder to read than `Math.floor`.
- Sorting the input first and counting runs avoids the Map, at O(n log n).
- For huge integers, `BigInt` division truncates too: floor needs an explicit adjustment.

## Common bugs

- **`Math.trunc` as `//`** (`bugs/trunc-division`): fine for positives, wrong for negatives. Caught
  by "negative values floor toward minus infinity".
- **An object as the Counter** (`bugs/object-keys-order`): string keys plus the default sort put
  `-1` before `-10`. Caught by "buckets are sorted numerically".
- **Dropping the validation** (`bugs/no-size-check`): size 0 yields `Infinity`/`NaN` buckets
  instead of an error. Caught by "size must be positive".

## Idioms

- `Map` for counters with non-string keys; `counts.get(k) ?? 0`.
- Labeled tuple types (`[bucket: number, count: number]`) document the output shape.
- Keep error messages identical across ports, since callers and logs depend on them.

## Level up

1. Port the inverse too: given bucket counts, rebuild a histogram string like Python's `"█" * n`.
2. Handle `size` as a float (Python's `//` works on floats too: what changes?).
