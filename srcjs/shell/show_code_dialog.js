// SAS Studio-style "Show code": an on-demand dialog showing the dplyr code
// that reproduces the current view (selected columns + filter + sort), with
// syntax highlighting and a Copy button. The code is a snapshot -- editing it
// here does nothing to the table, matching SAS Studio's behaviour.

export function createShowCodeDialog(host, { getCode }) {
  function open() {
    close();
    const code = getCode();

    const overlay = el("div", "dv-modal-overlay");
    const modal = el("div", "dv-modal dv-code-modal");

    const head = el("div", "dv-modal-head");
    head.appendChild(text("span", "dv-modal-title", "Code"));
    const x = el("button", "dv-modal-x");
    x.innerHTML = "&times;";
    x.title = "Close";
    x.addEventListener("click", close);
    head.appendChild(x);
    modal.appendChild(head);

    const pre = el("pre", "dv-code-block");
    pre.innerHTML = highlightR(code);
    modal.appendChild(pre);

    const foot = el("div", "dv-modal-foot");
    const copy = el("button", "dv-modal-apply");
    copy.textContent = "Copy";
    copy.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    });
    const closeBtn = el("button", "dv-modal-cancel");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", close);
    foot.appendChild(copy);
    foot.appendChild(closeBtn);
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

// Minimal R syntax highlighter for the generated snippet. No external
// dependency: tokenises comments, strings, numbers, function calls, the pipe,
// and operators, wrapping each in a span the stylesheet colours.
export function highlightR(code) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isIdStart = (c) => /[A-Za-z._]/.test(c);
  const isId = (c) => /[A-Za-z0-9._]/.test(c);

  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];

    if (ch === "#") {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      out += `<span class="hl-com">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === q) {
          j++;
          break;
        }
        j++;
      }
      out += `<span class="hl-str">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(code[j])) j++;
      out += `<span class="hl-num">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else if (isIdStart(ch)) {
      let j = i;
      while (j < n && isId(code[j])) j++;
      const word = code.slice(i, j);
      let k = j;
      while (k < n && code[k] === " ") k++;
      out += code[k] === "(" ? `<span class="hl-fun">${esc(word)}</span>` : esc(word);
      i = j;
    } else if (code.startsWith("|>", i)) {
      out += `<span class="hl-op">|&gt;</span>`;
      i += 2;
    } else if (/[&|<>=!]/.test(ch)) {
      let j = i;
      while (j < n && /[&|<>=!]/.test(code[j])) j++;
      out += `<span class="hl-op">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else {
      out += esc(ch);
      i++;
    }
  }
  return out;
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
