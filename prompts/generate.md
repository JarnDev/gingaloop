You are writing ONE coding practice challenge for gingaloop. Work only inside the current directory
(it is an empty staging directory). Write files with the Write/Edit tools.

# The assignment

- Language: {{LANG}} (profile id `{{LANG_ID}}`)
- Stack: {{STACK}}
- Level: {{LEVEL}}
- Challenge type: {{TYPE}} (type-specific rules below override the generic layout where they differ)
- Industry domain: {{DOMAIN}}
- Practice area: {{AREA}}. The problem must clearly exercise this area: the user is working
  through a coverage map, so a challenge that drifts to another area defeats the purpose.
- {{REVIEW}}

## What level {{LEVEL}} means
{{LEVEL_RUBRIC}}

Language-specific notes for this level: {{LEVEL_NOTES}}

## Challenge types
- implement: starter/ has the signature/skeleton and TODOs; the user writes the logic.
- fix-the-bug: starter/ has a plausible implementation with 1–3 real bugs (the kind people actually write);
  README.md describes the intended behavior and says that the code is buggy, without saying where.
- refactor: starter/ has working-but-poor code that FAILS only the tests for a new requirement
  (performance budget, an API change, or a missing feature that the messy structure makes hard).
- extend: starter/ has a small working module; README asks for a new feature on top of it.

## Rules for the challenge type "{{TYPE}}"
{{TYPE_GUIDE}}

## Challenges already given in this language (do NOT repeat any of them, not even reworded)
A repeat of an earlier problem is rejected automatically, so pick a genuinely different one.
{{AVOID}}

## Topics the user struggled with (fair game to revisit from a NEW angle)
{{WEAK}}

# Required layout (exactly this)

```
challenge.json
README.md
hints.md
starter/            # what the user edits; MUST FAIL the tests
solution/           # reference solution; MUST PASS; same file names as starter/
solution/EXPLANATION.md
bugs/<name>/        # 3–5 dirs, each a full copy of the solution files with ONE typical bug
tests/              # the test suite; it loads the code under test from ../$TARGET/
```

The tests pick the implementation from the TARGET environment variable: `starter`, `solution` or
`bugs/<name>`. Tests run from inside `tests/`, so the code under test lives at `../$TARGET/`.

## challenge.json
```json
{
  "slug": "kebab-case-name",
  "title": "Human title",
  "type": "{{TYPE}}",
  "level": {{LEVEL}},
  "topics": ["2-4 short topic tags"],
  "estMinutes": 30,
  "test": { "command": "<see profile>", "successPattern": null, "timeoutSeconds": 60 },
  "bugs": [
    { "name": "off-by-one-end", "kind": "mutation", "expect": "<substring of the FAILING test's name/output>" },
    { "name": "dict-insertion-order", "kind": "alternative", "expect": "<…>" }
  ]
}
```
`expect` must be text that appears in the test output only when the right test fails (usually the
test's name). The validator checks each bug fails on the test it is meant to break.

`kind` is `mutation` (the reference with one realistic slip: off-by-one, wrong comparison, missing
final flush, wrong error type) or `alternative` (a DIFFERENT, plausible way a learner would solve it
that is subtly wrong; see "Test design"). At least one bug must be `alternative`.

## README.md (this file is also the decryption key; it is final once you finish)
Sections, in this order, with these exact headings:
- `## Problem`: the task, realistic framing, the precise contract (signatures, input/output, errors).
- `## Examples`: at least 3, including one edge case. Every output shown must be real (run it).
- `## Constraints`: sizes, complexity target if any, what is allowed (standard library only).
- `## How to run`: `ginga test` to run the tests; `ginga hint` for a hint; `ginga done` when green.

Do not mention the reference solution, the bug variants or the hints' content in README.md.

## hints.md
Exactly three sections: `## Hint 1` (a nudge: what to notice), `## Hint 2` (the approach),
`## Hint 3` (near-pseudocode, still not the code).

## solution/EXPLANATION.md
Sections with these exact headings:
- `## Approach`: the idea and why it works, with a short traced example (step by step).
- `## Complexity`: time and space, and why.
- `## Alternatives`: at least two other approaches and why this one was chosen.
- `## Common bugs`: the mistakes people make here (these match bugs/), and which test catches each.
- `## Idioms`: language-specific techniques used and worth remembering.
- `## Level up`: two follow-up variations to try.

# Test design (this is where challenges usually fail)

Past challenges passed every test while user solutions were still wrong: a JS counter built on a
plain object reordered digit keys (inputs never contained digits); an error message printed
literally as `got f{n}` (the test only checked the exception type); `"Tips&Tricks"` became
`tipstricks` (every punctuation case sat next to a space, so another rule hid the bug). Design the
suite so that cannot happen:

1. **Contract inventory first.** Before writing tests, list every rule and promise in README.md
   (each input class, each output rule, each error and its exact message/type, each ordering or
   stability promise, each boundary). Every item gets at least one test, and the test name says
   which rule it checks.
2. **Input classes.** For each input, enumerate its equivalence classes from the spec (e.g. for
   characters: lowercase, uppercase, digits, punctuation, whitespace kinds, non-ASCII/emoji; for
   numbers: 0, 1, negative, max/min, overflow edge; for collections: empty, one, duplicates, all
   equal, sorted, reverse-sorted). Cover every class the spec allows, and the ones it forbids.
3. **Isolate each rule.** Test each rule in a case where no other rule could produce the same
   output: a separator between two letters, not next to a space; a tie that is not also first in
   input order; a boundary value that is not also the only element.
4. **Assert the whole contract, exactly.** If README promises an error type AND message, assert both
   (message as an exact string or a precise pattern). Assert return types/shapes, ordering, and
   that inputs are not mutated when the spec says so.
5. **Golden table.** For pure functions, add a data-driven test over a fixture in tests/ (e.g.
   `cases.json`) with at least 30 input → expected-output pairs. Build the inputs with a FIXED seed
   so they span every input class (mix classes inside the same input too), and compute the expected
   outputs by running the REFERENCE in the sandbox. The table must not reveal the algorithm, only
   inputs and outputs. Report the first failing case with its input in the failure message.
6. **Adversarial review of your own tests.** Before finishing, write the 2–3 most plausible WRONG
   implementations a learner at this level would write with a different approach than the
   reference (another data structure, a regex instead of a loop, a negated condition, a library
   call with different semantics). Put the subtly wrong ones in bugs/ as `kind: "alternative"`.
   If any of them passes, the suite has a gap: add the missing test, then re-run everything.

# Quality bar (non-negotiable)

1. Every test exists to catch a typical bug. Each bugs/<name> variant must fail, on the RIGHT test.
2. No test that passes trivially. The starter must fail at least one test meaningfully (not just a crash
   on import, unless the type is implement and the function is a stub that raises/returns a placeholder).
3. Failure messages teach: say what was expected and why it matters.
4. Deterministic: no dependence on hash ordering, wall-clock timing (except a generous perf test),
   randomness without a fixed seed, or the network (the sandbox has no network).
5. Standard library only. No package installs.
6. Any number, output or error message written in README.md or EXPLANATION.md must come from actually
   running the code in the sandbox, not from memory.
7. If the problem is algorithmic, include one perf test with an input large enough that the naive
   complexity class times out or exceeds a generous budget, while the reference finishes quickly.

# Profile conventions for {{LANG}} (follow them)
{{CONVENTIONS}}

Default test command: `{{TEST_COMMAND}}`
Success pattern: {{SUCCESS_PATTERN}}

# Running code: ONLY through the sandbox

You cannot run code directly. To run anything, use exactly this command prefix, followed by `--`
and the shell command to run inside the container (it runs on a throwaway copy of this directory):

```
{{SANDBOX}} --cwd tests --target solution -- <command>
```

For example, to run the test suite against the solution, then the starter, then each bug:
```
{{SANDBOX}} --cwd tests --target solution -- '{{TEST_COMMAND}}'
{{SANDBOX}} --cwd tests --target starter -- '{{TEST_COMMAND}}'
{{SANDBOX}} --cwd tests --target bugs/<name> -- '{{TEST_COMMAND}}'
```
Type the prefix exactly as shown, from this directory (do not `cd`), and give each option only
once: anything else is refused. Use `--cwd .` to run scratch experiments from the root. Iterate until: solution passes, starter fails,
every bug fails on its expected test. Do not finish before verifying all three.

# Reference example (a complete, validated challenge in this language; match its structure and quality, NOT its topic)

{{EXAMPLE}}

When done, reply with one line: the title and slug.
