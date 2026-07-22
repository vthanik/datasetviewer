// Glide Data Grid host, backed by the async engine and driven by the store.
// Renders only the selected columns under the current view mode, applies the
// current filter expression and sort as SQL, and serves cells from a row-window
// cache. When the filter or sort changes the cache is cleared, the row count
// recomputed, and the visible window refetched. Scroll cost stays independent
// of dataset size.

import React from "react";
import { createRoot } from "react-dom/client";
import {
  DataEditor,
  GridCellKind,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";

import { cellText, isMissing, NA_TEXT } from "../grid_cells.js";
import { headerText, presentedColumns } from "../state.js";
import { whereFromExpr, orderFromSort } from "../sql.js";

const { useRef, useState, useEffect, useCallback, useMemo } = React;

// Header label with its sort indicator (direction arrow + 1-based priority)
// appended, e.g. "AGE ↑1". The single source for the caret -- both the grid
// column titles and the size-to-content width measure use it, so the displayed
// header and the width it is sized to can never drift. The caret stays out of
// headerText(), so Copy Header and the property panel are unaffected.
function titleWithSort(c, sort, view) {
  const p = (sort || []).findIndex((s) => s.name === c.name);
  const caret = p === -1 ? "" : ` ${sort[p].dir === "desc" ? "↓" : "↑"}${p + 1}`;
  return headerText(c, view) + caret;
}

const COL_WIDTH = 140;
const PREFETCH = 50;
const FIRST_PAGE = 120;
const ROW_H = 29;
const HEADER_H = 34;
const HSCROLL_PAD = 18; // leave room for the horizontal scrollbar

// Canvas theme matching the shell stylesheet: the clean SAS Studio interface.
// Colours read from the live SAS Studio UI (DevTools/CDP): accent #0378cd, text
// #2b3138, hairline #e9ecef, selection ~#cbecff. The font is the neutral system
// stack (NOT SAS's commercial AvenirNext, which we cannot redistribute) -- clean
// on every OS, zero CRAN risk. Keep these hexes in sync with styles.css.
const GRID_THEME = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  baseFontStyle: "13px",
  headerFontStyle: "600 13px",
  accentColor: "#0378cd",
  accentLight: "rgba(3, 120, 205, 0.16)",
  textDark: "#2b3138",
  textMedium: "#5e6a7b",
  textLight: "#768396",
  textHeader: "#2b3138",
  bgCell: "#ffffff",
  bgCellMedium: "#ffffff",
  bgHeader: "#ffffff",
  bgHeaderHovered: "#eef1f4",
  bgHeaderHasFocus: "#eef1f4",
  bgBubble: "#ffffff",
  borderColor: "#eef1f4",
  horizontalBorderColor: "#f0f2f5",
  drilldownBorder: "#e9ecef",
  linkColor: "#0378cd",
  bgIconHeader: "#5e6a7b",
  fgIconHeader: "#f6f8fa",
  textHeaderSelected: "#ffffff",
  cellHorizontalPadding: 10,
};

function ensurePortal() {
  if (!document.getElementById("datasetviewer-portal")) {
    const portal = document.createElement("div");
    portal.id = "datasetviewer-portal";
    document.body.appendChild(portal);
  }
}

function Grid({
  engine,
  store,
  initialRowCount,
  onRange,
  scrollApi,
  gridApi,
  onHeaderMenu,
  onSort,
  onCellMenu,
  onCount,
}) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const cache = useRef(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [snap, setSnap] = useState(store.get());
  const [rowCount, setRowCount] = useState(initialRowCount);
  const [colWidths, setColWidths] = useState({}); // name -> px
  const [selection, setSelection] = useState({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });
  // The header-highlighted column is tracked by NAME, not by a positional
  // index: hiding/showing columns reindexes `visible`, so an index would point
  // at the wrong column. The Glide column selection is derived from this name.
  const [hlName, setHlName] = useState(null);

  useEffect(() => store.subscribe(setSnap), [store]);

  const where = useMemo(() => whereFromExpr(snap.filterExpr), [snap.filterExpr]);
  const order = useMemo(() => orderFromSort(snap.sort), [snap.sort]);

  const clausesRef = useRef({ where, order });
  clausesRef.current = { where, order };

  const visible = useMemo(
    () => presentedColumns(snap.columns, snap.pinnedCols || []),
    [snap.columns, snap.pinnedCols]
  );

  // Frozen = pinned AND currently shown (hidden pinned columns do not count).
  const frozenCount = useMemo(
    () => (snap.pinnedCols || []).filter((n) => visible.some((c) => c.name === n)).length,
    [snap.pinnedCols, visible]
  );

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Pinned snapshots render as the LAST k grid rows, natively frozen at the
  // bottom via freezeTrailingRows (Glide has no top-row freeze), so they stay
  // visible while scrolling. Data rows keep their plain 0..rowCount-1 indices.
  const pinned = snap.pinnedRows || [];

  const fetchWindow = useCallback(
    (offset, limit) => {
      const { where: w, order: o } = clausesRef.current;
      engine
        .query({ offset, limit, where: w, order: o })
        .then((rows) => {
          rows.forEach((rowArr, i) => cache.current.set(offset + i, rowArr));
          const cols = visibleRef.current.length;
          const damage = [];
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < cols; c++) damage.push({ cell: [c, offset + r] });
          }
          ref.current?.updateCells(damage);
        })
        .catch(() => {});
    },
    [engine]
  );

  // Row count depends only on the filter (WHERE); sorting cannot change it, so
  // this is keyed on `where` alone -- a sort no longer triggers a full re-count.
  useEffect(() => {
    let cancelled = false;
    engine
      .count(where)
      .then((n) => {
        if (cancelled) return;
        setRowCount(n);
        if (onCount) onCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [where, engine]);

  // Filter OR sort change: invalidate the cache, jump to the top ROW (vertical
  // only -- keep the horizontal scroll so sorting a far-right column does not
  // yank the view back to the first column), and refetch the first page.
  useEffect(() => {
    cache.current.clear();
    ref.current?.scrollTo(0, 0, "vertical");
    fetchWindow(0, FIRST_PAGE);
  }, [where, order, engine, fetchWindow]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollApi) return undefined;
    scrollApi.scrollToRow = (row) => ref.current?.scrollTo(0, row, "vertical");
    return () => {
      scrollApi.scrollToRow = undefined;
    };
  });

  // Column-width controls used by the header context menu.
  useEffect(() => {
    if (!gridApi) return undefined;
    gridApi.sizeToContent = () => {
      const widths = {};
      const sort = store.get().sort;
      const view = store.get().view;
      visibleRef.current.forEach((c, ci) => {
        // Measure the header WITH its sort indicator, or the column sizes too
        // narrow and the arrow + priority get clipped.
        let max = titleWithSort(c, sort, view).length;
        cache.current.forEach((row) => {
          const v = row[c.origIndex];
          // Missing cells display the NA token, so measure its width, not 0.
          const len = isMissing(v) ? NA_TEXT.length : String(v).length;
          if (len > max) max = len;
        });
        widths[c.name] = Math.min(420, Math.max(60, max * 8 + 28));
      });
      setColWidths((w) => ({ ...w, ...widths }));
    };
    gridApi.restoreWidths = () => setColWidths({});
    return undefined;
  });

  const gridColumns = useMemo(
    () =>
      visible.map((c) => ({
        title: titleWithSort(c, snap.sort, snap.view),
        id: c.name,
        width: colWidths[c.name] || COL_WIDTH,
      })),
    [visible, snap.view, snap.sort, colWidths]
  );

  const onColumnResize = useCallback((column, newSize) => {
    setColWidths((w) => ({ ...w, [column.id]: newSize }));
  }, []);

  // Positron-style pin indicator for columns: a thin accent line along the
  // top edge of the pinned header (rows get a DOM bar over the marker gutter
  // instead -- drawCell never sees Glide's internal marker column).
  const drawHeader = useCallback(
    (args, drawContent) => {
      drawContent();
      if (args.columnIndex >= 0 && args.columnIndex < frozenCount) {
        args.ctx.fillStyle = "#0378cd";
        args.ctx.fillRect(args.rect.x, args.rect.y, args.rect.width, 2);
      }
    },
    [frozenCount]
  );

  // Pinning shifts the trailing grid rows (and reorders columns), so a
  // selection made before the pin could highlight the wrong place after it --
  // and a lingering column highlight would read as part of the pin indicator.
  // Drop both; the thin accent marks are the only pin signal.
  useEffect(() => {
    setHlName(null);
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
  }, [pinned.length, snap.pinnedCols]);

  const getCellContent = useCallback(
    (cell) => {
      const [col, row] = cell;
      const meta = visible[col];
      // Trailing rows are the pinned snapshots; everything else is data.
      const cached =
        row >= rowCount ? pinned[row - rowCount] : cache.current.get(row);
      if (cached === undefined) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }
      const raw = cached[meta.origIndex];
      const text = cellText(raw);
      return {
        kind: GridCellKind.Text,
        data: text,
        displayData: text,
        allowOverlay: false,
        contentAlign: meta.type === "Num" ? "right" : "left",
        // Render the NA token muted so missing reads as absence, not data.
        ...(isMissing(raw) ? { themeOverride: { textDark: "#9097a0" } } : {}),
      };
    },
    [visible, pinned, rowCount]
  );

  const onVisibleRegionChanged = useCallback(
    (range) => {
      // The visible range never includes the frozen trailing block, and data
      // rows keep plain indices, so no offset math is needed here.
      if (onRange) onRange(range.y, Math.min(rowCount, range.y + range.height));
      const start = Math.max(0, range.y - PREFETCH);
      const end = Math.min(rowCount, range.y + range.height + PREFETCH);
      let first = -1;
      let last = -1;
      for (let r = start; r < end; r++) {
        if (!cache.current.has(r)) {
          if (first === -1) first = r;
          last = r;
        }
      }
      if (first === -1) return;
      fetchWindow(first, last - first + 1);
    },
    [rowCount, onRange, fetchWindow]
  );

  const onHeaderContextMenu = useCallback(
    (colIndex, event) => {
      if (event.preventDefault) event.preventDefault();
      // Highlight the whole column (by name; see hlName).
      setHlName(visible[colIndex].name);
      setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
      if (onHeaderMenu) onHeaderMenu(visible[colIndex], event.bounds);
    },
    [visible, onHeaderMenu]
  );

  const onHeaderClicked = useCallback(
    (colIndex, event) => {
      // Ignore the row-marker gutter; suppress Glide's own header selection so a
      // Shift-click only extends the sort, not a column range highlight. Then
      // highlight just the clicked column so the plain-click "neutral" step
      // reads as selected (highlighted) even before any sort arrow appears.
      if (colIndex < 0 || !visible[colIndex]) return;
      if (event && event.preventDefault) event.preventDefault();
      setHlName(visible[colIndex].name);
      setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
      if (onSort) onSort(visible[colIndex].name, !!(event && event.shiftKey));
    },
    [visible, onSort]
  );

  const onCellContextMenu = useCallback(
    (cell, event) => {
      if (event.preventDefault) event.preventDefault();
      const [col, row] = cell;
      const pins = snap.pinnedRows || [];
      const cached = row >= rowCount ? pins[row - rowCount] : cache.current.get(row);
      if (col < 0) {
        // Row number (marker): highlight the whole row, offer Copy Row / Pin Row.
        setHlName(null);
        setSelection({
          rows: CompactSelection.fromSingleSelection(row),
          columns: CompactSelection.empty(),
        });
        const rowVals = cached
          ? visible.map((m) => cellText(cached[m.origIndex]))
          : [];
        if (onCellMenu)
          onCellMenu(
            {
              rowVals,
              isMarker: true,
              rawRow: cached || null,
              pinnedIndex: row >= rowCount ? row - rowCount : -1,
            },
            event.bounds
          );
      } else {
        const value = cached ? cellText(cached[visible[col].origIndex]) : "";
        if (onCellMenu) onCellMenu({ value, isMarker: false }, event.bounds);
      }
    },
    [visible, onCellMenu, snap.pinnedRows, rowCount]
  );

  // When the rows do not fill the viewport, size the grid to its content so the
  // area below the last row is blank (no trailing empty grid lines), matching
  // SAS Studio. When they overflow, fill the container and scroll. Only reserve
  // room for the horizontal scrollbar when the columns actually overflow.
  const totalColsWidth =
    visible.reduce((s, c) => s + (colWidths[c.name] || COL_WIDTH), 0) + 60;
  const hOverflow = totalColsWidth > size.width;
  const contentHeight =
    HEADER_H + (rowCount + pinned.length) * ROW_H + (hOverflow ? HSCROLL_PAD : 0);
  const gridHeight = Math.min(size.height, contentHeight);

  // Derive the column highlight from the tracked name so it follows the column
  // across hide/show; fall back to Glide's own column selection when none.
  const hlIdx = hlName ? visible.findIndex((c) => c.name === hlName) : -1;
  const gridSelection =
    hlIdx >= 0
      ? { ...selection, columns: CompactSelection.fromSingleSelection(hlIdx) }
      : selection;

  const editor =
    size.width > 0 && size.height > 0
      ? React.createElement(DataEditor, {
          ref,
          theme: GRID_THEME,
          columns: gridColumns,
          freezeColumns: frozenCount,
          rows: rowCount + pinned.length,
          getCellContent,
          freezeTrailingRows: pinned.length,
          drawHeader,
          onVisibleRegionChanged,
          onHeaderClicked,
          onHeaderContextMenu,
          onCellContextMenu,
          onColumnResize,
          rowMarkers: "clickable-number", // row numbers; click one to select the row
          rowHeight: ROW_H,
          headerHeight: HEADER_H,
          gridSelection,
          onGridSelectionChange: (sel) => {
            // A body interaction (cell/row) drops the header highlight.
            setHlName(null);
            setSelection(sel);
          },
          rowSelect: "single", // one row at a time, no multi-select
          rowSelectionMode: "single",
          smoothScrollX: true,
          smoothScrollY: true,
          width: size.width,
          height: gridHeight,
        })
      : null;

  // Accent bar over the marker gutter of the frozen pinned block (before the
  // row numbers, Positron-style). When the grid fills the viewport the frozen
  // block touches the bottom edge; only when the content fits does it sit
  // above the strip we reserve for the horizontal scrollbar.
  // ponytail: assumes overlay scrollbars (macOS); classic scrollbars would
  // shift the fill case by their height -- measure the canvas if that bites.
  const pinBarBottom =
    gridHeight < contentHeight ? 0 : hOverflow ? HSCROLL_PAD : 0;
  const pinBar =
    pinned.length > 0
      ? React.createElement("div", {
          className: "dv-pin-bar",
          style: {
            height: `${pinned.length * ROW_H}px`,
            bottom: `${pinBarBottom}px`,
          },
        })
      : null;

  // Inner wrapper sized to the grid; its bottom border draws the rule under
  // the last row (Glide only draws separators between rows, not below the last).
  return React.createElement(
    "div",
    { ref: wrapRef, className: "datasetviewer-gridfill" },
    React.createElement(
      "div",
      { className: "dv-grid-inner", style: { height: `${gridHeight}px` } },
      editor,
      pinBar
    )
  );
}

export function createGrid(container, opts) {
  ensurePortal();
  const root = createRoot(container);
  root.render(React.createElement(Grid, opts));
  return {
    destroy() {
      root.unmount();
    },
  };
}
