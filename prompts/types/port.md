The user ports a working solution from {{SOURCE_LANG}} into this challenge's language.

Layout: the generic layout PLUS
```
source/             # a complete, idiomatic, CORRECT solution in {{SOURCE_LANG}}, VISIBLE, with a
                    # short header comment saying what it does
```
- challenge.json: `"sourceLang": "<source profile id>"`.
- The tests are written in the TARGET language only; the target solution must behave exactly like
  the source (same inputs → same outputs/errors), including edge cases.
- Pick a problem where a literal line-by-line translation goes wrong in the target language, and make
  those the bug variants: integer division and overflow, string indexing (bytes vs code points),
  mutability and copying, null/undefined/None, sorting stability and comparators, hash map iteration
  order, exceptions vs error values. At least one "alternative" bug is a literal translation that
  compiles and looks right.
- README: `## Problem`, `## Source` (what the source does and where it is), `## Examples`,
  `## Constraints` (write idiomatic target-language code, not a transliteration).
- EXPLANATION.md compares the two languages for every pitfall the bugs show.
