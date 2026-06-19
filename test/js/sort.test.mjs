import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shiftClickSort,
  setColumnSort,
  removeColumnSort,
  plainClickSort,
} from "../../srcjs/sort.js";

// ---- plainClickSort: neutral -> asc -> desc -> neutral cycle -----------
test("plainClickSort: first click on a resting column is neutral (no sort)", () => {
  assert.deepEqual(plainClickSort([], null, "AGE"), { sort: [], neutral: "AGE" });
});

test("plainClickSort: from neutral, the next click sorts ascending", () => {
  assert.deepEqual(plainClickSort([], "AGE", "AGE"), {
    sort: [{ name: "AGE", dir: "asc" }],
    neutral: null,
  });
});

test("plainClickSort: ascending -> descending", () => {
  assert.deepEqual(plainClickSort([{ name: "AGE", dir: "asc" }], null, "AGE"), {
    sort: [{ name: "AGE", dir: "desc" }],
    neutral: null,
  });
});

test("plainClickSort: descending -> back to neutral", () => {
  assert.deepEqual(plainClickSort([{ name: "AGE", dir: "desc" }], null, "AGE"), {
    sort: [],
    neutral: "AGE",
  });
});

test("plainClickSort: clicking a different column resets to its neutral", () => {
  // AGE is sorted; clicking SEX drops AGE and makes SEX neutral (no sort yet).
  assert.deepEqual(plainClickSort([{ name: "AGE", dir: "asc" }], null, "SEX"), {
    sort: [],
    neutral: "SEX",
  });
});

test("plainClickSort: a sole-sorted column ignores a stale neutral name", () => {
  // If the column is already sole-sorted (e.g. via the menu), the asc/desc
  // branches win even when `neutral` still names it.
  assert.deepEqual(plainClickSort([{ name: "AGE", dir: "asc" }], "AGE", "AGE"), {
    sort: [{ name: "AGE", dir: "desc" }],
    neutral: null,
  });
});

// ---- shiftClickSort: multi-column (Shift-click) -----------------------
test("shiftClickSort: append a new column at the next priority", () => {
  assert.deepEqual(shiftClickSort([{ name: "REGION", dir: "asc" }], "AGE"), [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "asc" },
  ]);
});

test("shiftClickSort: empty -> first key ascending", () => {
  assert.deepEqual(shiftClickSort([], "AGE"), [{ name: "AGE", dir: "asc" }]);
});

test("shiftClickSort: ascending -> descending in place (priority kept)", () => {
  const multi = [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "asc" },
  ];
  assert.deepEqual(shiftClickSort(multi, "REGION"), [
    { name: "REGION", dir: "desc" },
    { name: "AGE", dir: "asc" },
  ]);
});

test("shiftClickSort: descending -> removed, others keep order and renumber", () => {
  const multi = [
    { name: "REGION", dir: "desc" },
    { name: "AGE", dir: "desc" },
    { name: "SEX", dir: "desc" },
  ];
  // Shift-clicking AGE (already descending) removes it, leaving REGION
  // (priority 1) then SEX (now priority 2).
  assert.deepEqual(shiftClickSort(multi, "AGE"), [
    { name: "REGION", dir: "desc" },
    { name: "SEX", dir: "desc" },
  ]);
});

test("shiftClickSort never duplicates a column already in the sort", () => {
  const out = shiftClickSort([{ name: "AGE", dir: "asc" }], "AGE");
  assert.equal(out.filter((s) => s.name === "AGE").length, 1);
});

// ---- setColumnSort: right-click Sort Ascending / Descending -----------
test("setColumnSort: empty -> single key", () => {
  assert.deepEqual(setColumnSort([], "AGE", "asc"), [{ name: "AGE", dir: "asc" }]);
});

test("setColumnSort: a new column is appended at the next priority", () => {
  assert.deepEqual(
    setColumnSort([{ name: "REGION", dir: "asc" }], "AGE", "desc"),
    [
      { name: "REGION", dir: "asc" },
      { name: "AGE", dir: "desc" },
    ]
  );
});

test("setColumnSort: an existing column's direction updates in place", () => {
  const multi = [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "asc" },
  ];
  assert.deepEqual(setColumnSort(multi, "REGION", "desc"), [
    { name: "REGION", dir: "desc" },
    { name: "AGE", dir: "asc" },
  ]);
});

// ---- removeColumnSort: right-click Clear Sorting ----------------------
test("removeColumnSort: removes the named key, others keep order", () => {
  const multi = [
    { name: "REGION", dir: "asc" },
    { name: "AGE", dir: "desc" },
    { name: "SEX", dir: "asc" },
  ];
  assert.deepEqual(removeColumnSort(multi, "AGE"), [
    { name: "REGION", dir: "asc" },
    { name: "SEX", dir: "asc" },
  ]);
});

test("removeColumnSort: an absent column leaves the sort unchanged", () => {
  const multi = [{ name: "REGION", dir: "asc" }];
  assert.deepEqual(removeColumnSort(multi, "AGE"), [{ name: "REGION", dir: "asc" }]);
  assert.deepEqual(removeColumnSort([], "AGE"), []);
});
