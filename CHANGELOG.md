# Changelog

## Unreleased

- **Stacks:** each language practices `basics` (standard library only, the default) and may have an
  `ecosystem` stack with pinned libraries in a second image: Python (numpy, pandas, pytest),
  JavaScript/TypeScript (vitest, zod), Node.js (vitest, fastify, zod), C++ (GoogleTest + CMake).
  Basics challenges run in the bare image, so libraries are physically unavailable. Per-language
  mode `basics | mixed | ecosystem` (`ginga stack`, `init`, `new --stack`); ecosystem areas;
  rank/dashboard split solves by stack.
- **New languages:** SQL (SQLite 3.46) and React (Testing Library + jsdom).
- **Challenge types:** write-the-tests and trace (L1), port (L2), debug-from-symptom and optimize
  (L3), with per-type grading and validation; weighted mix keeps implement at >= 50%; `new --type`.
  `port` needs a source language at L2+ and at most one level below the challenge (otherwise the
  port drops one level), prefers a different language family, and never involves SQL or React.
- **Domains:** 40 industry domains (`general` by default) that frame challenges with realistic
  data and domain rules; `ginga domains`; general still appears ~1 in 4.

## 0.3.0 (2026-10-05)

- C and C++ challenges get a `compile_flags.txt` mirroring the sandbox flags (plus
  `-DGINGA_SCRATCH` for a guarded personal `main`), so clangd and debuggers see C17/C++20 and the
  starter headers. `ginga open` adds it to older challenges without overwriting edits. Profiles can
  declare such files with `editorFiles`.
- `ginga commit` / `ginga push`: commit the workspace with a structured Conventional-Commits message
  built from progress.jsonl and the changed files (solves with level, time, hints and points; new
  challenges; give-ups; level-ups; notes); confirm, edit or cancel; `--yes`, `--push`.
- Timer: the first `ginga open` starts it; `ginga done` suggests the elapsed minutes (enter accepts,
  or type your own; over 4 h it's only shown). Solves record where the minutes came from.
- Stronger tests: the generator designs suites from a contract inventory (input classes, isolated
  rules, exact error messages, a seeded golden table) and must include an "alternative" bug variant.
  The validator now requires 3+ bug variants, at least one of kind `alternative`.
- The built-in examples follow the new standard.
- `ginga review` runs in a staging copy with the sandbox, so it verifies claims by running code and
  lists missing tests.

## 0.2.1

Security and robustness fixes from a code review:

- Sandbox: `sandbox run --jail` (the only command Claude may run while generating) is confined to
  its staging directory; options can no longer be given twice; profiles written by Claude can't
  add `docker run` flags (built-ins only, from a whitelist).
- Paths with spaces or commas no longer break generation.
- `init` never overwrites existing files and no longer takes over your default workspace silently
  (`--default`); times are validated.
- Podman: `--userns=keep-id` and an SELinux `:z` mount label.
- Clear errors when Docker or Claude is missing/failing (a failing `claude` no longer burns retries).
- A corrupt `progress.jsonl` line or `challenge.json` is skipped with a warning instead of breaking
  every command.
- Unlock tolerates editor whitespace/line-ending changes; challenge READMEs are read-only; the bug
  list is locked with the solution; unlock refuses to write through symlinks.
- Reviews missed while the machine was off still come back; "newest challenge" means most recently
  created; an exact id beats a prefix match.

## 0.2.0 (unreleased)

- Leveling is now point-based (Codewars-style): 100 points at your level, 30 one below, 5 two+
  below, scaled by hints used; 10 levels with cumulative thresholds 600 … 68,000.
- Streak freezes: one per 7 solve days, hold up to 2, used automatically on a missed day.
- The difficulty rubric is rewritten for 10 levels.
- Daily language order: `random` (shuffle bag: each language once per cycle, default) or
  `ordered` (continues after the last daily, so missed days don't skip languages).
- Duplicate check: a new challenge whose slug or title matches any earlier one in the same language
  is rejected and regenerated; the prompt now lists the full history, not the last 30.
- Coverage map: generic + per-language practice areas with minimum levels; generation targets the
  least-covered unlocked area. `ginga coverage`, `ginga new --area`.
- The workspace README.md is a progress dashboard (streak, levels, activity grid, coverage, recent
  challenges), regenerated between markers after every change.
- New commands: `ginga open` (README + starter in your editor) and `ginga rotation`.
- The old `thresholds` (solve counts) config key is ignored; see `leveling`.

## 0.1.0 (unreleased)

- First version: `ginga` CLI with workspaces, earned per-language levels, README-keyed solution lock,
  Docker/Podman sandbox, generic test runner, Claude-generated challenges and language profiles,
  systemd daily schedule, and 6 built-in profiles with validated examples.
