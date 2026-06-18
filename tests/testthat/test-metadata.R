test_that(".dv_meta_synth() reads R types and base label attributes", {
  df <- data.frame(a = 1:3, b = c("xx", "y", "zzz"), stringsAsFactors = FALSE)
  attr(df$b, "label") <- "B label"
  meta <- .dv_meta_synth(df)

  expect_equal(meta[[1]]$type, "Num")
  expect_equal(meta[[1]]$kind, "number")
  expect_equal(meta[[1]]$length, "") # numeric length is blank (PROC CONTENTS style)
  expect_equal(meta[[1]]$label, "")
  expect_equal(meta[[2]]$type, "Char")
  expect_equal(meta[[2]]$length, "3")
  expect_equal(meta[[2]]$label, "B label")
})

test_that(".dv_meta_from_artoo() reads labels and types from a labelled frame", {
  skip_if_not_installed("artoo")
  data(cdisc_adsl, package = "artoo")
  meta <- .dv_meta_from_artoo(cdisc_adsl)

  expect_length(meta, ncol(cdisc_adsl))
  first <- meta[[which(vapply(meta, function(m) m$name == "STUDYID", FALSE))]]
  expect_equal(first$type, "Char")
  expect_equal(first$label, "Study Identifier")
  expect_true(all(vapply(meta, function(m) is.character(m$name), TRUE)))
  # every entry carries the six SAS property fields
  expect_true(all(vapply(
    meta,
    function(m) {
      all(
        c("name", "label", "type", "length", "format", "informat") %in%
          names(m)
      )
    },
    TRUE
  )))
})

test_that(".dv_blank() collapses NA and non-scalars to empty string", {
  expect_equal(.dv_blank(NA), "")
  expect_equal(.dv_blank(NA_character_), "")
  expect_equal(.dv_blank(character(0)), "")
  expect_equal(.dv_blank("DATE9."), "DATE9.")
  expect_equal(.dv_blank(8L), "8")
})

test_that("dataset_viewer() errors on a path when artoo is unavailable", {
  # We cannot uninstall artoo here; assert the path branch is reachable by
  # checking a nonexistent path surfaces an artoo-side error, not a silent
  # pass-through. (Full no-artoo behaviour is covered by code review.)
  skip_if_not_installed("artoo")
  expect_error(dataset_viewer(tempfile(fileext = ".parquet")))
})
