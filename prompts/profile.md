You are adding support for a new language to gingaloop: "{{NAME}}" (profile id: `{{ID}}`).
Work only inside the current directory. Produce two things:

1. `profile.json`: the language profile.
2. `example/`: one complete, validated level-1 reference challenge in this language, which future
   challenge generation will use as its template.

# profile.json

Follow the shape of this reference profile (for Python):

```json
{{REFERENCE_PROFILE}}
```

Rules:
- `id` = `{{ID}}`; `name` = the display name; `aliases` = other common names (lowercase).
- `image`: `{ "pull": "<official image>:<pinned tag>" }`. It MUST be a Docker Official Image (no "/"
  in the name, e.g. `rust:1.82-slim`, `golang:1.23-alpine`, `ruby:3.3-slim`, `eclipse-temurin` is
  allowed because it is official). Pick a slim/alpine variant when the toolchain works there.
- `testCommand`: one shell command run from `tests/`, using only what the image ships (no network,
  no package installs at test time). It must use `$TARGET` (starter | solution | bugs/<name>) to pick
  the code under test from `../$TARGET/`.
- The container root filesystem is read-only; only `/work` (a copy of the challenge) and `/tmp` are
  writable, and HOME=/tmp. Point caches/build dirs there (e.g. `CARGO_TARGET_DIR=/tmp/target`,
  `GOCACHE=/tmp/go-cache`).
- `successPattern`: a regex that only appears when ALL tests pass, or null if the exit code is reliable.
- `conventions`: concise, concrete instructions for writing challenges in this language: test
  framework, file names, how tests import `../$TARGET/`, warnings flags, idioms to favor.
- `areas`: 5–10 practice areas SPECIFIC to this language (the generic ones such as strings, hashing,
  graphs or dynamic programming are added automatically), as
  `[{ "id": "kebab-case", "name": "Human name", "minLevel": 1-10 }]`. Examples for C:
  `pointers-arrays` (1), `dynamic-memory` (3), `allocators` (6). Cover the language's signature
  mechanics: ownership, concurrency model, type system features, standard library staples.
- `levelNotes`: optional per-level hints for this language on the 1–10 scale ({"1": "...", "5": "..."}).

# example/

A complete level-1 challenge following exactly this structure and quality (here is the Python one):

{{REFERENCE_EXAMPLE}}

Level rubric for reference:
{{LEVEL_RUBRIC}}

# Running code: ONLY through the sandbox

You cannot run code directly. Use this prefix (it reads ./profile.json, pulls its image, and runs your
command on a throwaway copy of ./example):

```
{{SANDBOX}} --cwd tests --target solution -- '<your test command>'
```

Verify: solution passes, starter fails, every bug fails on its expected test. If the image lacks
something you need, change the image (still official) rather than installing packages.

When done, reply with one line: the image you chose and the test command.
