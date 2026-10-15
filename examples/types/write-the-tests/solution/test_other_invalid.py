# The other invalid inputs from the contract. No item of its own, so it always runs.
import unittest

from subject import parse_duration


class TestOtherInvalid(unittest.TestCase):
    def assert_invalid(self, text):
        with self.assertRaises(ValueError):
            parse_duration(text)

    def test_unknown_unit_is_rejected(self):
        self.assert_invalid("5d")

    def test_missing_number_is_rejected(self):
        self.assert_invalid("h")
        self.assert_invalid("1hm")

    def test_spaces_and_signs_are_rejected(self):
        self.assert_invalid("1h 30m")
        self.assert_invalid("-5m")


if __name__ == "__main__":
    unittest.main()
