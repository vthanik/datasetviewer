// Build DuckDB SQL fragments from the view state.
//
// The filter is a free-text expression (SAS "Filter Table Rows" style). Users
// write string values in double quotes (SEX = "M"); we translate each
// double-quoted run into a SQL single-quoted literal, doubling any embedded
// single quote so values like "O'Brien" become 'O''Brien'. SAS-style embedded
// double quotes are written as "" and collapse to one ". Single-quoted runs
// the user typed are passed through unchanged.

// Translate the missing-value predicate on a NON-STRING segment only (so a
// value the user quoted, like 'is na', is never rewritten). "COL is na" ->
// "COL IS NULL", "COL is not na" -> "COL IS NOT NULL", case-insensitive. The
// predicate is type-agnostic (IS NULL matches R's NA on every column kind); a
// genuine IEEE NaN is a distinct value the user can target with isnan(COL).
function translateMissingSql(seg) {
  return seg
    .replace(/\b([A-Za-z_.][\w.]*)\s+is\s+not\s+na\b/gi, "$1 IS NOT NULL")
    .replace(/\b([A-Za-z_.][\w.]*)\s+is\s+na\b/gi, "$1 IS NULL");
}

export function whereFromExpr(expr) {
  if (!expr || !String(expr).trim()) return "";
  const s = String(expr).trim();
  let out = "";
  let seg = "";
  let i = 0;
  // Flush the accumulated non-string run through the segment translators.
  const flush = () => {
    out += translateMissingSql(seg);
    seg = "";
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      // Read a double-quoted run; "" is an escaped double quote.
      flush();
      let val = "";
      i++;
      while (i < s.length) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') {
            val += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        val += s[i];
        i++;
      }
      out += `'${val.replace(/'/g, "''")}'`;
    } else if (ch === "'") {
      // Pass a single-quoted SQL literal through verbatim ('' stays escaped).
      flush();
      out += ch;
      i++;
      while (i < s.length) {
        out += s[i];
        if (s[i] === "'") {
          if (s[i + 1] === "'") {
            out += s[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
    } else {
      seg += ch;
      i++;
    }
  }
  flush();
  return out;
}

export function orderFromSort(sort) {
  return (sort || [])
    .map((s) => `"${String(s.name).replace(/"/g, '""')}" ${s.dir === "desc" ? "DESC" : "ASC"}`)
    .join(", ");
}
