# datasetviewer 0.0.0.9000

* Initial development version.
* `dataset_viewer()` renders a SAS Studio-style interactive grid for a data
  frame, an artoo-conformed frame, or a file path read via
  `artoo::read_dataset()`. The data is sent to the browser as Parquet and
  queried in place with DuckDB-WASM, so filter, sort, and scroll stay fast on
  large datasets without sampling rows.
* The shell provides a column-selection panel with char/num type icons and a
  collapse chevron, a property pane (Label, Name, Length, Type, Format,
  Informat), a names-versus-labels header toggle, header right-click sort and
  size-to-content, a free-text row filter, and CSV export of the current view.
* `datasetviewerOutput()` and `renderDatasetViewer()` embed the widget in
  Shiny and publish the current filter, sort, column selection, and view mode
  as inputs.
