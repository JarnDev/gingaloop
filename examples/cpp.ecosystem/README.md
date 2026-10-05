# Merge booking intervals

## Problem

A room-booking service stores reservations as half-open intervals `[start, end)` in minutes. Implement
`merge_intervals` in `starter/solution.cpp`:

```cpp
struct Interval { int start; int end; };          // [start, end)
std::vector<Interval> merge_intervals(std::vector<Interval> intervals);
```

- Overlapping **or touching** intervals merge: `[1,3)` and `[3,5)` become `[1,5)`.
- Empty intervals (`start == end`) are dropped.
- An interval with `start > end` throws `std::invalid_argument` with the message
  `invalid interval [5, 3)` (its own numbers).
- The input can be in any order; the result is sorted by `start`, and no two results touch or
  overlap.

## Examples

```cpp
merge_intervals({{1,3},{2,6},{8,10},{10,12}})  // {[1,6), [8,12)}
merge_intervals({{5,5},{0,1}})                 // {[0,1)}
merge_intervals({})                            // {}
merge_intervals({{5,3}})                       // throws invalid_argument("invalid interval [5, 3)")
```

## Constraints

- Up to 10^6 intervals: O(n log n).
- C++20; tests use GoogleTest, built with CMake.

## How to run

- `ginga test` builds with CMake and runs the GoogleTest suite against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
