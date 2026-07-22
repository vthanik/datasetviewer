// Kaggle-style column statistics: one renderer shared by the property-panel
// Statistics section and the floating "Column details" card. Charts are
// dependency-free inline SVG (single-hue bars, shell accent on neutrals).

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
function validBlock(stats) {
  const wrap = div("dv-stat-valid");
  const bar = svg("svg", { width: W, height: 8, class: "dv-stat-bar" });
  const validW = stats.nTotal ? Math.round((W * stats.nValid) / stats.nTotal) : 0;
  bar.appendChild(svg("rect", { x: 0, y: 0, width: W, height: 8, fill: MISS }));
  bar.appendChild(svg("rect", { x: 0, y: 0, width: validW, height: 8, fill: ACCENT }));
  wrap.appendChild(bar);
  const t = el("table", "dv-stat-table");
  [
    ["Valid", stats.nValid, pct(stats.nValid, stats.nTotal)],
    ["Missing", stats.nTotal - stats.nValid, pct(stats.nTotal - stats.nValid, stats.nTotal)],
    ["Unique", stats.nUnique, ""],
    ["Most common", stats.top[0] ? stats.top[0].v : "", stats.top[0] ? pct(stats.top[0].c, stats.nTotal) : ""],
  ].forEach(([k, v, p]) => {
    const tr = el("tr");
    tr.appendChild(textNode("td", "dv-stat-k", k));
    tr.appendChild(textNode("td", "dv-stat-v", fmt(v)));
    tr.appendChild(textNode("td", "dv-stat-p", p));
    t.appendChild(tr);
  });
  wrap.appendChild(t);
  return wrap;
}

// Histogram (numeric/temporal) -- equal-width bins, min/max labels under it.
function histBlock(stats) {
  const wrap = div("dv-stat-hist");
  const H = 64;
  const g = svg("svg", { width: W, height: H, class: "dv-stat-histsvg" });
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
  lab.appendChild(textNode("span", null, stats.minDisp ?? fmt(stats.min)));
  lab.appendChild(textNode("span", null, stats.maxDisp ?? fmt(stats.max)));
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

export function renderStats(container, stats, colMeta) {
  container.innerHTML = "";
  const uniq = div("dv-stat-uniq");
  uniq.appendChild(textNode("div", "dv-stat-uniq-n", String(stats.nUnique)));
  uniq.appendChild(textNode("div", "dv-stat-uniq-lab", "unique values"));
  container.appendChild(uniq);
  container.appendChild(validBlock(stats));
  if (stats.hist) container.appendChild(histBlock(stats));
  if (colMeta.kind === "number") container.appendChild(quantBlock(stats));
  if (
    (colMeta.kind === "string" || colMeta.kind === "bool") &&
    stats.nUnique <= 50 &&
    stats.top.length
  ) {
    container.appendChild(topBlock(stats));
  }
}

export function showStatsCard(bounds, colMeta, statsPromise) {
  document.querySelectorAll(".dv-stat-card").forEach((c) => c.remove());
  const card = div("dv-stat-card");
  card.tabIndex = -1;
  card.style.left = `${Math.max(8, bounds.x)}px`;
  card.style.top = `${bounds.y + bounds.height}px`;
  const head = div("dv-stat-card-head");
  head.appendChild(textNode("span", "dv-stat-card-title", colMeta.name));
  if (colMeta.label) head.appendChild(textNode("span", "dv-stat-card-sub", colMeta.label));
  card.appendChild(head);
  const body = div("dv-stat-card-body");
  body.textContent = "Computing...";
  card.appendChild(body);
  document.body.appendChild(card);
  const closeCard = () => {
    document.removeEventListener("mousedown", onDoc);
    card.remove();
  };
  const onDoc = (e) => {
    if (!card.contains(e.target)) closeCard();
  };
  setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCard();
  });
  card.focus();
  statsPromise
    .then((stats) => renderStats(body, stats, colMeta))
    .catch(() => {
      body.textContent = "Could not compute statistics.";
    });
}
