# Local DuckDB-WASM engine wiring. The ~35 MB engine plus the parquet extension
# are fetched at install time into inst/htmlwidgets/duckdb/ (see
# tools/fetch-duckdb.R, run by configure), mirroring how the arrow package
# acquires its C++ library at install. When the files are present we attach them
# as an htmlwidgets dependency so the browser loads the engine -- and the parquet
# extension -- from the package (offline, e.g. behind a corporate firewall);
# when absent the widget falls back to the jsDelivr CDN at runtime.

# Engine core files, exposed as attachments the browser resolves with
# HTMLWidgets.getAttachmentUrl().
.dv_duckdb_files <- c(
  eh_wasm = "duckdb-eh.wasm",
  eh_worker = "duckdb-browser-eh.worker.js",
  mvp_wasm = "duckdb-mvp.wasm",
  mvp_worker = "duckdb-browser-mvp.worker.js"
)

# Parquet extension files (under the repository layout DuckDB expects). DuckDB
# v1.5+ loads parquet as an extension at query time; the transport is parquet,
# so an offline bundle must carry it. Keep the version in sync with
# tools/fetch-duckdb.R.
.dv_duckdb_ext <- c(
  file.path("extensions", "v1.5.1", "wasm_eh", "parquet.duckdb_extension.wasm"),
  file.path("extensions", "v1.5.1", "wasm_mvp", "parquet.duckdb_extension.wasm")
)

# Directory holding the installed bundle, or "" when the package is not yet
# installed (devtools::load_all) or the fetch did not run.
.dv_duckdb_dir <- function() {
  system.file("htmlwidgets", "duckdb", package = "datasetviewer")
}

# TRUE only when the complete offline bundle (engine + parquet extension) is
# present locally; a partial bundle falls back to the CDN.
#
# `options(datasetviewer.use_local_engine = FALSE)` forces the CDN even when the
# bundle is present. Static self-contained HTML (vignettes, saveWidget) embeds
# every dependency, so embedding the ~80 MB engine there is never wanted; such
# documents set this option to keep the output small and load the engine from
# the CDN at view time. Shiny serves the engine instead of embedding it, so it
# leaves the option at its default and uses the local bundle offline.
.dv_duckdb_local <- function() {
  if (!isTRUE(getOption("datasetviewer.use_local_engine", TRUE))) {
    return(FALSE)
  }
  dir <- .dv_duckdb_dir()
  if (!nzchar(dir)) {
    return(FALSE)
  }
  all(file.exists(file.path(dir, c(.dv_duckdb_files, .dv_duckdb_ext))))
}

# htmlwidgets dependency serving the whole bundle (all_files = TRUE so the
# extensions/ tree ships alongside the engine); NULL when not present locally.
.dv_duckdb_dependency <- function() {
  if (!.dv_duckdb_local()) {
    return(NULL)
  }
  htmltools::htmlDependency(
    name = "datasetviewer-duckdb",
    version = "1.33.1",
    src = .dv_duckdb_dir(),
    attachment = as.list(.dv_duckdb_files),
    all_files = TRUE
  )
}
