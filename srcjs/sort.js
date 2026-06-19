// Sort cycling for a click on a column header.
//
// Plain click sorts by ONE column, cycling ascending -> descending -> off (data
// order), replacing any other sort. Shift-click builds a multi-column sort:
// each shifted column is appended at the next priority, and re-shift-clicking it
// flips its direction, then drops it. The sort state is the ordered array the
// rest of the app already consumes (sql ORDER BY, dplyr arrange, the priority
// caret), so its index is the column's sort priority.

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
