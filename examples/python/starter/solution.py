def rle_encode(text: str) -> str:
    """'OOOOOXXOOO' -> 'O5X2O3'"""
    raise NotImplementedError("rle_encode")


def rle_decode(encoded: str) -> str:
    """'a12b1' -> 'aaaaaaaaaaaab'; raises ValueError on malformed input."""
    raise NotImplementedError("rle_decode")
