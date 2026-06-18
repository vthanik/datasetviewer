# CLAUDE.md — datasetviewer

**datasetviewer** — an interactive, SAS Studio-style dataset viewer for R.
A fast canvas grid with a column-selection panel, per-column property
metadata, a names-versus-labels header toggle, header-driven sort, and a
free-text row filter (SAS "Filter Table Rows" style) over the full dataset
with no row sampling. One htmlwidget codebase renders in Shiny (primary
target) and in static Quarto/HTML. Integrates with the sibling `artoo`
package for CDISC column metadata; plain data frames work with zero `artoo`
dependency.

Note: the always-on dplyr-code box was dropped (2026-06-18) in favour of
SAS-style free-text filtering, then the code view was re-added the same day
as an on-demand "Show code" toolbar button (modelled on SAS Studio's
"Display the code that creates the current table"). It emits a runnable,
air-formatted dplyr pipeline for the current view (select / filter / arrange),
generated in JS (`srcjs/codegen.js`); both the free-text filter and the code
view coexist.

Global directives load from `~/.claude/CLAUDE.md`. This file holds
project-specific shared conventions. Deeper working detail, the competitor
framing, and the staged plan live in `CLAUDE.local.md` (gitignored).

## Architecture (one screen)

```
R                                   browser (one htmlwidget)
data.frame | artoo frame | path     state.js (single store)
  -> .dv_columns_meta() (artoo)       -> sql.js (filter expr -> WHERE, sort -> ORDER BY)
  -> nanoparquet -> base64 payload    -> engine_duckdb.js (DuckDB-WASM, native parquet)
                                       -> grid_view.js (Glide Data Grid, canvas)
                                       -> shell/ (toolbar, columns panel, property panel,
                                                  filter_dialog, context_menu, export)
```

- **Transport:** Parquet via `nanoparquet`, base64 in the widget payload.
- **Engine:** DuckDB-WASM, single engine, reads parquet natively, SQL for
  filter/sort/select, unbounded scale.
- **Grid:** Glide Data Grid (canvas), virtualized; `getCell` pulls the
  visible window via LIMIT/OFFSET.

## Engineering principle (non-negotiable)

**Strictly don't be lazy.** Root cause over patch, best long-term solution
over the lazy shortcut. No silent truncation, no "good enough for now."

## Working discipline

- **Anti-grinding.** Verify each stage adversarially before advancing. If a
  check fails the same way twice, stop and re-derive from first principles
  instead of retrying the same fix.
- **No backward-compat (pre-v1).** Freely delete/rewrite earlier-stage code
  and tests when a later stage shows a simpler shape. Simplest design that
  works; promote an abstraction only when a second concrete need forces it.

## Conventions

- **OOP: S7 if a domain class is ever needed** (none yet). This is a UI
  widget package with no stateful domain objects, so it has no S7 classes;
  the viewer returns an htmlwidget (S3) and the rest is plain functions. If a
  real class appears, use S7 (`R/aaa_class.R` first, `S7::method()` dispatch,
  `S7::methods_register()` in `.onLoad`) per the house standard. Do not add
  S7 scaffolding speculatively.
- **Lightweight deps.** Base R + targeted: `cli`, `rlang`, `S7`,
  `htmlwidgets`, `htmltools`, `nanoparquet`. No tidyverse in `Imports`.
  `arrow` banned (heavy C++); `nanoparquet` is the parquet engine.
- **Errors via cli.** `cli::cli_abort(class = "datasetviewer_error_<kind>",
  call = rlang::caller_env())`; kinds `input`, `transport`, `engine`,
  `metadata`. 3-part message; ASCII-only inside cli strings.
- **Naming.** snake_case; bare exports (`dataset_viewer`,
  `datasetviewerOutput`); dot-prefix internals only (`.dv_normalize`), not
  ordinary locals. Don't shadow base R. Base pipe `|>`; `vapply`;
  `seq_along`/`seq_len`; `::`-qualify; no `library()` in `R/`.
- **Test-first.** testthat ed.3; bug fixes ship a failing-first regression
  test with the issue ref. Error tests use BOTH `expect_snapshot(error =
  TRUE)` AND `expect_error(class = ...)`. Pin codegen + payload schema with
  snapshots. Fixtures via `tibble::tribble()`, never `expand.grid()` + `$<-`.
  Internals via `datasetviewer:::`. Coverage >= 95% per `R/` file.
- **Roxygen** to `~/.claude/rules/roxygen.md` (exceed tidyverse/r-lib/gt):
  one `@examples` block, two progressive narrated examples, last expr
  renders; no `\dontrun`/`\donttest`; CDISC clinical-canon examples. No
  `@section Syntax/Examples/Errors`, no per-param sub-tables, no `@family`.
- **Browser-launch CRAN trap (critical for a viewer).** An auto-printing
  htmlwidget routes through `htmltools:::html_print()`, which ignores
  `interactive()` and launches a browser -> `calibre-XXXX` detritus ->
  CRAN reject. Never end an example/vignette/test on an unguarded
  auto-printing widget; ship `test-examples-phantom.R`. Examples run under
  `R CMD check`, < 5s, `tempfile()` for I/O, never leave temp files.

## JS build

- `srcjs/` -> esbuild -> committed `inst/htmlwidgets/datasetviewer.js`
  (package installs without Node). Rebuild: `Rscript tools/build.R` (needs a
  one-time `npm install`). DuckDB-WASM + worker ship in
  `inst/htmlwidgets/duckdb/`.

## Dev loop (all, in order; 0/0/0 before commit)

```bash
Rscript -e 'devtools::document()'
Rscript -e 'devtools::test()'
Rscript -e 'devtools::check(args = "--no-manual")'
air format R/ tests/
Rscript tools/build.R          # when srcjs/ changed
```

## Authorship

`Authors@R`: Vignesh Thanikachalam, about.vignesh@gmail.com, GitHub
`vthanik`, roles `c("aut", "cre", "cph")`. No `Co-Authored-By: Claude` /
AI attribution anywhere.
