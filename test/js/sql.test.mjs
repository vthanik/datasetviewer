// Tests for the SQL fragment builders. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { whereFromExpr, orderFromSort } from "../../srcjs/sql.js";

test("whereFromExpr translates SAS double-quoted strings to SQL literals", () => {
  assert.equal(whereFromExpr('SEX = "M"'), "SEX = 'M'");
  assert.equal(whereFromExpr("  AGE > 50  "), "AGE > 50");
  assert.equal(whereFromExpr(""), "");
  assert.equal(whereFromExpr(null), "");
  assert.equal(
    whereFromExpr('RACE in ("ASIAN","WHITE")'),
    "RACE in ('ASIAN','WHITE')"
  );
});

test("whereFromExpr doubles single quotes inside values (apostrophes)", () => {
  // The core bug: "O'Brien" must become 'O''Brien', not 'O'Brien'.
  assert.equal(whereFromExpr('NAME = "O\'Brien"'), "NAME = 'O''Brien'");
  assert.equal(
    whereFromExpr('TERM in ("Crohn\'s disease")'),
    "TERM in ('Crohn''s disease')"
  );
});

test("whereFromExpr reconstructs SAS-escaped embedded double quotes", () => {
  // "" inside a double-quoted run is one literal double quote.
  assert.equal(whereFromExpr('H = "6"""'), "H = '6\"'");
});

test("whereFromExpr passes single-quoted SQL literals through verbatim", () => {
  assert.equal(whereFromExpr("AGE = '5'"), "AGE = '5'");
  assert.equal(whereFromExpr("X = 'a''b'"), "X = 'a''b'");
});

test("orderFromSort builds quoted ORDER BY with direction", () => {
  assert.equal(orderFromSort([]), "");
  assert.equal(orderFromSort([{ name: "AGE", dir: "desc" }]), '"AGE" DESC');
  assert.equal(
    orderFromSort([
      { name: "SITEID", dir: "asc" },
      { name: "USUBJID", dir: "desc" },
    ]),
    '"SITEID" ASC, "USUBJID" DESC'
  );
});
