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

  // Dismiss on a mousedown OUTSIDE the menu. Not `{ once: true }`: a mousedown
  // inside the menu (e.g. on a disabled item, a separator, or padding) must not
  // consume the listener, or the menu would be left with no way to dismiss and
  // stay stuck open. closeAny() removes the listener when the menu closes.
  const onDoc = (e) => {
    if (!menu.contains(e.target)) closeAny();
  };
  menu._onDoc = onDoc;
  setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
}

function closeAny() {
  document.querySelectorAll(".dv-context-menu").forEach((m) => {
    if (m._onDoc) document.removeEventListener("mousedown", m._onDoc);
    m.remove();
  });
}

function div(className) {
  const e = document.createElement("div");
  e.className = className;
  return e;
}
