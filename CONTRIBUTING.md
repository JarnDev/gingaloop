# Contributing

Thanks for helping! The most valuable contributions are **language profiles**, improvements to the
generation prompts, and **lessons** from your own reviews (no code needed, see below).

## Development

```sh
git clone https://github.com/JarnDev/gingaloop && cd gingaloop
npm test                      # unit tests (no Docker needed)
npm run check:examples        # validates every built-in example in the sandbox (needs Docker)
node bin/ginga.mjs --help
```

No runtime dependencies and no build step: plain ESM JavaScript with JSDoc, Node ≥ 22.18. Please
keep it that way.

## Adding a built-in language profile

1. Bootstrap one in a scratch workspace: `ginga lang add <language>`. Claude drafts
   `profiles/<id>.json` plus a reference example, and it's accepted only if the example validates.
2. Copy `profiles/<id>.json` into this repo's `profiles/`, and the example into `examples/<id>/`.
3. Review it by hand. This matters more than the generation:
   - the image is a **Docker Official Image** pinned to a tag (or a minimal Dockerfile on one);
   - tests use the language's standard tooling, no package installs, and work with a read-only root
     filesystem (HOME and caches under `/tmp`);
   - each bug variant fails **on the right test** and represents a mistake people really make;
   - the README examples and explanation numbers are real (run them).
4. `node bin/ginga.mjs validate examples/<id> --lang <id>` must pass.

## Lessons from your reviews

You don't need to write code to make every user's challenges better. When `ginga review` finds that
a challenge itself was wrong (a reference that's wrong on an allowed input, a promise no test
checks, a README that contradicts its tests), that mistake will happen again, to you and to others,
until gingaloop's prompts or validator change.

1. `ginga review`, then `ginga learn`. The rules you save go to your workspace's `LESSONS.md`, so
   your next challenges already avoid the mistake.
2. For each rule marked **all languages** or **gingaloop itself**, accept the offer to open an issue
   (or pass `--report`). It opens the [lesson form](https://github.com/JarnDev/gingaloop/issues/new?template=lesson.yml)
   pre-filled with the rule, a short summary and the challenge's language, level and type. Read it,
   then submit. A language-specific rule is welcome too: open the form by hand.
3. Please don't paste your solution or the challenge files. If a maintainer needs to reproduce it,
   they'll ask.

Saved lessons are plain lines in `LESSONS.md` / `IMPROVEMENTS.md`, so you can also report one later
by copying it into the form.

### Turning a lesson into a fix (maintainers and contributors)

Prefer, in this order:

1. **A validator check** (`src/runner.mjs` and friends), when the rule can be checked mechanically:
   it rejects a bad challenge before anyone sees it, while a prompt rule only asks.
2. **A language profile** (`profiles/<id>.json`: `conventions`, `levelNotes`), when the trap is
   specific to one language.
3. **`prompts/generate.md`**, for general rules. Keep it short: fold the lesson into the section it
   belongs to (test design, quality bar) with the concrete trap as its example, rather than appending
   a list. The "whole numeric range" rule came from such a lesson.

Close the issue with the commit, and add a CHANGELOG line so users know they can delete the lesson
from their own `LESSONS.md`.

## Principles

- Generated code never runs on the host. Anything that executes goes through `src/sandbox.mjs`.
- The runner knows no languages. Language knowledge lives in profiles and prompts, not in code.
- Be honest in docs: the solution lock is friction, not security.

## Releasing

1. Move the `Unreleased` entries in `CHANGELOG.md` under a new `## X.Y.Z (date)` heading and set the
   same version in `package.json`.
2. Commit, then tag and push: `git tag -s vX.Y.Z -m vX.Y.Z && git push origin main vX.Y.Z`.
3. `.github/workflows/release.yml` runs the tests and the examples, checks the tag matches
   `package.json`, publishes to npm with provenance through trusted publishing (no npm token), then
   creates the GitHub release with that version's CHANGELOG section as its notes.
