# Port bucket counts from Python to TypeScript

## Problem

A metrics service in Python puts values into buckets of a fixed size for histograms. The team moves
it to a TypeScript service. The port must give **exactly** the same result as the Python version for
each input, also for negative numbers. Write it in `starter/solution.ts`:

```ts
export function bucketCounts(values: number[], size: number): [bucket: number, count: number][];
```

## Source

`source/bucket_counts.py` is the working Python version. Read it carefully. It uses `//` (floor
division), a `Counter`, and `sorted` on tuples.

## Examples

```ts
bucketCounts([-1, 0, 9, 10, 25], 10)   // [[-1, 1], [0, 2], [1, 1], [2, 1]]
bucketCounts([], 5)                    // []
bucketCounts([1, 2], 0)                // throws Error("size must be positive")
```

## Constraints

- The values and the size are integers.
- Write idiomatic TypeScript, not a copy of the Python code line by line. It must pass
  `tsc --strict`.

## How to run

- `ginga test` type-checks and runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
