// Left "Columns" panel: a Select-all toggle plus a checkbox list of columns
// with char/num/date type icons. The header carries a collapse chevron that
// hides the whole sidebar. A "Sort by" dropdown and a "Filter" box (Positron's
// Columns tab) reorder and filter the LIST only -- a navigation aid; the grid
// columns and the CSV export keep their original order. Clicking a column row
// makes it the active column shown in the property panel.
//
// The list DOM is built once; store changes only update checkbox/active/label
// state in place, so a click never destroys and rebuilds hundreds of rows
// (no focus/scroll loss, O(1) work per toggle on wide datasets). Sorting moves
// the existing row nodes; filtering toggles their display -- neither rebuilds.

import { typeIcon, ICONS } from "./icons.js";
import { headerText, columnSortOrder } from "../state.js";

const SORT_OPTIONS = [
  ["original", "Sort by Original"],
  ["name-asc", "Sort by Name, Ascending"],
  ["name-desc", "Sort by Name, Descending"],
  ["type-asc", "Sort by Type, Ascending"],
  ["type-desc", "Sort by Type, Descending"],
];

export function createColumnsPanel(container, store, { onCollapse }) {
  container.innerHTML = "";
  const initial = store.get();

  // Local navigation state -- never written to the store, so it cannot affect
  // the grid, the export, or the Shiny inputs.
  let sortMode = "original";
  let filterText = "";
  let prevView = initial.view;

  const header = el("div", "dv-cols-header");
  header.appendChild(text("span", "dv-cols-title", "Columns"));
  const chevron = el("button", "dv-icon-btn dv-collapse");
  chevron.title = "Hide columns panel";
  chevron.innerHTML = ICONS.collapse;
  chevron.addEventListener("click", onCollapse);
  header.appendChild(chevron);
  container.appendChild(header);

  // Sort + filter tools, stacked (the sidebar is narrow and user-resizable).
  const tools = el("div", "dv-cols-tools");
  const sort = el("select", "dv-cols-sort");
  SORT_OPTIONS.forEach(([value, lab]) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = lab;
    sort.appendChild(o);
  });
  sort.addEventListener("change", () => {
    sortMode = sort.value;
    applyOrder(store.get());
  });
  tools.appendChild(sort);
  const filter = el("input", "dv-cols-filter");
  filter.type = "text";
  filter.placeholder = "Filter";
  filter.setAttribute("aria-label", "Filter columns");
  filter.addEventListener("input", () => {
    filterText = filter.value;
    applyFilter(store.get());
  });
  tools.appendChild(filter);
  container.appendChild(tools);

  const list = el("div", "dv-cols-list");

  // Select all
  const selectAll = el("label", "dv-col-row dv-selectall");
  const sa = el("input");
  sa.type = "checkbox";
  sa.addEventListener("change", () => {
    const checked = sa.checked;
    store.set((s) => ({
      ...s,
      columns: s.columns.map((c) => ({ ...c, selected: checked })),
    }));
  });
  selectAll.appendChild(sa);
  selectAll.appendChild(text("span", "dv-col-name", "Select all"));
  list.appendChild(selectAll);

  // One persistent row per column; keep handles for in-place updates. rows[i]
  // always maps to column i regardless of DOM position, so update() and the
  // checkbox/active handlers keep working after a sort reorders the nodes.
  const rows = initial.columns.map((col, i) => {
    const row = el("div", "dv-col-row");

    const cb = el("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      store.set((s) => ({
        ...s,
        columns: s.columns.map((c, j) =>
          j === i ? { ...c, selected: cb.checked } : c
        ),
      }));
    });
    row.appendChild(cb);

    const icon = el("span", "dv-col-icon");
    row.appendChild(icon);

    const name = text("span", "dv-col-name", "");
    row.appendChild(name);

    row.addEventListener("click", (e) => {
      if (e.target === cb) return;
      store.set({ activeColumn: i });
    });

    list.appendChild(row);
    return { row, cb, icon, name, kind: null };
  });

  container.appendChild(list);

  // Reorder the row nodes per the sort dropdown (Select all stays pinned: it is
  // never appended). appendChild moves an existing node, so handlers/checkbox
  // state survive.
  function applyOrder(state) {
    columnSortOrder(state.columns, sortMode, state.view).forEach((idx) =>
      list.appendChild(rows[idx].row)
    );
  }

  // Hide rows whose name and label both miss the typed text (case-insensitive),
  // so filtering works in either view. Never hides Select all.
  function applyFilter(state) {
    const q = filterText.trim().toLowerCase();
    state.columns.forEach((col, i) => {
      const hay = (col.name + " " + (col.label || "")).toLowerCase();
      rows[i].row.style.display = q && !hay.includes(q) ? "none" : "";
    });
  }

  function update(state) {
    const allSelected = state.columns.every((c) => c.selected);
    const someSelected = state.columns.some((c) => c.selected);
    sa.checked = allSelected;
    sa.indeterminate = !allSelected && someSelected;

    state.columns.forEach((col, i) => {
      const r = rows[i];
      r.cb.checked = col.selected;
      r.row.classList.toggle("dv-col-active", i === state.activeColumn);
      r.name.textContent = headerText(col, state.view);
      r.name.title = col.name;
      // Re-render the icon only when the resolved kind actually changes
      // (e.g. once the engine refines a date column's kind after load).
      if (r.kind !== col.kind) {
        r.icon.innerHTML = typeIcon(col);
        r.kind = col.kind;
      }
    });

    // A names<->labels toggle changes what Name-sort and the filter match on,
    // so re-apply them -- but only on that transition, not on every toggle.
    if (state.view !== prevView) {
      prevView = state.view;
      if (sortMode === "name-asc" || sortMode === "name-desc") applyOrder(state);
      if (filterText) applyFilter(state);
    }
  }

  update(initial);
  store.subscribe(update);
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function text(tag, className, content) {
  const e = el(tag, className);
  e.textContent = content;
  return e;
}
