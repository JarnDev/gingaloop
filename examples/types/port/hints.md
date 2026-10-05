## Hint 1
Python's `//` and JavaScript's division with `Math.trunc` agree for positive numbers. Try `-1 // 10`
in your head for each.

## Hint 2
Use `Math.floor(v / size)` for floor division. For counting, a `Map<number, number>` keeps numeric
keys numeric, whereas object keys are strings and sort as strings.

## Hint 3
`const counts = new Map<number, number>(); for (const v of values) { const b = Math.floor(v / size); counts.set(b, (counts.get(b) ?? 0) + 1); }`
then `[...counts].sort((a, b) => a[0] - b[0])`.
