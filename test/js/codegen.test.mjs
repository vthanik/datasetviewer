import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dplyrCode,
  dplyrFilterFromExpr,
  dplyrArrangeFromSort,
} from "../../srcjs/codegen.js";

const cols = (names, selected = names) =>
  names.map((name, i) => ({ name, origIndex: i, selected: selected.includes(name) }));

test("bare frame, no filter/sort/subset -> library + data only", () => {
  const state = { columns: cols(["mpg", "cyl"]), filterExpr: "", sort: [] };
  assert.equal(dplyrCode(state, "mtcars"), "library(dplyr)\n\nmtcars");
});

test("filter translates SAS dialect to dplyr with air spacing", () => {
  assert.equal(
    dplyrFilterFromExpr('AGE>=75 and SEX = "F"'),
    'AGE >= 75 & SEX == "F"'
  );
});

test('"OR" inside a string value is not translated to |', () => {
  assert.equal(
    dplyrFilterFromExpr('RACE = "AMERICAN INDIAN OR ALASKA NATIVE"'),
    'RACE == "AMERICAN INDIAN OR ALASKA NATIVE"'
  );
});

test("SQL IN / NOT IN translate to %in% c(...) / !x %in% c(...)", () => {
  assert.equal(dplyrFilterFromExpr("SITEID in (701, 703)"), "SITEID %in% c(701, 703)");
  assert.equal(
    dplyrFilterFromExpr("SITEID not in (701, 703)"),
    "!SITEID %in% c(701, 703)"
  );
});

test("SQL-typed date/time literals become R constructors", () => {
  assert.equal(
    dplyrFilterFromExpr("TRTSDT >= DATE '2014-01-01'"),
    'TRTSDT >= as.Date("2014-01-01")'
  );
  assert.equal(
    dplyrFilterFromExpr("ASTDTM > TIMESTAMP '2022-07-27 12:20:00'"),
    'ASTDTM > as.POSIXct("2022-07-27 12:20:00", tz = "UTC")'
  );
  assert.equal(
    dplyrFilterFromExpr("ASTTM = TIME '12:20:00'"),
    'ASTTM == hms::as_hms("12:20:00")'
  );
});

test("column names in the filter are canonicalised to real case", () => {
  // R is case-sensitive; a lowercase 'siteid' must become 'SITEID' to run.
  const state = {
    columns: [
      { name: "SITEID", origIndex: 0, selected: true },
      { name: "ARM", origIndex: 1, selected: true },
    ],
    filterExpr: 'siteid = "703"',
    sort: [],
  };
  assert.equal(
    dplyrCode(state, "d"),
    'library(dplyr)\n\nd |>\n  filter(SITEID == "703")'
  );
});

test("select() comes last when a column subset is active", () => {
  const state = {
    columns: cols(["mpg", "cyl", "hp"], ["mpg", "cyl"]),
    filterExpr: "cyl = 4",
    sort: [{ name: "mpg", dir: "desc" }],
  };
  assert.equal(
    dplyrCode(state, "mtcars"),
    "library(dplyr)\n\n" +
      "mtcars |>\n" +
      "  filter(cyl == 4) |>\n" +
      "  arrange(desc(mpg)) |>\n" +
      "  select(mpg, cyl)"
  );
});

test("filter/arrange on a hidden column stay valid (select() is last)", () => {
  // hp is filtered/sorted but not selected. select() must come after filter()
  // and arrange(), or the generated code drops hp before they can use it
  // (object 'hp' not found).
  const state = {
    columns: cols(["mpg", "cyl", "hp"], ["mpg", "cyl"]),
    filterExpr: "hp > 100",
    sort: [{ name: "hp", dir: "asc" }],
  };
  assert.equal(
    dplyrCode(state, "mtcars"),
    "library(dplyr)\n\n" +
      "mtcars |>\n" +
      "  filter(hp > 100) |>\n" +
      "  arrange(hp) |>\n" +
      "  select(mpg, cyl)"
  );
});

test("arrange uses desc() for descending keys", () => {
  assert.equal(
    dplyrArrangeFromSort([{ name: "mpg", dir: "desc" }, { name: "cyl", dir: "asc" }]),
    "desc(mpg), cyl"
  );
});

test("full pipeline: filter, then arrange, then select", () => {
  const state = {
    columns: cols(["mpg", "cyl", "hp", "wt"], ["mpg", "cyl"]),
    filterExpr: "mpg > 20 and cyl = 4",
    sort: [{ name: "mpg", dir: "desc" }],
  };
  assert.equal(
    dplyrCode(state, "mtcars"),
    "library(dplyr)\n\n" +
      "mtcars |>\n" +
      "  filter(mpg > 20 & cyl == 4) |>\n" +
      "  arrange(desc(mpg)) |>\n" +
      "  select(mpg, cyl)"
  );
});

test("multi-column sort -> arrange() with both keys in priority order", () => {
  const state = {
    columns: cols(["region", "age", "id"]),
    filterExpr: "",
    sort: [
      { name: "region", dir: "asc" },
      { name: "age", dir: "desc" },
    ],
  };
  assert.equal(
    dplyrCode(state, "d"),
    "library(dplyr)\n\nd |>\n  arrange(region, desc(age))"
  );
});

test("all columns selected -> no select()", () => {
  const state = {
    columns: cols(["mpg", "cyl"]),
    filterExpr: "",
    sort: [{ name: "cyl", dir: "asc" }],
  };
  assert.equal(dplyrCode(state, "mtcars"), "library(dplyr)\n\nmtcars |>\n  arrange(cyl)");
});

test("a select() wider than the line width wraps one arg per line (air)", () => {
  const names = Array.from({ length: 12 }, (_, i) => `LONGCOLUMNNAME${i}`);
  const state = {
    columns: cols(names, names.slice(0, 6)),
    filterExpr: "",
    sort: [],
  };
  const out = dplyrCode(state, "d");
  assert.match(out, /select\(\n {4}LONGCOLUMNNAME0,\n {4}LONGCOLUMNNAME1,/);
  assert.match(out, /\n {2}\)$/); // closing paren on its own line at indent 2
});

test("non-syntactic column names are backticked in select", () => {
  const state = {
    columns: cols(["A B", "ok"], ["A B"]),
    filterExpr: "",
    sort: [],
  };
  assert.equal(dplyrCode(state, "d"), "library(dplyr)\n\nd |>\n  select(`A B`)");
});
