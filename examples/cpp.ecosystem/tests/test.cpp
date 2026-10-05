#include <gtest/gtest.h>

#include <stdexcept>
#include <string>
#include <vector>

#include "cases.hpp"
#include "solution.hpp"

using V = std::vector<Interval>;

TEST(MergeIntervals, OverlappingIntervalsMerge) {
    EXPECT_EQ(merge_intervals({{1, 3}, {2, 6}, {8, 10}}), (V{{1, 6}, {8, 10}}));
}

TEST(MergeIntervals, AdjacentIntervalsMerge) {
    EXPECT_EQ(merge_intervals({{1, 3}, {3, 5}}), (V{{1, 5}})) << "[1,3) and [3,5) touch at 3 and must merge";
}

TEST(MergeIntervals, ContainedIntervalKeepsTheOuterEnd) {
    EXPECT_EQ(merge_intervals({{1, 10}, {2, 3}}), (V{{1, 10}}));
}

TEST(MergeIntervals, EmptyIntervalsAreDropped) {
    EXPECT_EQ(merge_intervals({{5, 5}, {0, 1}}), (V{{0, 1}}));
    EXPECT_EQ(merge_intervals({{2, 2}}), V{});
}

TEST(MergeIntervals, UnsortedInputIsHandled) {
    EXPECT_EQ(merge_intervals({{8, 10}, {1, 3}, {2, 6}}), (V{{1, 6}, {8, 10}}));
}

TEST(MergeIntervals, EmptyInputGivesEmptyOutput) {
    EXPECT_EQ(merge_intervals({}), V{});
}

TEST(MergeIntervals, InvalidIntervalThrowsWithItsNumbers) {
    try {
        merge_intervals({{0, 1}, {5, 3}});
        FAIL() << "expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "invalid interval [5, 3)");
    }
}

class Golden : public ::testing::TestWithParam<GoldenCase> {};

TEST_P(Golden, MatchesReference) {
    const auto& c = GetParam();
    EXPECT_EQ(merge_intervals(c.input), c.expected);
}

INSTANTIATE_TEST_SUITE_P(MergeIntervals, Golden, ::testing::ValuesIn(golden_cases()));
