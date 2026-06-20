// Shared DOM construction helpers for the shell pieces. One definition of each,
// imported everywhere -- the same three lines were previously copy-pasted into
// every panel and dialog.

export function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function div(className) {
  return el("div", className);
}

// An element with text content (the old `text` / `textNode` helper).
export function text(tag, className, content) {
  const e = el(tag, className);
  e.textContent = content;
  return e;
}
