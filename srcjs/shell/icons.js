// Column type chips for the columns panel and the toolbar icon set. Both use
// `currentColor` so the shell stylesheet drives every colour from one palette:
// the type chips are colour-coded per column kind (char/num/date), and the
// toolbar/pager icons inherit their button's text colour.

const CAL = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <path d="M2 6 H14" stroke="currentColor" stroke-width="1.2"/>
  <path d="M5 1.5 V4 M11 1.5 V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;

// Resolve the chip from the precise Arrow kind when present, else the coarse
// SAS type ("Num"/"Char"). The chip's CSS class colour-codes it by type.
export function typeIcon(col) {
  const kind = col.kind || (col.type === "Num" ? "number" : "string");
  if (kind === "number") return '<span class="dv-ti dv-ti-num">#</span>';
  if (kind === "date" || kind === "datetime" || kind === "time")
    return `<span class="dv-ti dv-ti-date">${CAL}</span>`;
  return '<span class="dv-ti dv-ti-char">A</span>';
}

// Toolbar icons (24px), drawn from simple paths. All strokes inherit the
// button colour via `currentColor`.
export const ICONS = {
  collapse: `<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 5 L6.5 8 L9.5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  expand: `<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 5 L9.5 8 L6.5 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  filter: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 3 H14 L9.5 8.5 V13 L6.5 11.5 V8.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  export: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M8 2 V10 M5 7 L8 10 L11 7 M3 13 H13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  print: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M4 6 V2 H12 V6 M4 12 H2 V6 H14 V12 H12 M4 9 H12 V14 H4 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  code: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M6 4 L2 8 L6 12 M10 4 L14 8 L10 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  first: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M11 3 L6 8 L11 13 M5 3 V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  prev: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  last: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3 L10 8 L5 13 M11 3 V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
