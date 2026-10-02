# Count words in a C string: explanation

## Approach

A two-state machine: **inside a word** or **outside**. Walking the string once:

- whitespace → we are outside;
- non-whitespace while outside → a new word starts: count it and move inside.

Counting word *starts* is robust to any number of leading, trailing or repeated separators.

Trace for `"  ab c"`: ` ` out, ` ` out, `a` start (1), `b` inside, ` ` out, `c` start (2). Result 2.

## Complexity

O(n) time, a single pass; O(1) memory, with no allocation and no copies.

## Alternatives

- `strtok` counts tokens easily, but it **modifies** the string (writes `'\0'`s) and keeps hidden
  global state, so it is not usable on a `const char *` and not reentrant.
- `sscanf("%s")` in a loop with `%n` works, but it is slower and harder to read.
- Counting separators + 1 is the tempting shortcut. It is wrong for leading, trailing and repeated
  whitespace (see below).

## Common bugs

- **Counting separators** (`bugs/leading-space`): `"  spaced   out  "` gives 8 instead of 2. Caught by
  `[FAIL] leading and trailing whitespace`.
- **Only `' '` as whitespace** (`bugs/space-only-separator`): tabs and newlines glue words together.
  Caught by `[FAIL] tabs and newlines separate words`.
- **`isspace(*s)` with a plain `char`**: on platforms where `char` is signed, bytes ≥ 0x80 become
  negative, and passing them to `isspace` is undefined behavior. Always cast to `unsigned char`. The
  UTF-8 test exercises those bytes.

## Idioms

- `for (; *s != '\0'; s++)` walks a C string by pointer; the parameter is a local copy, so advancing
  it is fine.
- `<stdbool.h>` gives you `bool`, which makes state flags self-documenting.
- `(void)param;` silences unused-parameter warnings in stubs under `-Werror`.

## Level up

1. Write `size_t split_words(const char *s, const char **starts, size_t *lens, size_t cap)` that
   reports where each word is, without copying or allocating.
2. Count UTF-8 *characters* per word (a byte starts a character iff `(b & 0xC0) != 0x80`).
