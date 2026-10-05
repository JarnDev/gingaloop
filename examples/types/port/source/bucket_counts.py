"""Counts values per bucket of a fixed size: bucket = value // size (floor division).

bucket_counts([-1, 0, 9, 10, 25], 10) -> [(-1, 1), (0, 2), (1, 1), (2, 1)]
"""
from collections import Counter


def bucket_counts(values: list[int], size: int) -> list[tuple[int, int]]:
    if size <= 0:
        raise ValueError("size must be positive")
    counts = Counter(v // size for v in values)
    return sorted(counts.items())
