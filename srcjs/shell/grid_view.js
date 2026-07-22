// Glide Data Grid host, backed by the async engine and driven by the store.
// Renders only the selected columns under the current view mode, applies the
// current filter expression and sort as SQL, and serves cells from a row-window
// cache. When the filter or sort changes the cache is cleared, the row count
// recomputed, and the visible window refetched. Scroll cost stays independent
// of dataset size.
//
// Pinned rows follow Positron's data explorer: a frozen strip at the TOP that
// never scrolls vertically, keeping the row number the row had when pinned.
// Positron does this inside its own DOM grid by giving pinned rows a
// scroll-invariant `top`; Glide owns its canvas render loop, so the strip is
// a SECOND, non-scrolling DataEditor that also owns the column header, while
// the body DataEditor below renders headerless pure data. The two stay
// pixel-aligned horizontally by mirroring the body scroller's scrollLeft onto
// the strip's scroller. Unlike Positron (which drops pins on sort/filter
// because its pins are row-index references that go stale), pins here are
// value snapshots, so they stay valid and stay pinned through sort/filter.

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
// headerText(), so Copy Column and the property panel are unaffected.
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
const MARKER_W = 60; // body row-marker gutter; the strip's number column matches

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
  const ref = useRef(null); // body DataEditor
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
  // Width the body's VERTICAL scrollbar consumes (0 with overlay scrollbars,
  // ~15px with classic ones). The strip has no vertical scrollbar, so its
  // width shrinks by this amount to keep both max horizontal scrolls equal --
  // otherwise the strip pegs short of the body when scrolled fully right.
  const [vScrollbarW, setVScrollbarW] = useState(0);

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

  // Pinned snapshots: [{ values, num }] -- the full row's values (by
  // origIndex) plus the row number it displayed when pinned.
  const pinned = snap.pinnedRows || [];
  const stripHeight = HEADER_H + pinned.length * ROW_H;

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
      visibleRef.current.forEach((c) => {
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

  // The strip prepends a number "gutter" column sized like the body's row
  // markers, so the data columns of both grids line up exactly.
  const stripColumns = useMemo(
    () => [{ title: "", id: "__dv_pin_gutter__", width: MARKER_W }, ...gridColumns],
    [gridColumns]
  );

  const onColumnResize = useCallback((column, newSize) => {
    if (column.id === "__dv_pin_gutter__") return;
    setColWidths((w) => ({ ...w, [column.id]: newSize }));
  }, []);

  // Positron-style pin indicator for columns: a thin accent line along the
  // top edge of the pinned header. Strip column 0 is the number gutter, so
  // pinned data columns are strip columns 1..frozenCount.
  const drawHeader = useCallback(
    (args, drawContent) => {
      drawContent();
      if (args.columnIndex >= 1 && args.columnIndex <= frozenCount) {
        args.ctx.fillStyle = "#0378cd";
        args.ctx.fillRect(args.rect.x, args.rect.y, args.rect.width, 2);
      }
    },
    [frozenCount]
  );

  // Positron-style pin indicator for rows: an accent bar at the left edge of
  // the number gutter, drawn on the strip's canvas.
  const drawStripCell = useCallback((args, drawContent) => {
    drawContent();
    if (args.col === 0) {
      args.ctx.fillStyle = "#0378cd";
      args.ctx.fillRect(args.rect.x, args.rect.y, 3, args.rect.height);
    }
  }, []);

  // Pinning reorders columns, so a selection made before the pin could
  // highlight the wrong place after it -- and a lingering column highlight
  // would read as part of the pin indicator. Drop it; the thin accent marks
  // are the only pin signal.
  useEffect(() => {
    setHlName(null);
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
  }, [pinned.length, snap.pinnedCols]);

  const getCellContent = useCallback(
    (cell) => {
      const [col, row] = cell;
      const meta = visible[col];
      const cached = cache.current.get(row);
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
    [visible]
  );

  // Strip cells: column 0 shows the row number captured at pin time (the
  // Positron behaviour -- row 8 pinned still reads "8"); the rest read the
  // snapshot values by origIndex.
  const getStripCellContent = useCallback(
    (cell) => {
      const [col, row] = cell;
      const pin = pinned[row];
      if (!pin) return { kind: GridCellKind.Loading, allowOverlay: false };
      if (col === 0) {
        return {
          kind: GridCellKind.Text,
          data: String(pin.num),
          displayData: String(pin.num),
          allowOverlay: false,
          contentAlign: "center",
          themeOverride: { textDark: "#768396" },
        };
      }
      const meta = visible[col - 1];
      const raw = pin.values[meta.origIndex];
      const text = cellText(raw);
      return {
        kind: GridCellKind.Text,
        data: text,
        displayData: text,
        allowOverlay: false,
        contentAlign: meta.type === "Num" ? "right" : "left",
        ...(isMissing(raw) ? { themeOverride: { textDark: "#9097a0" } } : {}),
      };
    },
    [pinned, visible]
  );

  const onVisibleRegionChanged = useCallback(
    (range) => {
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

  // Header interactions live on the STRIP (it owns the header row). Strip
  // column 0 is the number gutter; data columns are shifted by one.
  const onHeaderContextMenu = useCallback(
    (colIndex, event) => {
      if (event.preventDefault) event.preventDefault();
      const meta = visible[colIndex - 1];
      if (!meta) return;
      // Highlight the whole column (by name; see hlName).
      setHlName(meta.name);
      setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
      if (onHeaderMenu) onHeaderMenu(meta, event.bounds);
    },
    [visible, onHeaderMenu]
  );

  const onHeaderClicked = useCallback(
    (colIndex, event) => {
      // Ignore the number gutter; suppress Glide's own header selection so a
      // Shift-click only extends the sort, not a column range highlight. Then
      // highlight just the clicked column so the plain-click "neutral" step
      // reads as selected (highlighted) even before any sort arrow appears.
      const meta = visible[colIndex - 1];
      if (!meta) return;
      if (event && event.preventDefault) event.preventDefault();
      setHlName(meta.name);
      setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() });
      if (onSort) onSort(meta.name, !!(event && event.shiftKey));
    },
    [visible, onSort]
  );

  // Body context menu: markers offer Copy Row / Pin Row (with the displayed
  // row number captured for the pin), cells offer Copy.
  const onCellContextMenu = useCallback(
    (cell, event) => {
      if (event.preventDefault) event.preventDefault();
      const [col, row] = cell;
      const cached = cache.current.get(row);
      if (col < 0) {
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
              rawRowNum: row + 1,
              pinnedIndex: -1,
            },
            event.bounds
          );
      } else {
        const value = cached ? cellText(cached[visible[col].origIndex]) : "";
        if (onCellMenu) onCellMenu({ value, isMarker: false }, event.bounds);
      }
    },
    [visible, onCellMenu]
  );

  // Strip context menu: any pinned cell offers the row menu with Unpin (the
  // gutter acts as the marker); data cells also offer Copy.
  const onStripCellContextMenu = useCallback(
    (cell, event) => {
      if (event.preventDefault) event.preventDefault();
      const [col, row] = cell;
      const pin = pinned[row];
      if (!pin) return;
      if (col <= 0) {
        const rowVals = visible.map((m) => cellText(pin.values[m.origIndex]));
        if (onCellMenu)
          onCellMenu(
            { rowVals, isMarker: true, rawRow: pin.values, pinnedIndex: row },
            event.bounds
          );
      } else {
        const value = cellText(pin.values[visible[col - 1].origIndex]);
        if (onCellMenu) onCellMenu({ value, isMarker: false }, event.bounds);
      }
    },
    [pinned, visible, onCellMenu]
  );

  // Mirror the body's horizontal scroll onto the strip so the two canvases
  // stay pixel-aligned. Reconciled every animation frame rather than on
  // scroll events: momentum scrolling fires events faster than a listener
  // chain re-renders, so an event-driven mirror visibly lags (and a missed
  // final event would leave the strip stuck misaligned). The per-frame
  // comparison is one property read when nothing changed.
  useEffect(() => {
    let raf = 0;
    let lastSbw = -1;
    const tick = () => {
      const scrollers = wrapRef.current?.querySelectorAll(".dvn-scroller");
      if (scrollers && scrollers.length >= 2) {
        const strip = scrollers[0];
        const body = scrollers[1];
        // Classic scrollbars shrink the body's client area; mirror that onto
        // the strip's width (state change only when the measure changes).
        const sbw = body.offsetWidth - body.clientWidth;
        if (sbw !== lastSbw) {
          lastSbw = sbw;
          setVScrollbarW(sbw);
        }
        if (strip.scrollLeft !== body.scrollLeft) strip.scrollLeft = body.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // When the rows do not fill the viewport, size the grid to its content so the
  // area below the last row is blank (no trailing empty grid lines), matching
  // SAS Studio. When they overflow, fill the container and scroll. Only reserve
  // room for the horizontal scrollbar when the columns actually overflow.
  const totalColsWidth =
    visible.reduce((s, c) => s + (colWidths[c.name] || COL_WIDTH), 0) + MARKER_W;
  const hOverflow = totalColsWidth > size.width;
  const contentHeight =
    stripHeight + rowCount * ROW_H + (hOverflow ? HSCROLL_PAD : 0);
  const gridHeight = Math.min(size.height, contentHeight);
  const bodyHeight = Math.max(0, gridHeight - stripHeight);

  // Derive the column highlight from the tracked name so it follows the column
  // across hide/show; fall back to Glide's own column selection when none.
  const hlIdx = hlName ? visible.findIndex((c) => c.name === hlName) : -1;
  const gridSelection =
    hlIdx >= 0
      ? { ...selection, columns: CompactSelection.fromSingleSelection(hlIdx) }
      : selection;
  // The strip mirrors the column highlight (shifted past its gutter) so the
  // header -- which lives on the strip -- shows the selected state.
  const stripSelection = {
    rows: CompactSelection.empty(),
    columns:
      hlIdx >= 0 ? CompactSelection.fromSingleSelection(hlIdx + 1) : CompactSelection.empty(),
  };

  const ready = size.width > 0 && size.height > 0;

  // Non-scrolling strip: column header + pinned rows, frozen by construction
  // (its height exactly fits its rows, so it has nothing to scroll).
  const strip = ready
    ? React.createElement(DataEditor, {
        theme: GRID_THEME,
        columns: stripColumns,
        freezeColumns: 1 + frozenCount,
        rows: pinned.length,
        getCellContent: getStripCellContent,
        drawHeader,
        drawCell: drawStripCell,
        onHeaderClicked,
        onHeaderContextMenu,
        onCellContextMenu: onStripCellContextMenu,
        onColumnResize,
        rowMarkers: "none",
        rowHeight: ROW_H,
        headerHeight: HEADER_H,
        gridSelection: stripSelection,
        onGridSelectionChange: () => {},
        smoothScrollX: true,
        width: Math.max(0, size.width - vScrollbarW),
        height: stripHeight,
      })
    : null;

  // Headerless body: pure data rows, the single vertical scroll owner.
  const editor = ready
    ? React.createElement(DataEditor, {
        ref,
        theme: GRID_THEME,
        columns: gridColumns,
        freezeColumns: frozenCount,
        rows: rowCount,
        getCellContent,
        onVisibleRegionChanged,
        onCellContextMenu,
        rowMarkers: "clickable-number", // row numbers; click one to select the row
        rowMarkerWidth: MARKER_W,
        rowHeight: ROW_H,
        headerHeight: 0,
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
        height: bodyHeight,
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
      React.createElement(
        "div",
        {
          className:
            "dv-pin-strip" + (pinned.length ? " dv-pin-strip-active" : ""),
          style: { height: `${stripHeight}px` },
        },
        strip
      ),
      editor
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
