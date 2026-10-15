# What to test, item 1: the weight of each unit, alone and combined.
import unittest

from subject import parse_duration


class TestWeights(unittest.TestCase):
    def test_hours_and_minutes(self):
        self.assertEqual(parse_duration("1h30m"), 5400)

    def test_each_unit_has_its_own_weight(self):
        self.assertEqual(parse_duration("1h"), 3600)
        self.assertEqual(parse_duration("1m"), 60)
        self.assertEqual(parse_duration("1s"), 1)

    def test_all_three_units(self):
        self.assertEqual(parse_duration("2h5m7s"), 2 * 3600 + 5 * 60 + 7)

    def test_skipping_a_unit_is_fine(self):
        self.assertEqual(parse_duration("2h5s"), 7205)

    def test_multi_digit_numbers_and_zero(self):
        self.assertEqual(parse_duration("90m"), 5400)
        self.assertEqual(parse_duration("0s"), 0)


if __name__ == "__main__":
    unittest.main()
