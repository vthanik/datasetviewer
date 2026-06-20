// Native date / datetime / time input fields for the per-column Add Filter
// dialog. The browser supplies the calendar/clock UI; the value is always a
// canonical string the filter wraps into a typed SQL literal:
//   date     -> "YYYY-MM-DD"           (DATE '...')
//   datetime -> "YYYY-MM-DD HH:MM:SS"  (TIMESTAMP '...')
//   time     -> "HH:MM:SS"             (TIME '...')
// This matches how artoo presents SAS temporals -- date as R Date, datetime as
// POSIXct (UTC, second precision), time as hms -- which nanoparquet writes as
// DATE / TIMESTAMP / TIME and DuckDB reads back natively. datetime carries the
// time-of-day (the previous date-only calendar dropped it).

const NATIVE_TYPE = { date: "date", datetime: "datetime-local", time: "time" };

export function createDateField(kind = "date") {
  const input = document.createElement("input");
  input.type = NATIVE_TYPE[kind] || "date";
  input.className = "dv-date-field";
  // Second precision for datetime/time so a TIMESTAMP/TIME literal is exact.
  if (kind !== "date") input.step = 1;

  const clear = () => (input.value = "");
  // The dialog's Clear button resets fields it finds by .dv-date-field via _clear.
  input._clear = clear;

  // datetime-local yields "YYYY-MM-DDTHH:MM:SS"; the SQL literal wants a space.
  const value = () =>
    kind === "datetime" ? input.value.replace("T", " ") : input.value;

  return { el: input, value, clear, destroy: () => {} };
}
