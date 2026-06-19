# Get started with datasetviewer

Looking at a dataset should not mean choosing between *fast* and
*complete*. Grids that render every cell into the page bog down at a few
thousand rows; ones that page through a server add a network round-trip
to every scroll and filter. The usual escape hatch — show the first
1,000 rows — quietly hides exactly the rows you opened the viewer to
find.

`datasetviewer` takes a different route, borrowed from [SAS
Studio](https://www.sas.com/en_us/software/studio.html)’s table viewer.
The data is sent to the browser **once**, as Parquet, and queried in
place with
[DuckDB-WASM](https://duckdb.org/docs/stable/clients/wasm/overview); the
grid is drawn on an HTML canvas and only ever materialises the rows you
can see. Sort, filter, hide a column, jump to the last page — each is a
SQL query over the whole dataset that returns in milliseconds, with **no
row sampling**. The same widget runs in an interactive Shiny app and in
a static HTML document like this one.

## Your first viewer

Hand
[`dataset_viewer()`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
a data frame. That is the entire API for the common case — everything
else is interaction inside the widget.

``` r

library(datasetviewer)
dataset_viewer(mtcars)
```

Try it: drag the scrollbar, drag a column border to resize, or click a
row. The grid above is live — it is the real widget, not a screenshot.

## A guided tour of the interface

The layout mirrors SAS Studio, so anyone who has used that viewer is
already at home:

- **Columns panel** (left) — a checklist of every column with a type
  chip (`A` for character, `#` for numeric, a calendar for dates).
  Uncheck a column to hide it from the grid; the data is never reloaded.
- **Property pane** (lower left) — select a column to inspect its
  `Label`, `Name`, `Length`, `Type`, `Format`, and `Informat`, the same
  attributes `PROC CONTENTS` reports.
- **Toolbar** (top) — the names-versus-labels **View** dropdown, an
  **Export current view to CSV** button, a **Show code** button (`<>`)
  that reveals the dplyr pipeline for the current view, and **Filter
  table rows** (the funnel) with a badge showing the active filter.
- **Header menu** — right-click any column header to sort ascending or
  descending, add a filter, copy the column, or size the columns to
  content.
- **Status bar** — the total row and column counts, and the filtered
  count once a filter is active.

> **Tip**
>
> Sorting and filtering are driven from the widget, not from R
> arguments, so a reader of your report can explore the data themselves
> without re-running any code.

## CDISC metadata, labels, and the property pane

A plain data frame has no labels, so the property pane shows names only.
Point the viewer at a labelled or CDISC-conformed frame and the metadata
comes to life. With the companion
[`artoo`](https://vthanik.github.io/artoo/) package installed, column
labels, formats, informats, and storage lengths are read straight from
the frame and shown in the property pane — and you can set the header
row to use labels instead of names.

``` r

# artoo ships the CDISC pilot ADaM datasets used across these docs.
dataset_viewer(artoo::cdisc_adsl, view = "labels")
```

Select `STUDYID` in the columns panel and the property pane reads *Study
Identifier*; the header row now shows labels because of
`view = "labels"`. No `artoo` dependency is required for plain frames —
it is consulted only when present.

> **Note**
>
> [`dataset_viewer()`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
> also accepts a **path** to a dataset file
> (`dataset_viewer("adsl.parquet")`);
> [`artoo::read_dataset()`](https://vthanik.github.io/artoo/reference/read_dataset.html)
> reads it, carrying its metadata into the property pane.

## Filtering the whole table

There are two ways to filter, both operating over every row:

1.  **Filter Table Rows** — click the funnel in the toolbar and type a
    free-text expression, SAS-style, such as `AGE >= 75 and SEX = "F"`.
    It is translated to a SQL `WHERE` clause, and the status bar updates
    to the matched count.
2.  **Add Filter** — right-click a column header. The dialog adapts to
    the column’s type: a checklist of distinct values for character
    columns, a comparison operator and value for numbers, and a date
    picker for dates.

Because the filter runs in DuckDB over the full Parquet payload, the
answer is exact — the matched count is the true count, not a count
within a sampled window.

## Reproducing the view as code

Exploration in the grid is convenient, but a report needs to be
reproducible. The **Show code** button (`<>` in the toolbar) opens a
dialog with the runnable [`dplyr`](https://dplyr.tidyverse.org/)
pipeline that reproduces the current view — the column selection, the
filter, and the sort, in order:

``` r

mtcars |>
  dplyr::select(cyl, hp, wt, mpg) |>
  dplyr::filter(mpg >= 20) |>
  dplyr::arrange(dplyr::desc(hp))
```

The snippet is air-formatted and syntax-highlighted, with a **Copy**
button. SQL idioms are translated to their R equivalents — `IN (...)`
becomes `%in% c(...)`, `NOT IN` becomes `!x %in% c(...)`, and date or
time literals become [`as.Date()`](https://rdrr.io/r/base/as.Date.html)
/ [`as.POSIXct()`](https://rdrr.io/r/base/as.POSIXlt.html) /
[`hms::as_hms()`](https://hms.tidyverse.org/reference/hms.html) — so the
code runs as-is against the source frame. It is modelled on SAS Studio’s
“show the code that creates this table”, and it stays in sync with the
view: change the filter or sort and reopen it to see the updated
pipeline.

## Exporting the current view

The **Export current view to CSV** toolbar button downloads exactly what
you are looking at — the visible columns, the active filter, and the
current sort, over **every** matching row, not just the visible window.
The export streams from the engine in row chunks, so it does not depend
on the dataset fitting in memory in one piece.

## Built for scale: no row sampling

The design choice that makes this work is moving the query engine into
the browser:

- **Transport.** The frame is serialised to Parquet with `nanoparquet`
  and carried in the widget payload — columnar, compressed, and read
  natively by the engine.
- **Engine.** DuckDB-WASM reads that Parquet directly and answers every
  filter, sort, and page as SQL.
- **Grid.** The canvas grid asks the engine only for the rows in the
  visible window (a `LIMIT`/`OFFSET` query), so scrolling cost is
  independent of the dataset’s size.

The practical upshot: a viewer over a multi-million-row frame scrolls,
sorts, and filters as smoothly as one over `mtcars`, and every row stays
reachable.

## Embedding in a Shiny app

In Shiny, pair
[`datasetviewerOutput()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
in the UI with
[`renderDatasetViewer()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
on the server. The viewer is not a dead end: the user’s current column
selection, filter, sort, and view mode flow **back** into the app as
inputs, namespaced by the output id, so the rest of the app can react to
what the analyst is looking at.

``` r

library(shiny)
library(datasetviewer)

ui <- fluidPage(
  datasetviewerOutput("viewer", height = "560px"),
  verbatimTextOutput("state")
)

server <- function(input, output, session) {
  output$viewer <- renderDatasetViewer(dataset_viewer(mtcars))

  # State changes in the widget arrive as inputs, namespaced by output id.
  output$state <- renderPrint({
    list(
      columns = input$viewer_columns, # columns currently shown
      filter  = input$viewer_filter, # active filter expression
      sort    = input$viewer_sort, # active sort
      view    = input$viewer_view # "names" or "labels"
    )
  })
}

shinyApp(ui, server)
```

## Static HTML and Quarto

No server is required for the static case — this very vignette embeds
live widgets. Drop
[`dataset_viewer()`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
into any R Markdown or Quarto document and the result is a fully
interactive grid. The same call you would write in a Shiny app produces
the same viewer here.

## The query engine: online by default, offline when you need it

Everything except one piece is bundled in the package and works with no
internet: the canvas grid, the column panel, the filters, the code view,
the CSV export, and your data (carried in the page as Parquet). The one
piece is the **DuckDB-WASM query engine** — the in-browser database that
answers every filter, sort, and page. It is roughly 35 MB, far too large
to ship inside an R package, so by default the widget loads it from a
public CDN ([jsDelivr](https://www.jsdelivr.com/)) the first time a grid
is rendered. For interactive use on a connected machine, nothing more is
needed.

### Self-hosting the engine for offline and corporate use

When the browser cannot reach the CDN — an air-gapped laptop, or a
corporate Shiny server behind a firewall — the engine must be served
locally. This works the same way the
[`arrow`](https://arrow.apache.org/docs/r/) package acquires its C++
library: **at install time**, with no function for you to call.

When you install `datasetviewer`, an install step fetches the engine
(and the parquet extension DuckDB needs to read the payload) into the
package. From then on, a Shiny app **serves the engine from the package
to the browser** — no internet at runtime. If the install machine cannot
reach the public host, the step is skipped and the widget simply falls
back to the CDN; the install never fails.

The fetch is steered with environment variables, set before
`install.packages("datasetviewer")` (the analogues of `arrow`’s
`LIBARROW_BINARY`):

| Variable | Effect |
|----|----|
| `DATASETVIEWER_DUCKDB_DIR` | Copy the engine from a pre-staged directory instead of downloading — for a fully air-gapped install. |
| `DATASETVIEWER_DUCKDB_URL` | Base URL of an internal mirror of the engine files. |
| `DATASETVIEWER_DUCKDB_EXT_URL` | Base URL of an internal mirror of the DuckDB extension repository. |
| `DATASETVIEWER_DUCKDB_OFFLINE` | Set to `true` to skip the fetch and always use the CDN. |

A typical corporate deployment installs the package the same way it
installs any other (often through an internal mirror that already
carries `arrow`), points these variables at the in-house mirror if the
public host is blocked, and then runs the Shiny app — which serves the
engine to every user’s browser with no outbound connection.

### Static documents and the engine

A self-contained HTML document (a Quarto or R Markdown report, or
`htmlwidgets::saveWidget(selfcontained = TRUE)`) embeds **every**
dependency in the file. Embedding the 35 MB engine there would produce
an enormous page, so static documents should load the engine from the
CDN instead. Set this option once, in a setup chunk, before any
[`dataset_viewer()`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
call:

``` r

options(datasetviewer.use_local_engine = FALSE)
```

That keeps the document small while the grid loads the engine from the
CDN when a reader opens it. (This vignette does exactly that.) Leave the
option at its default for Shiny, where the engine is served rather than
embedded.

## Where to next

- [`?dataset_viewer`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
  — the full argument reference, including `view`, `width`, and
  `height`.
- [`?datasetviewerOutput`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
  and
  [`?renderDatasetViewer`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
  — the Shiny bindings and the input names the widget publishes.
- [`artoo`](https://vthanik.github.io/artoo/) — lossless CDISC dataset
  I/O and the metadata model the property pane reads.
