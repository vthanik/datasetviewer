// Tests for the column-stats SQL builders. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { statsSql, HIST_BINS } from "../../srcjs/engine/stats_sql.js";

test("base counts query covers total/valid/unique", () => {
  const q = statsSql({ name: "AGE", kind: "number" });
  assert.match(q.base, /count\(\*\)::BIGINT AS n_total/);
  assert.match(q.base, /count\("AGE"\)::BIGINT AS n_valid/);
  assert.match(q.base, /count\(DISTINCT "AGE"\)::BIGINT AS n_unique/);
});

test("topk groups the display expression, most frequent first", () => {
  const q = statsSql({ name: "SEX", kind: "string" });
  assert.match(q.topk, /GROUP BY 1 ORDER BY c DESC/);
  assert.match(q.topk, /LIMIT 10/);
  assert.match(q.topk, /"SEX" IS NOT NULL/);
});

test("numeric block exists for number, null for string", () => {
  assert.ok(statsSql({ name: "AGE", kind: "number" }).numeric);
  assert.equal(statsSql({ name: "SEX", kind: "string" }).numeric, null);
  assert.match(
    statsSql({ name: "AGE", kind: "number" }).numeric,
    /quantile_cont\("AGE", 0\.25\)/
  );
});

test("temporal bins over epoch, numeric over the raw column", () => {
  const num = statsSql({ name: "AGE", kind: "number" });
  const dat = statsSql({ name: "TRTSDT", kind: "date" });
  assert.match(num.histogram(0, 100), /"AGE"/);
  // Cast to the core type inside epoch(): the tz-aware forms would autoload
  // the ICU extension, which the local engine bundle does not ship.
  assert.match(dat.histogram(0, 100), /epoch\(CAST\("TRTSDT" AS DATE\)\)/);
  // bins are clamped so max lands in the last bin, not one past it
  assert.match(num.histogram(0, 100), new RegExp(`${HIST_BINS - 1}`));
});

test("identifiers with quotes are escaped", () => {
  const q = statsSql({ name: 'we"ird', kind: "string" });
  assert.match(q.base, /"we""ird"/);
});
