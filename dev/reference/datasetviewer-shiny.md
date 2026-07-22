# Shiny bindings for the dataset viewer

Output and render functions to embed
[`dataset_viewer()`](https://vthanik.github.io/datasetviewer/dev/reference/dataset_viewer.md)
in a Shiny app. The widget pushes its live view state back to Shiny as
inputs, so the app can reuse the user's filter, sort, and column
selection server-side.

## Usage

``` r
datasetviewerOutput(outputId, width = "100%", height = "500px")

renderDatasetViewer(expr, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId:

  *Output slot id.* `<character(1)>`. Matched by `datasetviewerOutput()`
  and `renderDatasetViewer()`.

- width, height:

  *CSS sizing.* `<character(1)>`. Any valid CSS size; the grid fills the
  element.

- expr:

  *Render expression.* A call that returns a
  [`dataset_viewer()`](https://vthanik.github.io/datasetviewer/dev/reference/dataset_viewer.md)
  widget.

- env, quoted:

  *Evaluation control.* Standard htmlwidgets render plumbing; leave at
  their defaults.

## Value

*`datasetviewerOutput()`* returns a Shiny output UI element;
*`renderDatasetViewer()`* returns a Shiny render function.

## Details

**Inputs published.** For an output with id `"viewer"` the widget sets,
on every change:

- `input$viewer_columns` *(`<character>`)*: selected column names.

- `input$viewer_filter` *(`<character(1)>`)*: the filter expression.

- `input$viewer_sort` *(`<list>`)*: sort keys (`name`, `dir`).

- `input$viewer_view` *(`<character(1)>`)*: `"names"` or `"labels"`.

## See also

[`dataset_viewer()`](https://vthanik.github.io/datasetviewer/dev/reference/dataset_viewer.md)
for the widget these bindings embed.

## Examples

``` r
# ---- Example 1: read the viewer's filter and selection server-side ----
#
# The app shows a dataset and echoes the filter expression and selected
# columns the user builds in the grid. Runs only in an interactive session.
if (interactive()) {
  library(shiny)
  ui <- fluidPage(
    datasetviewerOutput("viewer", height = "500px"),
    verbatimTextOutput("state")
  )
  server <- function(input, output, session) {
    output$viewer <- renderDatasetViewer(dataset_viewer(mtcars))
    output$state <- renderText({
      paste0(
        "filter: ", input$viewer_filter, "\n",
        "columns: ", paste(input$viewer_columns, collapse = ", ")
      )
    })
  }
  shinyApp(ui, server)
}
```
