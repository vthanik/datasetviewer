// Elegant custom date field + calendar popup, styled after the SAS Studio
// filter date picker (month dropdown, prev/next arrows, year selector, Clear /
// Today). Replaces the browser-native date input so the look is consistent.
// Value is exposed as a "YYYY-MM-DD" string.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const CAL_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="#3b6ea5" stroke-width="1.2"/>
  <path d="M2 6 H14" stroke="#3b6ea5" stroke-width="1.2"/>
  <path d="M5 1.5 V4 M11 1.5 V4" stroke="#3b6ea5" stroke-width="1.2" stroke-linecap="round"/></svg>`;

const pad = (n) => String(n).padStart(2, "0");
const fmt = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function createDateField() {
  const wrap = el("div", "dv-date-field");
  const input = el("input", "dv-date-input");
  input.type = "text";
  input.readOnly = true;
  input.placeholder = "yyyy-mm-dd";
  const btn = el("button", "dv-date-btn");
  btn.type = "button";
  btn.innerHTML = CAL_ICON;
  wrap.appendChild(input);
  wrap.appendChild(btn);

  let value = "";
  let popup = null;
  let view = null;

  function startView() {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      return { y, m: m - 1 };
    }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  }

  function reposition() {
    if (!popup) return;
    const r = wrap.getBoundingClientRect();
    popup.style.left = `${r.left}px`;
    popup.style.top = `${r.bottom + 4}px`;
  }

  function open() {
    if (popup) {
      close();
      return;
    }
    view = startView();
    popup = el("div", "dv-cal");
    document.body.appendChild(popup);
    render();
    reposition();
    setTimeout(() => document.addEventListener("mousedown", outside), 0);
    // Keep the popup glued to its field while the dialog/page scrolls.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
  }

  function outside(e) {
    if (popup && !popup.contains(e.target) && !wrap.contains(e.target)) close();
  }

  function close() {
    if (popup) {
      popup.remove();
      popup = null;
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    }
  }

  function pick(y, m, d) {
    value = fmt(y, m, d);
    input.value = value;
    close();
  }

  function render() {
    popup.innerHTML = "";

    // header: prev, month dropdown, next
    const head = el("div", "dv-cal-head");
    const prev = navBtn("‹", () => {
      view.m === 0 ? ((view.m = 11), view.y--) : view.m--;
      render();
    });
    const next = navBtn("›", () => {
      view.m === 11 ? ((view.m = 0), view.y++) : view.m++;
      render();
    });
    const msel = el("select", "dv-cal-month");
    MONTHS.forEach((nm, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = nm;
      if (i === view.m) o.selected = true;
      msel.appendChild(o);
    });
    msel.onchange = () => {
      view.m = Number(msel.value);
      render();
    };
    head.appendChild(prev);
    head.appendChild(msel);
    head.appendChild(next);
    popup.appendChild(head);

    // weekday header
    const wd = el("div", "dv-cal-wd");
    WEEKDAYS.forEach((d) => {
      const c = el("div", "dv-cal-wdc");
      c.textContent = d;
      wd.appendChild(c);
    });
    popup.appendChild(wd);

    // day grid (6 weeks)
    const grid = el("div", "dv-cal-grid");
    const first = new Date(view.y, view.m, 1).getDay();
    const inMonth = new Date(view.y, view.m + 1, 0).getDate();
    const prevDays = new Date(view.y, view.m, 0).getDate();
    const sel = value ? value.split("-").map(Number) : null;
    const now = new Date();
    for (let i = 0; i < 42; i++) {
      let y = view.y;
      let m = view.m;
      let d;
      let muted = false;
      if (i < first) {
        d = prevDays - first + 1 + i;
        m = view.m - 1;
        if (m < 0) {
          m = 11;
          y--;
        }
        muted = true;
      } else if (i >= first + inMonth) {
        d = i - first - inMonth + 1;
        m = view.m + 1;
        if (m > 11) {
          m = 0;
          y++;
        }
        muted = true;
      } else {
        d = i - first + 1;
      }
      const cell = el("button", "dv-cal-day");
      cell.type = "button";
      cell.textContent = d;
      if (muted) cell.classList.add("muted");
      if (sel && sel[0] === y && sel[1] - 1 === m && sel[2] === d) {
        cell.classList.add("selected");
      }
      if (
        y === now.getFullYear() &&
        m === now.getMonth() &&
        d === now.getDate()
      ) {
        cell.classList.add("today");
      }
      cell.onclick = () => pick(y, m, d);
      grid.appendChild(cell);
    }
    popup.appendChild(grid);

    // year selector
    const years = el("div", "dv-cal-years");
    [view.y - 1, view.y, view.y + 1].forEach((y) => {
      const yb = el("button", "dv-cal-year");
      yb.type = "button";
      yb.textContent = y;
      if (y === view.y) yb.classList.add("current");
      yb.onclick = () => {
        view.y = y;
        render();
      };
      years.appendChild(yb);
    });
    popup.appendChild(years);

    // footer: Clear / Today
    const foot = el("div", "dv-cal-foot");
    const clr = link("Clear", () => {
      value = "";
      input.value = "";
      close();
    });
    const tdy = link("Today", () => {
      const n = new Date();
      pick(n.getFullYear(), n.getMonth(), n.getDate());
    });
    foot.appendChild(clr);
    foot.appendChild(tdy);
    popup.appendChild(foot);
  }

  btn.addEventListener("click", open);
  input.addEventListener("click", open);

  return { el: wrap, value: () => value, destroy: close };
}

function navBtn(glyph, onClick) {
  const b = el("button", "dv-cal-nav");
  b.type = "button";
  b.innerHTML = glyph;
  b.onclick = onClick;
  return b;
}

function link(text, onClick) {
  const b = el("button", "dv-cal-link");
  b.type = "button";
  b.textContent = text;
  b.onclick = onClick;
  return b;
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
