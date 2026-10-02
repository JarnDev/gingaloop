# Changelog

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
