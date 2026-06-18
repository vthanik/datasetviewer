// Engine interface. One implementation today (DuckDB-WASM); kept behind this
// re-export so the grid depends on the contract, not the impl.
//
// Contract: createEngine() -> Promise<engine> where engine exposes:
//   load(bytes)          -> Promise<{columns, rowCount}>
//   query({offset,limit})-> Promise<row[]>   (row = values in column order)
//   columns()            -> [{name, kind}]
//   rowCount()           -> number
//   destroy()            -> Promise<void>
// kind is one of: number | string | bool | date | datetime | time.

export { createEngine } from "./engine_duckdb.js";
