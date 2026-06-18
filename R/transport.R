# Data transport: a data frame becomes a Parquet buffer (via nanoparquet),
# base64-encoded into the widget payload. The browser registers those bytes in
# DuckDB-WASM and queries them natively. Parquet is columnar and compressed, so
# the payload is far smaller than JSON for the same data, with no row sampling.

# Write a data frame to a Parquet byte vector.
.dv_to_parquet_raw <- function(x) {
  tmp <- tempfile(fileext = ".parquet")
  on.exit(unlink(tmp), add = TRUE)
  nanoparquet::write_parquet(x, tmp)
  size <- file.info(tmp)$size
  if (is.na(size) || size == 0) {
    cli::cli_abort(
      c(
        "Failed to serialize the dataset to Parquet.",
        "i" = "The temporary Parquet file is missing or empty."
      ),
      class = "datasetviewer_error_transport"
    )
  }
  readBin(tmp, what = "raw", n = size)
}

# Base64-encode a data frame's Parquet representation for JSON transport.
.dv_to_parquet_b64 <- function(x) {
  jsonlite::base64_enc(.dv_to_parquet_raw(x))
}
