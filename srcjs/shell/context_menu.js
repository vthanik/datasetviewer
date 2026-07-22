// Minimal floating context menu for the column header right-click, the cell
// right-click, and the columns Sort trigger. Renders a fixed-position list at
// (x, y) and dismisses on the next outside mousedown. Keyboard: the menu takes
// focus on open so Escape closes it and Up/Down/Enter navigate -- a custom popup
// must not regress the keyboard access of the native control it replaces. Focus
// returns to the opener on close.

import { div } from "./dom.js";

export function showContextMenu(x, y, items, opener) {
  closeAny();

  const returnFocus =
    opener ||
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);

  const menu = document.createElement("div");
  menu.className = "dv-context-menu";
  menu.setAttribute("role", "menu");
  menu.tabIndex = -1;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // Enabled rows in DOM order; the keyboard cursor walks this list.
  const enabledRows = [];

  items.forEach((item) => {
    if (item.separator) {
      const sep = div("dv-menu-sep");
      sep.setAttribute("role", "separator");
      menu.appendChild(sep);
      return;
    }
    const row = div("dv-menu-item");
    row.setAttribute("role", "menuitem");
    row.tabIndex = -1;
    if (item.disabled) {
      row.classList.add("dv-menu-item-disabled");
      row.setAttribute("aria-disabled", "true");
    }
    const icon = div("dv-menu-icon");
    if (item.icon) icon.innerHTML = item.icon;
    row.appendChild(icon);
    const label = document.createElement("span");
    label.className = "dv-menu-label";
    label.textContent = item.label;
    row.appendChild(label);
    if (!item.disabled) {
      const activate = () => {
        closeAny();
        item.onClick();
      };
      row.addEventListener("click", activate);
      row._activate = activate;
      enabledRows.push(row);
    }
    menu.appendChild(row);
  });

  document.body.appendChild(menu);

  // Clamp into the viewport: a menu opened near the right/bottom edge (last
  // column, last visible row) shifts inward instead of clipping.
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 4) {
    menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
  }
  if (rect.bottom > window.innerHeight - 4) {
    menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
  }

  let focusIdx = -1;
  const focusRow = (i) => {
    if (!enabledRows.length) return;
    focusIdx = (i + enabledRows.length) % enabledRows.length;
    enabledRows[focusIdx].focus();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAny();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(focusIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(focusIdx - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusIdx >= 0) enabledRows[focusIdx]._activate();
    }
  };
  menu.addEventListener("keydown", onKey);

  // Dismiss on a mousedown OUTSIDE the menu. Not `{ once: true }`: a mousedown
  // inside the menu (e.g. on a disabled item, a separator, or padding) must not
  // consume the listener, or the menu would be left with no way to dismiss and
  // stay stuck open. closeAny() removes the listener when the menu closes.
  const onDoc = (e) => {
    if (!menu.contains(e.target)) closeAny();
  };
  menu._onDoc = onDoc;
  menu._returnFocus = returnFocus;
  setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
  menu.focus();
}

function closeAny() {
  document.querySelectorAll(".dv-context-menu").forEach((m) => {
    if (m._onDoc) document.removeEventListener("mousedown", m._onDoc);
    const rf = m._returnFocus;
    m.remove();
    if (rf && typeof rf.focus === "function") rf.focus();
  });
}
