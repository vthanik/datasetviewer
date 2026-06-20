// Top toolbar: View dropdown (Column names / Column labels), export (CSV) and
// print actions, a Filter indicator (click to edit, with a clear button), and
// pagination controls showing the current visible row range.

import { ICONS } from "./icons.js";
import { el, text } from "./dom.js";

export function createToolbar(
  container,
  store,
  { rowCount, scrollApi, onOpenFilter, onClearFilter, onExport, onShowCode }
) {
  container.innerHTML = "";

  // --- View dropdown ---------------------------------------------------
  const viewWrap = el("div", "dv-tb-group");
  viewWrap.appendChild(text("span", "dv-tb-label", "View:"));
  const select = el("select", "dv-view-select");
  select.innerHTML =
    '<option value="names">Column names</option>' +
    '<option value="labels">Column labels</option>';
  select.value = store.get().view;
  select.addEventListener("change", () => store.set({ view: select.value }));
  viewWrap.appendChild(select);
  container.appendChild(viewWrap);

  const exportBtn = iconButton(ICONS.export, "Export current view to CSV");
  exportBtn.addEventListener("click", () => onExport && onExport());
  container.appendChild(exportBtn);
  const codeBtn = iconButton(ICONS.code, "Show the code that creates this view");
  codeBtn.addEventListener("click", () => onShowCode && onShowCode());
  container.appendChild(codeBtn);
  container.appendChild(sep());

  // --- Filter indicator: the whole funnel + label + expression opens the
  // filter dialog ("enter filter mode"); a clear button removes the filter ----
  const filter = el("div", "dv-tb-group dv-filter");
  const trigger = el("button", "dv-filter-trigger");
  trigger.title = "Filter table rows";
  trigger.innerHTML = ICONS.filter;
  trigger.appendChild(text("span", "dv-tb-label", "Filter:"));
  const filterValue = text("span", "dv-filter-value", "(none)");
  trigger.appendChild(filterValue);
  trigger.addEventListener("click", () => onOpenFilter && onOpenFilter());
  filter.appendChild(trigger);
  const clearBtn = el("button", "dv-filter-clear");
  clearBtn.innerHTML = "&times;";
  clearBtn.title = "Clear filter";
  clearBtn.style.display = "none";
  clearBtn.addEventListener("click", () => onClearFilter && onClearFilter());
  filter.appendChild(clearBtn);
  container.appendChild(filter);

  function refreshFilter(state) {
    const expr = (state.filterExpr || "").trim();
    filterValue.textContent = expr || "(none)";
    clearBtn.style.display = expr ? "" : "none";
  }
  store.subscribe(refreshFilter);
  refreshFilter(store.get());

  // --- Pagination (right) ----------------------------------------------
  const pager = el("div", "dv-tb-pager");
  const range = text("span", "dv-range", rowCount ? `Rows 1-${rowCount}` : "No rows");

  const go = (fn) => () => scrollApi && scrollApi.scrollToRow && scrollApi.scrollToRow(fn());
  // Live state, updated by the grid: current filtered count and visible page.
  let count = rowCount;
  let page = { start: 0, end: 0 };
  const pageSize = () => Math.max(1, page.end - page.start);

  const first = pagerButton(ICONS.first, "First", go(() => 0));
  const prev = pagerButton(ICONS.prev, "Previous", go(() => Math.max(0, page.start - pageSize())));
  const next = pagerButton(ICONS.next, "Next", go(() => Math.min(Math.max(0, count - 1), page.end)));
  const last = pagerButton(ICONS.last, "Last", go(() => Math.max(0, count - 1)));

  pager.appendChild(first);
  pager.appendChild(prev);
  pager.appendChild(range);
  pager.appendChild(next);
  pager.appendChild(last);
  container.appendChild(pager);

  function relabel() {
    range.textContent = count ? `Rows ${page.start + 1}-${page.end}` : "No rows";
  }

  return {
    setRange(start, end) {
      page = { start, end };
      relabel();
    },
    setCount(n) {
      count = n;
      relabel();
    },
  };
}

function iconButton(svg, title) {
  const b = el("button", "dv-icon-btn");
  b.title = title;
  b.innerHTML = svg;
  return b;
}

function pagerButton(svg, title, onClick) {
  const b = iconButton(svg, title);
  b.classList.add("dv-pager-btn");
  b.addEventListener("click", onClick);
  return b;
}

function sep() {
  return el("span", "dv-tb-sep");
}
