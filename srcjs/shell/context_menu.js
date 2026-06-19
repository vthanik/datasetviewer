// Minimal floating context menu for the column header right-click. Renders a
// fixed-position list at (x, y) and dismisses on the next outside click.

export function showContextMenu(x, y, items) {
  closeAny();

  const menu = document.createElement("div");
  menu.className = "dv-context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  items.forEach((item) => {
    if (item.separator) {
      menu.appendChild(div("dv-menu-sep"));
      return;
    }
    const row = div("dv-menu-item");
    if (item.disabled) row.classList.add("dv-menu-item-disabled");
    const icon = div("dv-menu-icon");
    if (item.icon) icon.innerHTML = item.icon;
    row.appendChild(icon);
    const label = document.createElement("span");
    label.className = "dv-menu-label";
    label.textContent = item.label;
    row.appendChild(label);
    if (!item.disabled) {
      row.addEventListener("click", () => {
        closeAny();
        item.onClick();
      });
    }
    menu.appendChild(row);
  });

  document.body.appendChild(menu);

  // Dismiss on the next click anywhere else.
  setTimeout(() => {
    const onDoc = (e) => {
      if (!menu.contains(e.target)) closeAny();
    };
    menu._onDoc = onDoc;
    document.addEventListener("mousedown", onDoc, { once: true });
  }, 0);
}

function closeAny() {
  document.querySelectorAll(".dv-context-menu").forEach((m) => m.remove());
}

function div(className) {
  const e = document.createElement("div");
  e.className = className;
  return e;
}
