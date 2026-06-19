import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleSort } from "../../srcjs/sort.js";

test("cycleSort: unsorted -> ascending", () => {
  assert.deepEqual(cycleSort([], "AGE"), [{ name: "AGE", dir: "asc" }]);
  assert.deepEqual(cycleSort(undefined, "AGE"), [{ name: "AGE", dir: "asc" }]);
});

test("cycleSort: ascending -> descending", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "asc" }], "AGE"), [
    { name: "AGE", dir: "desc" },
  ]);
});

test("cycleSort: descending -> off (data order)", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "desc" }], "AGE"), []);
});

test("cycleSort: clicking a different column starts at ascending", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "desc" }], "SEX"), [
    { name: "SEX", dir: "asc" },
  ]);
});
