# Reverse the words of a sentence

## Problem

Implement `std::string reverse_words(std::string_view s)` in `starter/solution.cpp`. It returns the
words of `s` in reverse order, separated by exactly one space, with no leading or trailing spaces.
Words are maximal runs of characters other than `' '`. The letters inside each word keep their order.

## Examples

```cpp
reverse_words("the sky is blue")   // "blue is sky the"
reverse_words("  hello world  ")   // "world hello"
reverse_words("a good   example")  // "example good a"
reverse_words("   ")               // ""
```

## Constraints

- O(n) time.
- C++20, standard library only, compiled with `-Wall -Wextra -Wpedantic -Werror` and sanitizers.

## How to run

- `ginga test` builds and runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
