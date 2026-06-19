// Left-bottom property panel: a Property/Value table for the active column,
// mirroring the SAS Studio attribute pane (Label, Name, Length, Type, Format).
// Informat is omitted: it is a SAS read-time parsing concept with no meaning
// for already-loaded R data.

const FIELDS = [
  ["Label", "label"],
  ["Name", "name"],
  ["Length", "length"],
  ["Type", "type"],
  ["Format", "format"],
];

export function createPropertyPanel(container, store) {
  function render(state) {
    const col = state.columns[state.activeColumn];
    container.innerHTML = "";

    const table = document.createElement("table");
    table.className = "dv-prop-table";

    const head = document.createElement("tr");
    head.appendChild(th("Property"));
    head.appendChild(th("Value"));
    table.appendChild(head);

    FIELDS.forEach(([label, key]) => {
      const tr = document.createElement("tr");
      tr.appendChild(td(label, "dv-prop-name"));
      const value = col && col[key] !== undefined && col[key] !== "" ? col[key] : "";
      tr.appendChild(td(String(value), "dv-prop-value"));
      table.appendChild(tr);
    });

    container.appendChild(table);
  }

  render(store.get());
  store.subscribe(render);
}

function th(textContent) {
  const e = document.createElement("th");
  e.textContent = textContent;
  return e;
}

function td(textContent, className) {
  const e = document.createElement("td");
  e.textContent = textContent;
  if (className) e.className = className;
  return e;
}
