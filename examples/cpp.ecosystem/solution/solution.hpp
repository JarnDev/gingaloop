#pragma once

#include <vector>

struct Interval {
    int start;  // inclusive
    int end;    // exclusive
    bool operator==(const Interval&) const = default;
};

std::vector<Interval> merge_intervals(std::vector<Interval> intervals);
