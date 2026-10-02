# Run-length encoding: explanation

## Approach

**Encode**: `itertools.groupby` splits the string into runs of equal consecutive characters, which is
exactly what run-length encoding needs. For each run we emit the character and the run's length.

Trace for `"OOOXXO"`: groupby yields `('O', OOO)`, `('X', XX)`, `('O', O)`, giving `O3`, `X2`, `O1`,
which joins to `O3X2O1`.

**Decode**: walk with an index. At position `i` there must be a character; then consume every digit
that follows (`j` advances while `isdigit()`). The digits `encoded[i+1:j]` are the count. Empty digits
or a zero count is malformed input, so we raise `ValueError` with the position.

Trace for `"a12b1"`: `i=0`, char `a`, digits `12` → `j=3`, append 12 × `a`; `i=3`, char `b`, digits
`1` → `j=5`, append `b`; done.

## Complexity

Both are O(n) time and O(n) extra space for the output. Collecting parts in a list and joining once
avoids the quadratic cost of repeated string concatenation in a loop.

## Alternatives

- A manual loop with `current`/`count` variables for encoding works too, but you must remember to
  flush the last run after the loop (the classic bug, see below). `groupby` makes that impossible.
- `re.findall(r"(\D)(\d+)", encoded)` decodes in one line, but silently skips malformed parts
  (`"a"` would decode to `""`) unless you also check that the matches cover the whole string.

## Common bugs

- **Forgetting the last run** (`bugs/drops-last-run`): with a manual loop, runs are written when the
  character *changes*, so the final run is never written. Caught by `test_encode_keeps_the_last_run`.
- **Reading one digit only** (`bugs/single-digit-decode`): treating `"a12"` as `a×1` then a stray `2`.
  Caught by `test_decode_multi_digit_counts`.

## Idioms

- `itertools.groupby` groups *consecutive* equal items: exactly runs. (It does not sort.)
- `sum(1 for _ in it)` counts an iterator without building a list.
- `"".join(parts)` for building strings in loops.
- `f"{char!r}"` puts quotes around the character in error messages.

## Level up

1. Make the encoding binary-safe: digits in the input must also round-trip (hint: an escape character,
   or always write the count first with a separator).
2. Write a streaming `rle_encode_iter(chunks)` that accepts an iterable of string chunks, where a run
   may span two chunks.
