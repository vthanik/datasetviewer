import { test } from "node:test";
import assert from "node:assert/strict";
import { columnSortOrder } from "../../srcjs/state.js";

const cols = [
  { name: "REGION", label: "Region", kind: "string" },
  { name: "AGE", label: "Age in years", kind: "number" },
  { name: "ID", label: "Subject Id", kind: "string" },
  { name: "VISIT", label: "Visit date", kind: "date" },
];

test("original mode returns the identity order", () => {
  assert.deepEqual(columnSortOrder(cols, "original", "names"), [0, 1, 2, 3]);
  assert.deepEqual(columnSortOrder(cols, undefined, "names"), [0, 1, 2, 3]);
});

test("name ascending / descending sort by the shown name", () => {
  // names: AGE, ID, REGION, VISIT
  assert.deepEqual(columnSortOrder(cols, "name-asc", "names"), [1, 2, 0, 3]);
  assert.deepEqual(columnSortOrder(cols, "name-desc", "names"), [3, 0, 2, 1]);
});

test("name sort under labels view uses the label, not the name", () => {
  // labels: Age in years, Region, Subject Id, Visit date
  assert.deepEqual(columnSortOrder(cols, "name-asc", "labels"), [1, 0, 2, 3]);
});

test("type sort groups char < num < date, name as tiebreaker", () => {
  // type-asc: strings (ID, REGION by name), then number (AGE), then date (VISIT)
  assert.deepEqual(columnSortOrder(cols, "type-asc", "names"), [2, 0, 1, 3]);
  // type-desc reverses the rank groups but keeps the name tiebreak ascending
  assert.deepEqual(columnSortOrder(cols, "type-desc", "names"), [3, 1, 2, 0]);
});

test("does not mutate the input array", () => {
  const input = cols.slice();
  columnSortOrder(input, "name-asc", "names");
  assert.deepEqual(input, cols);
});
