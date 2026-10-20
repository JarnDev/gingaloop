import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { bar, colorEnabled, displayWidth, paint, stripAnsi, table, truncate } from "../src/view.mjs";

const withEnv = (vars, fn) => {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

test("color: only on a terminal; NO_COLOR and FORCE_COLOR win", () => {
  const tty = { isTTY: true };
  const pipe = { isTTY: false };
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, TERM: "xterm" }, () => {
    assert.equal(colorEnabled(tty), true);
    assert.equal(colorEnabled(pipe), false, "piped or logged output stays plain");
    assert.equal(paint.green("ok", pipe), "ok");
    assert.equal(paint.green("ok", tty), "\x1b[32mok\x1b[39m");
  });
  withEnv({ NO_COLOR: "1", FORCE_COLOR: "1" }, () => assert.equal(colorEnabled(tty), false));
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () => assert.equal(colorEnabled(pipe), true));
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: "0" }, () => assert.equal(colorEnabled(tty), false));
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, TERM: "dumb" }, () => assert.equal(colorEnabled(tty), false));
});

test("widths ignore color codes and count wide emoji as 2", () => {
  assert.equal(displayWidth("\x1b[32mabc\x1b[39m"), 3);
  assert.equal(displayWidth("🔁 review"), 9);
  assert.equal(displayWidth("❄️"), 1, "a variation selector takes no column");
  assert.equal(truncate("abcdef", 4), "abc…");
  assert.equal(truncate("abc", 4), "abc");
});

test("tables line up colored cells", () => {
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () => {
    const out = table(["A", "B"], [[paint.green("x"), "1"], ["long", "22"]], ["left", "right"]).split("\n").map(stripAnsi);
    assert.deepEqual(out, ["A      B", "────  ──", "x      1", "long  22"]);
  });
});

test("bars are plain unless a color is asked for (they also go into Markdown)", () => {
  withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () => {
    assert.equal(bar(3, 6, 6), "███░░░");
    assert.equal(bar(9, 6, 6), "██████", "clamped");
    assert.equal(stripAnsi(bar(3, 6, 6, paint.green)), "███░░░");
    assert.notEqual(bar(3, 6, 6, paint.green), "███░░░");
  });
});

// --- the views, through the CLI (piped: no color) ---

function workspace(config) {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-view-")));
  writeFileSync(join(tmp, "gingaloop.json"), JSON.stringify({ version: 2, ...config }));
  mkdirSync(join(tmp, "challenges"));
  const run = (...a) => spawnSync(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), ...a, "-w", tmp],
    { encoding: "utf8", timeout: 20000, env: { ...process.env, NO_COLOR: "1", XDG_CONFIG_HOME: join(tmp, "xdg") } });
  return { tmp, run, done: () => rmSync(tmp, { recursive: true, force: true }) };
}

test("coverage: unlocked areas and what unlocks next; --all for the whole map", () => {
  const w = workspace({ rotation: ["python"] });
  try {
    const short = w.run("coverage").stdout;
    assert.match(short, /^Python {2}L1 {2}░{12} {2}0\/\d+ unlocked areas covered/m);
    assert.match(short, /^ {2}Unlocks at L2 \(\d+\): /m);
    assert.match(short, /^ {2}Later levels: \d+ more areas \(ginga coverage --all\)/m);
    assert.doesNotMatch(short, /unlocks at L3/);
    const all = w.run("coverage", "--all").stdout;
    assert.match(all, /unlocks at L3/);
    assert.ok(all.split("\n").length > short.split("\n").length * 2);
  } finally {
    w.done();
  }
});

test("config show: your changes; --all every setting; --json the raw config", () => {
  const w = workspace({ rotation: ["python", "c"], claude: { model: "opus" } });
  try {
    const out = w.run("config", "show").stdout;
    assert.match(out, /^ {2}claude\.model +opus$/m);
    assert.match(out, /^ {2}rotation +python, c$/m);
    assert.doesNotMatch(out, /sandbox\.memory/, "defaults stay out");
    assert.match(w.run("config", "show", "--all").stdout, /^ {2}sandbox\.memory +1g {2}\(default\)$/m);
    assert.equal(JSON.parse(w.run("config", "show", "--json").stdout).claude.model, "opus");
  } finally {
    w.done();
  }
});

test("domains: yours by default, the catalog with list", () => {
  const w = workspace({ rotation: ["python"], domains: ["fintech", "general"] });
  try {
    const mine = w.run("domains").stdout;
    assert.match(mine, /^Your domains \(2\)/);
    assert.match(mine, /● fintech/);
    assert.doesNotMatch(mine, /gamedev/);
    const list = w.run("domains", "list").stdout;
    assert.match(list, /^ {4}gamedev +Game development/m);
    // Where the name starts: after the marker, the id and its padding.
    const nameAt = new Set(list.split("\n").map((l) => /^ {2}[● ] \S+ +/.exec(l)?.[0].length).filter(Boolean));
    assert.equal(nameAt.size, 1, "names line up in one column, even the longest");
  } finally {
    w.done();
  }
});
