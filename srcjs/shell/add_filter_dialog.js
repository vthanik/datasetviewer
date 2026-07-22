// SAS Studio-style per-column "Add Filter" dialog. The body adapts to the
// column type:
//   string/bool -> "Select one or more values" (distinct values, multi-select)
//   number      -> operator (= >= > <= <) + value, with + for more conditions
//   date        -> Equal to / Less than / Greater than date pickers
//   datetime    -> the same with datetime pickers
//   time        -> the same with time pickers
// Apply builds a filter expression for the column and hands it (with the column
// name) to onApply, which applies it to the active filter -- replacing any
// existing clause for that column -- validated by the engine.

import { createDateField } from "./datepicker.js";
import { el, text as textNode } from "./dom.js";

const NUM_OPS = [
  ["=", "="],
  [">=", "≥"],
  [">", ">"],
  ["<=", "≤"],
  ["<", "<"],
];

export function createAddFilterDialog(host, { getDistinct, onApply }) {
  function open(colMeta) {
    close();
    const kind = colMeta.kind || (colMeta.type === "Num" ? "number" : "string");

    const overlay = el("div", "dv-modal-overlay");
    const modal = el("div", "dv-modal");

    const head = el("div", "dv-modal-head");
    head.appendChild(textNode("span", "dv-modal-title", "Add Filter"));
    const x = el("button", "dv-modal-x");
    x.innerHTML = "&times;";
    x.addEventListener("click", close);
    head.appendChild(x);
    modal.appendChild(head);

    const err = el("div", "dv-modal-error");

    let build; // () => expression string (or "")
    if (kind === "string" || kind === "bool") {
      build = buildValues(modal, colMeta, getDistinct);
    } else if (kind === "number") {
      build = buildNumber(modal, colMeta);
    } else {
      build = buildDateTime(modal, colMeta, kind);
    }

    modal.appendChild(err);

    const foot = el("div", "dv-modal-foot");
    const apply = el("button", "dv-modal-apply");
    apply.textContent = "Filter";
    const clear = el("button", "dv-modal-cancel");
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      // Reset the picker in place (matches SAS's Clear, which empties the
      // selection without closing or applying the filter).
      modal
        .querySelectorAll('input[type="checkbox"]')
        .forEach((c) => (c.checked = false));
      modal.querySelectorAll(".dv-af-val").forEach((i) => (i.value = ""));
      // Custom date fields hold their value in a closure, not the input, so
      // reset them through the hook the field registers on its wrapper.
      modal
        .querySelectorAll(".dv-date-field")
        .forEach((w) => w._clear && w._clear());
      err.textContent = "";
    });
    const cancel = el("button", "dv-modal-cancel");
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", close);
    apply.addEventListener("click", () => {
      const expr = build();
      if (!expr) {
        err.textContent = "Enter at least one value.";
        return;
      }
      apply.disabled = true;
      Promise.resolve(onApply(colMeta.name, expr))
        .then(() => close())
        .catch((e) => {
          apply.disabled = false;
          err.textContent = "Invalid filter: " + shortMsg(e);
        });
    });
    foot.appendChild(apply);
    foot.appendChild(clear);
    foot.appendChild(cancel);
    modal.appendChild(foot);

    overlay.appendChild(modal);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    host.appendChild(overlay);
  }

  function close() {
    host.querySelectorAll(".dv-modal-overlay").forEach((m) => m.remove());
  }

  return { open };
}

// ---- categorical: select one or more values --------------------------
function buildValues(modal, colMeta, getDistinct) {
  modal.appendChild(textNode("div", "dv-af-prompt", "Select one or more values."));
  const search = el("input", "dv-af-search");
  search.type = "search";
  search.placeholder = "Search values";
  modal.appendChild(search);
  const tableWrap = el("div", "dv-af-values");
  tableWrap.textContent = "Loading values...";
  modal.appendChild(tableWrap);

  const checks = [];
  let missingCb = null; // a "(Missing)" row, added only when the column has NAs
  getDistinct(colMeta.name)
    .then(({ values, truncated, hasNull }) => {
      tableWrap.innerHTML = "";
      const table = el("table", "dv-af-table");
      const hr = el("tr");
      // One "Value" column: factors arrive as character, so a separate
      // "Formatted Value" column would only repeat it.
      hr.appendChild(textNode("th", null, "Value"));
      table.appendChild(hr);
      // Offer "(Missing)" first (when present) so filtering to NA is one click.
      if (hasNull) missingCb = appendMissingRow(table);
      values.forEach((v) => {
        const tr = el("tr");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(v);
        checks.push(cb);
        const td1 = el("td");
        td1.appendChild(cb);
        td1.appendChild(document.createTextNode(" " + String(v)));
        tr.appendChild(td1);
        tr.addEventListener("click", (e) => {
          if (e.target !== cb) cb.checked = !cb.checked;
        });
        table.appendChild(tr);
      });
      tableWrap.appendChild(table);
      const rows = [...table.querySelectorAll("tr")].slice(1); // skip header
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        rows.forEach((tr) => {
          tr.style.display =
            !q || tr.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
      if (truncated) {
        const note = el("div", "dv-af-note");
        note.textContent = `Showing the first ${values.length} values.`;
        tableWrap.appendChild(note);
      }
    })
    .catch(() => {
      tableWrap.textContent = "Could not load values.";
    });

  return function () {
    const vals = checks.filter((c) => c.checked).map((c) => c.value);
    // Escape embedded double quotes as "" (SAS style) so whereFromExpr
    // reconstructs the exact value; apostrophes are handled downstream.
    const q = (s) => '"' + s.replace(/"/g, '""') + '"';
    let base = "";
    if (vals.length === 1) base = `${colMeta.name} = ${q(vals[0])}`;
    else if (vals.length) base = `${colMeta.name} in (${vals.map(q).join(", ")})`;
    return combineMissing(base, missingCb && missingCb.checked, colMeta.name);
  };
}

// ---- numeric: operator + value, with + for more ----------------------
function buildNumber(modal, colMeta) {
  modal.appendChild(
    textNode("div", "dv-af-prompt", `Specify the criteria for "${colMeta.name}"`)
  );
  const rowsWrap = el("div", "dv-af-numrows");
  modal.appendChild(rowsWrap);

  const rows = [];
  function addRow() {
    const row = el("div", "dv-af-numrow");
    const op = el("select", "dv-af-op");
    NUM_OPS.forEach(([val, lab]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = lab;
      op.appendChild(o);
    });
    const val = el("input", "dv-af-val");
    val.type = "text";
    const plus = el("button", "dv-af-plus");
    plus.textContent = "+";
    plus.title = "Add another condition";
    plus.addEventListener("click", () => addRow());
    row.appendChild(op);
    row.appendChild(val);
    row.appendChild(plus);
    rowsWrap.appendChild(row);
    rows.push({ op, val });
  }
  addRow();
  const missingCb = appendMissingCheckbox(modal);

  return function () {
    const parts = rows
      .filter((r) => String(r.val.value).trim() !== "")
      .map((r) => `${colMeta.name} ${r.op.value} ${String(r.val.value).trim()}`);
    return combineMissing(parts.join(" and "), missingCb.checked, colMeta.name);
  };
}

// ---- date / datetime / time: equal / less / greater ------------------
function buildDateTime(modal, colMeta, kind) {
  modal.appendChild(
    textNode("div", "dv-af-prompt", `Specify the criteria for "${colMeta.name}"`)
  );

  // Native date / datetime / time field for this column kind; each exposes
  // value() as the canonical string the typed SQL literal expects.
  function crit(label) {
    const wrap = el("div", "dv-af-crit");
    wrap.appendChild(textNode("label", "dv-af-critlabel", label));
    const field = createDateField(kind);
    wrap.appendChild(field.el);
    modal.appendChild(wrap);
    return field;
  }
  const eq = crit("Equal to:");
  const lt = crit("Less than:");
  const gt = crit("Greater than:");
  const missingCb = appendMissingCheckbox(modal);

  // Emit a typed SQL literal so comparisons are real date/time comparisons,
  // not fragile string-vs-date casts. These pass through whereFromExpr
  // unchanged (single-quoted runs are preserved verbatim).
  const sqlType = kind === "time" ? "TIME" : kind === "datetime" ? "TIMESTAMP" : "DATE";
  const lit = (v) => `${sqlType} '${String(v).replace(/'/g, "''")}'`;

  return function () {
    const parts = [];
    if (eq.value()) parts.push(`${colMeta.name} = ${lit(eq.value())}`);
    if (lt.value()) parts.push(`${colMeta.name} < ${lit(lt.value())}`);
    if (gt.value()) parts.push(`${colMeta.name} > ${lit(gt.value())}`);
    return combineMissing(parts.join(" and "), missingCb.checked, colMeta.name);
  };
}

// ---- missing-value option (shared across the three builders) ---------
// OR the "(Missing)" clause onto the criteria the user set. Empty criteria +
// missing -> just "COL is na"; criteria + missing -> "(criteria) or COL is na"
// (the criteria are parenthesised so the OR binds the whole group).
function combineMissing(expr, missing, name) {
  if (!missing) return expr;
  const na = `${name} is na`;
  return expr ? `(${expr}) or ${na}` : na;
}

// A "(Missing)" checkbox row inside the categorical values table.
function appendMissingRow(table) {
  const tr = el("tr", "dv-af-missing");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  const td = el("td");
  td.appendChild(cb);
  td.appendChild(textNode("em", null, " (Missing)"));
  tr.appendChild(td);
  tr.addEventListener("click", (e) => {
    if (e.target !== cb) cb.checked = !cb.checked;
  });
  table.appendChild(tr);
  return cb;
}

// A standalone "(Missing)" checkbox for the numeric / date builders.
function appendMissingCheckbox(modal) {
  const wrap = el("label", "dv-af-missing");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  wrap.appendChild(cb);
  wrap.appendChild(textNode("span", null, " Include missing (NA) values"));
  modal.appendChild(wrap);
  return cb;
}

// ---- helpers ---------------------------------------------------------
function shortMsg(e) {
  const s = String((e && e.message) || e);
  return s.length > 140 ? s.slice(0, 140) + "..." : s;
}
