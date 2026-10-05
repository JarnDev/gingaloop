import unittest

from subject import parse_duration


class TestParseDuration(unittest.TestCase):
    # Happy path, one rule at a time
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

    # Invalid inputs: each kind on its own, with the exact message
    def assert_invalid(self, text):
        with self.assertRaises(ValueError) as ctx:
            parse_duration(text)
        self.assertEqual(str(ctx.exception), f"invalid duration: {text!r}")

    def test_empty_text_is_rejected(self):
        self.assert_invalid("")

    def test_unknown_unit_is_rejected(self):
        self.assert_invalid("5d")

    def test_units_out_of_order_are_rejected(self):
        self.assert_invalid("30m1h")
        self.assert_invalid("5s2m")

    def test_repeated_unit_is_rejected(self):
        self.assert_invalid("1h2h")

    def test_missing_number_is_rejected(self):
        self.assert_invalid("h")
        self.assert_invalid("1hm")

    def test_spaces_and_signs_are_rejected(self):
        self.assert_invalid("1h 30m")
        self.assert_invalid("-5m")


if __name__ == "__main__":
    unittest.main()
