test_that("dataset_viewer() returns an htmlwidget for a data frame", {
  w <- dataset_viewer(mtcars)
  expect_s3_class(w, "datasetviewer")
  expect_s3_class(w, "htmlwidget")
})

test_that("dataset_viewer() rejects non-data-frame input", {
  expect_snapshot(dataset_viewer(1:10), error = TRUE)
  expect_error(
    dataset_viewer(1:10),
    class = "datasetviewer_error_input"
  )
})

test_that(".dv_payload() carries Parquet, column meta, view, name, and counts", {
  p <- .dv_payload(head(iris, 3), data_name = "iris")

  expect_named(
    p,
    c(
      "parquet",
      "columns",
      "view",
      "data_name",
      "n_rows",
      "n_cols",
      "duckdb_local"
    )
  )
  expect_type(p$duckdb_local, "logical")
  expect_type(p$parquet, "character")
  expect_equal(p$view, "names")
  expect_equal(p$data_name, "iris")
  expect_equal(p$n_rows, 3L)
  expect_equal(p$n_cols, 5L)
  expect_equal(vapply(p$columns, `[[`, "", "name"), names(iris))
  # types are Num/Char regardless of the extraction path (artoo or synth)
  expect_true(all(
    vapply(p$columns, `[[`, "", "type") %in% c("Num", "Char")
  ))
})

test_that("dataset_viewer() captures the data symbol name for the code view", {
  mt <- head(mtcars, 2)
  w <- dataset_viewer(mt)
  expect_equal(w$x$data_name, "mt")
})

test_that(".dv_columns_meta() emits the SAS property fields + kind per column", {
  meta <- .dv_columns_meta(data.frame(a = 1:3, b = c("xx", "y", "zzz")))
  expect_named(
    meta[[1]],
    c("name", "label", "type", "kind", "length", "format", "informat")
  )
  expect_equal(meta[[1]]$type, "Num")
  expect_equal(meta[[2]]$type, "Char")
})

test_that(".dv_col_type() maps numeric and dates to Num, the rest to Char", {
  expect_equal(.dv_col_type(1:3), "Num")
  expect_equal(.dv_col_type(c(1.5, 2.5)), "Num")
  expect_equal(.dv_col_type(letters), "Char")
  expect_equal(.dv_col_type(factor(c("a", "b"))), "Char")
  # SAS stores dates numerically, so a Date column is Num
  expect_equal(.dv_col_type(as.Date("2026-01-01")), "Num")
})

test_that(".dv_col_kind() resolves the precise browser kind", {
  expect_equal(.dv_col_kind(1:3), "number")
  expect_equal(.dv_col_kind(letters), "string")
  expect_equal(.dv_col_kind(as.Date("2026-01-01")), "date")
  expect_equal(
    .dv_col_kind(as.POSIXct("2026-01-01 08:00", tz = "UTC")),
    "datetime"
  )
  expect_equal(.dv_col_kind(c(TRUE, FALSE)), "bool")
})

test_that(".dv_col_length() is blank for numeric/date and widest bytes for char", {
  expect_equal(.dv_col_length(1:5), "") # numeric length blank (PROC CONTENTS style)
  expect_equal(.dv_col_length(c("a", "abc", "ab")), "3")
  expect_equal(.dv_col_length(character(0)), "")
  expect_equal(.dv_col_length(as.Date("2026-01-01")), "") # dates are numeric -> blank
})

test_that("view argument is validated and carried into the payload", {
  expect_error(dataset_viewer(mtcars, view = "bogus"))
})

test_that("dataset_viewer() reads a file path through artoo", {
  skip_if_not_installed("artoo")
  df <- data.frame(a = 1:3, b = c("x", "y", "z"), stringsAsFactors = FALSE)
  path <- withr::local_tempfile(fileext = ".parquet")
  nanoparquet::write_parquet(df, path)

  w <- dataset_viewer(path)
  expect_s3_class(w, "datasetviewer")
  expect_equal(w$x$n_rows, 3L)
  expect_equal(w$x$data_name, "data") # a path literal is not a usable data name
})

test_that(".dv_read_path() errors when artoo is not installed", {
  testthat::local_mocked_bindings(
    requireNamespace = function(...) FALSE,
    .package = "base"
  )
  call <- rlang::current_env()
  expect_snapshot(.dv_read_path("adsl.parquet", call = call), error = TRUE)
  expect_error(
    .dv_read_path("adsl.parquet", call = call),
    class = "datasetviewer_error_input"
  )
})
