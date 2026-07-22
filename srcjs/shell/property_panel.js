// Left-bottom property panel: a compact tabbed pane for the active column.
// The Properties tab is the SAS Studio attribute table (Label, Name, Length,
// Type, Format); the Statistics tab holds the Kaggle-style column stats.
// Tabs keep the pane short so the columns list above keeps most of the
// sidebar height. Informat is omitted: it is a SAS read-time parsing concept
// with no meaning for already-loaded R data.

import { text, div } from "./dom.js";
import { renderStats } from "./column_stats.js";

const FIELDS = [
  ["Label", "label"],
  ["Name", "name"],
  ["Length", "length"],
  ["Type", "type"],
  ["Format", "format"],
];

export function createPropertyPanel(container, store, { getStats } = {}) {
  // The chosen tab survives re-renders (column switches, sort/filter changes).
  let activeTab = "props";
  let lastStatsCol = null;

  function propsTable(col) {
    const table = document.createElement("table");
    table.className = "dv-prop-table";
    const head = document.createElement("tr");
    head.appendChild(text("th", null, "Property"));
    head.appendChild(text("th", null, "Value"));
    table.appendChild(head);
    FIELDS.forEach(([label, key]) => {
      const tr = document.createElement("tr");
      tr.appendChild(text("td", "dv-prop-name", label));
      const value = col && col[key] !== undefined && col[key] !== "" ? col[key] : "";
      tr.appendChild(text("td", "dv-prop-value", String(value)));
      table.appendChild(tr);
    });
    return table;
  }

  function render(state) {
    const col = state.columns[state.activeColumn];
    container.innerHTML = "";

    // Without a stats source there is nothing to tab between; keep the plain
    // attribute table (also the shape all existing tests and docs show).
    if (!getStats) {
      container.appendChild(propsTable(col));
      return;
    }

    const tabs = div("dv-prop-tabs");
    [
      ["props", "Properties"],
      ["stats", "Statistics"],
    ].forEach(([id, label]) => {
      const b = text("button", "dv-prop-tab", label);
      b.type = "button";
      if (activeTab === id) b.classList.add("dv-prop-tab-active");
      b.addEventListener("click", () => {
        if (activeTab === id) return;
        activeTab = id;
        render(store.get());
      });
      tabs.appendChild(b);
    });
    container.appendChild(tabs);

    if (activeTab === "props" || !col) {
      container.appendChild(propsTable(col));
      return;
    }

    // Statistics for the active column (full dataset, engine-cached).
    const box = div("dv-prop-stats");
    box.textContent = "Computing...";
    container.appendChild(box);
    lastStatsCol = col.name;
    getStats(col.name)
      .then((stats) => {
        // A newer render may have swapped the panel to another column.
        if (lastStatsCol === col.name && box.isConnected)
          renderStats(box, stats, col);
      })
      .catch(() => {
        if (box.isConnected) box.textContent = "";
      });
  }

  render(store.get());
  store.subscribe(render);
}
