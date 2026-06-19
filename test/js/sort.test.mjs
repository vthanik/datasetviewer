import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleSort } from "../../srcjs/sort.js";

// ---- plain click: single-column cycle ---------------------------------
test("plain click: unsorted -> ascending", () => {
  assert.deepEqual(cycleSort([], "AGE"), [{ name: "AGE", dir: "asc" }]);
  assert.deepEqual(cycleSort(undefined, "AGE"), [{ name: "AGE", dir: "asc" }]);
});

test("plain click: sole ascending -> descending", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "asc" }], "AGE"), [
    { name: "AGE", dir: "desc" },
  ]);
});

test("plain click: sole descending -> off", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "desc" }], "AGE"), []);
});

test("plain click: a different column replaces (starts ascending)", () => {
  assert.deepEqual(cycleSort([{ name: "AGE", dir: "desc" }], "SEX"), [
    { name: "SEX", dir: "asc" },
  ]);
});

test("plain click: a column inside a multi-sort collapses to it alone", () => {
  const multi = [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "desc" },
  ];
  // Even though AGE is descending in the multi-sort, a plain click resets it to
  // the sole ascending sort, dropping REGION.
  assert.deepEqual(cycleSort(multi, "AGE"), [{ name: "AGE", dir: "asc" }]);
});

// ---- shift click: multi-column ----------------------------------------
test("shift click: append a new column at the next priority", () => {
  assert.deepEqual(cycleSort([{ name: "REGION", dir: "asc" }], "AGE", true), [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "asc" },
  ]);
});

test("shift click: empty -> first key ascending", () => {
  assert.deepEqual(cycleSort([], "AGE", true), [{ name: "AGE", dir: "asc" }]);
});

test("shift click: ascending -> descending in place (priority kept)", () => {
  const multi = [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "asc" },
  ];
  assert.deepEqual(cycleSort(multi, "REGION", true), [
    { name: "REGION", dir: "desc" },
    { name: "AGE", dir: "asc" },
  ]);
});

test("shift click: descending -> removed, others keep order and renumber", () => {
  const multi = [
    { name: "REGION", dir: "desc" },
    { name: "AGE", dir: "desc" },
    { name: "SEX", dir: "desc" },
  ];
  // Shift-clicking AGE (already descending) removes it, leaving REGION
  // (priority 1) then SEX (now priority 2).
  assert.deepEqual(cycleSort(multi, "AGE", true), [
    { name: "REGION", dir: "desc" },
    { name: "SEX", dir: "desc" },
  ]);
});

test("shift click never duplicates a column already in the sort", () => {
  const out = cycleSort([{ name: "AGE", dir: "asc" }], "AGE", true);
  assert.equal(out.filter((s) => s.name === "AGE").length, 1);
});
