## Hint 1
For positive numbers, Python's `//` and JavaScript's division with `Math.trunc` give the same
result. Calculate `-1 // 10` with each of them.

## Hint 2
Use `Math.floor(v / size)` for floor division. To count, use a `Map<number, number>`: its keys stay
numbers. Object keys are strings, and they sort as strings.

## Hint 3
`const counts = new Map<number, number>(); for (const v of values) { const b = Math.floor(v / size); counts.set(b, (counts.get(b) ?? 0) + 1); }`
then `[...counts].sort((a, b) => a[0] - b[0])`.
