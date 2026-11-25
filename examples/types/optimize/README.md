# Count pairs with a target sum, within a time budget

## Problem

`starter/solution.py` has a **correct** `count_pairs(nums: list[int], target: int) -> int`. It
returns the number of index pairs `i < j` with `nums[i] + nums[j] == target`. A fraud-detection job
uses it on large batches, and it is much too slow. Make it fast enough **and keep the same results**.

## Budget

The tests measure `count_pairs` on 200 000 numbers. It must finish in **2 seconds** or less. The
current code compares each pair: approximately 2 × 10^10 operations.

## Examples

```python
count_pairs([1, 5, 7, -1, 5], 6)   # 3: (1,5), (1,5), (7,-1)
count_pairs([3, 3, 3], 6)          # 3: every pair of the three 3s
count_pairs([3], 6)                # 0: an element doesn't pair with itself
count_pairs([], 0)                 # 0
```

## Constraints

- Use only the standard library.
- Values can be negative. A value can occur more than one time.
- The correctness tests also run without the budget test (`GINGA_PERF=0`). The results must stay
  the same.

## How to run

- `ginga test` runs the correctness tests and the budget test against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
