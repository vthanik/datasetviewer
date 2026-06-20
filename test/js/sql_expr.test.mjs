import test from "node:test";
import assert from "node:assert";
import { quoteId, colSelect, colExpr } from "../../srcjs/engine/sql_expr.js";

test("string column is a bare identifier, no cast and no alias", () => {
  assert.equal(colExpr({ name: "SEX", kind: "string" }), '"SEX"');
  assert.equal(colSelect({ name: "SEX", kind: "string" }), '"SEX"');
});

test("date and time columns cast to varchar", () => {
  assert.equal(colExpr({ name: "VISIT", kind: "date" }), 'CAST("VISIT" AS VARCHAR) AS "VISIT"');
  assert.equal(colExpr({ name: "TM", kind: "time" }), 'CAST("TM" AS VARCHAR) AS "TM"');
});

test("datetime casts through TIMESTAMP to drop the +00 zone", () => {
  // Regression: a POSIXct column is TIMESTAMP WITH TIME ZONE, whose VARCHAR
  // cast appends "+00". Casting through plain TIMESTAMP shows the UTC wall-clock.
  assert.equal(
    colExpr({ name: "DTM", kind: "datetime" }),
    'CAST(CAST("DTM" AS TIMESTAMP) AS VARCHAR) AS "DTM"'
  );
});

test("colSelect omits the alias so distinct()/column() can reuse it", () => {
  assert.equal(
    colSelect({ name: "DTM", kind: "datetime" }),
    'CAST(CAST("DTM" AS TIMESTAMP) AS VARCHAR)'
  );
});

test("quoteId escapes embedded double quotes", () => {
  assert.equal(quoteId('a"b'), '"a""b"');
});
