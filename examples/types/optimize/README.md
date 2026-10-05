# Count pairs with a target sum, within a time budget

## Problem

`starter/solution.py` has a **correct** `count_pairs(nums: list[int], target: int) -> int`: the
number of index pairs `i < j` with `nums[i] + nums[j] == target`. It's used by a fraud-detection job
on large batches, and it's far too slow. Make it fast enough **without changing what it returns**.

## Budget

The tests time `count_pairs` on 200 000 numbers, and it must finish within **2 seconds**. The current
code compares every pair: about 2 × 10^10 operations.

## Examples

```python
count_pairs([1, 5, 7, -1, 5], 6)   # 3: (1,5), (1,5), (7,-1)
count_pairs([3, 3, 3], 6)          # 3: every pair of the three 3s
count_pairs([3], 6)                # 0: an element doesn't pair with itself
count_pairs([], 0)                 # 0
```

## Constraints

- Standard library only. Values can be negative and repeated.
- The correctness tests also run on their own (`GINGA_PERF=0`): the behavior must stay identical.

## How to run

- `ginga test` runs the correctness tests and the budget test against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
