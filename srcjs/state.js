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
    informat: c.informat || "",
    origIndex: i,
    selected: true,
  }));
  return {
    columns,
    view: payload.view === "labels" ? "labels" : "names",
    activeColumn: 0, // column shown in the property panel
    filterExpr: "", // free-text SAS-style filter expression
    sort: [], // [{ name, dir }]
  };
}

// Header text for a column under the current view mode.
export function headerText(column, view) {
  if (view === "labels") return column.label || column.name;
  return column.name;
}
