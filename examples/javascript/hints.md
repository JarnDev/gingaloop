## Hint 1
How many chunks are there for `n` items? What happens to the leftover items when `n` is not a
multiple of `size`?

## Hint 2
Step through the array `size` items at a time and copy each window into a new array. Check the
`size` argument before doing anything else.

## Hint 3
`for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));`
plus `if (!Number.isInteger(size) || size <= 0) throw new RangeError(...)`.
