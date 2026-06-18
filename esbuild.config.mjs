// Bundle srcjs/ into the committed widget assets:
//   inst/htmlwidgets/datasetviewer.js   (+ datasetviewer.css, from CSS imports)
// Run via `node esbuild.config.mjs` or `Rscript tools/build.R`.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["srcjs/index.js"],
  bundle: true,
  format: "iife",
  target: ["es2018"],
  legalComments: "none",
  minify: true,
  // React (and Glide) branch on this; without it the bundle throws
  // "process is not defined" at runtime.
  define: { "process.env.NODE_ENV": '"production"' },
  // Glide ships small assets imported from JS/CSS; inline them so the bundle
  // stays self-contained.
  loader: {
    ".png": "dataurl",
    ".svg": "dataurl",
    ".woff": "dataurl",
    ".woff2": "dataurl",
  },
  outfile: "inst/htmlwidgets/datasetviewer.js",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("esbuild: watching srcjs/ ...");
} else {
  await esbuild.build(options);
  console.log("esbuild: built inst/htmlwidgets/datasetviewer.js (+ .css)");
}
