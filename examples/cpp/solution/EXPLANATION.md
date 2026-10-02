# Reverse the words of a sentence: explanation

## Approach

1. **Tokenize without copying**: scan once, skipping runs of spaces. Each word is recorded as a
   `std::string_view` into the original input, which is a pointer and a length with no allocation per word.
2. **Join backwards**: walk the vector with reverse iterators and append each word, adding a single
   `' '` before every word except the first. `reserve(s.size())` makes the output allocate once.

Trace for `"  hi  you "`: skip 2 spaces, word `hi`; skip 2, word `you`; skip 1, end. The views are
`[hi, you]`; joined backwards that gives `"you hi"`.

## Complexity

O(n) time: every character is visited a constant number of times. O(n) space for the output plus
O(w) views.

## Alternatives

- `std::istringstream` with `>> word` tokenizes on whitespace in two lines, but copies every word into
  a `std::string` and is much slower.
- The classic in-place trick: reverse the whole string, then reverse each word back. That uses O(1)
  extra space when you own a mutable buffer. It still needs a pass to collapse spaces.
- C++20 ranges: `s | std::views::split(' ')` then filter empties. Elegant, but it is easy to get the
  types wrong and harder to read at level 1.

## Common bugs

- **Splitting on every single space** (`bugs/keeps-extra-spaces`): runs of spaces produce empty words,
  so the output has double spaces. Caught by `[FAIL] collapses repeated spaces`.
- **Reversing characters instead of words** (`bugs/reverses-letters`): `std::reverse` on the whole
  string turns `"abc de"` into `"ed cba"`. Caught by `[FAIL] letters inside words keep their order`.
- **Dangling views**: a `std::string_view` must not outlive the string it points into. Here every view
  points into the caller's `s`, which outlives the function call, so it is safe.

## Idioms

- `std::string_view` parameters accept literals, `std::string` and substrings without copies.
- `rbegin()`/`rend()` iterate backwards without index arithmetic.
- `reserve` before appending in a loop avoids repeated reallocation.

## Level up

1. Do it in place on a `std::string&` with O(1) extra memory (reverse all, then reverse each word,
   then compact the spaces).
2. Make it generic: `template <std::ranges::forward_range R> auto reverse_tokens(R&&, delimiter)`
   constrained with concepts.
