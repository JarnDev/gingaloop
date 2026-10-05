def count_pairs(nums: list[int], target: int) -> int:
    """Number of index pairs i < j with nums[i] + nums[j] == target."""
    # WRONG OPTIMIZATION (plausible alternative): a set remembers that a value was seen, not how many
    # times, so [3, 3, 3] with target 6 gives 2 instead of 3.
    seen: set[int] = set()
    total = 0
    for x in nums:
        if target - x in seen:
            total += 1
        seen.add(x)
    return total
