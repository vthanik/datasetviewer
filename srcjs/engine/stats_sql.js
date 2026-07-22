// Pure SQL builders for the Kaggle-style per-column statistics (no duckdb
// import, so node-testable). All stats run over the FULL dataset -- the
// engine caches one result per column, so filters never invalidate them.

import { quoteId, colSelect } from "./sql_expr.js";

export const HIST_BINS = 20;
export const TOPK = 10;

const NUMERIC_LIKE = new Set(["number", "date", "datetime", "time"]);

export function statsSql(col) {
  const id = quoteId(col.name);
  const base =
    `SELECT count(*)::BIGINT AS n_total, ` +
    `count(${id})::BIGINT AS n_valid, ` +
    `count(DISTINCT ${id})::BIGINT AS n_unique FROM dv_data`;
  const topk =
    `SELECT ${colSelect(col)} AS v, count(*)::BIGINT AS c FROM dv_data ` +
    `WHERE ${id} IS NOT NULL GROUP BY 1 ORDER BY c DESC, 1 LIMIT ${TOPK}`;
  if (!NUMERIC_LIKE.has(col.kind)) {
    return { base, topk, numeric: null, histogram: null };
  }
  // Temporal kinds aggregate over epoch seconds; the numeric column over
  // itself. min/max are ALSO cast for display via colSelect.
  const v = col.kind === "number" ? id : `epoch(${id})`;
  const numeric =
    `SELECT min(${v}) AS mn, max(${v}) AS mx, avg(${v}) AS mean, ` +
    `stddev(${v}) AS sd, quantile_cont(${v}, 0.25) AS q25, ` +
    `quantile_cont(${v}, 0.5) AS q50, quantile_cont(${v}, 0.75) AS q75, ` +
    `min(${colSelect(col)}) AS mn_disp, max(${colSelect(col)}) AS mx_disp ` +
    `FROM dv_data WHERE ${id} IS NOT NULL`;
  const histogram = (mn, mx) => {
    const w = (mx - mn) / HIST_BINS || 1;
    // least() clamps the max value into the last bin.
    return (
      `SELECT least(floor((${v} - ${mn}) / ${w})::INT, ${HIST_BINS - 1}) AS bin, ` +
      `count(*)::BIGINT AS c FROM dv_data WHERE ${id} IS NOT NULL ` +
      `GROUP BY 1 ORDER BY 1`
    );
  };
  return { base, topk, numeric, histogram };
}
