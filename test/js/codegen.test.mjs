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

test("arrange uses desc() for descending keys", () => {
  assert.equal(
    dplyrArrangeFromSort([{ name: "mpg", dir: "desc" }, { name: "cyl", dir: "asc" }]),
    "desc(mpg), cyl"
  );
});

test("full pipeline: filter + arrange + select, library(dplyr) first", () => {
  const state = {
    columns: cols(["mpg", "cyl", "hp", "wt"], ["mpg", "cyl"]),
    filterExpr: 'mpg > 20 and cyl = 4',
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
