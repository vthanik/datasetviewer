# datasetviewer 0.1.1

* Initial CRAN release.
* `dataset_viewer()` renders a SAS Studio-style interactive grid for a data
  frame, an artoo-conformed frame, or a file path read via
  `artoo::read_dataset()`. The data is sent to the browser as Parquet and
  queried in place with DuckDB-WASM, so filter, sort, and scroll stay fast on
  large datasets without sampling rows.
* The shell provides a column-selection panel with char/num type icons and a
  collapse chevron (its list can be sorted by original order, name, or type and
  filtered by name to navigate wide datasets, without changing the grid column
  order), a property pane (Label, Name, Length, Type, Format), a
  names-versus-labels header toggle, and click-a-header to sort (the first click
  selects the column, then clicks cycle ascending, descending, unsorted) --
  Shift-click adds columns for a multi-column sort, each shown with its direction
  and priority. A right-click menu sorts per column
  (Sort Ascending/Descending add the column to the sort; Clear Sorting removes
  just that column) and offers per-column filters, copying a column or its
  header, and size-to-content, alongside a free-text row filter and CSV export
  of the current view.
* Missing values display as a muted `NA` in every column (numeric, character,
  and date), keeping them distinct from a genuine empty string and from the
  `NaN` floating-point value, which renders as `NaN`. They can be filtered with
  the `COL is na` / `COL is not na` free-text predicate or the per-column
  "(Missing)" option in the Add Filter dialog; the generated `dplyr` code uses
  `is.na()`.
* `datasetviewerOutput()` and `renderDatasetViewer()` embed the widget in
  Shiny and publish the current filter, sort, column selection, and view mode
  as inputs.
* The "Show code" toolbar button emits the runnable, air-formatted `dplyr`
  pipeline (filter, arrange, then select, with SQL-to-R translation) that
  reproduces the current view.
* The DuckDB-WASM engine loads from a CDN by default and is fetched into the
  package at install time when reachable, so a Shiny app can serve it to
  browsers with no internet at runtime (offline / corporate deployment). The
  install-time fetch honours `DATASETVIEWER_DUCKDB_DIR`,
  `DATASETVIEWER_DUCKDB_URL`, `DATASETVIEWER_DUCKDB_EXT_URL`, and
  `DATASETVIEWER_DUCKDB_OFFLINE`; the install never fails if the engine cannot
  be fetched (it falls back to the CDN at runtime).
* `options(datasetviewer.use_local_engine = FALSE)` forces the CDN even when
  the engine is present locally, keeping self-contained HTML documents small.
