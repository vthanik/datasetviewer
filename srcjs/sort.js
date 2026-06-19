// Single-key sort cycling for a left-click on a column header.
//
// Clicking a header advances its sort: unsorted -> ascending -> descending ->
// off (data order). Matches the SAS Studio header behaviour. The sort state is
// the same single-element array the right-click menu sets, so the two paths
// stay consistent.

export function cycleSort(sort, name) {
  const cur = (sort || [])[0];
  if (!cur || cur.name !== name) return [{ name, dir: "asc" }];
  if (cur.dir === "asc") return [{ name, dir: "desc" }];
  return [];
}
