# What to test, item 5: the exact error type and message.
import unittest

from subject import parse_duration  # noqa: F401 (the tests you add use it)


class TestMessage(unittest.TestCase):
    # TODO: the exact ValueError message, e.g. for "5d".
    pass


if __name__ == "__main__":
    unittest.main()
