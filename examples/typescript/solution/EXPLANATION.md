# Top word frequencies: explanation

## Approach

Two phases:

1. **Count**: lowercase the text once, then `matchAll(/[a-z']+/g)` yields every word (maximal runs of
   letters/apostrophes; anything else separates words). A `Map<string, number>` accumulates counts.
2. **Rank**: spread the map into `[word, count]` entries and sort with a two-key comparator: count
   descending (`countB - countA`), and when that is `0`, word ascending. `slice(0, limit)` keeps the top.

Trace for `"b a c b a"`: counts `b→2, a→2, c→1` (insertion order b, a, c). The sort compares `b` and
`a` with equal counts, so the tie-break puts `a` first: `[a,2], [b,2], [c,1]`.

## Complexity

Counting is O(n) in the text length. Sorting the k distinct words is O(k log k). Memory is O(k).

## Alternatives

- `a.localeCompare(b)` as the tie-break reads nicely, but it is locale-dependent (and slower). For
  ASCII words, plain `<` comparison is deterministic everywhere.
- For a small `limit` and a huge `k`, a bounded min-heap of size `limit` gives O(k log limit) instead
  of sorting everything.
- `text.split(/[^a-z']+/)` works too, but produces empty strings at the edges that you must filter.

## Common bugs

- **No tie-break** (`bugs/ties-unsorted`): `Array.prototype.sort` is stable, so equal counts keep
  insertion order (`b` before `a`). That looks right on many inputs and fails on ties. Caught by
  "ties are ordered alphabetically".
- **Case-sensitive counting** (`bugs/case-sensitive`): `"THE"` and `"the"` become two entries. Caught
  by "counts words case-insensitively".

## Idioms

- `readonly [word: string, count: number]` is a labeled, read-only tuple: self-documenting and it
  stops callers from mutating results.
- `map.get(k) ?? 0` handles the missing-key case without an `if`.
- `countB - countA || tieBreak` chains comparators: `||` falls through only when the first is `0`.

## Level up

1. Return `{ word, count, share }` objects where `share` is the fraction of all words, typed with a
   `satisfies` check.
2. Accept a `stopWords: ReadonlySet<string>` option and make `topWords` generic over a tokenizer
   function.
