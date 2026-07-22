// Tiny observable store: the single source of truth for view state (column
// selection, header mode, active column, filter expression, sort). The vanilla
// shell chrome and the React grid both read and write it; on change,
// subscribers re-render.

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get() {
      return state;
    },
    set(patch) {
      state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// Build the initial store state from the widget payload.
export function initialState(payload) {
  const columns = payload.columns.map((c, i) => ({
    name: c.name,
    label: c.label || "",
    type: c.type, // "Num" | "Char"
    kind: c.kind || (c.type === "Num" ? "number" : "string"),
    length: c.length,
    format: c.format || "",
    origIndex: i,
    selected: true,
  }));
  return {
    columns,
    view: payload.view === "labels" ? "labels" : "names",
    activeColumn: 0, // column shown in the property panel
    filterExpr: "", // free-text SAS-style filter expression
    sort: [], // [{ name, dir }]
    pinnedCols: [], // column NAMES pinned (frozen) to the left, in pin order
    pinnedRows: [], // full-row value snapshots pinned to the top of the grid
  };
}

// Header text for a column under the current view mode.
export function headerText(column, view) {
  if (view === "labels") return column.label || column.name;
  return column.name;
}

// Type-sort rank: characters, then numbers/booleans, then temporal. Sorting on
// the raw `kind` string alphabetically would wedge "number" between "datetime"
// and "string"; this rank keeps an intuitive grouping and covers the engine's
// full kind set (string | number | bool | date | datetime | time).
const KIND_RANK = { string: 0, number: 1, bool: 2, date: 3, datetime: 4, time: 5 };

// Display order of columns for the columns-panel "Sort by" dropdown. Returns an
// array of indices into `columns` (so the panel can reorder its rows without
// touching the column data). `mode` is one of: "original", "name-asc",
// "name-desc", "type-asc", "type-desc". Name comparisons use the text actually
// shown under `view` (name or label); type comparisons fall back to that name as
// the tiebreaker. Pure -- no DOM.
export function columnSortOrder(columns, mode, view) {
  const order = columns.map((_, i) => i);
  if (!mode || mode === "original") return order;
  const label = (i) => headerText(columns[i], view);
  // Fixed locale + options so the order is deterministic across browsers and
  // sorts numbers naturally (COL2 before COL10), not by code point.
  const byName = (a, b) =>
    label(a).localeCompare(label(b), "en", { numeric: true, sensitivity: "base" });
  const rank = (i) => KIND_RANK[columns[i].kind] ?? 99;
  const cmp = {
    "name-asc": byName,
    "name-desc": (a, b) => byName(b, a),
    "type-asc": (a, b) => rank(a) - rank(b) || byName(a, b),
    "type-desc": (a, b) => rank(b) - rank(a) || byName(a, b),
  }[mode];
  return cmp ? order.sort(cmp) : order;
}

// Columns as the grid presents them: selected only, pinned first (in pin
// order), then the rest in their original order. A pinned-but-hidden column
// simply does not show; re-showing it restores the pin. Pure -- no DOM.
export function presentedColumns(columns, pinnedCols) {
  const sel = columns.filter((c) => c.selected);
  const pinned = pinnedCols
    .map((n) => sel.find((c) => c.name === n))
    .filter(Boolean);
  return [...pinned, ...sel.filter((c) => !pinnedCols.includes(c.name))];
}
