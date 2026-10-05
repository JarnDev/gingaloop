import unittest

from subject import parse_duration


class TestParseDuration(unittest.TestCase):
    def test_hours_and_minutes(self):
        self.assertEqual(parse_duration("1h30m"), 5400)

    # TODO: each unit's weight, combinations, and every kind of invalid input
    # (with the exact error message).


if __name__ == "__main__":
    unittest.main()
