## Hint 1
Split the problem in two: counting (one pass over the words) and ranking (sorting the distinct words).
What should decide the order when two words have the same count?

## Hint 2
Normalize with `toLowerCase()`, extract words with a global regex (`/[a-z']+/g`) and count in a
`Map<string, number>`. Then sort the entries with a comparator that compares counts first, then words.

## Hint 3
`[...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, limit)`
