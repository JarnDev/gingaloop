import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewRunLines } from "../src/cli.mjs";
import { commandVarProblems } from "../src/runner.mjs";

test("a reviewer of write-the-tests gets IMPL and TESTS, not just TARGET (#8)", () => {
  const cmd = "make -s IMPL=$IMPL TESTS=$TESTS";
  const lines = reviewRunLines("ginga sandbox run --jail --lang cpp", "write-the-tests", cmd);
  assert.match(lines, /--cwd tests --target subject --impl subject --tests starter -- 'make -s IMPL=\$IMPL TESTS=\$TESTS'/);
  assert.match(lines, /--tests solution runs the reference tests/);
  assert.match(lines, /--impl bugs\/<name>/);
  assert.match(reviewRunLines("P", "implement", "node --test"), /^ {2}P --cwd tests --target starter -- 'node --test'\nUse --target solution/);
});

test("test.command may only use the variables the runner sets (#8)", () => {
  const m = (type, command) => ({ type, test: { command } });
  assert.deepEqual(commandVarProblems(m("write-the-tests", "PYTHONPATH=../$IMPL python3 -m unittest discover -s ../${TESTS}")), []);
  assert.deepEqual(commandVarProblems(m("implement", "make -s TARGET=$TARGET && ls $HOME")), []);
  assert.deepEqual(commandVarProblems(m("implement", "make -s IMPL=$IMPL TESTS=$TESTS")), [
    "challenge.json: test.command uses $IMPL, $TESTS, which the runner never sets (it sets $TARGET)",
  ]);
  assert.match(commandVarProblems(m("write-the-tests", "make SUITE=$SUITE"))[0], /\$SUITE/);
});
