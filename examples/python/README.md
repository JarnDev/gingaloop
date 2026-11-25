# Run-length encoding

## Problem

A log shipper compresses status strings such as `"OOOOOXXOOO"` before it sends them. Write the
two functions of a simple run-length encoding in `starter/solution.py`.

- `rle_encode(text: str) -> str`: each run (a sequence of the same character) becomes
  `<char><count>`.
- `rle_decode(encoded: str) -> str`: does the opposite. A count can have more than one digit.
- `rle_decode` raises `ValueError` for a malformed input: a character without a count, or a count
  of zero.

## Examples

```python
>>> rle_encode("OOOOOXXOOO")
'O5X2O3'
>>> rle_encode("")
''
>>> rle_decode("a12b1")
'aaaaaaaaaaaab'
>>> rle_decode("a")
Traceback (most recent call last):
ValueError: missing count after 'a' at position 0
```

## Constraints

- The input characters are letters or punctuation. They are never digits.
- The input has at most 10^6 characters. Aim for O(n).
- Use only the standard library.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
