## R CMD check results

0 errors | 0 warnings | 1 note

* The note is the expected "New submission" from
  `checking CRAN incoming feasibility`; see below.

## Submission notes

* This is a new submission (datasetviewer 0.1.0), so
  `checking CRAN incoming feasibility` reports a NOTE flagging it as a new
  package with a new maintainer. This is expected for a first release.

* The package renders an interactive htmlwidget. The DuckDB-WASM engine
  (~80 MB) is not shipped in the tarball. It is fetched at install time by a
  `configure` script (`tools/fetch-duckdb.R`), modelled on how the 'arrow'
  package acquires its C++ library. The fetch is best-effort and never fails
  the install: it is wrapped so that no error or warning propagates, and when
  it cannot run (no network, or the CRAN build sandbox) the install still
  succeeds and the widget loads the engine from a CDN at runtime instead, so
  the package installs and works without it. The download is therefore not
  required for the package to install, load, check, or run its examples,
  tests, and vignette (those do not exercise the engine). Should
  `checking for ...` flag the `configure` step or an install-time download,
  this is the reason. On a build machine with network access the fetch runs
  and `checking installed package size` may then report ~80 MB; that size is
  the downloaded engine, never the tarball (which is ~290 KB), and it is
  absent on any install where the fetch is skipped. The behaviour can be
  steered with the environment
  variables `DATASETVIEWER_DUCKDB_OFFLINE` (skip the fetch, always use the
  CDN), `DATASETVIEWER_DUCKDB_DIR` (copy from a pre-staged directory for an
  air-gapped install), `DATASETVIEWER_DUCKDB_URL`, and
  `DATASETVIEWER_DUCKDB_EXT_URL` (internal mirrors).

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
