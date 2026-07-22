# CLAUDE.md — datasetviewer

This file provides guidance to Claude Code when working with code in this
repository. Global directives load from `~/.claude/CLAUDE.md`; deeper
working detail (competitor framing, stage history, CRAN status) lives in
the gitignored `CLAUDE.local.md`.

## Project overview

**datasetviewer** — an interactive, SAS Studio-style dataset viewer for R.
A fast canvas grid with a column-selection panel, per-column property
metadata, a names-versus-labels header toggle, header-menu sort, pinned
columns/rows, column statistics, a free-text row filter (SAS "Filter Table
Rows" style) and a type-aware per-column Add Filter — over the full
dataset with no row sampling. One htmlwidget codebase renders in Shiny
(primary target) and in static Quarto/HTML. Integrates with the sibling
`artoo` package for CDISC column metadata; plain data frames work with
zero `artoo` dependency. An on-demand "Show code" toolbar button emits a
runnable, air-formatted dplyr pipeline for the current view
(select / filter / arrange), generated in JS (`srcjs/codegen.js`).

## Architecture

### Core flow (one screen)

```
R                                   browser (one htmlwidget)
data.frame | artoo frame | path     state.js (single store)
  -> .dv_columns_meta() (artoo)       -> sql.js (filter expr -> WHERE, sort -> ORDER BY)
  -> nanoparquet -> base64 payload    -> engine_duckdb.js (DuckDB-WASM, native parquet)
                                       -> grid_view.js (Glide Data Grid, canvas)
                                       -> shell/ (toolbar, columns panel, property panel,
                                                  filter_dialog, add_filter_dialog,
                                                  column_stats, context_menu, export)
```

- **Transport:** Parquet via `nanoparquet`, base64 in the widget payload.
- **Engine:** DuckDB-WASM, single engine, reads parquet natively, SQL for
  filter/sort/select/stats, unbounded scale.
- **Grid:** Glide Data Grid (canvas), virtualized; `getCell` pulls the
  visible window via LIMIT/OFFSET. Glide's canvas draw is async — cell
  getters must tolerate stale coordinates after a column shrink.

### File organization

- `R/dataset_viewer.R` — the widget constructor (main export).
- `R/shiny.R` — `datasetviewerOutput()` / `renderDatasetViewer()`.
- `R/transport.R` — data frame -> parquet -> base64 payload.
- `R/metadata.R` — `.dv_columns_meta()`: artoo-when-installed else synth.
- `R/duckdb.R` — local-engine vs CDN wiring for DuckDB-WASM.
- `srcjs/` — JS source: `state.js` (single store), `sql.js`, `codegen.js`,
  `engine/` (DuckDB), `shell/` (all UI), bundled by esbuild into the
  committed `inst/htmlwidgets/datasetviewer.js`.
- `tests/testthat/test-<source>.R` mirrors each `R/` file exactly.
- `test/js/*.test.mjs` — pure-module JS tests (`npm test`, node --test).
- `.local/` (gitignored) — headless Playwright verify scripts and demo-GIF
  recording (`.local/demo-gif.mjs`); browser-level regression checks live
  here because React-internal code paths are unreachable from node --test.
- `data-raw/misc_files/` — README demo GIF (`.Rbuildignore`d, referenced
  by absolute GitHub URL so it never ships in the tarball).

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

## R package development

### Key commands

```
# Run code interactively
Rscript -e "devtools::load_all(); <code>"

# Run all tests / a filtered subset
Rscript -e "devtools::test()"
Rscript -e "devtools::test(filter = '^{name}')"

# Re-document (regenerates man/*.Rd and NAMESPACE)
Rscript -e "devtools::document()"

# R CMD check
Rscript -e "devtools::check(args = '--no-manual')"

# Format R code (non-negotiable, runs as a PostToolUse hook)
air format R/ tests/

# JS: rebuild the committed bundle after any srcjs/ change
Rscript tools/build.R

# JS: pure-module tests
npm test

# Headless browser verification (pattern: see .local/dv-verify*.mjs)
Rscript .local/gen-demo.R && node .local/dv-verify-selectall.mjs
```

### The inner loop (after every change, all, in order; 0/0/0 before commit)

```
Rscript -e "devtools::document()"
Rscript -e "devtools::test()"
Rscript -e "devtools::check(args = '--no-manual')"
air format R/ tests/
Rscript tools/build.R          # when srcjs/ changed
```

### Coding

- snake_case; bare exports (`dataset_viewer`, `datasetviewerOutput`);
  dot-prefix internals only (`.dv_normalize`), not ordinary locals. Don't
  shadow base R.
- Base R plus targeted dependencies: `cli`, `rlang`, `htmlwidgets`,
  `htmltools`, `nanoparquet`. No tidyverse in `Imports`. `arrow` banned
  (heavy C++); `nanoparquet` is the parquet engine.
- Base pipe `|>`; `vapply` not `sapply`; `seq_along`/`seq_len` not `1:n`;
  `::`-qualify; no `library()` in `R/`.
- Errors via `cli::cli_abort(class = "datasetviewer_error_<kind>",
  call = rlang::caller_env())`; kinds `input`, `transport`, `engine`,
  `metadata`. 3-part message; ASCII-only inside cli strings.
- **OOP: S7 if a domain class is ever needed** (none yet). This is a UI
  widget package with no stateful domain objects; the viewer returns an
  htmlwidget (S3) and the rest is plain functions. Do not add S7
  scaffolding speculatively.

### Testing

- Tests for `R/{name}.R` live in `tests/testthat/test-{name}.R`; mirror
  the source file name. testthat edition 3.
- All new code ships with a test. **Bug fixes are test-first**: write the
  failing regression test (red on the prior code), then fix it (green),
  with the issue ref. JS/browser-only bugs get a failing-first Playwright
  script in `.local/` when node --test cannot reach the code path.
- Error tests use BOTH `expect_snapshot(error = TRUE)` AND
  `expect_error(class = ...)`. Pin codegen + payload schema with
  snapshots. Fixtures via `tibble::tribble()`, never `expand.grid()` +
  `$<-`. Internals via `datasetviewer:::`. Coverage >= 95% per `R/` file.
- Shared JS/R codegen fixtures keep `srcjs/codegen.js` and the R tests
  from drifting; `test-codegen-exec.R` executes the emitted dplyr code.

### Documentation

- **Roxygen** to `~/.claude/rules/roxygen.md` (exceed tidyverse/r-lib/gt):
  one `@examples` block, two progressive narrated examples, last expr
  renders; no `\dontrun`/`\donttest`; CDISC clinical-canon examples. No
  `@section Syntax/Examples/Errors`, no per-param sub-tables, no `@family`.
- **README.md is edited by hand — there is deliberately no README.qmd.**
  The viewer auto-prints an htmlwidget, so rendering a README source would
  launch a browser under `R CMD check` (CRAN reject). This deviates from
  the sibling packages' `.qmd` README convention on purpose.
- Vignettes are `.qmd` (Quarto); heavy/web-only pieces go in
  `vignettes/articles/` (pkgdown renders, check skips).
- **Browser-launch CRAN trap (critical for a viewer).** An auto-printing
  htmlwidget routes through `htmltools:::html_print()`, which ignores
  `interactive()` and launches a browser -> `calibre-XXXX` detritus ->
  CRAN reject. Never end an example/vignette/test on an unguarded
  auto-printing widget; ship `test-examples-phantom.R`. Examples run under
  `R CMD check`, < 5s, `tempfile()` for I/O, never leave temp files.

### `NEWS.md`

- Every user-facing change gets a bullet under the top heading. Skip
  bullets for internal refactors and small doc fixes.
- A bullet is one fact, past tense, ending in a period, function name in
  backticks and early, issue ref in parentheses where one exists;
  alphabetical by function, non-function bullets first.
- Heading is always `# datasetviewer <version>` (never
  `(development version)` — that form draws an `R CMD check` NOTE).

### GitHub

- Branch for every new task (`feat/` / `fix/` / `docs/` off `main`);
  never commit new work directly to `main`.
- No AI attribution in commits or PRs.
- **Never merge into `main` while any check fails — including
  `codecov/patch` (>= 95% patch coverage), even though it is not a
  required check.** Add tests that execute the uncovered diff lines
  before merging; mock OS/device-conditional boundaries
  (`testthat::local_mocked_bindings` with `.package =` for foreign
  namespaces), do not waive them.
- Before every push, run the public-surface sweep in `CLAUDE.local.md`
  (competitor-name guard); it must return nothing.

### Writing

- Sentence case for headings; US English.
- Em-dashes, en-dashes, and curly quotes are canonical in prose, comments,
  and roxygen. The one hard exception: keep `cli_abort()` / `cli_warn()` /
  `cli_inform()` message strings ASCII.

## JS build

- `srcjs/` -> esbuild -> committed `inst/htmlwidgets/datasetviewer.js`
  (package installs without Node). Rebuild: `Rscript tools/build.R` (needs a
  one-time `npm install`). The DuckDB-WASM engine is NOT committed or shipped
  in the tarball; it is fetched at install time (see decision below).
- `inst/COPYRIGHTS` records every bundled third-party JS (react,
  react-dom, glide-data-grid, apache-arrow, duckdb-wasm) — a CRAN
  requirement for vendored code.

## DuckDB-WASM engine: install-time fetch (CRAN decision, 2026-06-19)

**Decision: acquire the ~80 MB DuckDB-WASM engine at install time, arrow-style
— never ship it in the source tarball.** CRAN's tarball limit is ~5 MB; the
engine + parquet extension are ~80 MB, so bundling them is an automatic
reject. Modelled on `arrow`'s `tools/nixlibs.R` / `LIBARROW_BINARY`.

- `configure` (POSIX `sh`) runs `tools/fetch-duckdb.R` at `R CMD INSTALL`,
  ending `|| true; exit 0` — the fetch is best-effort and NEVER fails the
  install (CRAN rejects packages that error at install with no network).
- `tools/fetch-duckdb.R` downloads the engine (eh+mvp wasm + workers) and the
  parquet extension into `inst/htmlwidgets/duckdb/`, wrapped in `tryCatch`
  (catches errors AND warnings), removes any partial bundle, and is
  idempotent. Air-gap/corporate controls mirror arrow:
  `DATASETVIEWER_DUCKDB_{OFFLINE,DIR,URL,EXT_URL}`.
- `inst/htmlwidgets/duckdb/` is git-ignored AND `.Rbuildignore`d, so neither
  the repo nor the tarball carries it. Built tarball is ~287 KB.
- Runtime fallback: when the local bundle is absent (offline install, CRAN
  sandbox, static self-contained HTML via
  `options(datasetviewer.use_local_engine = FALSE)`), the widget loads the
  engine from the jsDelivr CDN. Wiring in `R/duckdb.R` (`.dv_duckdb_local`,
  `.dv_duckdb_dependency`).
- Static self-contained pages MUST use the CDN engine: `saveWidget()` with
  the local bundle inlined fails ("function signature mismatch").

Consequence: **package size is NOT a CRAN blocker.** Do not re-flag the local
working-tree `inst/htmlwidgets/duckdb/` size as a problem — measure the built
tarball (`R CMD build`), not the working tree.

## Authorship

`Authors@R`: Vignesh Thanikachalam, about.vignesh@gmail.com, GitHub
`vthanik`, roles `c("aut", "cre", "cph")`. No `Co-Authored-By: Claude` /
AI attribution anywhere.

## More detail

See `CLAUDE.local.md` (gitignored) for the competitor framing and
public-surface sweep, stage history, CI/Codecov findings, and CRAN
submission status.
