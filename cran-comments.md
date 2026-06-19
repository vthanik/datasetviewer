## R CMD check results

0 errors | 0 warnings | 0 notes

## Submission notes

* This is a new submission (datasetviewer 0.1.0).

* The package renders an interactive htmlwidget. The DuckDB-WASM engine
  (~80 MB) is not shipped in the tarball. It is fetched at install time by a
  `configure` script (`tools/fetch-duckdb.R`), modelled on how the 'arrow'
  package acquires its C++ library. The fetch is best-effort and never fails
  the install: when it cannot run (no network, or the CRAN build sandbox), the
  widget loads the engine from a CDN at runtime instead, so the package
  installs and works offline-of-the-engine without it. The behaviour can be
  controlled with the environment variables `DATASETVIEWER_DUCKDB_OFFLINE`,
  `DATASETVIEWER_DUCKDB_DIR`, `DATASETVIEWER_DUCKDB_URL`, and
  `DATASETVIEWER_DUCKDB_EXT_URL`.

* The package bundles third-party JavaScript (React, Glide Data Grid,
  Apache Arrow JS, and the DuckDB-WASM JavaScript API) compiled into
  `inst/htmlwidgets/datasetviewer.js`. Their versions, licenses, and copyright
  holders are recorded in `inst/COPYRIGHTS`.

* Examples and the vignette never auto-print an htmlwidget at the top level
  (which would launch a browser under `R CMD check`); a regression test
  guards this.

## Test environments

* local macOS (aarch64), R 4.5.3
* GitHub Actions: macOS, Windows, Ubuntu (release, devel, oldrel-1)
