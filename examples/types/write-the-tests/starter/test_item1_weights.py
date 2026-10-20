# What to test, item 1: the weight of each unit, alone and combined.
import unittest

from subject import parse_duration


class TestWeights(unittest.TestCase):
    def test_seconds_alone(self):
        self.assertEqual(parse_duration("45s"), 45)

    # TODO: each unit's weight, alone and combined ("1h30m" -> 5400).


if __name__ == "__main__":
    unittest.main()
