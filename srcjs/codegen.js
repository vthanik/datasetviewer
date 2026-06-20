// Generate the dplyr pipeline that reproduces the current view -- selected
// columns, free-text filter, and sort -- over the source frame. This drives
// the SAS Studio-style "Show code" button: produced on demand, copy-paste
// reproducible, and always prefixed with library(dplyr).

import { scanRuns } from "./filter_scan.js";

// Backtick a column name only when it is not a syntactic R name.
function bt(name) {
  return /^[A-Za-z.][A-Za-z0-9._]*$/.test(name) ? name : "`" + name + "`";
}

// Translate one non-string segment of the filter expression from the SAS
// free-text dialect to R: and/or/not to &/|/!, <> to !=, and a lone "=" to
// "==" (leaving >=, <=, !=, == intact). Operator spacing is normalised to a
// single space on each side, matching air's formatting convention.
function translateSegment(seg, canon) {
  let t = seg
    // Missing-value predicate first, before the bare "not"/"=" passes would
    // mangle "is not na". COL is na -> is.na(COL); is not na -> !is.na(COL).
    .replace(/([A-Za-z.][\w.]*)\s+is\s+not\s+na\b/gi, "!is.na($1)")
    .replace(/([A-Za-z.][\w.]*)\s+is\s+na\b/gi, "is.na($1)")
    .replace(/([A-Za-z.][\w.]*)\s+not\s+in\s*\(/gi, "!$1 %in% c(") // NOT IN (..)
    .replace(/\bin\s*\(/gi, "%in% c(") // SQL IN (...) -> R %in% c(...)
    .replace(/<>/g, "!=")
    .replace(/\band\b/gi, "&")
    .replace(/\bor\b/gi, "|")
    .replace(/\bnot\b/gi, "!")
    .replace(/(^|[^<>=!])=(?!=)/g, "$1==")
    .replace(/\s*(>=|<=|==|!=|>|<|&|\|)\s*/g, " $1 ")
    .replace(/[ \t]+/g, " ");
  // Canonicalise column names to their real case (R is case-sensitive, the
  // engine is not). Identifiers followed by "(" are function calls, not columns.
  if (canon) {
    t = t.replace(
      /\b([A-Za-z_.][\w.]*)\b(?!\s*\()/g,
      (m, w) => canon[w.toLowerCase()] || m
    );
  }
  return t;
}

// SQL-typed date/time literals are valid DuckDB but not R. Convert them to the
// matching R constructor so the snippet runs as-is. By the time this runs the
// single-quoted SQL literal has already become a double-quoted R string, so the
// pattern is e.g. DATE "2014-01-01".
function convertTypedLiterals(s) {
  return s
    .replace(/\bDATE\s+"([^"]*)"/gi, 'as.Date("$1")')
    .replace(/\bTIMESTAMP\s+"([^"]*)"/gi, 'as.POSIXct("$1", tz = "UTC")')
    .replace(/\bTIME\s+"([^"]*)"/gi, 'hms::as_hms("$1")');
}

// Translate the SAS-style free-text filter to a dplyr filter() condition.
// Double-quoted runs are copied verbatim (so a value like
// "AMERICAN INDIAN OR ALASKA NATIVE" keeps its "OR"); single-quoted runs become
// double-quoted R strings; everything outside strings is operator-translated.
export function dplyrFilterFromExpr(expr, canon) {
  if (!expr || !String(expr).trim()) return "";
  // Every quoted run (typed with " or ') becomes an R double-quoted string,
  // escaping embedded double quotes. Unquoted runs are operator-translated.
  const out = scanRuns(String(expr).trim())
    .map((r) =>
      r.q ? '"' + r.value.replace(/"/g, '\\"') + '"' : translateSegment(r.value, canon)
    )
    .join("");
  return convertTypedLiterals(out).trim();
}

// air's default line width: a call wider than this is wrapped one arg per line.
const LINE_WIDTH = 80;

// arrange() keys from the sort state, as an argument array.
function arrangeKeys(sort) {
  return (sort || []).map((s) =>
    s.dir === "desc" ? `desc(${bt(s.name)})` : bt(s.name)
  );
}

// Comma-joined arrange() args (exported for testing the key formatting).
export function dplyrArrangeFromSort(sort) {
  return arrangeKeys(sort).join(", ");
}

// select() keys, or [] when every column is shown (so no select() verb).
function selectKeys(state) {
  const cols = state.columns || [];
  const shown = cols.filter((c) => c.selected);
  if (shown.length === 0 || shown.length === cols.length) return [];
  return shown.map((c) => bt(c.name));
}

// One pipe step at 2-space indent. Following air, a call stays inline when it
// fits the line width; otherwise each argument goes on its own line with the
// closing parenthesis on a line of its own.
function verbStep(verb, args) {
  const inline = `  ${verb}(${args.join(", ")})`;
  if (args.length <= 1 || inline.length <= LINE_WIDTH) return inline;
  return `  ${verb}(\n` + args.map((a) => `    ${a}`).join(",\n") + "\n  )";
}

// The full dplyr pipeline for the current view, prefixed with library(dplyr)
// and formatted to air's conventions.
export function dplyrCode(state, dataName) {
  const name = dataName || "data";
  // Lower-cased -> canonical column name, so a case-insensitive filter (the
  // engine folds case) generates case-correct R (R does not).
  const canon = {};
  (state.columns || []).forEach((c) => (canon[c.name.toLowerCase()] = c.name));

  const steps = [];
  const cond = dplyrFilterFromExpr(state.filterExpr, canon);
  if (cond) steps.push(verbStep("filter", [cond]));
  const ord = arrangeKeys(state.sort);
  if (ord.length) steps.push(verbStep("arrange", ord));
  // select() comes last so filter()/arrange() may reference a column the view
  // hides -- a hidden column can still drive the filter or the sort, and
  // narrowing first would drop it before those verbs run.
  const sel = selectKeys(state);
  if (sel.length) steps.push(verbStep("select", sel));

  const pipeline = steps.length ? `${name} |>\n` + steps.join(" |>\n") : name;
  return `library(dplyr)\n\n${pipeline}`;
}
