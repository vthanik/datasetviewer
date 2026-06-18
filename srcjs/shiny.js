// Publish the live view state to Shiny inputs so an app can reuse the user's
// filter, sort, and column selection server-side. No-op outside Shiny.

export function wireShiny(el, store) {
  if (typeof window === "undefined" || !window.Shiny || !el.id) return;
  const id = el.id;

  function push(state) {
    const selected = state.columns.filter((c) => c.selected).map((c) => c.name);
    window.Shiny.setInputValue(`${id}_columns`, selected);
    window.Shiny.setInputValue(`${id}_filter`, state.filterExpr || "");
    window.Shiny.setInputValue(`${id}_sort`, state.sort || []);
    window.Shiny.setInputValue(`${id}_view`, state.view);
  }

  store.subscribe(push);
  push(store.get());
}
