# What to test, item 4: empty text is rejected.
import unittest

from subject import parse_duration


class TestEmpty(unittest.TestCase):
    def test_empty_text_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_duration("")


if __name__ == "__main__":
    unittest.main()
