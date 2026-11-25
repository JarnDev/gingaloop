# Reverse the words of a sentence

## Problem

Write `std::string reverse_words(std::string_view s)` in `starter/solution.cpp`. It returns the
words of `s` in reverse order.

- A word is a sequence of characters that are not `' '`, with a space or the string's start or end
  on each side.
- In the result, exactly one space separates two words. The result has no space at the start or
  at the end.
- The letters in each word stay in the same order.

## Examples

```cpp
reverse_words("the sky is blue")   // "blue is sky the"
reverse_words("  hello world  ")   // "world hello"
reverse_words("a good   example")  // "example good a"
reverse_words("   ")               // ""
```

## Constraints

- The time is O(n).
- Use C++20 and only the standard library. The tests compile with
  `-Wall -Wextra -Wpedantic -Werror` and sanitizers.

## How to run

- `ginga test` builds and runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
