# Top word frequencies

## Problem

A support dashboard shows the most frequent words in customer messages. Write
`topWords(text, limit)` in `starter/solution.ts`:

```ts
export type WordCount = readonly [word: string, count: number];
export function topWords(text: string, limit: number): WordCount[];
```

- A word is a sequence of ASCII letters `a`–`z` and apostrophes. All other characters separate
  words: digits, punctuation and spaces.
- Upper and lower case are equal. The function returns each word in lowercase.
- Sort by count, from highest to lowest. For equal counts, sort by word, from A to Z.
- Return at most `limit` words. If `limit` is 0, return `[]`.

## Examples

```ts
topWords("the cat and THE hat", 2)        // [["the", 2], ["and", 1]]
topWords("b a c b a", 10)                  // [["a", 2], ["b", 2], ["c", 1]]
topWords("don't stop, don't!", 1)          // [["don't", 2]]
topWords("", 5)                            // []
```

## Constraints

- The text has at most 10^6 characters. Aim for O(n + k log k), where k is the number of different
  words.
- The code must pass `tsc --strict`.

## How to run

- `ginga test` type-checks and runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
