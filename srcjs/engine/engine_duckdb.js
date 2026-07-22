// DuckDB-WASM engine. Registers the transported Parquet bytes and answers
// windowed queries as SQL, so the grid pulls only the rows it shows. Scale is
// bounded by the browser, not by what the grid can hold in the DOM.
//
// The engine is served from the package when fetched at install time (offline
// / corporate, via configure -> tools/fetch-duckdb.R); otherwise it loads from
// the jsDelivr CDN. See localBundles() below.

import * as duckdb from "@duckdb/duckdb-wasm";
import { Type } from "apache-arrow";
import { quoteId, colSelect, colExpr } from "./sql_expr.js";
import { statsSql, HIST_BINS } from "./stats_sql.js";

const VIEW = "dv_data";
const FILE = "dv_data.parquet";
const DISTINCT_LIMIT = 1000;

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
//
// Read each cell with Vector.get(r), NOT Vector.toArray(): toArray() on a
// numeric column returns a TypedArray, which cannot hold null, so a missing
// value (SQL NULL) silently becomes 0 (Int) or NaN (Float). get() honors the
// validity bitmap and yields a real null for every type, which fmtVal maps to
// the missing-value display. A genuine NaN value (validity set) still reads
// back as NaN and is rendered as such.
function tableToRows(table, columns) {
  const ncol = table.numCols;
  const vecs = [];
  for (let c = 0; c < ncol; c++) vecs.push(table.getChildAt(c));
  const nrow = table.numRows;
  const rows = new Array(nrow);
  for (let r = 0; r < nrow; r++) {
    const row = new Array(ncol);
    for (let c = 0; c < ncol; c++) row[c] = fmtVal(vecs[c].get(r), columns[c]);
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
  const statsCache = new Map();

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
      statsCache.clear();
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
    // Returns { values, truncated, hasNull } so the dialog can flag a capped
    // list and offer a "(Missing)" entry when the column has any NULL.
    async distinct(name) {
      const col = columns.find((c) => c.name === name) || { name, kind: "string" };
      const id = quoteId(name);
      const t = await conn.query(
        `SELECT DISTINCT ${colSelect(col)} AS v FROM ${VIEW} WHERE ${id} IS NOT NULL ORDER BY 1 LIMIT ${DISTINCT_LIMIT + 1}`
      );
      const vec = t.getChildAt(0);
      const all = [...vec].map((v) => fmtVal(v, { kind: "string" }));
      const nt = await conn.query(
        `SELECT count(*) FILTER (WHERE ${id} IS NULL) AS n FROM ${VIEW}`
      );
      return {
        values: all.slice(0, DISTINCT_LIMIT),
        truncated: all.length > DISTINCT_LIMIT,
        hasNull: Number(nt.toArray()[0].n) > 0,
      };
    },

    // All values of one column (current filter/sort), formatted for display.
    async column(name, { where = "", order = "" } = {}) {
      const col = columns.find((c) => c.name === name) || { name, kind: "string" };
      const w = where ? ` WHERE ${where}` : "";
      const o = order ? ` ORDER BY ${order}` : "";
      const t = await conn.query(
        `SELECT ${colSelect(col)} AS v FROM ${VIEW}${w}${o}`
      );
      // get()-based read (via iteration) so a NULL stays null, not 0/NaN.
      return [...t.getChildAt(0)].map((v) => fmtVal(v, col));
    },

    // Row count under an optional filter.
    async count(where = "") {
      const w = where ? ` WHERE ${where}` : "";
      const ct = await conn.query(
        `SELECT count(*)::BIGINT AS n FROM ${VIEW}${w}`
      );
      return Number(ct.toArray()[0].n);
    },

    // Kaggle-style stats for one column, over the FULL dataset. Cached: the
    // data never changes after load, so each column computes once.
    async columnStats(name) {
      if (statsCache.has(name)) return statsCache.get(name);
      const col = columns.find((c) => c.name === name) || { name, kind: "string" };
      const q = statsSql(col);
      const num = (x) => (x == null ? null : typeof x === "bigint" ? Number(x) : x);
      const b = (await conn.query(q.base)).toArray()[0];
      const top = (await conn.query(q.topk))
        .toArray()
        .map((r) => ({ v: r.v == null ? null : String(r.v), c: num(r.c) }));
      const out = {
        nTotal: num(b.n_total),
        nValid: num(b.n_valid),
        nUnique: num(b.n_unique),
        top,
        min: null, max: null, mean: null, sd: null,
        q25: null, q50: null, q75: null,
        minDisp: null, maxDisp: null, hist: null,
      };
      if (q.numeric && out.nValid > 0) {
        const n = (await conn.query(q.numeric)).toArray()[0];
        Object.assign(out, {
          min: num(n.mn), max: num(n.mx), mean: num(n.mean), sd: num(n.sd),
          q25: num(n.q25), q50: num(n.q50), q75: num(n.q75),
          minDisp: n.mn_disp == null ? null : String(n.mn_disp),
          maxDisp: n.mx_disp == null ? null : String(n.mx_disp),
        });
        if (out.max > out.min) {
          const h = (await conn.query(q.histogram(out.min, out.max))).toArray();
          const hist = Array.from({ length: HIST_BINS }, (_, i) => ({ bin: i, c: 0 }));
          h.forEach((r) => { const i = num(r.bin); if (hist[i]) hist[i].c = num(r.c); });
          out.hist = hist;
        }
      }
      statsCache.set(name, out);
      return out;
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
