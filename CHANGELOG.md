# Changelog

## Unreleased

- **Anchors and extras: more than one language a day.** `ginga rotation anchor add python typescript`
  makes those languages every day, each in its own challenge, instead of the daily draw; the rest of
  the rotation stays in the shuffle bag. `ginga rotation extra 0.3 [max]` adds extras on top: each
  day, each of `max` (default 1) comes with that chance, drawn from the same bag and never a
  language already made that day. The roll depends only on the date, so rerunning `daily` doesn't
  roll again, and extras wait while a challenge from an earlier day is still open. Each slot runs
  once a day, so a rerun retries only what failed. Without anchors or extras nothing changes.
- **write-the-tests: each promise needs its own test.** The starter has one file per "What to test"
  item (`item<N>` in the name), and the grader runs each hidden bug first against the file of the
  item it breaks. A bug caught only through another item's tests shows as "caught ⚠ … item N has no
  test that catches it": it still counts as caught, but the solve isn't clean (clean streak, areas,
  promotions) and the topic comes back as a review. The solve records `accidental: [N]`, and
  NOTES.md says so. Challenges without item files are graded as before. (#12)
- **write-the-tests: the README's examples give nothing away.** They are the starter's example
  tests, copied as they are, and the validator runs the starter against every hidden bug: an
  example that catches one is rejected, so copying the examples never catches a bug for free. The
  built-in example's `"1h30m"` test (it caught the minutes-as-seconds bug) became `"45s"`. (#9)
- **Reviews of write-the-tests run the right command.** The reviewer was handed the test command
  with only `TARGET` set, so `$IMPL` and `$TESTS` were empty and the run failed. `ginga sandbox run`
  takes `--impl` and `--tests`, and the review prompt now gives the runs the grader does (your
  suite or the reference, on the correct code or a buggy version). The validator rejects a
  `test.command` that uses a variable the runner never sets. (#8)
- **`ginga giveup` asks what stopped you** (enter skips; `--reason R` answers it, `--yes` skips
  it). The answer fills the "What tripped me up" line of NOTES.md, is kept on the give-up event,
  and the topic's review challenges are generated to need exactly that point.

- **Pause the timer:** `ginga pause` and `ginga resume` (or `ginga open` on a paused challenge) stop
  and restart it, and `ginga timer` shows it. `done` suggests active time only, so a lunch break no
  longer inflates the minutes or pushes them past the 4-hour cap. `ginga list` marks paused
  challenges ⏸ (`--json`: `timer`).
- **NOTES.md fills itself in:** `done` and `giveup` write the empty "Time spent" (minutes, where
  they came from, pauses, expected time and verdict), "Hints used" (which of how many) and a new
  "Result" line (date, points, when you opened it, whether it comes back as a review). Lines you
  wrote are never overwritten; older notes gain the Result line. "What tripped me up" stays yours.
- `ginga commit` no longer lists `notes(...)` for a challenge solved or given up in the same commit.

## 0.6.2 (2026-10-15)

The first release shaped by lessons users sent upstream with `ginga learn --report` (#1, #2, #3).

- **`ginga list`** is a table in creation order with a **From** column: daily, manual, or
  "🔁 review: <topic>" (named after the original challenge of the review cycle). `--json` gains
  `source` and `reviewOf`. (#5)
- **write-the-tests: every promise is graded.** "What to test" is a numbered list, each hidden bug
  names the item it breaks (`bugs[].breaks`), and the validator rejects an item no bug breaks, so a
  suite can no longer skip a promise and still pass. (#2, #6)
- **write-the-tests: each bug breaks only its promise.** The reference suite has one file per item
  (`item<N>` in the name), and the validator runs it without the bug's item against each bug: it
  must pass, so no bug is caught by luck through another promise. One extra sandbox run per bug. (#3, #7)
- C and C++ profiles: tests with guard or sentinel values next to the input run each case with a
  "stop" and a "continue" guard, since ASan can't see a stray read inside one buffer. (#1, #4)

## 0.6.1 (2026-10-15)

- Without an id, a command run inside `challenges/<id>/` (at any depth) uses that challenge, instead
  of always the newest open one. `ginga review` elsewhere defaults to the newest unlocked challenge,
  so an open, still-locked one no longer blocks it.

## 0.6.0 (2026-10-14)

- **Reviews fit the challenge type.** fix-the-bug reviews judge the fix (each bug in the handed code:
  fixed, at the cause or the symptom; focused change or rewrite) instead of reviewing the result as
  new code; refactor, extend, debug-from-symptom and optimize get their own focus too. Types that
  hand you code now keep it in the lock as `original/`, unlocked with the solution after `done` or
  `giveup`, so the review can compare against it. Challenges generated before this have no
  `original/`; their reviews use the planted bug variants instead.

## 0.5.0 (2026-10-13)

- **`ginga learn`** turns a review's findings about the challenge itself (a wrong reference, a
  promise no test checks, an ambiguous README) into rules. They go to the workspace's `LESSONS.md`,
  which every later generation prompt follows, or to `IMPROVEMENTS.md` when only a change to
  gingaloop would prevent them. General rules can be sent upstream as a pre-filled GitHub issue
  (`--report`), reviewed by you before submitting. `ginga commit` lists them (`learn 1`).
- Generation prompt: references must be exact across the whole numeric range README.md allows, and
  tests must use its extremes (a review caught a TypeScript reference that lost precision above 2^53).
- **Pace:** `ginga done` shows the expected time (Claude's estimate × your pace, the median of your
  time ÷ estimate over recent clean solves), what it took and the difference, on a bar with an
  "on pace" band (`pace.tolerance`, ±25%) and a struggle line (`pace.struggle`, +50%). `rank` shows
  the pace per language and the dashboard expected vs. actual per challenge.
- `ginga rank` is a table now (level, progress, solved, gave up, average time, pace), sorted by
  progress, with "still needed for the next level" as its own section and the review status up top.
- **Struggle** is now measured against your own pace instead of "twice Claude's estimate", which
  flagged ordinary solves (the estimates run low), and time alone only counts after 5 clean timed
  solves. 2+ hints still count from the start.
- **Reviews are an extra, never a replacement:** `daily` always makes the rotation's challenge, plus
  the due review when no other review is open. Before, reviews took the daily's place and could
  starve the rotation for days.
- **One review cycle per topic:** struggling with a review (or giving it up) extends the original's
  cycle by `reviewExtendDays` (14) after its last step, instead of starting a new 3/7/21 cycle of
  its own. Reviews of reviews point back to the original.
- `ginga review` points at `ginga learn` when it's done.
- Releases: the workflow also creates the GitHub release from the CHANGELOG section. A "lesson" issue
  form, and CONTRIBUTING explains how lessons become fixes.

## 0.4.0 (2026-10-12)

- `ginga test --watch` reruns the tests on every save in starter/ or tests/.
- `ginga hint` says what the hint costs (points, review, clean streak, promotion) before revealing it.
- `--json` for `rank`, `list` and `coverage`.
- `ginga completion bash|zsh` prints a completion script (commands, subcommands, flags, languages).
- `ginga doctor --prune [--all]` removes images gingaloop built that no profile uses anymore.
- Fix: a Claude run's log is flushed before the run is reported done, so a failure always shows its
  last lines.
- **Per-command help:** `ginga <command> --help` and `ginga help <command>`; an unknown command now
  says so instead of printing the full help.
- **`ginga config [show|get|set|unset]`** changes `gingaloop.json` with type checks (model, budget,
  editor, leveling, sandbox limits…); `unset` goes back to the default.
- The gate settings (`leveling.cleanStreak`, `promotion`, `promotionRetryDays`) are now listed in the
  defaults. `ginga review` also reports its cost and honors `claude.maxBudgetUsd`.
- README: supported platforms stated plainly (Linux; macOS and Windows not yet).
- **`ginga discard [id] [--reason R]`** drops a broken, duplicate or unwanted challenge with no
  penalty, review or reveal. Generation forgets it: its area, type, domain and daily slot come back.
  Shown as ⬛ in INDEX and the dashboard, and as `discard(lang)` in `ginga commit` messages.
- **Cost tracking:** each generation records its Claude cost (API list price) and `ginga rank` shows
  the total and the last 30 days; a failed generation says what it spent. `claude.maxBudgetUsd` caps
  each Claude call (`--max-budget-usd`).
- **Config v2:** `gingaloop.json` only stores values you changed (plus rotation, domains, stacks and
  schedule), so improved defaults reach existing workspaces. v1 files are upgraded once on their
  first command, dropping frozen defaults such as the old `reviewAfterDays: [3, 7]`.
- **More practice areas:** every level from 1 to 10 now opens generic areas (L5, L9 and L10 had
  none): linked lists, greedy, prefix sums, grids, regex, money and floating point, dates and time
  zones, tries and string algorithms, union-find, range queries, streaming, storage engines,
  distributed-systems patterns, runtimes and query engines. Each built-in language gains its missing
  staples (C++ smart pointers and lambdas, Python comprehensions and the data model, TS utility
  types, React custom hooks, SQL subqueries and transactions, and more). New areas count toward the
  breadth gate of your current level.
- **`genericAreas` in a profile** keeps only the generic areas that make sense for the language; SQL
  and React use it, so their breadth gate no longer requires heaps or linked lists.
- `ginga init` also ignores `node_modules/` in the workspace (editor installs for type checking or
  autocomplete in JS/TS challenges); existing workspaces get the line on their next `init`.
- **Mastery gates:** reaching the next level needs the points **and** a clean solve (<= 1 hint, not
  after giving up) in every area unlocked at your level, **and** your last 3 solves at your level
  clean. `rank`, `done` and the dashboard show what's missing. Levels reached before are kept.
- **Promotion challenges:** once points and gates are met, the next challenge in that language is a
  promotion combining 2–3 practiced areas; solving it cleanly unlocks the level, a failure retries
  after 3 days (`leveling.promotion`, `leveling.promotionRetryDays`).
- **Spaced reviews for struggles:** challenges solved with 2+ hints or in more than twice the
  estimated time come back like give-ups, now at 3, 7 and 21 days.

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
