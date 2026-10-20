# Tests for other invalid input (not graded on its own).
import unittest

from subject import parse_duration


class TestOtherInvalid(unittest.TestCase):
    def test_unknown_unit_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_duration("5d")

    # TODO: missing numbers, spaces and signs.


if __name__ == "__main__":
    unittest.main()
