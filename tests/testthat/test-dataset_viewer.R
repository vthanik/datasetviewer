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
    c("parquet", "columns", "view", "data_name", "n_rows", "n_cols")
  )
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

test_that(".dv_col_length() returns 8 for numeric and the widest bytes for char", {
  expect_equal(.dv_col_length(1:5), "8")
  expect_equal(.dv_col_length(c("a", "abc", "ab")), "3")
  expect_equal(.dv_col_length(character(0)), "")
  expect_equal(.dv_col_length(as.Date("2026-01-01")), "8")
})

test_that("view argument is validated and carried into the payload", {
  expect_error(dataset_viewer(mtcars, view = "bogus"))
})
