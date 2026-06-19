// SAS Studio-style "Filter Table Rows" modal: a free-text filter expression
// with Clear Filter / Apply / Cancel and a "?" Help that opens a centered
// modal on top of the dialog (with its own close). Apply is validated by the
// caller (which runs the expression as a count) so an invalid expression keeps
// the dialog open with an error instead of silently failing.

export function createFilterDialog(host, { getExpr, onApply, onClear }) {
  function open(prefill) {
    close();

    const overlay = el("div", "dv-modal-overlay");
    const modal = el("div", "dv-modal");

    const head = el("div", "dv-modal-head");
    head.appendChild(textNode("span", "dv-modal-title", "Filter Table Rows"));
    const x = el("button", "dv-modal-x");
    x.innerHTML = "&times;";
    x.addEventListener("click", close);
    head.appendChild(x);

    const toolRow = el("div", "dv-modal-toolrow");
    const clearBtn = el("button", "dv-modal-clear");
    clearBtn.textContent = "Clear Filter";
    clearBtn.addEventListener("click", () => {
      onClear();
      close();
    });
    const helpBtn = el("button", "dv-modal-help");
    helpBtn.textContent = "?";
    helpBtn.title = "Filter expression help";
    helpBtn.addEventListener("click", openHelp);
    toolRow.appendChild(clearBtn);
    toolRow.appendChild(helpBtn);

    const ta = el("textarea", "dv-modal-textarea");
    ta.placeholder = "Enter a filter expression. See the help for syntax information.";
    ta.value = prefill !== undefined ? prefill : getExpr() || "";

    const err = el("div", "dv-modal-error");

    const foot = el("div", "dv-modal-foot");
    const apply = el("button", "dv-modal-apply");
    apply.textContent = "Apply";
    const cancel = el("button", "dv-modal-cancel");
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", close);
    apply.addEventListener("click", () => {
      err.textContent = "";
      apply.disabled = true;
      Promise.resolve(onApply(ta.value))
        .then(() => close())
        .catch((e) => {
          apply.disabled = false;
          err.textContent = "Invalid filter: " + shortMsg(e);
        });
    });
    foot.appendChild(apply);
    foot.appendChild(cancel);

    modal.appendChild(head);
    modal.appendChild(toolRow);
    modal.appendChild(ta);
    modal.appendChild(err);
    modal.appendChild(foot);

    overlay.appendChild(modal);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    host.appendChild(overlay);
    ta.focus();
  }

  // Help is a centered modal stacked above the filter dialog.
  function openHelp() {
    closeHelp();
    const overlay = el("div", "dv-modal-overlay dv-help-overlay");
    const modal = el("div", "dv-modal dv-help-modal");

    const head = el("div", "dv-modal-head");
    head.appendChild(textNode("span", "dv-modal-title", "Help"));
    const x = el("button", "dv-modal-x");
    x.innerHTML = "&times;";
    x.addEventListener("click", closeHelp);
    head.appendChild(x);
    modal.appendChild(head);

    modal.appendChild(textNode("h4", "dv-help-h", "Filter expression syntax"));
    modal.appendChild(
      textNode(
        "p",
        "dv-help-p",
        "Enter an SQL WHERE expression without the WHERE keyword. For example, " +
          "to show the rows where the value of the AGE column is less than 30, " +
          "use:"
      )
    );
    modal.appendChild(codeBlock("AGE < 30"));

    // Combine conditions with `and` / `or` rendered in monospace.
    const combine = el("p", "dv-help-p");
    combine.appendChild(document.createTextNode("Combine conditions with "));
    combine.appendChild(textNode("code", "dv-help-kw", "and"));
    combine.appendChild(document.createTextNode(" / "));
    combine.appendChild(textNode("code", "dv-help-kw", "or"));
    combine.appendChild(
      document.createTextNode(". String values use double or single quotes:")
    );
    modal.appendChild(combine);

    const ex = el("div", "dv-help-examples");
    ['SEX = "M" and AGE >= 18', 'RACE in ("WHITE", "ASIAN")'].forEach((e) =>
      ex.appendChild(codeBlock(e))
    );
    modal.appendChild(ex);

    overlay.appendChild(modal);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeHelp();
    });
    host.appendChild(overlay);
  }

  function closeHelp() {
    host.querySelectorAll(".dv-help-overlay").forEach((m) => m.remove());
  }

  function close() {
    host.querySelectorAll(".dv-modal-overlay").forEach((m) => m.remove());
  }

  return { open };
}

function shortMsg(e) {
  const s = String((e && e.message) || e);
  return s.length > 160 ? s.slice(0, 160) + "..." : s;
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

// A content-width, syntax-highlighted example box for the help dialog.
function codeBlock(expr) {
  const e = el("div", "dv-help-code");
  e.innerHTML = highlightFilter(expr);
  return e;
}

// Light token highlighting for a filter expression: keywords (and/or/in/not),
// quoted strings, numbers, and comparison operators. Everything else is escaped
// and passed through, so it is safe to assign as innerHTML.
function highlightFilter(s) {
  const esc = (t) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re =
    /("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|(\b(?:and|or|in|not)\b)|(>=|<=|<>|!=|=|<|>)/gi;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    out += esc(s.slice(last, m.index));
    const cls = m[1] ? "hl-str" : m[2] ? "hl-num" : m[3] ? "hl-kw" : "hl-op";
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(s.slice(last));
}
