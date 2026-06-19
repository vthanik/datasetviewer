// Left "Columns" panel: a Select-all toggle plus a checkbox list of columns
// with char/num/date type icons. The header carries a collapse chevron that
// hides the whole sidebar. A Sort icon menu and a "Filter" box reorder and
// filter the LIST only -- a navigation aid; the grid columns and the CSV export
// keep their original order. Clicking a column row makes it the active column
// shown in the property panel.
//
// The list DOM is built once; store changes only update checkbox/active/label
// state in place, so a click never destroys and rebuilds hundreds of rows
// (no focus/scroll loss, O(1) work per toggle on wide datasets). Sorting moves
// the existing row nodes; filtering toggles their display -- neither rebuilds.

import { typeIcon, ICONS, MENU_ICONS } from "./icons.js";
import { showContextMenu } from "./context_menu.js";
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
  // Kind signature: the engine refines coarse load-time kinds (number/string)
  // into date/datetime/time after it reads the schema; a Type-sort must re-apply
  // when that happens or it shows a stale order.
  let prevKindSig = initial.columns.map((c) => c.kind).join(",");

  const header = el("div", "dv-cols-header");
  header.appendChild(text("span", "dv-cols-title", "Columns"));
  const chevron = el("button", "dv-icon-btn dv-collapse");
  chevron.title = "Hide columns panel";
  chevron.innerHTML = ICONS.collapse;
  chevron.addEventListener("click", onCollapse);
  header.appendChild(chevron);
  container.appendChild(header);

  // Filter box (with a leading magnifier) and a Sort icon that opens a menu,
  // laid out as one compact row.
  const tools = el("div", "dv-cols-tools");

  const filterWrap = el("div", "dv-cols-filter-wrap");
  const searchIcon = el("span", "dv-cols-search-icon");
  searchIcon.innerHTML = ICONS.search;
  searchIcon.setAttribute("aria-hidden", "true");
  filterWrap.appendChild(searchIcon);
  const filter = el("input", "dv-cols-filter");
  filter.type = "text";
  filter.placeholder = "Filter";
  filter.setAttribute("aria-label", "Filter columns");
  filter.addEventListener("input", () => {
    filterText = filter.value;
    applyFilter(store.get());
  });
  filterWrap.appendChild(filter);
  tools.appendChild(filterWrap);

  // Sort: an icon button opening a menu of the SORT_OPTIONS, the active one
  // checkmarked. The button title reflects the current mode so the icon-only
  // control still exposes its state.
  const sortBtn = el("button", "dv-icon-btn dv-cols-sortbtn");
  sortBtn.innerHTML = ICONS.sort;
  sortBtn.title = "Sort columns";
  sortBtn.setAttribute("aria-label", "Sort columns");
  sortBtn.setAttribute("aria-haspopup", "menu");
  sortBtn.addEventListener("click", () => {
    const r = sortBtn.getBoundingClientRect();
    showContextMenu(
      r.left,
      r.bottom + 4,
      SORT_OPTIONS.map(([value, label]) => ({
        label,
        icon: value === sortMode ? MENU_ICONS.check : "",
        onClick: () => {
          sortMode = value;
          sortBtn.title = label;
          applyOrder(store.get());
        },
      })),
      sortBtn
    );
  });
  tools.appendChild(sortBtn);

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

    // Re-apply order/filter only on the transitions that change their result,
    // not on every checkbox toggle: a names<->labels view change (affects
    // Name-sort and the label-aware filter) or a kind refinement (affects
    // Type-sort).
    const kindSig = state.columns.map((c) => c.kind).join(",");
    const viewChanged = state.view !== prevView;
    const kindChanged = kindSig !== prevKindSig;
    prevView = state.view;
    prevKindSig = kindSig;
    if (viewChanged && (sortMode === "name-asc" || sortMode === "name-desc")) {
      applyOrder(state);
    }
    if (kindChanged && (sortMode === "type-asc" || sortMode === "type-desc")) {
      applyOrder(state);
    }
    if (viewChanged && filterText) applyFilter(state);
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
