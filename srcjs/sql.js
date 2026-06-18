// Build DuckDB SQL fragments from the view state.
//
// The filter is a free-text expression (SAS "Filter Table Rows" style). Users
// write string values in double quotes (SEX = "M"); we translate each
// double-quoted run into a SQL single-quoted literal, doubling any embedded
// single quote so values like "O'Brien" become 'O''Brien'. SAS-style embedded
// double quotes are written as "" and collapse to one ". Single-quoted runs
// the user typed are passed through unchanged.

export function whereFromExpr(expr) {
  if (!expr || !String(expr).trim()) return "";
  const s = String(expr).trim();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      // Read a double-quoted run; "" is an escaped double quote.
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
      out += ch;
      i++;
    }
  }
  return out;
}

export function orderFromSort(sort) {
  return (sort || [])
    .map((s) => `"${String(s.name).replace(/"/g, '""')}" ${s.dir === "desc" ? "DESC" : "ASC"}`)
    .join(", ");
}
