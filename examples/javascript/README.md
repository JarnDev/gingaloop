# Chunk an array

## Problem

A batch uploader can send at most `size` records per request. Implement
`chunk(items, size)` in `starter/solution.mjs`: it returns a NEW array of arrays, each with at most
`size` elements, preserving order.

- The input array must not be modified (callers reuse it).
- `size` must be a positive integer; otherwise throw a `RangeError`.

## Examples

```js
chunk([1, 2, 3, 4, 5], 2)   // [[1, 2], [3, 4], [5]]
chunk([], 3)                // []
chunk(["a", "b"], 5)        // [["a", "b"]]
chunk([1, 2], 0)            // throws RangeError: size must be a positive integer, got 0
```

## Constraints

- Up to 10^6 items; aim for O(n).
- No dependencies.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
