# Rebuild the bundled widget JS from srcjs/ via esbuild.
# Run from the package root: Rscript tools/build.R
#
# Requires Node and a one-time `npm install` (installs esbuild into
# node_modules/). The built artifact inst/htmlwidgets/datasetviewer.js is
# committed so the package installs without Node.

status <- system2("node", "esbuild.config.mjs")
if (!identical(status, 0L)) {
  stop("esbuild failed (exit status ", status, ").", call. = FALSE)
}
