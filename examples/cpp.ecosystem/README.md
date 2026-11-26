# Merge booking intervals

## Problem

A room-booking service keeps each reservation as a half-open interval `[start, end)`, in minutes.
Write `merge_intervals` in `starter/solution.cpp`:

```cpp
struct Interval { int start; int end; };          // [start, end)
std::vector<Interval> merge_intervals(std::vector<Interval> intervals);
```

- Two intervals that overlap **or touch** become one interval: `[1,3)` and `[3,5)` become `[1,5)`.
- The function removes each empty interval (`start == end`).
- For an interval with `start > end`, the function throws `std::invalid_argument`. The message
  contains the numbers of that interval: `invalid interval [5, 3)`.
- The input can be in any order. The result is sorted by `start`. No two intervals in the result
  touch or overlap.

## Examples

```cpp
merge_intervals({{1,3},{2,6},{8,10},{10,12}})  // {[1,6), [8,12)}
merge_intervals({{5,5},{0,1}})                 // {[0,1)}
merge_intervals({})                            // {}
merge_intervals({{5,3}})                       // throws invalid_argument("invalid interval [5, 3)")
```

## Constraints

- The input has at most 10^6 intervals. The time is O(n log n).
- Use C++20. The tests use GoogleTest, and CMake builds them.

## How to run

- `ginga test` builds with CMake and runs the GoogleTest suite against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
