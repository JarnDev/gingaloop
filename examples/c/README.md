# Count words in a C string

## Problem

Implement `size_t count_words(const char *s)` in `starter/solution.c`, like `wc -w` does for one
string: a word is a maximal sequence of non-whitespace characters, where whitespace is anything
`isspace()` accepts (space, `\t`, `\n`, `\v`, `\f`, `\r`). `NULL` counts as 0 words.

The function must not modify the string or read past its terminating `'\0'`.

## Examples

```c
count_words("hello world")       // 2
count_words("  spaced   out  ")  // 2
count_words("tab\tand\nnewline") // 3
count_words("")                  // 0
count_words(NULL)                // 0
```

## Constraints

- One pass, O(n), no allocation.
- Pass the argument to `isspace` as `(unsigned char)c` (negative `char` values are undefined behavior).
- Compiled with `-Wall -Wextra -Wpedantic -Werror` and AddressSanitizer/UBSan.

## How to run

- `ginga test` builds and runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
