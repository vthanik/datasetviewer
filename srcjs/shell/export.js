// Export the current view (selected columns, current filter and sort) to CSV.
// The result is pulled from the engine in row windows and appended as Blob
// parts, so neither the full Arrow result nor one giant CSV string is held in
// memory at once -- the export scales with the data the widget targets.

import { whereFromExpr, orderFromSort } from "../sql.js";
import { headerText } from "../state.js";

const CHUNK = 50000;

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Disambiguate repeated header names by suffixing .1, .2, ... (like R's
// make.unique), so an exported CSV never has two identically-named columns.
function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const k = seen.get(n) || 0;
    seen.set(n, k + 1);
    return k === 0 ? n : `${n}.${k}`;
  });
}

export function exportCsv({ engine, store, rowCount }) {
  const state = store.get();
  const selected = state.columns.filter((c) => c.selected);
  const where = whereFromExpr(state.filterExpr);
  const order = orderFromSort(state.sort);

  // Header row follows the View toggle: column names, or labels in labels view
  // (falling back to the name when a label is absent). Labels are not unique
  // (CDISC frames often repeat e.g. "Description"), so de-duplicate the header
  // the way R's make.unique would -- a CSV with two identical column names is
  // ambiguous to readers.
  const header = uniqueNames(selected.map((c) => headerText(c, state.view)));
  const parts = [header.map(csvCell).join(",") + "\n"];

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
