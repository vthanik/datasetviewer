# dataset_viewer() rejects non-data-frame input

    Code
      dataset_viewer(1:10)
    Condition
      Error:
      ! `x` must be a data frame or a file path.
      x You supplied an integer vector.

# .dv_read_path() errors when artoo is not installed

    Code
      .dv_read_path("adsl.parquet", call = call)
    Condition
      Error:
      ! Reading a file path requires the artoo package.
      i Install artoo, or pass a data frame to `x`.

