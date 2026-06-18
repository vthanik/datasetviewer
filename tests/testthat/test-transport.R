test_that(".dv_to_parquet_raw() round-trips through nanoparquet", {
  df <- data.frame(
    a = 1:3,
    b = c("x", "y", "z"),
    stringsAsFactors = FALSE
  )
  raw <- .dv_to_parquet_raw(df)
  expect_type(raw, "raw")

  tmp <- withr::local_tempfile(fileext = ".parquet")
  writeBin(raw, tmp)
  back <- nanoparquet::read_parquet(tmp)

  expect_equal(back$a, 1:3)
  expect_equal(back$b, c("x", "y", "z"))
})

test_that(".dv_to_parquet_b64() yields decodable base64", {
  b64 <- .dv_to_parquet_b64(data.frame(a = 1:3))
  expect_type(b64, "character")
  expect_length(b64, 1L)

  raw <- jsonlite::base64_dec(b64)
  expect_gt(length(raw), 0L)
})

test_that("Parquet transport beats JSON on a non-trivial frame", {
  # Parquet's fixed footer overhead loses on tiny data; the win is at scale.
  set.seed(1)
  n <- 5000
  df <- data.frame(
    id = seq_len(n),
    x = rnorm(n),
    grp = sample(c("A", "B", "C"), n, replace = TRUE),
    stringsAsFactors = FALSE
  )
  parquet_bytes <- length(.dv_to_parquet_raw(df))
  json_bytes <- nchar(jsonlite::toJSON(df), type = "bytes")
  expect_lt(parquet_bytes, json_bytes)
})
