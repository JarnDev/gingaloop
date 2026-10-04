# Chunk an array: explanation

## Approach

Validate `size` first: a `0` or `NaN` size would otherwise make the loop never advance. Then walk the
array in steps of `size` and copy each window with `slice(i, i + size)`. `slice` clamps the end at
`items.length`, so the last, shorter window comes out naturally.

Trace for `chunk([1,2,3,4,5], 2)`: `i=0` → `[1,2]`; `i=2` → `[3,4]`; `i=4` → `slice(4, 6)` = `[5]`;
`i=6` stops the loop. Result `[[1,2],[3,4],[5]]`.

## Complexity

O(n) time and O(n) extra space: every element is copied once into exactly one chunk.

## Alternatives

- `Array.from({ length: Math.ceil(n / size) }, (_, k) => items.slice(k * size, (k + 1) * size))`
  computes the chunk count up front; same complexity, a bit more arithmetic to get right.
- `splice` in a loop is shorter but destroys the caller's array (see below). Copying first
  (`[...items]`) fixes that, but each `splice(0, size)` shifts the rest of the array, which is
  O(n²) overall.
- A generator (`function* chunks()`) avoids building all chunks at once, which is good for streaming
  huge inputs.

## Common bugs

- **Dropping the leftover items** (`bugs/drops-partial-chunk`): a loop condition like
  `i + size <= items.length` only emits full chunks. Caught by "keeps the last partial chunk".
- **Mutating the input** (`bugs/mutates-input`): `splice` removes elements from the caller's array.
  Caught by "does not mutate the input array".
- **A truthy size check** (`bugs/truthy-size-check`): `if (!(size > 0))` accepts `1.5`, and `Math.ceil`/`Math.round` quietly produce chunks of mixed sizes. Caught by "rejects a non-positive or non-integer size", which also checks the exact `RangeError` message.

## Idioms

- `slice` never throws on out-of-range ends: it clamps them, so you don't need `Math.min`.
- `Number.isInteger(x)` rejects `NaN`, `Infinity`, `1.5` and non-numbers in one check.
- `RangeError` is the built-in error for "argument outside the allowed range".

## Level up

1. Write `function* chunked(iterable, size)` that works on any iterable (e.g. a Set or a generator)
   without converting it to an array first.
2. Add an option `{ pad: value }` that fills the last chunk up to `size`.
