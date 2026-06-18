// Export the current view (selected columns, current filter and sort) to CSV.
// The result is pulled from the engine in row windows and appended as Blob
// parts, so neither the full Arrow result nor one giant CSV string is held in
// memory at once -- the export scales with the data the widget targets.

import { whereFromExpr, orderFromSort } from "../sql.js";

const CHUNK = 50000;

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv({ engine, store, rowCount }) {
  const state = store.get();
  const selected = state.columns.filter((c) => c.selected);
  const where = whereFromExpr(state.filterExpr);
  const order = orderFromSort(state.sort);

  const parts = [selected.map((c) => csvCell(c.name)).join(",") + "\n"];

  function fetchChunk(offset) {
    return engine
      .query({ offset, limit: CHUNK, where, order })
      .then((rows) => {
        if (rows.length) {
          parts.push(
            rows
              .map((r) => selected.map((c) => csvCell(r[c.origIndex])).join(","))
              .join("\n") + "\n"
          );
        }
        if (rows.length === CHUNK && offset + CHUNK < rowCount) {
          return fetchChunk(offset + CHUNK);
        }
        return undefined;
      });
  }

  return fetchChunk(0).then(() => {
    const blob = new Blob(parts, { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
