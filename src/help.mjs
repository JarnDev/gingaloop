// Per-command help: `ginga <command> --help` and `ginga help <command>`.

export const COMMAND_HELP = {
  init: `ginga init [dir] [--rotation L,L] [--mode random|ordered] [--stack S] [--domains D,D] [--time HH:MM] [--engine docker|podman] [--default] [--yes]

Create a workspace (default: ~/gingaloop) and make it your default. Asks for the languages, their
order, stacks, domains and the daily time; the flags answer those questions, --default takes every
default. Existing files (README, .gitignore) are kept: missing lines are appended.`,

  new: `ginga new <lang> [--level N] [--area ID] [--type T] [--stack basics|ecosystem] [--domain D]

Generate a challenge now (uses Claude). Every option is optional:
  --level N    at most your earned level in that language (default: your level)
  --area ID    a practice area, see \`ginga coverage <lang>\` (default: the least covered)
  --type T     implement, fix-the-bug, refactor, extend, write-the-tests, trace, port,
               debug-from-symptom, optimize (default: the type most behind its share)
  --stack S    basics (standard library) or ecosystem (pinned libraries), when the language has one
  --domain D   an industry from \`ginga domains list\` (default: from your configured domains)`,

  daily: `ginga daily [--force]

Today's challenge (uses Claude): a due review first, else a promotion when your gates are met, else
the next language from the rotation. Runs once per day; --force makes another. This is what the
systemd timer runs.`,

  open: `ginga open [id]

Open the README and starter files in your editor (\`editor\` in gingaloop.json, else $VISUAL, $EDITOR,
then vi), from inside the challenge folder. The first open starts the timer that \`done\` suggests.`,

  test: `ginga test [id] [--watch]

Run the challenge's tests against your starter/ inside the sandbox. Nothing is recorded. --watch
reruns them whenever a file in starter/ or tests/ is saved, until Ctrl+C.`,

  hint: `ginga hint [id] [--yes]

Reveal the next hint, after saying what it costs (--yes skips the question). Recorded: each hint lowers the points this solve is worth (85%, 70%, 50%), and
2+ hints bring the challenge back as a review.`,

  done: `ginga done [id] [--minutes N]

Run the tests; when they pass, record the solve (points, streak, gates) and unlock the reference
solution and explanation. Asks for the minutes spent, suggesting the time since your first \`open\`.`,

  giveup: `ginga giveup [id] [--yes]

Record a give-up and unlock the solution. The topic comes back as a review after 3, 7 and 21 days.`,

  discard: `ginga discard [id] [--reason R] [--yes]

Drop an open challenge that shouldn't count: broken, a near-duplicate, or not wanted. No penalty, no
review, no reveal. Generation forgets it, so its area, type and daily slot come back
(\`ginga daily\` makes a replacement). The folder stays, marked ⬛ discarded.`,

  review: `ginga review [id]

Ask Claude (uses tokens) to review your solution against the reference, after it's unlocked. It runs
the tests and its own edge-case probes in the sandbox and appends the review to NOTES.md.`,

  rank: `ginga rank [--json]

Per language: level, points to the next one and what the gates still need, solves, give-ups and
average time. Also your streak and freezes, weak topics and what Claude has cost so far.
--json prints the same facts as JSON, for scripts.`,

  coverage: `ginga coverage [lang…] [--json]

Practice areas per language (generic and language-specific ★), how many challenges you've had in each,
and the level each one unlocks at. Default: your rotation.`,

  list: `ginga list [--json]

Every challenge with its status: open, solved, gaveup or discarded.`,

  rotation: `ginga rotation [list]
ginga rotation set|add|remove <lang…>
ginga rotation mode random|ordered

The languages \`daily\` draws from. random: each language once per cycle, in shuffled order; ordered:
the list in order. Removing a language keeps its progress.`,

  stack: `ginga stack [<lang> basics|mixed|ecosystem]

Without arguments, show each language's stack. basics: standard library only; ecosystem: also the
language's pinned libraries (pandas, vitest, GoogleTest…); mixed: some of each, by domain.`,

  domains: `ginga domains [list]
ginga domains set|add|remove <id…>

Industries your challenges are framed in (general = no framing). With others configured, general
still comes up about 1 in 4 times.`,

  lang: `ginga lang list
ginga lang add <name>

List language profiles, or bootstrap one for a new language with Claude (a profile plus a validated
example).`,

  schedule: `ginga schedule install [--time HH:MM]
ginga schedule remove|status

A systemd user timer that runs \`ginga daily\` every day (Linux). Without systemd, it prints a cron
line to use instead.`,

  doctor: `ginga doctor [--pull]
ginga doctor --prune [--all] [--yes]

Check node, claude, the container engine and each rotation language's image. --pull downloads or
builds the missing images now. --prune removes images gingaloop built that no profile uses anymore
(older versions left by upgrades); --all removes every gingaloop image (rebuilt when next needed).
Official images such as python:3.12-slim are never removed.`,

  config: `ginga config [show]
ginga config get <key>
ginga config set <key> <value>
ginga config unset <key>

Read or change gingaloop.json, e.g. \`ginga config set claude.model opus\`,
\`ginga config set claude.maxBudgetUsd 2\`, \`ginga config unset sandbox.memory\` (back to the default).
Values are parsed as JSON when they can be (numbers, arrays, null). Rotation, stacks, domains and the
schedule have their own commands.`,

  commit: `ginga commit [--yes] [--push]

Stage the workspace and commit it with a message built from your progress log (solves, new
challenges, give-ups, level-ups, notes). Plain git, no Claude. --push pushes afterwards.`,

  push: `ginga push

Push the workspace repo, setting the upstream on the first push. Plain git.`,

  validate: `ginga validate [dir] [--examples]

Check a challenge (or every built-in example with --examples): the solution passes, the starter fails,
every bug variant is caught, and the manifest and docs are complete.`,

  completion: `ginga completion bash|zsh

Print a shell completion script (commands, subcommands, flags, languages). Add to ~/.bashrc or
~/.zshrc:  source <(ginga completion bash)   (or zsh)`,

  sandbox: `ginga sandbox run --lang L [--stack S] [--dir D] [--cwd C] [--target T] -- <command>

Run a command in the language's sandbox (no network, read-only image, resource limits) on a throwaway
copy of D. Used by Claude while it writes a challenge.`,
};

const SUBCOMMANDS = {
  rotation: ["list", "set", "add", "remove", "mode"],
  domains: ["list", "set", "add", "remove"],
  lang: ["list", "add"],
  schedule: ["install", "remove", "status"],
  config: ["show", "get", "set", "unset"],
  sandbox: ["run"],
  help: Object.keys(COMMAND_HELP),
};

/**
 * Bash completion script (zsh loads it through bashcompinit): commands, subcommands, each command's
 * flags (read from its help) and language ids where a language is expected.
 */
export function completionScript(shell, langs) {
  const cases = Object.entries(COMMAND_HELP).map(([name, help]) => {
    const flags = [...new Set([...help.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]))];
    const words = [...(SUBCOMMANDS[name] ?? []), ...(["new", "stack", "coverage"].includes(name) ? langs : []), ...flags, "--help"];
    return `    ${name}) words="${words.join(" ")}" ;;`;
  });
  cases.push(`    help) words="${SUBCOMMANDS.help.join(" ")}" ;;`);
  const body = `# ginga completion (${shell}). Load it with:  source <(ginga completion ${shell})
_ginga() {
  local cur=\${COMP_WORDS[COMP_CWORD]} words
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "${[...Object.keys(COMMAND_HELP), "help"].join(" ")} --help --version" -- "$cur"))
    return
  fi
  case "\${COMP_WORDS[1]}" in
${cases.join("\n")}
    *) words="" ;;
  esac
  COMPREPLY=($(compgen -W "$words" -- "$cur"))
}
complete -F _ginga ginga
`;
  return shell === "zsh" ? `(( $+functions[compdef] )) || { autoload -U compinit && compinit; }\nautoload -U +X bashcompinit && bashcompinit\n${body}` : body;
}
