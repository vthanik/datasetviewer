// Column type chips for the columns panel and the toolbar icon set. Both use
// `currentColor` so the shell stylesheet drives every colour from one palette:
// the type chips are colour-coded per column kind (char/num/date), and the
// toolbar/pager icons inherit their button's text colour.

const CAL = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <path d="M2 6 H14" stroke="currentColor" stroke-width="1.2"/>
  <path d="M5 1.5 V4 M11 1.5 V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;

const CLOCK = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <path d="M8 4.5 V8 L10.5 9.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Resolve the chip from the precise Arrow kind when present, else the coarse
// SAS type ("Num"/"Char"). The chip's CSS class colour-codes it by type:
// a calendar for date/datetime, a clock for time-of-day, A for char, # for num.
export function typeIcon(col) {
  const kind = col.kind || (col.type === "Num" ? "number" : "string");
  if (kind === "number") return '<span class="dv-ti dv-ti-num">#</span>';
  if (kind === "time") return `<span class="dv-ti dv-ti-date">${CLOCK}</span>`;
  if (kind === "date" || kind === "datetime")
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
  code: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M6 4 L2 8 L6 12 M10 4 L14 8 L10 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  first: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M11 3 L6 8 L11 13 M5 3 V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  prev: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  last: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3 L10 8 L5 13 M11 3 V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // Magnifier for the columns Filter box.
  search: `<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="6.8" cy="6.8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 10 L14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  // Decreasing lines: the columns "Sort" menu trigger.
  sort: `<svg viewBox="0 0 16 16" width="15" height="15"><path d="M2.5 4 H13.5 M2.5 8 H10 M2.5 12 H6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
};

// Header / cell context-menu icons (15px), one 16x16 grid, 1.3 stroke, round
// caps and joins, optically centered -- consistent with the toolbar set above.
const M = (body) =>
  `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const MENU_ICONS = {
  // Two offset sheets (front rect + the back sheet's visible L).
  copy: M(
    `<rect x="6" y="6" width="7.5" height="7.5" rx="1.5"/><path d="M3.5 10 V4 A1.5 1.5 0 0 1 5 2.5 H10"/>`
  ),
  // Up arrow: shaft + chevron head.
  sortAsc: M(`<path d="M8 13 V4 M5 7 L8 4 L11 7"/>`),
  sortDesc: M(`<path d="M8 3 V12 M5 9 L8 12 L11 9"/>`),
  // Vertical double arrow with a small x: clear all sorting.
  clearSort: M(
    `<path d="M6 4 V12 M4.2 5.8 L6 4 L7.8 5.8 M4.2 10.2 L6 12 L7.8 10.2"/><path d="M10.6 3.4 L13.6 6.4 M13.6 3.4 L10.6 6.4"/>`
  ),
  // Fit between two bounds: side bars + horizontal double arrow.
  sizeToContent: M(
    `<path d="M3 3.5 V12.5 M13 3.5 V12.5"/><path d="M5.8 8 H10.2 M7.2 6.6 L5.8 8 L7.2 9.4 M8.8 6.6 L10.2 8 L8.8 9.4"/>`
  ),
  // Counter-clockwise reset arrow.
  restoreWidths: M(`<path d="M4 8 A4.5 4.5 0 1 1 5.2 11.2"/><path d="M4 4.8 V8 H7.2"/>`),
  // Checkmark: marks the active option in the columns Sort menu.
  check: M(`<path d="M3.5 8.5 L6.5 11.5 L12.5 4.5"/>`),
};
