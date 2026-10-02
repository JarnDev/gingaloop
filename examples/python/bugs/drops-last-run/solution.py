from itertools import groupby


def rle_encode(text: str) -> str:
    """'OOOOOXXOOO' -> 'O5X2O3'"""
    out = []
    current, count = None, 0
    for char in text:
        if char == current:
            count += 1
        else:
            if current is not None:
                out.append(f"{current}{count}")
            current, count = char, 1
    return "".join(out)  # BUG: the final run is never flushed


def rle_decode(encoded: str) -> str:
    """'a12b1' -> 'aaaaaaaaaaaab'; raises ValueError on malformed input."""
    parts = []
    i = 0
    while i < len(encoded):
        char = encoded[i]
        j = i + 1
        while j < len(encoded) and encoded[j].isdigit():
            j += 1
        if j == i + 1:
            raise ValueError(f"missing count after {char!r} at position {i}")
        count = int(encoded[i + 1 : j])
        if count == 0:
            raise ValueError(f"zero count after {char!r} at position {i}")
        parts.append(char * count)
        i = j
    return "".join(parts)
