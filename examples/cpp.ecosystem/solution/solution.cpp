#include "solution.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>

std::vector<Interval> merge_intervals(std::vector<Interval> intervals) {
    for (const auto& iv : intervals) {
        if (iv.start > iv.end) {
            throw std::invalid_argument("invalid interval [" + std::to_string(iv.start) + ", " +
                                        std::to_string(iv.end) + ")");
        }
    }
    std::erase_if(intervals, [](const Interval& iv) { return iv.start == iv.end; });
    std::ranges::sort(intervals, {}, &Interval::start);

    std::vector<Interval> out;
    out.reserve(intervals.size());
    for (const auto& iv : intervals) {
        if (!out.empty() && iv.start <= out.back().end) {
            out.back().end = std::max(out.back().end, iv.end);
        } else {
            out.push_back(iv);
        }
    }
    return out;
}
