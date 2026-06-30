# View a dataset in an interactive SAS Studio-style grid

Renders a fast, scrollable data grid with a column-selection panel and
per-column property metadata. The same widget renders in interactive
Shiny apps and in static HTML documents.

## Usage

``` r
dataset_viewer(
  x,
  ...,
  view = c("names", "labels"),
  width = NULL,
  height = NULL,
  elementId = NULL
)
```

## Arguments

- x:

  *Dataset to view.* `<data.frame | character(1)>`. A data frame, or a
  file path read via
  [`artoo::read_dataset()`](https://vthanik.github.io/artoo/reference/read_dataset.html)
  (xpt, Dataset-JSON, NDJSON, 'Parquet', RDS). An artoo-conformed frame
  supplies labels, formats, and lengths to the property panel; a plain
  frame uses synthesized metadata.

- ...:

  Reserved for future arguments.

- view:

  *Initial header mode.* `<character(1)>`. `"names"` (default, matching
  SAS Studio) shows column names as headers; `"labels"` shows labels,
  falling back to names when a label is absent.

- width, height:

  *Widget sizing.* `<character(1) | numeric(1) | NULL>`. Passed through
  to
  [`htmlwidgets::createWidget()`](https://rdrr.io/pkg/htmlwidgets/man/createWidget.html).

- elementId:

  *Explicit DOM id.* `<character(1) | NULL>`. Usually left `NULL` so
  htmlwidgets assigns one.

## Value

*An htmlwidget.* Print it to render, or use it as a Shiny output.

## Details

**Query engine.** The data is sent to the browser once as 'Parquet' and
queried in place with DuckDB-WASM, so filter, sort, and paging run over
the whole dataset with no row sampling. The engine (~35 MB) loads from a
CDN by default but is fetched into the package at install time when
reachable, so a Shiny app can serve it to browsers with no internet at
runtime. Set `options(datasetviewer.use_local_engine = FALSE)` to force
the CDN (for small self-contained HTML). See
[`vignette("datasetviewer")`](https://vthanik.github.io/datasetviewer/articles/datasetviewer.md)
for offline and corporate deployment, including the
`DATASETVIEWER_DUCKDB_*` install-time environment variables.

## See also

**Shiny bindings:**
[`datasetviewerOutput()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md),
[`renderDatasetViewer()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md).

## Examples

``` r
# ---- Example 1: view a plain data frame ----
#
# Wrap any data frame to get the interactive grid. Printing the widget in
# an interactive session or a rendered document shows it; here we inspect
# the payload so the example stays headless and self-contained (printing a
# widget would launch a browser under R CMD check).
viewer <- dataset_viewer(mtcars)
viewer$x$n_rows
#> [1] 32

# ---- Example 2: CDISC labels as headers ----
#
# With the sibling artoo package, a CDISC-conformed frame supplies column
# labels, formats, and storage lengths to the property pane and the
# names-versus-labels header toggle. Start on labels with view = "labels".
if (requireNamespace("artoo", quietly = TRUE)) {
  labelled <- dataset_viewer(artoo::cdisc_adsl, view = "labels")
  labelled$x$columns[[1]]$label
}
#> [1] "Study Identifier"
```
