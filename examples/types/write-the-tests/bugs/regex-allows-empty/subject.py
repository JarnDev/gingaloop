import re

# BUG (plausible alternative): one fullmatch regex with optional groups; every group is optional,
# so the empty string matches and returns 0 instead of raising.
_FULL = re.compile(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?")


def parse_duration(text: str) -> int:
    """'1h30m' -> 5400 seconds. Units h, m, s, in that order, each at most once."""
    match = _FULL.fullmatch(text)
    if not match:
        raise ValueError(f"invalid duration: {text!r}")
    h, m, s = (int(g) if g else 0 for g in match.groups())
    return h * 3600 + m * 60 + s
