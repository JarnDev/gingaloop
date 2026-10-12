import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { costSummary } from "../src/cli.mjs";
import { parseClaudeCost, runClaude } from "../src/generate.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const tmp = mkdtempSync(join(tmpdir(), "gingaloop-cost-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("parseClaudeCost reads total_cost_usd from the JSON result, else null", () => {
  assert.equal(parseClaudeCost('{"type":"result","result":"done","total_cost_usd":0.42}\n'), 0.42);
  assert.equal(parseClaudeCost("plain text"), null);
  assert.equal(parseClaudeCost('{"result":"x"}'), null);
});

test("runClaude asks for JSON, passes the budget cap, logs the text and adds up the cost", async () => {
  const fake = join(tmp, "fake-claude");
  const argsFile = join(tmp, "args");
  writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFile}"\necho '{"type":"result","result":"all files written","total_cost_usd":0.25}'\n`);
  chmodSync(fake, 0o755);
  const config = { ...DEFAULT_CONFIG, claude: { ...DEFAULT_CONFIG.claude, command: fake, maxBudgetUsd: 1.5 } };
  const logFile = join(tmp, "run.log");
  const usage = { costUsd: null };
  for (let i = 0; i < 2; i++) {
    assert.equal(await runClaude({ config, cwd: tmp, prompt: "hi", allowedTools: ["Read"], logFile, usage }), 0);
  }
  assert.equal(usage.costUsd, 0.5);
  const args = readFileSync(argsFile, "utf8").split("\n");
  assert.equal(args[args.indexOf("--output-format") + 1], "json");
  assert.equal(args[args.indexOf("--max-budget-usd") + 1], "1.5");
  const log = readFileSync(logFile, "utf8");
  assert.match(log, /all files written/);
  assert.match(log, /cost of this call: \$0\.2500/);
});

test("costSummary totals generations, with the last 30 days apart", () => {
  const g = (date, costUsd) => ({ type: "generated", date, costUsd });
  assert.equal(costSummary([{ type: "generated", date: "2026-10-01" }], "2026-10-12"), null);
  const s = costSummary([g("2026-08-01", 1), g("2026-10-01", 0.5), g("2026-10-12", 0.25)], "2026-10-12");
  assert.match(s, /\$1\.75 over 3 generations \(\$0\.75 in the last 30 days/);
});
