# Port bucket counts from Python to TypeScript

## Problem

A metrics service written in Python groups values into fixed-size buckets for histograms. It's being
moved to a TypeScript service, and the port must behave **exactly** like the Python version for every
input, negative numbers included. Implement in `starter/solution.ts`:

```ts
export function bucketCounts(values: number[], size: number): [bucket: number, count: number][];
```

## Source

`source/bucket_counts.py`, the working Python version. Read it carefully: it uses `//` (floor
division), a `Counter`, and `sorted` on tuples.

## Examples

```ts
bucketCounts([-1, 0, 9, 10, 25], 10)   // [[-1, 1], [0, 2], [1, 1], [2, 1]]
bucketCounts([], 5)                    // []
bucketCounts([1, 2], 0)                // throws Error("size must be positive")
```

## Constraints

- Values and size are integers. Write idiomatic TypeScript (it must pass `tsc --strict`), not a
  line-by-line transliteration.

## How to run

- `ginga test` type-checks and runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
