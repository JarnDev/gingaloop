## Hint 1
How many chunks do `n` items make? When `n` is not a multiple of `size`, where do the remaining
items go?

## Hint 2
Go through the array in steps of `size` items. Copy each step's items into a new array. Check the
`size` argument first, before all other work.

## Hint 3
`for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));`
plus `if (!Number.isInteger(size) || size <= 0) throw new RangeError(...)`.
