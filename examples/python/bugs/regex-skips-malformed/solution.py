import re
from itertools import groupby


def rle_encode(text: str) -> str:
    """'OOOOOXXOOO' -> 'O5X2O3'"""
    return "".join(f"{char}{sum(1 for _ in run)}" for char, run in groupby(text))


def rle_decode(encoded: str) -> str:
    """'a12b1' -> 'aaaaaaaaaaaab'; raises ValueError on malformed input."""
    # BUG (plausible alternative): findall silently skips anything that doesn't match,
    # so "a" decodes to "" instead of raising, and "a0" decodes to "".
    return "".join(char * int(count) for char, count in re.findall(r"(\D)(\d+)", encoded))
