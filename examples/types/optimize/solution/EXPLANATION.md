# Count pairs within a time budget: explanation

## Approach

The partner of `x` is fully determined: `target - x`. Walk the list once, keeping a `Counter` of
the values seen so far. Each new `x` forms one pair with **every earlier occurrence** of its partner,
so add `seen[target - x]`, *then* record `x`. Recording after the lookup is what keeps `i < j`: an
element never pairs with itself.

Trace for `[3, 3, 3]`, target 6:
- x=3, seen={}: +0, seen={3:1}
- x=3: +1, seen={3:2}
- x=3: +2, seen={3:3}

Total 3: the pairs (0,1), (0,2), (1,2).

## Complexity

O(n) time and O(distinct values) space, against O(n²) for the nested loops. For n = 200 000 that's
about 2·10^5 dictionary operations instead of 2·10^10 additions: a factor of about 10^5, so the
result doesn't depend on how loaded the machine is.

## Alternatives

- **Sort + two pointers**: O(n log n). Correct only if runs of equal values are counted with care
  (the count of pairs between two runs is a product, and a run pairing with itself contributes
  `k·(k-1)/2`).
- **Counter of the whole list, then combinatorics**: count each value once, then add
  `c[x]·c[t-x]` for x < t-x and `c[x]·(c[x]-1)/2` for x == t-x. Also O(n), with more edge cases.
- `set` instead of `Counter`: fast, but wrong with duplicates (see the bugs).

## Common bugs

- **A set instead of a counter** (`bugs/set-loses-duplicates`): `[3,3,3]` gives 2. Caught by
  `test_duplicates_make_more_pairs`.
- **Recording before looking up** (`bugs/pairs-with-itself`): `[3]`, target 6 gives 1. Caught by
  `test_an_element_does_not_pair_with_itself`.
- **"One loop" that's still quadratic** (`bugs/still-quadratic`): `nums[:i].count(...)` hides an inner
  scan. Caught by `test_large_input_within_budget`.

## Idioms

- `collections.Counter` returns 0 for missing keys, so no `if key in` is needed.
- Measure with `time.perf_counter()`; guard long runs with `signal.setitimer` in tests.
- Keep the behavior identical while optimizing: run the correctness tests alone (`GINGA_PERF=0`).

## Level up

1. Return the pairs themselves for the first 10 matches, still in O(n + 10).
2. Stream version: numbers arrive one by one, and `add(x)` must return the running count in O(1).
