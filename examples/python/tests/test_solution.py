import json
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", os.environ.get("TARGET", "starter")))
from solution import rle_decode, rle_encode  # noqa: E402


class TestEncode(unittest.TestCase):
    def test_encode_basic_runs(self):
        self.assertEqual(rle_encode("OOOOOXXOOO"), "O5X2O3")

    def test_encode_empty_string(self):
        self.assertEqual(rle_encode(""), "", "an empty input has no runs, so the output is empty")

    def test_encode_keeps_the_last_run(self):
        self.assertEqual(rle_encode("ab"), "a1b1", "the final run must be written after the loop ends")

    def test_encode_long_run_has_multi_digit_count(self):
        self.assertEqual(rle_encode("z" * 12), "z12")


class TestDecode(unittest.TestCase):
    def test_decode_basic(self):
        self.assertEqual(rle_decode("O5X2O3"), "OOOOOXXOOO")

    def test_decode_multi_digit_counts(self):
        self.assertEqual(rle_decode("a12b1"), "a" * 12 + "b", "counts can have more than one digit")

    def test_decode_rejects_missing_count(self):
        with self.assertRaises(ValueError, msg="'a' alone has no count and must be rejected") as ctx:
            rle_decode("a")
        self.assertEqual(str(ctx.exception), "missing count after 'a' at position 0", "the README promises this exact message")

    def test_decode_rejects_missing_count_in_the_middle(self):
        with self.assertRaises(ValueError, msg="'b' has no count even though runs follow") as ctx:
            rle_decode("a2bc3")
        self.assertEqual(str(ctx.exception), "missing count after 'b' at position 2")

    def test_decode_rejects_zero_count(self):
        with self.assertRaises(ValueError, msg="a run of zero characters is not valid"):
            rle_decode("a0")

    def test_decode_one_digit_count_is_not_glued_to_the_next_run(self):
        self.assertEqual(rle_decode("a1b9"), "a" + "b" * 9)

    def test_round_trip(self):
        for text in ["", "x", "aaabccddd", "!!??..", "q" * 250]:
            self.assertEqual(rle_decode(rle_encode(text)), text, f"round trip failed for {text!r}")


class TestGoldenCases(unittest.TestCase):
    def test_golden_cases_encode_and_round_trip(self):
        with open(os.path.join(os.path.dirname(__file__), "cases.json")) as f:
            cases = json.load(f)
        for case in cases:
            text, encoded = case["text"], case["encoded"]
            self.assertEqual(rle_encode(text), encoded, f"rle_encode({text!r})")
            self.assertEqual(rle_decode(encoded), text, f"rle_decode({encoded!r})")


class TestPerformance(unittest.TestCase):
    def test_large_input_is_linear(self):
        text = "ab" * 500_000
        start = time.perf_counter()
        self.assertEqual(rle_decode(rle_encode(text)), text)
        self.assertLess(time.perf_counter() - start, 5.0, "1M chars should take well under a second in O(n)")


if __name__ == "__main__":
    unittest.main()
