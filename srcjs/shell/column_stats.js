// Kaggle-style column statistics for the "Column details" modal (header
// context menu). Charts are dependency-free inline SVG (single-hue bars,
// shell accent on neutrals).

import { el, text as textNode, div } from "./dom.js";

const ACCENT = "#0378cd";
const MISS = "#c9552e";
const GRAY = "#e9ecef";
const W = 220;

function fmt(x) {
  if (x == null) return "";
  if (typeof x !== "number") return String(x);
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(2);
}

// Trim display noise from temporal value strings: sub-second precision and
// the "+00" zone suffix a TIMETZ VARCHAR cast appends. Summary labels only --
// grid cells show the engine strings untouched.
function tidyTemporal(s) {
  return String(s)
    .replace(/\.\d+(?=$|\+)/, "")
    .replace(/\+00(:00)?$/, "");
}

function pct(part, whole) {
  if (!whole) return "0%";
  const p = (100 * part) / whole;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

function svg(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}

// Valid/missing completeness bar + counts table.
function validBlock(stats, isTemporal) {
  const wrap = div("dv-stat-valid");
  // viewBox + preserveAspectRatio none: the bar stretches with the panel
  // width (drag-resize) instead of clipping at a fixed pixel width.
  const bar = svg("svg", {
    viewBox: `0 0 ${W} 8`,
    preserveAspectRatio: "none",
    class: "dv-stat-bar",
  });
  const validW = stats.nTotal ? Math.round((W * stats.nValid) / stats.nTotal) : 0;
  bar.appendChild(svg("rect", { x: 0, y: 0, width: W, height: 8, fill: MISS }));
  bar.appendChild(svg("rect", { x: 0, y: 0, width: validW, height: 8, fill: ACCENT }));
  wrap.appendChild(bar);
  const t = el("table", "dv-stat-table");
  [
    // The swatch ties each row to its slice of the completeness bar above.
    ["Valid", stats.nValid, pct(stats.nValid, stats.nTotal), ACCENT],
    ["Missing", stats.nTotal - stats.nValid, pct(stats.nTotal - stats.nValid, stats.nTotal), MISS],
    ["Unique", stats.nUnique, ""],
    [
      "Most common",
      stats.top[0] ? (isTemporal ? tidyTemporal(stats.top[0].v) : stats.top[0].v) : "",
      stats.top[0] ? pct(stats.top[0].c, stats.nTotal) : "",
    ],
  ].forEach(([k, v, p, swatch]) => {
    const tr = el("tr");
    const kd = el("td", "dv-stat-k");
    if (swatch) {
      const box = el("span", "dv-stat-swatch");
      box.style.background = swatch;
      kd.appendChild(box);
    }
    kd.appendChild(document.createTextNode(k));
    tr.appendChild(kd);
    tr.appendChild(textNode("td", "dv-stat-v", fmt(v)));
    tr.appendChild(textNode("td", "dv-stat-p", p));
    t.appendChild(tr);
  });
  wrap.appendChild(t);
  return wrap;
}

// Histogram (numeric/temporal) -- equal-width bins, min/max labels under it.
function histBlock(stats, isTemporal) {
  const wrap = div("dv-stat-hist");
  const H = 64;
  // Full-width like the completeness bar; bars stretch with the panel.
  const g = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none",
    class: "dv-stat-histsvg",
  });
  const max = Math.max(...stats.hist.map((b) => b.c), 1);
  const bw = W / stats.hist.length;
  stats.hist.forEach((b, i) => {
    const h = Math.round(((H - 2) * b.c) / max);
    g.appendChild(
      svg("rect", { x: i * bw + 0.5, y: H - h, width: bw - 1, height: h, fill: ACCENT })
    );
  });
  wrap.appendChild(g);
  const lab = div("dv-stat-histlab");
  const edge = (disp, num) =>
    disp == null ? fmt(num) : isTemporal ? tidyTemporal(disp) : disp;
  lab.appendChild(textNode("span", null, edge(stats.minDisp, stats.min)));
  lab.appendChild(textNode("span", null, edge(stats.maxDisp, stats.max)));
  wrap.appendChild(lab);
  return wrap;
}

// Top-10 category bars (string/bool with unique <= 50).
function topBlock(stats) {
  const wrap = div("dv-stat-top");
  const max = Math.max(...stats.top.map((t) => t.c), 1);
  stats.top.forEach(({ v, c }) => {
    const row = div("dv-stat-toprow");
    row.appendChild(textNode("span", "dv-stat-toplab", v));
    const bar = svg("svg", { width: 90, height: 10 });
    bar.appendChild(svg("rect", { x: 0, y: 0, width: 90, height: 10, fill: GRAY }));
    bar.appendChild(
      svg("rect", { x: 0, y: 0, width: Math.max(1, Math.round((90 * c) / max)), height: 10, fill: ACCENT })
    );
    row.appendChild(bar);
    row.appendChild(textNode("span", "dv-stat-topn", String(c)));
    wrap.appendChild(row);
  });
  return wrap;
}

// Quantile table for numbers (epoch-based mean/sd are meaningless to show
// for temporal kinds, so those get min/max via the histogram labels only).
function quantBlock(stats) {
  const t = el("table", "dv-stat-table");
  [
    ["Mean", fmt(stats.mean)],
    ["Std. deviation", fmt(stats.sd)],
    ["Min", fmt(stats.min)],
    ["25%", fmt(stats.q25)],
    ["Median", fmt(stats.q50)],
    ["75%", fmt(stats.q75)],
    ["Max", fmt(stats.max)],
  ].forEach(([k, v]) => {
    const tr = el("tr");
    tr.appendChild(textNode("td", "dv-stat-k", k));
    tr.appendChild(textNode("td", "dv-stat-v", v));
    t.appendChild(tr);
  });
  return t;
}

function renderStats(container, stats, colMeta) {
  container.innerHTML = "";
  const uniq = div("dv-stat-uniq");
  uniq.appendChild(textNode("div", "dv-stat-uniq-n", String(stats.nUnique)));
  uniq.appendChild(textNode("div", "dv-stat-uniq-lab", "unique values"));
  container.appendChild(uniq);
  const isTemporal = ["date", "datetime", "time"].includes(colMeta.kind);
  container.appendChild(validBlock(stats, isTemporal));
  if (stats.hist) container.appendChild(histBlock(stats, isTemporal));
  if (colMeta.kind === "number") container.appendChild(quantBlock(stats));
  if (
    (colMeta.kind === "string" || colMeta.kind === "bool") &&
    stats.nUnique <= 50 &&
    stats.top.length
  ) {
    container.appendChild(topBlock(stats));
  }
}

// Centered modal, same interaction pattern as the filter dialogs (overlay
// click or Escape or the corner x closes). `host` is the widget root the
// filter dialogs also mount on; `bounds` is accepted for call-site symmetry
// with the menus but unused -- a modal does not anchor.
export function showStatsCard(host, bounds, colMeta, statsPromise) {
  host.querySelectorAll(".dv-stats-overlay").forEach((c) => c.remove());
  const overlay = el("div", "dv-modal-overlay");
  overlay.classList.add("dv-stats-overlay");
  const modal = el("div", "dv-modal");
  modal.classList.add("dv-stats-modal");

  const head = div("dv-modal-head");
  const title = textNode("span", "dv-modal-title", colMeta.name);
  head.appendChild(title);
  const x = el("button", "dv-modal-x");
  x.innerHTML = "&times;";
  head.appendChild(x);
  modal.appendChild(head);
  if (colMeta.label) modal.appendChild(textNode("div", "dv-stat-card-sub", colMeta.label));

  const body = div("dv-stat-card-body");
  body.textContent = "Computing...";
  modal.appendChild(body);
  overlay.appendChild(modal);
  host.appendChild(overlay);

  const close = () => overlay.remove();
  x.addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.tabIndex = -1;
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  overlay.focus();

  statsPromise
    .then((stats) => renderStats(body, stats, colMeta))
    .catch(() => {
      body.textContent = "Could not compute statistics.";
    });
}
