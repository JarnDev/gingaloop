## Hint 1
Sort the intervals by start. Then you compare each interval only with the last interval that you
kept.

## Hint 2
First check each interval, and throw for an invalid one. Then remove the empty intervals and sort by
`start`. Then go through the list. If the next interval starts at or before the end of the last kept
interval, extend the last kept interval. If not, keep the next interval as a new one.

## Hint 3
`std::ranges::sort(v, {}, &Interval::start);` then
`if (!out.empty() && iv.start <= out.back().end) out.back().end = std::max(out.back().end, iv.end); else out.push_back(iv);`
