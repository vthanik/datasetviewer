# The "Show code" dialog generates dplyr in JavaScript (srcjs/codegen.js). These
# tests pin the contract that the emitted grammar is *runnable, correct R*: each
# snippet below mirrors what codegen.js produces for a given view, and is
# evaluated against a fixture so a syntax error or a wrong result fails the
# build. Keep these in sync with codegen.js (and test/js/codegen.test.mjs).

skip_if_not_installed("dplyr")

run_code <- function(code, data) {
  env <- new.env(parent = globalenv())
  env$data <- data
  eval(parse(text = code), envir = env)
}

test_that("a character %in% filter with select-first runs and returns the view", {
  d <- data.frame(
    SITEID = c("701", "702", "703", "701"),
    ARM = c("Placebo", "Low", "High", "Placebo"),
    AGE = c(75, 64, 80, 71),
    stringsAsFactors = FALSE
  )
  code <- paste(
    "library(dplyr)",
    "",
    "data |>",
    "  select(SITEID, ARM) |>",
    '  filter(SITEID %in% c("701", "703")) |>',
    "  arrange(desc(SITEID))",
    sep = "\n"
  )
  res <- run_code(code, d)
  expect_named(res, c("SITEID", "ARM"))
  expect_true(all(res$SITEID %in% c("701", "703")))
  expect_equal(res$SITEID, sort(res$SITEID, decreasing = TRUE))
})

test_that("a NOT IN filter runs (precedence: !x %in% c() == !(x %in% c()))", {
  d <- data.frame(SEX = c("M", "F", "M", "F"))
  res <- run_code('library(dplyr)\n\ndata |>\n  filter(!SEX %in% c("M"))', d)
  expect_true(all(res$SEX == "F"))
})

test_that("a Date filter via as.Date() runs", {
  d <- data.frame(TRTSDT = as.Date(c("2014-01-02", "2012-08-05", "2013-07-19")))
  res <- run_code(
    'library(dplyr)\n\ndata |>\n  filter(TRTSDT >= as.Date("2013-01-01"))',
    d
  )
  expect_equal(nrow(res), 2L)
})

test_that("a datetime filter via as.POSIXct() runs", {
  d <- data.frame(
    ASTDTM = as.POSIXct(
      c("2022-07-27 12:20:00", "2023-09-01 08:00:00"),
      tz = "UTC"
    )
  )
  res <- run_code(
    paste0(
      'library(dplyr)\n\ndata |>\n  filter(ASTDTM >= ',
      'as.POSIXct("2023-01-01", tz = "UTC"))'
    ),
    d
  )
  expect_equal(nrow(res), 1L)
})

test_that("a time filter via hms::as_hms() runs", {
  skip_if_not_installed("hms")
  d <- data.frame(ASTTM = hms::as_hms(c("08:00:00", "12:20:00", "17:00:00")))
  res <- run_code(
    'library(dplyr)\n\ndata |>\n  filter(ASTTM >= hms::as_hms("12:00:00"))',
    d
  )
  expect_equal(nrow(res), 2L)
})
