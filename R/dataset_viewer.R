#' View a dataset in an interactive SAS Studio-style grid
#'
#' Renders a fast, scrollable data grid with a column-selection panel and
#' per-column property metadata. The same widget renders in interactive Shiny
#' apps and in static HTML documents.
#'
#' @param x *Dataset to view.* `<data.frame | character(1)>`. A data frame, or
#'   a file path read via [artoo::read_dataset()] (xpt, Dataset-JSON, NDJSON,
#'   Parquet, RDS). An artoo-conformed frame supplies labels, formats, and
#'   informats to the property panel; a plain frame uses synthesized metadata.
#' @param ... Reserved for future arguments.
#' @param view *Initial header mode.* `<character(1)>`. `"names"` (default,
#'   matching SAS Studio) shows column names as headers; `"labels"` shows
#'   labels, falling back to names when a label is absent.
#' @param width,height *Widget sizing.* `<character(1) | numeric(1) | NULL>`.
#'   Passed through to [htmlwidgets::createWidget()].
#' @param elementId *Explicit DOM id.* `<character(1) | NULL>`. Usually left
#'   `NULL` so htmlwidgets assigns one.
#'
#' @return *An htmlwidget.* Print it to render, or use it as a Shiny output.
#' @export
dataset_viewer <- function(
  x,
  ...,
  view = c("names", "labels"),
  width = NULL,
  height = NULL,
  elementId = NULL
) {
  # Capture the symbol the user passed (mtcars, artoo::cdisc_adsl) for the
  # "Show code" snippet, before x is forced or a path is read.
  data_name <- rlang::as_label(rlang::enexpr(x))

  if (is.character(x) && length(x) == 1L) {
    x <- .dv_read_path(x, call = rlang::caller_env())
    data_name <- "data" # a path literal is not a usable data name
  }
  if (!inherits(x, "data.frame")) {
    cli::cli_abort(
      c(
        "{.arg x} must be a data frame or a file path.",
        "x" = "You supplied {.obj_type_friendly {x}}."
      ),
      class = "datasetviewer_error_input",
      call = rlang::caller_env()
    )
  }
  view <- rlang::arg_match(view)

  payload <- .dv_payload(x, view = view, data_name = data_name)

  htmlwidgets::createWidget(
    name = "datasetviewer",
    x = payload,
    width = width,
    height = height,
    package = "datasetviewer",
    elementId = elementId,
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = 500,
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      padding = 0
    )
  )
}

# Read a file path through artoo (required for path input).
.dv_read_path <- function(path, call) {
  if (!requireNamespace("artoo", quietly = TRUE)) {
    cli::cli_abort(
      c(
        "Reading a file path requires the {.pkg artoo} package.",
        "i" = "Install artoo, or pass a data frame to {.arg x}."
      ),
      class = "datasetviewer_error_input",
      call = call
    )
  }
  artoo::read_dataset(path)
}

# Assemble the widget payload. The data travels as base64 Parquet; the browser
# registers it in DuckDB-WASM and queries it natively. Column metadata feeds the
# column panel (icons) and the property panel.
.dv_payload <- function(x, view = "names", data_name = "data") {
  list(
    parquet = .dv_to_parquet_b64(x),
    columns = .dv_columns_meta(x),
    view = view,
    data_name = data_name,
    n_rows = nrow(x),
    n_cols = ncol(x)
  )
}
