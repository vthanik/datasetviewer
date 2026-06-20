// Pure cell-display helpers. Kept free of React/Glide imports so they are
// unit-testable under plain node.

// The token shown for a missing value (SQL NULL / R NA). Visible (not blank) so
// a missing character cell is distinguishable from a genuine empty string "",
// which DuckDB and R both keep distinct. Matches R's own print() and Positron.
export const NA_TEXT = "NA";

// True when a cell value is missing (NULL/NA). A genuine IEEE NaN is a real
// numeric value, not missing, so it is NOT treated as missing here.
export function isMissing(value) {
  return value === null || value === undefined;
}

// Format one display value: missing renders as the NA token; a genuine NaN
// renders as "NaN" (R's convention for the IEEE value).
export function cellText(value) {
  return isMissing(value) ? NA_TEXT : String(value);
}
