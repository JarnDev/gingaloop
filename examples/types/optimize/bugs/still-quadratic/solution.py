def count_pairs(nums: list[int], target: int) -> int:
    """Number of index pairs i < j with nums[i] + nums[j] == target."""
    # ALMOST OPTIMIZED (plausible alternative): one loop, but list.count() scans the prefix every time,
    # so it is still O(n²) and blows the budget.
    total = 0
    for i, x in enumerate(nums):
        total += nums[:i].count(target - x)
    return total
