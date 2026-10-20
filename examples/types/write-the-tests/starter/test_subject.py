import unittest

from subject import parse_duration


class TestParseDuration(unittest.TestCase):
    def test_seconds_alone(self):
        self.assertEqual(parse_duration("45s"), 45)

    def test_unknown_unit_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_duration("5d")

    # TODO: each unit's weight, combinations, and every kind of invalid input
    # (with the exact error message).


if __name__ == "__main__":
    unittest.main()
