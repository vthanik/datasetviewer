# Install-time fetch of the DuckDB-WASM engine, modelled on arrow's
# tools/nixlibs.R. The wasm engine is ~35 MB -- far too large to ship in the
# package -- so it is fetched into inst/htmlwidgets/duckdb/ at install time and
# served locally from there at runtime. When the fetch cannot happen (no
# network, CRAN's sandbox), install still succeeds and the widget falls back to
# the jsDelivr CDN at runtime. Nothing here is required for the package to load.
#
# Two pieces are fetched:
#   1. the engine core (wasm + worker, eh and mvp variants), and
#   2. the parquet extension -- DuckDB v1.5+ loads parquet as an extension from
#      extensions.duckdb.org at query time, and the transport is parquet, so a
#      truly offline (air-gapped / corporate) deployment needs it locally too.
#
# Corporate / offline control (arrow's LIBARROW_BINARY analogue):
#   DATASETVIEWER_DUCKDB_DIR      a directory holding a full pre-staged bundle
#                                 (engine files + extensions/ tree); copied
#                                 instead of downloaded (air-gapped install).
#   DATASETVIEWER_DUCKDB_URL      base URL mirroring the engine dist files.
#   DATASETVIEWER_DUCKDB_EXT_URL  base URL mirroring the extension repository.
#   DATASETVIEWER_DUCKDB_OFFLINE  "true" to skip the fetch entirely.

# Pinned to the @duckdb/duckdb-wasm version in package.json and the DuckDB core
# version it embeds -- keep both in sync when bumping the bundle.
VERSION <- "1.33.1-dev45.0" # npm @duckdb/duckdb-wasm
EXT_VERSION <- "v1.5.1" # DuckDB core version on extensions.duckdb.org

dest <- file.path("inst", "htmlwidgets", "duckdb")

# Engine core files (flat in dest).
ENGINE <- c(
  "duckdb-eh.wasm",
  "duckdb-browser-eh.worker.js",
  "duckdb-mvp.wasm",
  "duckdb-browser-mvp.worker.js"
)

# Parquet extension, per wasm platform, under the repository layout DuckDB
# expects: <repo>/<version>/<platform>/<name>.
EXT_PLATFORMS <- c("wasm_eh", "wasm_mvp")
EXT_NAME <- "parquet.duckdb_extension.wasm"
ext_rel <- function(platform) {
  file.path("extensions", EXT_VERSION, platform, EXT_NAME)
}

fetch_one <- function(url, out) {
  dir.create(dirname(out), showWarnings = FALSE, recursive = TRUE)
  tryCatch(
    {
      utils::download.file(url, out, mode = "wb", quiet = TRUE)
      file.exists(out) && file.info(out)$size > 0
    },
    error = function(e) FALSE,
    warning = function(w) FALSE
  )
}

copy_one <- function(from, out) {
  if (!file.exists(from)) {
    return(FALSE)
  }
  dir.create(dirname(out), showWarnings = FALSE, recursive = TRUE)
  isTRUE(file.copy(from, out, overwrite = TRUE))
}

main <- function() {
  if (tolower(Sys.getenv("DATASETVIEWER_DUCKDB_OFFLINE", "false")) == "true") {
    message("datasetviewer: DUCKDB_OFFLINE set; skipping engine fetch (CDN at runtime).")
    return(invisible())
  }

  # Target file -> (download URL, staged source path) for every needed file.
  rel <- c(ENGINE, vapply(EXT_PLATFORMS, ext_rel, character(1)))
  out <- file.path(dest, rel)

  engine_base <- Sys.getenv(
    "DATASETVIEWER_DUCKDB_URL",
    sprintf("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@%s/dist", VERSION)
  )
  ext_base <- Sys.getenv("DATASETVIEWER_DUCKDB_EXT_URL", "https://extensions.duckdb.org")
  url <- c(
    paste0(engine_base, "/", ENGINE),
    vapply(EXT_PLATFORMS, function(p) {
      sprintf("%s/%s/%s/%s", ext_base, EXT_VERSION, p, EXT_NAME)
    }, character(1))
  )

  staged <- Sys.getenv("DATASETVIEWER_DUCKDB_DIR", "")

  ok <- TRUE
  for (i in seq_along(rel)) {
    if (file.exists(out[i]) && file.info(out[i])$size > 0) next # idempotent
    got <- if (nzchar(staged)) {
      copy_one(file.path(staged, rel[i]), out[i])
    } else {
      fetch_one(url[i], out[i])
    }
    if (!isTRUE(got)) ok <- FALSE
  }

  if (!ok) {
    message("datasetviewer: could not assemble the full DuckDB-WASM bundle; the widget will use the CDN.")
    unlink(dest, recursive = TRUE) # leave no partial bundle (-> CDN fallback)
    return(invisible())
  }
  message("datasetviewer: DuckDB-WASM engine + parquet extension ready for offline use.")
}

tryCatch(main(), error = function(e) {
  message("datasetviewer: engine fetch skipped (", conditionMessage(e), "); CDN at runtime.")
})
