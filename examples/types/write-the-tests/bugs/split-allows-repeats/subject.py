import re

_WEIGHT = {"h": 3600, "m": 60, "s": 1}


def parse_duration(text: str) -> int:
    """'1h30m' -> 5400 seconds. Units h, m, s, in that order, each at most once."""
    # BUG (plausible alternative): tokenizing with findall and checking the token sequence's order
    # with <= lets a unit repeat ("1h2h" -> 10800).
    tokens = re.findall(r"(\d+)([hms])", text)
    if not tokens or "".join(n + u for n, u in tokens) != text:
        raise ValueError(f"invalid duration: {text!r}")
    units = [u for _, u in tokens]
    if any("hms".index(a) > "hms".index(b) for a, b in zip(units, units[1:])):
        raise ValueError(f"invalid duration: {text!r}")
    return sum(int(n) * _WEIGHT[u] for n, u in tokens)
