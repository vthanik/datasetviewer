// SAS Studio-style per-column "Add Filter" dialog. The body adapts to the
// column type:
//   string/bool -> "Select one or more values" (distinct values, multi-select)
//   number      -> operator (= >= > <= <) + value, with + for more conditions
//   date        -> Equal to / Less than / Greater than date pickers
//   datetime    -> the same with datetime pickers
//   time        -> the same with time pickers
// Apply builds a filter expression for the column and hands it to onApply,
// which appends it to the active filter (validated by the engine).

import { createDateField } from "./datepicker.js";

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
      Promise.resolve(onApply(expr))
        .then(() => close())
        .catch((e) => {
          apply.disabled = false;
          err.textContent = "Invalid filter: " + shortMsg(e);
        });
    });
    foot.appendChild(apply);
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
  const tableWrap = el("div", "dv-af-values");
  tableWrap.textContent = "Loading values...";
  modal.appendChild(tableWrap);

  const checks = [];
  getDistinct(colMeta.name)
    .then(({ values, truncated }) => {
      tableWrap.innerHTML = "";
      const table = el("table", "dv-af-table");
      const hr = el("tr");
      hr.appendChild(thNode("Value"));
      hr.appendChild(thNode("Formatted Value"));
      table.appendChild(hr);
      values.forEach((v) => {
        const tr = el("tr");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(v);
        checks.push(cb);
        const td1 = el("td");
        td1.appendChild(cb);
        td1.appendChild(document.createTextNode(" " + String(v)));
        const td2 = el("td");
        td2.textContent = String(v);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.addEventListener("click", (e) => {
          if (e.target !== cb) cb.checked = !cb.checked;
        });
        table.appendChild(tr);
      });
      tableWrap.appendChild(table);
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
    if (!vals.length) return "";
    // Escape embedded double quotes as "" (SAS style) so whereFromExpr
    // reconstructs the exact value; apostrophes are handled downstream.
    const q = (s) => '"' + s.replace(/"/g, '""') + '"';
    if (vals.length === 1) return `${colMeta.name} = ${q(vals[0])}`;
    return `${colMeta.name} in (${vals.map(q).join(", ")})`;
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

  return function () {
    const parts = rows
      .filter((r) => String(r.val.value).trim() !== "")
      .map((r) => `${colMeta.name} ${r.op.value} ${String(r.val.value).trim()}`);
    return parts.join(" and ");
  };
}

// ---- date / datetime / time: equal / less / greater ------------------
function buildDateTime(modal, colMeta, kind) {
  modal.appendChild(
    textNode("div", "dv-af-prompt", `Specify the criteria for "${colMeta.name}"`)
  );

  // Date and datetime use the elegant custom calendar; time uses a native
  // time input. Each field exposes value().
  function makeField() {
    if (kind === "time") {
      const i = el("input", "dv-af-critinput");
      i.type = "time";
      i.step = 1;
      return { el: i, value: () => i.value };
    }
    return createDateField();
  }

  function crit(label) {
    const wrap = el("div", "dv-af-crit");
    wrap.appendChild(textNode("label", "dv-af-critlabel", label));
    const field = makeField();
    wrap.appendChild(field.el);
    modal.appendChild(wrap);
    return field;
  }
  const eq = crit("Equal to:");
  const lt = crit("Less than:");
  const gt = crit("Greater than:");

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
    return parts.join(" and ");
  };
}

// ---- helpers ---------------------------------------------------------
function shortMsg(e) {
  const s = String((e && e.message) || e);
  return s.length > 140 ? s.slice(0, 140) + "..." : s;
}
function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
function textNode(tag, className, content) {
  const e = el(tag, className);
  e.textContent = content;
  return e;
}
function thNode(t) {
  const e = document.createElement("th");
  e.textContent = t;
  return e;
}
