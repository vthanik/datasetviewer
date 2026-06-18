// Pure cell-display helpers. Kept free of React/Glide imports so they are
// unit-testable under plain node.

// Format one display value: null/undefined render as an empty string.
export function cellText(value) {
  return value === null || value === undefined ? "" : String(value);
}
