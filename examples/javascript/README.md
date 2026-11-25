# Chunk an array

## Problem

A batch uploader can send at most `size` records in one request. Write `chunk(items, size)` in
`starter/solution.mjs`. It returns a NEW array of arrays.

- Each inner array has at most `size` elements. Only the last inner array can have fewer.
- The elements stay in their input order.
- The function must not change the input array, because the callers use it again.
- `size` must be a positive integer. For all other values, the function throws a `RangeError`.

## Examples

```js
chunk([1, 2, 3, 4, 5], 2)   // [[1, 2], [3, 4], [5]]
chunk([], 3)                // []
chunk(["a", "b"], 5)        // [["a", "b"]]
chunk([1, 2], 0)            // throws RangeError: size must be a positive integer, got 0
```

## Constraints

- The input has at most 10^6 items. Aim for O(n).
- Do not use dependencies.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
