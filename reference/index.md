# Package index

## Create a viewer

Wrap a data frame, an artoo-conformed frame, or a path to a dataset file
into an interactive viewer widget. Plain data frames work with zero
artoo dependency; artoo supplies CDISC column metadata when present.

- [`dataset_viewer()`](https://vthanik.github.io/datasetviewer/reference/dataset_viewer.md)
  : View a dataset in an interactive SAS Studio-style grid

## Shiny bindings

Embed the viewer in a Shiny app. Pair the output placeholder in the UI
with the render function on the server; state changes (selected columns,
filter, sort, view mode) flow back as Shiny inputs.

- [`datasetviewerOutput()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
  [`renderDatasetViewer()`](https://vthanik.github.io/datasetviewer/reference/datasetviewer-shiny.md)
  : Shiny bindings for the dataset viewer
