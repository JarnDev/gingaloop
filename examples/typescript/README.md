# Top word frequencies

## Problem

A support dashboard shows the most frequent words in customer messages. Implement
`topWords(text, limit)` in `starter/solution.ts`:

```ts
export type WordCount = readonly [word: string, count: number];
export function topWords(text: string, limit: number): WordCount[];
```

- A word is a maximal run of letters `a`–`z` (ASCII) or apostrophes, compared case-insensitively
  and returned in lowercase. Everything else (digits, punctuation, spaces) separates words.
- Sort by count descending; ties are broken alphabetically (ascending).
- Return at most `limit` entries; `limit` of 0 returns `[]`.

## Examples

```ts
topWords("the cat and THE hat", 2)        // [["the", 2], ["and", 1]]
topWords("b a c b a", 10)                  // [["a", 2], ["b", 2], ["c", 1]]
topWords("don't stop, don't!", 1)          // [["don't", 2]]
topWords("", 5)                            // []
```

## Constraints

- Up to 10^6 characters of text; aim for O(n + k log k) where k is the number of distinct words.
- The code must pass `tsc --strict`.

## How to run

- `ginga test` type-checks and runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
