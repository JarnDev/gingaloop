from collections import Counter


def count_pairs(nums: list[int], target: int) -> int:
    """Number of index pairs i < j with nums[i] + nums[j] == target. O(n)."""
    seen: Counter[int] = Counter()
    total = 0
    for x in nums:
        total += seen[target - x]  # every earlier partner forms one pair with x
        seen[x] += 1
    return total
