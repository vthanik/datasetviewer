test_that(".dv_duckdb_local() is FALSE without the complete bundle", {
  tmp <- withr::local_tempdir()
  testthat::local_mocked_bindings(.dv_duckdb_dir = function() tmp)

  # Empty directory: nothing local.
  expect_false(.dv_duckdb_local())
  expect_null(.dv_duckdb_dependency())

  # Engine present but parquet extension missing: still not a usable offline
  # bundle, so fall back to the CDN.
  for (f in .dv_duckdb_files) {
    file.create(file.path(tmp, f))
  }
  expect_false(.dv_duckdb_local())
  expect_null(.dv_duckdb_dependency())
})

test_that("use_local_engine = FALSE forces the CDN even with a full bundle", {
  tmp <- withr::local_tempdir()
  testthat::local_mocked_bindings(.dv_duckdb_dir = function() tmp)
  for (f in .dv_duckdb_files) {
    file.create(file.path(tmp, f))
  }
  for (f in .dv_duckdb_ext) {
    dir.create(
      file.path(tmp, dirname(f)),
      recursive = TRUE,
      showWarnings = FALSE
    )
    file.create(file.path(tmp, f))
  }
  withr::local_options(datasetviewer.use_local_engine = FALSE)
  expect_false(.dv_duckdb_local())
  expect_null(.dv_duckdb_dependency())
})

test_that(".dv_duckdb_local() is FALSE when the package dir is unresolved", {
  # system.file() returns "" when the resource is absent (e.g. not installed).
  testthat::local_mocked_bindings(.dv_duckdb_dir = function() "")
  expect_false(.dv_duckdb_local())
  expect_null(.dv_duckdb_dependency())
})

test_that(".dv_duckdb_dependency() serves the bundle when engine + extension present", {
  tmp <- withr::local_tempdir()
  testthat::local_mocked_bindings(.dv_duckdb_dir = function() tmp)

  for (f in .dv_duckdb_files) {
    file.create(file.path(tmp, f))
  }
  for (f in .dv_duckdb_ext) {
    dir.create(
      file.path(tmp, dirname(f)),
      recursive = TRUE,
      showWarnings = FALSE
    )
    file.create(file.path(tmp, f))
  }

  expect_true(.dv_duckdb_local())
  dep <- .dv_duckdb_dependency()
  expect_s3_class(dep, "html_dependency")
  expect_equal(dep$name, "datasetviewer-duckdb")
  expect_equal(unlist(dep$attachment), .dv_duckdb_files)
})
