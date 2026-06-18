#' Shiny bindings for the dataset viewer
#'
#' Output and render functions to embed [dataset_viewer()] in a Shiny app. The
#' widget pushes its live view state back to Shiny as inputs, so the app can
#' reuse the user's filter, sort, and column selection server-side.
#'
#' **Inputs published.** For an output with id `"viewer"` the widget sets, on
#' every change:
#'
#' - `input$viewer_columns` *(`<character>`)*: selected column names.
#' - `input$viewer_filter` *(`<character(1)>`)*: the filter expression.
#' - `input$viewer_sort` *(`<list>`)*: sort keys (`name`, `dir`).
#' - `input$viewer_view` *(`<character(1)>`)*: `"names"` or `"labels"`.
#'
#' @param outputId *Output slot id.* `<character(1)>`. Matched by
#'   `datasetviewerOutput()` and `renderDatasetViewer()`.
#' @param width,height *CSS sizing.* `<character(1)>`. Any valid CSS size; the
#'   grid fills the element.
#' @param expr *Render expression.* A call that returns a [dataset_viewer()]
#'   widget.
#' @param env,quoted *Evaluation control.* Standard htmlwidgets render plumbing;
#'   leave at their defaults.
#'
#' @return *`datasetviewerOutput()`* returns a Shiny output UI element;
#'   *`renderDatasetViewer()`* returns a Shiny render function.
#'
#' @examples
#' # ---- Example 1: read the viewer's filter and selection server-side ----
#' #
#' # The app shows a dataset and echoes the filter expression and selected
#' # columns the user builds in the grid. Runs only in an interactive session.
#' if (interactive()) {
#'   library(shiny)
#'   ui <- fluidPage(
#'     datasetviewerOutput("viewer", height = "500px"),
#'     verbatimTextOutput("state")
#'   )
#'   server <- function(input, output, session) {
#'     output$viewer <- renderDatasetViewer(dataset_viewer(mtcars))
#'     output$state <- renderText({
#'       paste0(
#'         "filter: ", input$viewer_filter, "\n",
#'         "columns: ", paste(input$viewer_columns, collapse = ", ")
#'       )
#'     })
#'   }
#'   shinyApp(ui, server)
#' }
#'
#' @seealso [`dataset_viewer()`] for the widget these bindings embed.
#' @name datasetviewer-shiny
#' @export
datasetviewerOutput <- function(outputId, width = "100%", height = "500px") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "datasetviewer",
    width,
    height,
    package = "datasetviewer"
  )
}

#' @rdname datasetviewer-shiny
#' @export
renderDatasetViewer <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  htmlwidgets::shinyRenderWidget(
    expr,
    datasetviewerOutput,
    env,
    quoted = TRUE
  )
}
