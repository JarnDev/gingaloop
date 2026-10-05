The user reads a short program and predicts its exact output, without running it.

Layout (differs from the generic one):
```
program/            # the program to trace, VISIBLE: 20–60 lines, deterministic, standard library only
starter/answer.txt  # what the user edits: one line "TODO"
solution/answer.txt # the exact output of the program (computed by RUNNING it in the sandbox)
solution/EXPLANATION.md  # step-by-step trace of the tricky parts
bugs/<name>/answer.txt   # 3–5 plausible WRONG answers, each the result of a specific misreading
                    # (evaluation order, closures capturing variables, aliasing/mutation, integer
                    # division, string/Unicode length, shadowing, default arguments, short-circuit)
tests/              # harness: runs program/ in the sandbox and compares its stdout with ../$TARGET/answer.txt
```
- The harness normalizes only trailing whitespace and the final newline. On a mismatch it prints the
  1-based numbers of the differing lines and the line counts, and NEVER prints the program's
  output (that would reveal the answer). Name each check so `bugs[].expect` can target it, e.g. one
  check per output line: "line 3 matches".
- The program must not be trivially guessable and must exercise a real mechanism of the language
  (the level's rubric). No randomness, time, or environment dependence.
- README: `## Problem` (what to predict), `## Program` (how to read it: files in program/, which one
  runs), `## Answer format` (exact format of answer.txt), `## Examples` (one tiny worked example of
  the same mechanism, NOT this program), `## Constraints` ("don't run it: the point is to read it").
- The starter fails; the solution passes; each bug answer fails on the line it gets wrong.
- bug kinds can be "misread" (alternative bugs are not required for this type).
