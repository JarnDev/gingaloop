# Merge booking intervals: explanation

## Approach

Validate, clean, sort, sweep:

1. **Validate** every interval first, so a bad one throws before any work is done, with its own
   numbers in the message.
2. **Drop empties** with `std::erase_if` (C++20).
3. **Sort by start** with `std::ranges::sort(v, {}, &Interval::start)`, using a projection instead of
   a lambda comparator.
4. **Sweep** once: if the next interval starts at or before the end of the last kept one (`<=`,
   because touching half-open intervals merge), extend that end with `max`; otherwise start a new
   interval.

Trace: `{[8,10),[1,3),[2,6)}` sorts to `[1,3),[2,6),[8,10)`. `[2,6)` starts at 2 ≤ 3, so the last
becomes `[1,6)`. `[8,10)` starts at 8 > 6, so it's kept separately. Result: `{[1,6),[8,10)}`.

## Complexity

O(n log n) for the sort and O(n) for the sweep. The vector is taken by value and sorted in place, so
the caller's copy is untouched and there's one move.

## Alternatives

- A boolean "timeline" array marked per minute is O(range) in memory and breaks with large values.
- `std::map<int,int>` with insert-and-merge supports incremental inserts (good for a live service),
  but it's more code and slower for a one-shot batch.
- Sorting by `(start, end)` isn't needed: ties in start are resolved by `max` on the end.

## Common bugs

- **`<` instead of `<=`** (`bugs/adjacent-not-merged`): `[1,3)` and `[3,5)` stay separate. Caught by
  `MergeIntervals.AdjacentIntervalsMerge`.
- **Keeping empty intervals** (`bugs/keeps-empty`): `[5,5)` shows up in the output. Caught by
  `MergeIntervals.EmptyIntervalsAreDropped`.
- **Assuming sorted input** (`bugs/assumes-sorted`): the textbook sweep, but without the sort; most
  hand-written examples happen to be sorted. Caught by `MergeIntervals.UnsortedInputIsHandled`.

## Idioms

- `bool operator==(const Interval&) const = default;` gives you comparison (and readable GoogleTest
  failures) for free.
- Range projections (`&Interval::start`) instead of comparator lambdas.
- `INSTANTIATE_TEST_SUITE_P` + `ValuesIn` for table-driven tests.

## Level up

1. Return the **free** slots between bookings within `[open, close)`.
2. Support incremental `add(Interval)` on a `class Calendar` in O(log n) per insert.
