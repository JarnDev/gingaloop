## Hint 1
If the intervals were sorted by start, you'd only ever need to compare each interval with the last
one you kept.

## Hint 2
Validate first (and throw), drop empties, sort by `start`, then sweep: extend the last kept interval
when the next one starts at or before its end, otherwise start a new one.

## Hint 3
`std::ranges::sort(v, {}, &Interval::start);` then
`if (!out.empty() && iv.start <= out.back().end) out.back().end = std::max(out.back().end, iv.end); else out.push_back(iv);`
