// Left-bottom property panel: a Property/Value table for the active column,
// mirroring the SAS Studio attribute pane (Label, Name, Length, Type, Format).
// Informat is omitted: it is a SAS read-time parsing concept with no meaning
// for already-loaded R data.

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
  let lastStatsCol = null;
  function render(state) {
    const col = state.columns[state.activeColumn];
    container.innerHTML = "";

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

    container.appendChild(table);

    // Statistics for the active column (full dataset, engine-cached).
    if (col && getStats) {
      container.appendChild(text("div", "dv-prop-stats-head", "Statistics"));
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
  }

  render(store.get());
  store.subscribe(render);
}
