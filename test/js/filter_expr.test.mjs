import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitTopLevelAnd,
  leadingColumn,
  replaceColumnClause,
} from "../../srcjs/filter_expr.js";

test("splitTopLevelAnd splits on top-level and only", () => {
  assert.deepEqual(splitTopLevelAnd('SEX = "M" and AGE >= 70'), [
    'SEX = "M"',
    "AGE >= 70",
  ]);
});

test("splitTopLevelAnd ignores and/or inside double-quoted values", () => {
  // The value text contains "and" and "OR"; neither is a separator.
  assert.deepEqual(splitTopLevelAnd('STUDY = "safe and sound"'), [
    'STUDY = "safe and sound"',
  ]);
  assert.deepEqual(
    splitTopLevelAnd('RACE in ("AMERICAN INDIAN OR ALASKA NATIVE") and SEX = "F"'),
    ['RACE in ("AMERICAN INDIAN OR ALASKA NATIVE")', 'SEX = "F"']
  );
});

test("splitTopLevelAnd honours doubled-quote escapes", () => {
  // "" is an escaped double quote inside a value; it must not end the run.
  assert.deepEqual(splitTopLevelAnd('NOTE = "say ""and"" twice" and X = 1'), [
    'NOTE = "say ""and"" twice"',
    "X = 1",
  ]);
});

test("splitTopLevelAnd does not split inside parentheses", () => {
  assert.deepEqual(splitTopLevelAnd("(AGE >= 70 and AGE < 80) and SEX = 1"), [
    "(AGE >= 70 and AGE < 80)",
    "SEX = 1",
  ]);
});

test("splitTopLevelAnd keeps a single-quoted date literal whole", () => {
  assert.deepEqual(
    splitTopLevelAnd("TRTSDT = DATE '2020-01-01' and SEX = 1"),
    ["TRTSDT = DATE '2020-01-01'", "SEX = 1"]
  );
});

test("leadingColumn reads the first identifier, past ( and !", () => {
  assert.equal(leadingColumn('SEX = "M"'), "SEX");
  assert.equal(leadingColumn("(AGE >= 70 and AGE < 80)"), "AGE");
  assert.equal(leadingColumn('!SEX %in% ("M")'), "SEX");
  assert.equal(leadingColumn('rincome in ("No answer")'), "rincome");
});

test("replaceColumnClause appends when the column is not yet filtered", () => {
  assert.equal(replaceColumnClause("", "AGE", "AGE >= 70"), "AGE >= 70");
  assert.equal(
    replaceColumnClause('SEX = "M"', "AGE", "AGE >= 70"),
    'SEX = "M" and AGE >= 70'
  );
});

test("replaceColumnClause replaces the same column, keeping others", () => {
  // The reported bug: re-filtering rincome must not AND a contradictory clause.
  const cur = 'rincome in ("No answer", "Refused")';
  assert.equal(
    replaceColumnClause(cur, "rincome", 'rincome = "$1000 to 2999"'),
    'rincome = "$1000 to 2999"'
  );
  assert.equal(
    replaceColumnClause('SEX = "M" and rincome in ("No answer")', "rincome", 'rincome = "X"'),
    'SEX = "M" and rincome = "X"'
  );
});

test("replaceColumnClause replaces in place and drops later same-column clauses", () => {
  // First occurrence keeps its slot; a stray second clause for the same column
  // (possible from a hand-edited filter) is collapsed away.
  assert.equal(
    replaceColumnClause("AGE >= 70 and SEX = 1 and AGE < 90", "AGE", "AGE = 80"),
    "AGE = 80 and SEX = 1"
  );
});

test("replaceColumnClause treats a parenthesised compound as one column clause", () => {
  assert.equal(
    replaceColumnClause('(AGE >= 70 and AGE < 80) and SEX = "M"', "AGE", "AGE = 75"),
    'AGE = 75 and SEX = "M"'
  );
});

test("replaceColumnClause is case-insensitive on the column name", () => {
  assert.equal(
    replaceColumnClause('SEX = "M"', "sex", 'SEX = "F"'),
    'SEX = "F"'
  );
});
