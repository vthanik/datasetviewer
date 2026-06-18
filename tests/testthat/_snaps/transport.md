# .dv_to_parquet_raw() aborts when serialization yields no bytes

    Code
      .dv_to_parquet_raw(data.frame(a = 1))
    Condition
      Error in `.dv_to_parquet_raw()`:
      ! Failed to serialize the dataset to Parquet.
      i The temporary Parquet file is missing or empty.

