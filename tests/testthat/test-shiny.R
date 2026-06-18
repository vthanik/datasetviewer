test_that("datasetviewerOutput() returns a Shiny output container", {
  skip_if_not_installed("shiny")
  out <- datasetviewerOutput("viewer", height = "400px")
  expect_s3_class(out, "shiny.tag.list")

  txt <- paste(as.character(out), collapse = "")
  expect_match(txt, "viewer") # the output id is embedded
  expect_match(txt, "datasetviewer") # the widget name is embedded
})

test_that("renderDatasetViewer() returns a render function (quoted = FALSE)", {
  skip_if_not_installed("shiny")
  r <- renderDatasetViewer(dataset_viewer(mtcars))
  expect_type(r, "closure")
})

test_that("renderDatasetViewer() honours an already-quoted expression", {
  skip_if_not_installed("shiny")
  expr <- quote(dataset_viewer(mtcars))
  r <- renderDatasetViewer(expr, quoted = TRUE)
  expect_type(r, "closure")
})
