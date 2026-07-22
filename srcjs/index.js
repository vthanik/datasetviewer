// datasetviewer htmlwidget entry point. Composes the SAS Studio-style shell
// (toolbar + columns panel + property panel + grid) around the DuckDB-WASM
// engine, wired through a single state store.

/* global HTMLWidgets */

import "./styles.css";
import { createStore, initialState, headerText } from "./state.js";
import { createEngine } from "./engine/engine_duckdb.js";
import { b64ToBytes } from "./parquet_decode.js";
import { whereFromExpr, orderFromSort } from "./sql.js";
import { replaceColumnClause } from "./filter_expr.js";
import {
  shiftClickSort,
  setColumnSort,
  removeColumnSort,
  plainClickSort,
} from "./sort.js";
import { validateFilterTypes } from "./filter_validate.js";
import { createGrid } from "./shell/grid_view.js";
import { createToolbar } from "./shell/toolbar.js";
import { createColumnsPanel } from "./shell/columns_panel.js";
import { createPropertyPanel } from "./shell/property_panel.js";
import { createFilterDialog } from "./shell/filter_dialog.js";
import { createAddFilterDialog } from "./shell/add_filter_dialog.js";
import { createShowCodeDialog } from "./shell/show_code_dialog.js";
import { dplyrCode } from "./codegen.js";
import { showContextMenu } from "./shell/context_menu.js";
import { showStatsCard } from "./shell/column_stats.js";
import { exportCsv } from "./shell/export.js";
import { wireShiny } from "./shiny.js";
import { ICONS, MENU_ICONS } from "./shell/icons.js";
import { div } from "./shell/dom.js";

HTMLWidgets.widget({
  name: "datasetviewer",
  type: "output",

  factory: function (el) {
    el.classList.add("datasetviewer-root");
    let grid = null;
    let engine = null;
    // The column currently in the plain-click "neutral" step (selected, not yet
    // sorted). Any non-plain sort path (Shift-click, the right-click menu) clears
    // it so the next plain click starts the cycle fresh.
    let neutralCol = null;

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

        // Commit a sort that does NOT come from a plain click (Shift-click or
        // the right-click menu); these clear the plain-click neutral step.
        const setSort = (next) => {
          neutralCol = null;
          store.set({ sort: next });
        };

        // The plain-click "neutral" step is only meaningful in the context it
        // was entered: a filter or view change invalidates it, so reset it then
        // (a later plain click on that column should start the cycle fresh).
        let prevFilter = store.get().filterExpr;
        let prevView = store.get().view;
        store.subscribe((s) => {
          if (s.filterExpr !== prevFilter || s.view !== prevView) neutralCol = null;
          prevFilter = s.filterExpr;
          prevView = s.view;
        });

        // Column name -> kind, for strict type validation of filter values.
        const kindMap = () => {
          const m = {};
          store.get().columns.forEach((c) => {
            m[c.name] = c.kind || (c.type === "Num" ? "number" : "string");
          });
          return m;
        };

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
            // Strict type check first -- fail fast before the query runs.
            try {
              validateFilterTypes(expr, kindMap());
            } catch (e) {
              return Promise.reject(e);
            }
            return engine.count(whereFromExpr(expr)).then(() => {
              store.set({ filterExpr: expr });
            });
          },
          onClear: () => store.set({ filterExpr: "" }),
        });

        // Apply a per-column clause to the active filter. Re-applying a column
        // REPLACES its existing clause (so the dialog never produces a
        // contradictory `col in (...) and col = ...`); clauses for other
        // columns are kept and AND-combined.
        function applyColumnFilter(colName, clause) {
          const cur = (store.get().filterExpr || "").trim();
          // Parenthesize only a compound clause (the builders join with " and ").
          const c = clause.includes(" and ") ? `(${clause})` : clause;
          const next = replaceColumnClause(cur, colName, c);
          try {
            validateFilterTypes(next, kindMap());
          } catch (e) {
            return Promise.reject(e);
          }
          return engine.count(whereFromExpr(next)).then(() => {
            store.set({ filterExpr: next });
          });
        }

        const addFilterDialog = createAddFilterDialog(el, {
          getDistinct: (name) => engine.distinct(name),
          onApply: applyColumnFilter,
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
          onShowCode: () => showCodeDialog.open(),
        });
        createColumnsPanel(colsPanel, store, { onCollapse: collapse });
        const getStats = (name) =>
          engine ? engine.columnStats(name) : Promise.reject(new Error("loading"));
        createPropertyPanel(propPanel, store, { getStats });
        wireShiny(el, store);

        function copyText(text) {
          if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        }

        function copyColumn(colMeta) {
          if (!engine) return;
          const state = store.get();
          const header = headerText(colMeta, state.view);
          const where = whereFromExpr(state.filterExpr);
          const order = orderFromSort(state.sort);
          engine
            .column(colMeta.name, { where, order })
            .then((vals) => {
              const body = vals.map((v) => (v == null ? "" : String(v))).join("\n");
              copyText(header + "\n" + body);
            })
            .catch(() => {});
        }

        function copyHeader(colMeta) {
          copyText(headerText(colMeta, store.get().view));
        }

        function cellMenu({ value, rowVals, isMarker, rawRow, pinnedIndex }, bounds) {
          // Copy Row only from the row number; Copy (value) only from a cell.
          const items = isMarker
            ? [
                {
                  label: "Copy Row",
                  icon: MENU_ICONS.copy,
                  onClick: () => copyText((rowVals || []).join("\t")),
                },
                { separator: true },
                pinnedIndex >= 0
                  ? {
                      label: "Unpin Row",
                      icon: MENU_ICONS.pin,
                      onClick: () =>
                        store.set((s) => ({
                          ...s,
                          pinnedRows: s.pinnedRows.filter((_, i) => i !== pinnedIndex),
                        })),
                    }
                  : {
                      label: "Pin Row",
                      icon: MENU_ICONS.pin,
                      disabled: !rawRow,
                      onClick: () =>
                        store.set((s) => ({
                          ...s,
                          pinnedRows: [...(s.pinnedRows || []), rawRow],
                        })),
                    },
              ]
            : [
                {
                  label: "Copy",
                  icon: MENU_ICONS.copy,
                  onClick: () => copyText(value),
                },
              ];
          showContextMenu(bounds.x, bounds.y + bounds.height, items);
        }

        function headerMenu(colMeta, bounds) {
          // Sort actions are per-column: Sort Asc/Desc add (or re-aim) this
          // column within the current multi-sort; Clear Sorting removes only it.
          const colSorted = (store.get().sort || []).some(
            (s) => s.name === colMeta.name
          );
          showContextMenu(bounds.x, bounds.y + bounds.height, [
            {
              label: "Copy Column",
              icon: MENU_ICONS.copy,
              onClick: () => copyColumn(colMeta),
            },
            {
              label: "Copy Header",
              icon: MENU_ICONS.copy,
              onClick: () => copyHeader(colMeta),
            },
            { separator: true },
            (store.get().pinnedCols || []).includes(colMeta.name)
              ? {
                  label: "Unpin Column",
                  icon: MENU_ICONS.pin,
                  onClick: () =>
                    store.set((s) => ({
                      ...s,
                      pinnedCols: s.pinnedCols.filter((n) => n !== colMeta.name),
                    })),
                }
              : {
                  label: "Pin Column",
                  icon: MENU_ICONS.pin,
                  onClick: () =>
                    store.set((s) => ({
                      ...s,
                      pinnedCols: [...(s.pinnedCols || []), colMeta.name],
                    })),
                },
            { separator: true },
            {
              label: "Sort Ascending",
              icon: MENU_ICONS.sortAsc,
              onClick: () => setSort(setColumnSort(store.get().sort, colMeta.name, "asc")),
            },
            {
              label: "Sort Descending",
              icon: MENU_ICONS.sortDesc,
              onClick: () => setSort(setColumnSort(store.get().sort, colMeta.name, "desc")),
            },
            {
              label: "Clear Sorting",
              icon: MENU_ICONS.clearSort,
              disabled: !colSorted,
              onClick: () => setSort(removeColumnSort(store.get().sort, colMeta.name)),
            },
            { separator: true },
            {
              label: "Add Filter",
              icon: ICONS.filter,
              onClick: () => addFilterDialog.open(colMeta),
            },
            {
              label: "Column details",
              icon: MENU_ICONS.info,
              onClick: () => showStatsCard(bounds, colMeta, getStats(colMeta.name)),
            },
            { separator: true },
            {
              label: "Size grid columns to content",
              icon: MENU_ICONS.sizeToContent,
              onClick: () => gridApi.sizeToContent && gridApi.sizeToContent(),
            },
            {
              label: "Restore original column widths",
              icon: MENU_ICONS.restoreWidths,
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
              onSort: (name, additive) => {
                if (additive) {
                  setSort(shiftClickSort(store.get().sort, name));
                  return;
                }
                const r = plainClickSort(store.get().sort, neutralCol, name);
                neutralCol = r.neutral;
                store.set({ sort: r.sort });
              },
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
