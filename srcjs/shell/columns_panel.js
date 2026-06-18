// Left "Columns" panel: a Select-all toggle plus a checkbox list of columns
// with char/num/date type icons. The header carries a collapse chevron that
// hides the whole sidebar. Clicking a column row makes it the active column
// shown in the property panel.
//
// The list DOM is built once; store changes only update checkbox/active/label
// state in place, so a click never destroys and rebuilds hundreds of rows
// (no focus/scroll loss, O(1) work per toggle on wide datasets).

import { typeIcon, ICONS } from "./icons.js";
import { headerText } from "../state.js";

export function createColumnsPanel(container, store, { onCollapse }) {
  container.innerHTML = "";
  const initial = store.get();

  const header = el("div", "dv-cols-header");
  header.appendChild(text("span", "dv-cols-title", "Columns"));
  const chevron = el("button", "dv-icon-btn dv-collapse");
  chevron.title = "Hide columns panel";
  chevron.innerHTML = ICONS.collapse;
  chevron.addEventListener("click", onCollapse);
  header.appendChild(chevron);
  container.appendChild(header);

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

  // One persistent row per column; keep handles for in-place updates.
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
