// DuckDB-WASM engine. Registers the transported Parquet bytes and answers
// windowed queries as SQL, so the grid pulls only the rows it shows. Scale is
// bounded by the browser, not by what the grid can hold in the DOM.
//
// The engine is served from the package when fetched at install time (offline
// / corporate, via configure -> tools/fetch-duckdb.R); otherwise it loads from
// the jsDelivr CDN. See localBundles() below.

import * as duckdb from "@duckdb/duckdb-wasm";
import { Type } from "apache-arrow";

const VIEW = "dv_data";
const FILE = "dv_data.parquet";
const DISTINCT_LIMIT = 1000;
const TEMPORAL = new Set(["date", "datetime", "time"]);

// Map an Arrow column type to a coarse display/alignment kind.
function kindOf(type) {
  switch (type.typeId) {
    case Type.Int:
    case Type.Float:
    case Type.Decimal:
      return "number";
    case Type.Bool:
      return "bool";
    case Type.Date:
      return "date";
    case Type.Timestamp:
      return "datetime";
    case Type.Time:
      return "time";
    default:
      return "string";
  }
}

function quoteId(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

// SQL select expression for a column. Temporal columns are cast to text in
// DuckDB (which yields canonical ISO strings) so the browser never has to
// reason about Arrow time units, and so date/time/timestamp all display
// correctly regardless of precision.
function colExpr(col) {
  const id = quoteId(col.name);
  return TEMPORAL.has(col.kind) ? `CAST(${id} AS VARCHAR) AS ${id}` : id;
}

// Format a single value for display. Temporal values arrive as strings (cast
// in SQL); only numbers and booleans need shaping here.
function fmtVal(v, col) {
  if (v === null || v === undefined) return null;
  if (col.kind === "number") return typeof v === "bigint" ? Number(v) : v;
  if (col.kind === "bool") return v ? "TRUE" : "FALSE";
  return v;
}

// Build display rows by COLUMN INDEX (not by name). Indexing by position avoids
// Arrow's StructRow name resolution, which would (a) return prototype members
// for columns named like Object keys (constructor, toString, ...) and (b)
// collapse duplicate column names onto the first match.
function tableToRows(table, columns) {
  const ncol = table.numCols;
  const cols = [];
  for (let c = 0; c < ncol; c++) cols.push(table.getChildAt(c).toArray());
  const nrow = table.numRows;
  const rows = new Array(nrow);
  for (let r = 0; r < nrow; r++) {
    const row = new Array(ncol);
    for (let c = 0; c < ncol; c++) row[c] = fmtVal(cols[c][r], columns[c]);
    rows[r] = row;
  }
  return rows;
}

// Engine bundle served from the package (offline / corporate) when the wasm
// was fetched at install time and attached as an htmlwidgets dependency; null
// otherwise, so the caller falls back to the jsDelivr CDN.
function localBundles() {
  const hw = typeof window !== "undefined" ? window.HTMLWidgets : undefined;
  if (!hw || typeof hw.getAttachmentUrl !== "function") return null;
  const dep = "datasetviewer-duckdb";
  // The wasm and worker are loaded inside a Web Worker (a Blob URL origin),
  // where a relative attachment URL cannot resolve. Make every URL absolute
  // against the document so the worker fetches the right file.
  const abs = (u) => (u ? new URL(u, document.baseURI).href : u);
  let mvpWasm, mvpWorker, ehWasm, ehWorker;
  try {
    mvpWasm = abs(hw.getAttachmentUrl(dep, "mvp_wasm"));
    mvpWorker = abs(hw.getAttachmentUrl(dep, "mvp_worker"));
    ehWasm = abs(hw.getAttachmentUrl(dep, "eh_wasm"));
    ehWorker = abs(hw.getAttachmentUrl(dep, "eh_worker"));
  } catch (e) {
    return null; // dependency not registered -> use CDN
  }
  if (!mvpWasm || !ehWasm) return null;
  // The parquet extension lives under <bundle dir>/extensions/<ver>/<platform>/;
  // point DuckDB's extension repository at that base so read_parquet loads it
  // locally instead of fetching from extensions.duckdb.org.
  const extRepo = ehWasm.replace(/\/[^/]*$/, "") + "/extensions";
  return {
    bundles: {
      mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
      eh: { mainModule: ehWasm, mainWorker: ehWorker },
    },
    extRepo,
  };
}

export async function createEngine() {
  const local = localBundles();
  const bundle = await duckdb.selectBundle(
    local ? local.bundles : duckdb.getJsDelivrBundles()
  );
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  const conn = await db.connect();

  if (local) {
    // Load the parquet extension from the package's local repository (offline).
    await conn.query(
      `SET custom_extension_repository='${local.extRepo}'`
    );
  }

  let columns = [];
  let rowCount = 0;
  let selectList = "*";

  return {
    async load(bytes) {
      await db.registerFileBuffer(FILE, bytes);
      await conn.query(
        `CREATE OR REPLACE VIEW ${VIEW} AS SELECT * FROM read_parquet('${FILE}')`
      );
      const head = await conn.query(`SELECT * FROM ${VIEW} LIMIT 0`);
      columns = head.schema.fields.map((f) => ({
        name: f.name,
        kind: kindOf(f.type),
      }));
      selectList = columns.map(colExpr).join(", ");
      const ct = await conn.query(`SELECT count(*)::BIGINT AS n FROM ${VIEW}`);
      rowCount = Number(ct.toArray()[0].n);
      return { columns, rowCount };
    },

    // Windowed read with optional WHERE / ORDER BY (built from the filter
    // expression and sort).
    async query({ offset = 0, limit = 100, where = "", order = "" } = {}) {
      const w = where ? ` WHERE ${where}` : "";
      const o = order ? ` ORDER BY ${order}` : "";
      const table = await conn.query(
        `SELECT ${selectList} FROM ${VIEW}${w}${o} LIMIT ${limit} OFFSET ${offset}`
      );
      return tableToRows(table, columns);
    },

    // Distinct non-null values of a column (for the categorical filter).
    // Returns { values, truncated } so the dialog can flag a capped list.
    async distinct(name) {
      const col = columns.find((c) => c.name === name) || { name, kind: "string" };
      const expr = colExpr(col).replace(/ AS .*/, "");
      const id = quoteId(name);
      const t = await conn.query(
        `SELECT DISTINCT ${expr} AS v FROM ${VIEW} WHERE ${id} IS NOT NULL ORDER BY 1 LIMIT ${DISTINCT_LIMIT + 1}`
      );
      const all = t.toArray().map((r) => fmtVal(r.v, { kind: "string" }));
      return {
        values: all.slice(0, DISTINCT_LIMIT),
        truncated: all.length > DISTINCT_LIMIT,
      };
    },

    // All values of one column (current filter/sort), formatted for display.
    async column(name, { where = "", order = "" } = {}) {
      const col = columns.find((c) => c.name === name) || { name, kind: "string" };
      const w = where ? ` WHERE ${where}` : "";
      const o = order ? ` ORDER BY ${order}` : "";
      const t = await conn.query(
        `SELECT ${colExpr(col).replace(/ AS .*/, "")} AS v FROM ${VIEW}${w}${o}`
      );
      return t.getChildAt(0).toArray().map((v) => fmtVal(v, col));
    },

    // Row count under an optional filter.
    async count(where = "") {
      const w = where ? ` WHERE ${where}` : "";
      const ct = await conn.query(
        `SELECT count(*)::BIGINT AS n FROM ${VIEW}${w}`
      );
      return Number(ct.toArray()[0].n);
    },

    columns() {
      return columns;
    },
    rowCount() {
      return rowCount;
    },

    async destroy() {
      try {
        await conn.close();
        await db.terminate();
        worker.terminate();
      } catch (e) {
        // best effort
      }
    },
  };
}
