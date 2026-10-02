# Run-length encoding

## Problem

A log shipper compresses status strings like `"OOOOOXXOOO"` before sending them. Implement both sides
of a simple run-length encoding in `starter/solution.py`:

- `rle_encode(text: str) -> str`: every run of the same character becomes `<char><count>`.
- `rle_decode(encoded: str) -> str`: the inverse. Counts can have several digits.

`rle_decode` raises `ValueError` when the input is malformed: a character without a count, or a
count of zero.

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

- Input characters are letters or punctuation, never digits.
- Up to 10^6 characters; aim for O(n).
- Standard library only.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
