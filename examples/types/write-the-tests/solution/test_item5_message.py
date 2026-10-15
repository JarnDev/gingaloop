# What to test, item 5: the exact error type and message. The other files only check that
# ValueError is raised, so this file is the only one that pins the message down. Its inputs are
# invalid for reasons outside items 2-4, so it says nothing about order, repeats or empty text.
import unittest

from subject import parse_duration


class TestMessage(unittest.TestCase):
    def test_exact_error_message(self):
        for text in ("5d", "1h 30m", "h"):
            with self.assertRaises(ValueError) as ctx:
                parse_duration(text)
            self.assertEqual(str(ctx.exception), f"invalid duration: {text!r}")


if __name__ == "__main__":
    unittest.main()
