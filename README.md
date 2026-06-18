# datasetviewer

<!-- badges: start -->
[![Lifecycle: experimental](https://img.shields.io/badge/lifecycle-experimental-orange.svg)](https://lifecycle.r-lib.org/articles/stages.html#experimental)
<!-- badges: end -->

An interactive, SAS Studio-style dataset viewer for R. `datasetviewer`
renders a dataset in a fast, scrollable grid modelled on the SAS Studio
table viewer, from one htmlwidget that runs in interactive Shiny apps and in
static HTML documents.

- **Fast on large data, no sampling.** The data is sent to the browser as
  Parquet and queried in place with DuckDB-WASM, so filtering, sorting, and
  scrolling stay responsive on datasets that overwhelm DOM-bound grids or
  server-paged tables.
- **SAS Studio layout.** A column-selection panel with char/num type icons
  and a collapse toggle, a property pane (Label, Name, Length, Type, Format,
  Informat), a names-versus-labels header toggle, header right-click sort,
  and a free-text "Filter Table Rows" expression.
- **Clinical metadata.** With the sibling
  [`artoo`](https://github.com/vthanik/artoo) package installed, column
  labels, formats, informats, and storage lengths are read from a labelled or
  CDISC-conformed frame. Plain data frames work with zero `artoo` dependency.

## Installation

```r
# install.packages("pak")
pak::pak("vthanik/datasetviewer")
```

## Usage

```r
library(datasetviewer)

# a plain data frame
dataset_viewer(mtcars)

# an artoo-conformed frame, headers shown as labels
adsl <- artoo::read_dataset("adsl.parquet")
dataset_viewer(adsl, view = "labels")
```

Right-click a column header to sort or add a filter; click the funnel in the
toolbar to edit the filter expression directly (for example
`AGE > 50 and SEX = "M"`).

### In Shiny

```r
library(shiny)
ui <- fluidPage(datasetviewerOutput("viewer", height = "500px"))
server <- function(input, output, session) {
  output$viewer <- renderDatasetViewer(dataset_viewer(adsl))
  # input$viewer_filter, input$viewer_sort, input$viewer_columns,
  # input$viewer_view track the user's current view
}
shinyApp(ui, server)
```
