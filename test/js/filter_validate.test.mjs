import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFilterTypes } from "../../srcjs/filter_validate.js";

const KINDS = {
  AGE: "number",
  TRT01AN: "number",
  SEX: "string",
  SITEID: "string",
  SAFFL: "bool",
};

const throws = (expr) => () => validateFilterTypes(expr, KINDS);
const ok = (expr) => validateFilterTypes(expr, KINDS); // returns undefined, no throw

test("numeric column with a quoted value is rejected", () => {
  assert.throws(throws('TRT01AN = "0"'), /TRT01AN.*numeric.*unquoted number/);
});

test("character column with an unquoted numeric value is rejected", () => {
  assert.throws(throws("SITEID = 701"), /SITEID.*character.*Quote the value/);
});

test("correct typing passes: numeric unquoted, character quoted", () => {
  assert.doesNotThrow(() => ok('AGE >= 75 and SEX = "F"'));
  assert.doesNotThrow(() => ok('SITEID in ("701", "703")'));
  assert.doesNotThrow(() => ok("TRT01AN = 0"));
});

test("IN / NOT IN lists are validated element by element", () => {
  assert.throws(throws("SITEID in (701, 703)"), /SITEID.*character/);
  assert.throws(throws('TRT01AN not in ("0", "81")'), /TRT01AN.*numeric/);
  assert.doesNotThrow(() => ok('SITEID not in ("701")'));
});

test("unknown columns and column-vs-column are not flagged (conservative)", () => {
  assert.doesNotThrow(() => ok('UNKNOWNCOL = "x"'));
  assert.doesNotThrow(() => ok("AGE = TRT01AN")); // both columns, no literal
});

test("no kind map -> no validation", () => {
  assert.doesNotThrow(() => validateFilterTypes('TRT01AN = "0"', undefined));
});
