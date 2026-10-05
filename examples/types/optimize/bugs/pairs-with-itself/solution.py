from collections import Counter


def count_pairs(nums: list[int], target: int) -> int:
    """Number of index pairs i < j with nums[i] + nums[j] == target."""
    seen: Counter[int] = Counter()
    total = 0
    for x in nums:
        seen[x] += 1  # BUG: counted before looking up its partner, so x pairs with itself when 2x == target
        total += seen[target - x]
    return total
