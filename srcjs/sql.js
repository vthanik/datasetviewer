// Build DuckDB SQL fragments from the view state.
//
// The filter is a free-text expression (SAS "Filter Table Rows" style). Users
// write string values in double quotes (SEX = "M"); we translate each quoted
// run into a SQL single-quoted literal, doubling any embedded single quote so
// values like "O'Brien" become 'O''Brien'. Quote scanning lives in filter_scan.

import { scanRuns } from "./filter_scan.js";

// Translate the missing-value predicate on a NON-STRING segment only (so a
// value the user quoted, like 'is na', is never rewritten). "COL is na" ->
// "COL IS NULL", "COL is not na" -> "COL IS NOT NULL", case-insensitive. The
// predicate is type-agnostic (IS NULL matches R's NA on every column kind); a
// genuine IEEE NaN is a distinct value the user can target with isnan(COL).
function translateMissingSql(seg) {
  return seg
    .replace(/\b([A-Za-z_.][\w.]*)\s+is\s+not\s+na\b/gi, "$1 IS NOT NULL")
    .replace(/\b([A-Za-z_.][\w.]*)\s+is\s+na\b/gi, "$1 IS NULL");
}

export function whereFromExpr(expr) {
  if (!expr || !String(expr).trim()) return "";
  // Every quoted run (typed with " or ') becomes a SQL single-quoted literal,
  // re-escaping embedded single quotes as ''. Unquoted runs get the missing
  // predicate translated; everything else passes through.
  return scanRuns(String(expr).trim())
    .map((r) =>
      r.q ? `'${r.value.replace(/'/g, "''")}'` : translateMissingSql(r.value)
    )
    .join("");
}

export function orderFromSort(sort) {
  return (sort || [])
    .map((s) => `"${String(s.name).replace(/"/g, '""')}" ${s.dir === "desc" ? "DESC" : "ASC"}`)
    .join(", ");
}
