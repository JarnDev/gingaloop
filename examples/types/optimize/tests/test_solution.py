import json
import os
import random
import signal
import sys
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", os.environ.get("TARGET", "starter")))
from solution import count_pairs  # noqa: E402

BUDGET_SECONDS = 2.0
PERF = os.environ.get("GINGA_PERF") != "0"


class TestCorrectness(unittest.TestCase):
    def test_counts_index_pairs(self):
        self.assertEqual(count_pairs([1, 5, 7, -1, 5], 6), 3)

    def test_duplicates_make_more_pairs(self):
        self.assertEqual(count_pairs([3, 3, 3], 6), 3, "three equal values form three pairs")
        self.assertEqual(count_pairs([2, 2, 4, 4], 6), 4)

    def test_an_element_does_not_pair_with_itself(self):
        self.assertEqual(count_pairs([3], 6), 0)
        self.assertEqual(count_pairs([3, 1], 6), 0)

    def test_negative_numbers_and_zero_target(self):
        self.assertEqual(count_pairs([-2, 2, 0, 0, -2], 0), 3)

    def test_empty_and_no_match(self):
        self.assertEqual(count_pairs([], 0), 0)
        self.assertEqual(count_pairs([1, 2, 3], 100), 0)

    def test_golden_cases(self):
        with open(os.path.join(os.path.dirname(__file__), "cases.json")) as f:
            for case in json.load(f):
                self.assertEqual(count_pairs(case["nums"], case["target"]), case["expected"], case)


@unittest.skipUnless(PERF, "budget tests disabled with GINGA_PERF=0")
class TestBudget(unittest.TestCase):
    def test_large_input_within_budget(self):
        rng = random.Random(7)
        nums = [rng.randint(-1000, 1000) for _ in range(200_000)]
        # Abort well before the sandbox timeout so a slow solution fails with a clear message.
        def over(_signum, _frame):
            raise TimeoutError("over budget: still running after 3× the budget")
        signal.signal(signal.SIGALRM, over)
        signal.setitimer(signal.ITIMER_REAL, BUDGET_SECONDS * 3)
        try:
            start = time.perf_counter()
            count_pairs(nums, 17)
            elapsed = time.perf_counter() - start
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
        self.assertLess(elapsed, BUDGET_SECONDS, f"over budget: {elapsed:.2f}s for 200 000 numbers (budget {BUDGET_SECONDS}s)")


if __name__ == "__main__":
    unittest.main()
