// Terminal output: color, tables, bars and widths for the command views.
// Color only reaches a terminal: never with NO_COLOR, TERM=dumb, or when the output is piped or
// logged (systemd, tests, `| less`); FORCE_COLOR=1 turns it on anyway, FORCE_COLOR=0 off.
import { homedir } from "node:os";

export function colorEnabled(stream = process.stdout) {
  const env = process.env;
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR != null && env.FORCE_COLOR !== "") return env.FORCE_COLOR !== "0";
  return Boolean(stream.isTTY) && env.TERM !== "dumb";
}

const sgr = (open, close) => (s, stream) => (colorEnabled(stream) ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

/** Styles: `paint.green("✔")`; pass `process.stderr` as the second argument for stderr text. */
export const paint = {
  bold: sgr(1, 22),
  dim: sgr(2, 22),
  red: sgr(31, 39),
  green: sgr(32, 39),
  yellow: sgr(33, 39),
  blue: sgr(34, 39),
  magenta: sgr(35, 39),
  cyan: sgr(36, 39),
};

/** Status marks used across commands. */
export const mark = {
  ok: (s = "✔", stream) => paint.green(s, stream),
  fail: (s = "✘", stream) => paint.red(s, stream),
  warn: (s = "⚠", stream) => paint.yellow(s, stream),
};

const ANSI = /\x1b\[[0-9;]*m/g;

export const stripAnsi = (s) => String(s).replace(ANSI, "");

/** Columns a string takes in a terminal: no color codes, wide emoji count 2, joiners and variation selectors 0. */
export function displayWidth(s) {
  let w = 0;
  for (const ch of stripAnsi(s)) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d || (cp >= 0x300 && cp < 0x370)) continue;
    w += cp >= 0x1f000 || (cp >= 0x2e80 && cp < 0xa000) ? 2 : 1;
  }
  return w;
}

const padEnd = (s, n) => String(s) + " ".repeat(Math.max(0, n - displayWidth(s)));
const padStart = (s, n) => " ".repeat(Math.max(0, n - displayWidth(s))) + String(s);

/** Terminal width; Infinity when the output isn't a terminal (piped output is never cut). */
export const termWidth = () => process.stdout.columns || Infinity;

/** Cut plain text to `n` columns with an ellipsis. */
export function truncate(s, n) {
  if (displayWidth(s) <= n) return s;
  let out = "";
  for (const ch of s) {
    if (displayWidth(out + ch) > n - 1) break;
    out += ch;
  }
  return `${out}…`;
}

/** A path with the home directory shown as ~. */
export function tilde(path) {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/**
 * A plain-text table: header, a rule, rows; columns padded to their widest cell (colored cells
 * are measured without their color codes). `align[i]` is "left" (default) or "right".
 */
export function table(header, rows, align = []) {
  const width = header.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i]))));
  const cell = (v, i) => (align[i] === "right" ? padStart(v, width[i]) : padEnd(v, width[i]));
  const line = (r) => r.map(cell).join("  ").trimEnd();
  return [
    paint.bold(line(header)),
    paint.dim(width.map((w) => "─".repeat(w)).join("  ")),
    ...rows.map(line),
  ].join("\n");
}

/**
 * "███░░░" progress bar. Plain by default (it also goes into Markdown files); with `color` (a
 * paint style) the filled part takes it and the rest is dimmed.
 */
export function bar(done, total, width = 12, color = null) {
  const filled = total <= 0 ? width : Math.max(0, Math.min(width, Math.round((done / total) * width)));
  const [full, empty] = ["█".repeat(filled), "░".repeat(width - filled)];
  return color ? color(full) + paint.dim(empty) : full + empty;
}

/** A section title. */
export const heading = (s) => paint.bold(s);

/** "1 challenge" / "3 challenges". */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
