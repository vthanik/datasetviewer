// datasetviewer htmlwidget entry point. Composes the SAS Studio-style shell
// (toolbar + columns panel + property panel + grid) around the DuckDB-WASM
// engine, wired through a single state store.

/* global HTMLWidgets */

import "./styles.css";
import { createStore, initialState } from "./state.js";
import { createEngine } from "./engine/engine.js";
import { b64ToBytes } from "./parquet_decode.js";
import { whereFromExpr, orderFromSort } from "./sql.js";
import { createGrid } from "./shell/grid_view.js";
import { createToolbar } from "./shell/toolbar.js";
import { createColumnsPanel } from "./shell/columns_panel.js";
import { createPropertyPanel } from "./shell/property_panel.js";
import { createFilterDialog } from "./shell/filter_dialog.js";
import { createAddFilterDialog } from "./shell/add_filter_dialog.js";
import { createShowCodeDialog } from "./shell/show_code_dialog.js";
import { dplyrCode } from "./codegen.js";
import { showContextMenu } from "./shell/context_menu.js";
import { exportCsv } from "./shell/export.js";
import { wireShiny } from "./shiny.js";
import { ICONS } from "./shell/icons.js";

function div(className) {
  const e = document.createElement("div");
  if (className) e.className = className;
  return e;
}

HTMLWidgets.widget({
  name: "datasetviewer",
  type: "output",

  factory: function (el) {
    el.classList.add("datasetviewer-root");
    let grid = null;
    let engine = null;

    function teardown() {
      if (grid) {
        grid.destroy();
        grid = null;
      }
      if (engine) {
        engine.destroy();
        engine = null;
      }
    }

    return {
      renderValue: function (x) {
        teardown();
        el.innerHTML = "";

        const store = createStore(initialState(x));

        // --- layout skeleton ---------------------------------------
        const toolbar = div("dv-toolbar");
        const body = div("dv-body");
        const sidebar = div("dv-sidebar");
        const colsPanel = div("dv-columns-panel");
        const propPanel = div("dv-property-panel");
        sidebar.appendChild(colsPanel);
        sidebar.appendChild(propPanel);

        // Draggable divider to resize the sidebar (like SAS Studio).
        const resizer = div("dv-resizer");
        resizer.title = "Drag to resize";

        const reopen = div("dv-reopen");
        reopen.title = "Show columns panel";
        reopen.innerHTML = ICONS.expand;
        reopen.style.display = "none";

        const main = div("dv-main");
        const gridEl = div("dv-grid");
        gridEl.textContent = "Loading...";
        main.appendChild(gridEl);

        // Full-width bottom status bar (Positron-style footer). It also keeps
        // the grid's horizontal scrollbar above the viewport edge, so the
        // empty block at the bottom now carries the row/column counts.
        const statusbar = div("dv-statusbar");
        function setSummary(filtered) {
          const hasFilter = !!(store.get().filterExpr || "").trim();
          let txt = `Total rows: ${x.n_rows}    Total columns: ${x.n_cols}`;
          if (hasFilter) txt += `    Filtered rows: ${filtered}`;
          statusbar.textContent = txt;
        }
        setSummary(x.n_rows);

        body.appendChild(sidebar);
        body.appendChild(resizer);
        body.appendChild(reopen);
        body.appendChild(main);
        el.appendChild(toolbar);
        el.appendChild(body);
        el.appendChild(statusbar);

        // --- collapse / reopen -------------------------------------
        function collapse() {
          sidebar.style.display = "none";
          resizer.style.display = "none";
          reopen.style.display = "flex";
        }
        function expand() {
          sidebar.style.display = "";
          resizer.style.display = "";
          reopen.style.display = "none";
        }
        reopen.addEventListener("click", expand);

        // --- sidebar resize ------------------------------------------
        resizer.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = sidebar.getBoundingClientRect().width;
          const onMove = (ev) => {
            const w = Math.max(150, Math.min(700, startWidth + ev.clientX - startX));
            sidebar.style.flex = `0 0 ${w}px`;
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
          };
          document.body.style.cursor = "col-resize";
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        });

        // --- filter dialog -----------------------------------------
        // Apply validates the expression by running it as a count; a bad
        // expression rejects and the dialog stays open with the error.
        const filterDialog = createFilterDialog(el, {
          getExpr: () => store.get().filterExpr,
          onApply: (expr) => {
            if (!engine) return Promise.resolve();
            return engine.count(whereFromExpr(expr)).then(() => {
              store.set({ filterExpr: expr });
            });
          },
          onClear: () => store.set({ filterExpr: "" }),
        });

        // Append a per-column clause to the active filter, AND-combined.
        function appendFilter(clause) {
          const cur = (store.get().filterExpr || "").trim();
          // Parenthesize only a compound clause (the builders join with " and ").
          const c = clause.includes(" and ") ? `(${clause})` : clause;
          const next = cur ? `${cur} and ${c}` : c;
          return engine.count(whereFromExpr(next)).then(() => {
            store.set({ filterExpr: next });
          });
        }

        const addFilterDialog = createAddFilterDialog(el, {
          getDistinct: (name) => engine.distinct(name),
          onApply: appendFilter,
        });

        // SAS-style "Show code": a snapshot of the dplyr pipeline for the
        // current view (data name captured from the R symbol).
        const showCodeDialog = createShowCodeDialog(el, {
          getCode: () => dplyrCode(store.get(), x.data_name),
        });

        // --- shell pieces ------------------------------------------
        const scrollApi = {};
        const gridApi = {};
        let currentRowCount = x.n_rows;
        const tb = createToolbar(toolbar, store, {
          rowCount: x.n_rows,
          scrollApi,
          onOpenFilter: () => filterDialog.open(),
          onClearFilter: () => store.set({ filterExpr: "" }),
          onExport: () => {
            if (engine) exportCsv({ engine, store, rowCount: currentRowCount });
          },
          onPrint: () => window.print(),
          onShowCode: () => showCodeDialog.open(),
        });
        createColumnsPanel(colsPanel, store, { onCollapse: collapse });
        createPropertyPanel(propPanel, store);
        wireShiny(el, store);

        function copyText(text) {
          if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        }

        function copyColumn(colMeta) {
          if (!engine) return;
          const state = store.get();
          const where = whereFromExpr(state.filterExpr);
          const order = orderFromSort(state.sort);
          engine
            .column(colMeta.name, { where, order })
            .then((vals) => {
              copyText(vals.map((v) => (v == null ? "" : String(v))).join("\n"));
            })
            .catch(() => {});
        }

        function cellMenu({ value, rowVals, isMarker }, bounds) {
          // Copy Row only from the row number; Copy (value) only from a cell.
          const items = isMarker
            ? [
                {
                  label: "Copy Row",
                  shortcut: "⌘C",
                  onClick: () => copyText((rowVals || []).join("\t")),
                },
              ]
            : [
                {
                  label: "Copy",
                  shortcut: "⌘C",
                  onClick: () => copyText(value),
                },
              ];
          showContextMenu(bounds.x, bounds.y + bounds.height, items);
        }

        function headerMenu(colMeta, bounds) {
          showContextMenu(bounds.x, bounds.y + bounds.height, [
            {
              label: "Copy Column",
              shortcut: "⌘C",
              onClick: () => copyColumn(colMeta),
            },
            { separator: true },
            {
              label: "Sort Ascending",
              onClick: () => store.set({ sort: [{ name: colMeta.name, dir: "asc" }] }),
            },
            {
              label: "Sort Descending",
              onClick: () => store.set({ sort: [{ name: colMeta.name, dir: "desc" }] }),
            },
            { separator: true },
            {
              label: "Add Filter",
              onClick: () => addFilterDialog.open(colMeta),
            },
            { separator: true },
            {
              label: "Size grid columns to content",
              onClick: () => gridApi.sizeToContent && gridApi.sizeToContent(),
            },
            {
              label: "Restore original column widths",
              onClick: () => gridApi.restoreWidths && gridApi.restoreWidths(),
            },
          ]);
        }

        // --- engine + grid -----------------------------------------
        const bytes = b64ToBytes(x.parquet);
        createEngine()
          .then((eng) => {
            engine = eng;
            return eng.load(bytes);
          })
          .then((info) => {
            gridEl.textContent = "";
            currentRowCount = info.rowCount;
            // Enrich columns with the precise Arrow kind so the per-column
            // Add Filter dialog can choose the right editor.
            store.set((s) => ({
              ...s,
              columns: s.columns.map((c) => {
                const ec = info.columns.find((x) => x.name === c.name);
                return ec ? { ...c, kind: ec.kind } : c;
              }),
            }));
            grid = createGrid(gridEl, {
              engine,
              store,
              initialRowCount: info.rowCount,
              onRange: (start, end) => tb.setRange(start, end),
              scrollApi,
              gridApi,
              onHeaderMenu: headerMenu,
              onCellMenu: cellMenu,
              onCount: (n) => {
                currentRowCount = n;
                setSummary(n);
                tb.setCount(n);
              },
            });
          })
          .catch((err) => {
            gridEl.textContent = "Failed to load data: " + String(err);
          });
      },

      resize: function () {
        // Glide observes its container and reflows on its own.
      },
    };
  },
});
