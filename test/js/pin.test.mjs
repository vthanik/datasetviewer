// Tests for pinned-column presentation order. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { presentedColumns, initialState } from "../../srcjs/state.js";

const cols = [
  { name: "A", selected: true },
  { name: "B", selected: true },
  { name: "C", selected: true },
];

test("presentedColumns keeps original order with no pins", () => {
  assert.deepEqual(presentedColumns(cols, []).map((c) => c.name), ["A", "B", "C"]);
});

test("presentedColumns moves pinned first, in pin order", () => {
  assert.deepEqual(
    presentedColumns(cols, ["C", "A"]).map((c) => c.name),
    ["C", "A", "B"]
  );
});

test("presentedColumns drops unselected columns, pinned or not", () => {
  const mixed = [
    { name: "A", selected: false },
    { name: "B", selected: true },
  ];
  assert.deepEqual(presentedColumns(mixed, ["A"]).map((c) => c.name), ["B"]);
});

test("initialState starts with empty pin state", () => {
  const s = initialState({ columns: [{ name: "A", type: "Num" }] });
  assert.deepEqual(s.pinnedCols, []);
  assert.deepEqual(s.pinnedRows, []);
});
