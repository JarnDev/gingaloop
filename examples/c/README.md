# Count words in a C string

## Problem

Write `size_t count_words(const char *s)` in `starter/solution.c`. It counts the words of one
string, as `wc -w` does.

- A word is a sequence of characters that are not whitespace, with whitespace or the string's
  start or end on each side.
- Whitespace is each character that `isspace()` accepts: space, `\t`, `\n`, `\v`, `\f` and `\r`.
- For `NULL`, the function returns 0.
- The function must not change the string. It must not read after the terminating `'\0'`.

## Examples

```c
count_words("hello world")       // 2
count_words("  spaced   out  ")  // 2
count_words("tab\tand\nnewline") // 3
count_words("")                  // 0
count_words(NULL)                // 0
```

## Constraints

- Read the string one time: O(n), with no allocation.
- Give the argument to `isspace` as `(unsigned char)c`. A negative `char` value causes undefined
  behavior.
- The tests compile with `-Wall -Wextra -Wpedantic -Werror` and AddressSanitizer/UBSan.

## How to run

- `ginga test` builds and runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
