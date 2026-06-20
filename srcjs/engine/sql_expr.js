// Pure SQL fragment builders for the engine (no duckdb import, so node-testable).
//
// Temporal columns are cast to text in SQL (canonical ISO strings) so the
// browser never reasons about Arrow time units. A datetime column is
// TIMESTAMP WITH TIME ZONE -- artoo stores POSIXct, which nanoparquet writes
// with is_adjusted_to_utc, so DuckDB types it as TZ-aware and its VARCHAR cast
// appends a "+00" offset. Casting through plain TIMESTAMP first drops the zone
// and shows the stored UTC wall-clock (and keeps sub-second precision, which
// strftime would truncate).

const TEMPORAL = new Set(["date", "datetime", "time"]);

export function quoteId(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

// Bare select expression for a column (NO alias), reusable in any SELECT.
export function colSelect(col) {
  const id = quoteId(col.name);
  if (col.kind === "datetime") return `CAST(CAST(${id} AS TIMESTAMP) AS VARCHAR)`;
  return TEMPORAL.has(col.kind) ? `CAST(${id} AS VARCHAR)` : id;
}

// Aliased form for the main SELECT list; the alias is dropped for a plain
// identifier (where it would be redundant).
export function colExpr(col) {
  const sel = colSelect(col);
  const id = quoteId(col.name);
  return sel === id ? id : `${sel} AS ${id}`;
}
