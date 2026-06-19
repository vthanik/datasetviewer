// Sort cycling for a click on a column header.
//
// Plain click sorts by ONE column, cycling ascending -> descending -> off (data
// order), replacing any other sort. Shift-click builds a multi-column sort:
// each shifted column is appended at the next priority, and re-shift-clicking it
// flips its direction, then drops it. The sort state is the ordered array the
// rest of the app already consumes (sql ORDER BY, dplyr arrange, the priority
// caret), so its index is the column's sort priority.

// Set one column's direction within the sort, used by the right-click menu's
// Sort Ascending / Sort Descending. If the column is already a sort key its
// direction is updated in place (priority kept); otherwise it is appended at the
// next priority, so sorting a new column adds to -- not replaces -- an existing
// multi-sort.
export function setColumnSort(sort, name, dir) {
  const list = sort || [];
  const idx = list.findIndex((s) => s.name === name);
  if (idx === -1) return [...list, { name, dir }];
  const next = list.slice();
  next[idx] = { name, dir };
  return next;
}

// Remove one column from the sort (the right-click "Clear Sorting", which clears
// only the selected column); the other keys keep their order and renumber.
export function removeColumnSort(sort, name) {
  return (sort || []).filter((s) => s.name !== name);
}

export function cycleSort(sort, name, additive = false) {
  const list = sort || [];
  const idx = list.findIndex((s) => s.name === name);

  if (additive) {
    // Shift-click: add/cycle this column within the multi-sort, keep the rest.
    if (idx === -1) return [...list, { name, dir: "asc" }];
    if (list[idx].dir === "asc") {
      const next = list.slice();
      next[idx] = { name, dir: "desc" }; // flip in place, priority preserved
      return next;
    }
    return list.filter((_, i) => i !== idx); // desc -> remove
  }

  // Plain click: this column becomes the sole sort. Cycle only when it is
  // already the sole key; otherwise start fresh ascending (dropping others).
  const sole = list.length === 1 && idx === 0;
  if (sole && list[0].dir === "asc") return [{ name, dir: "desc" }];
  if (sole && list[0].dir === "desc") return [];
  return [{ name, dir: "asc" }];
}
