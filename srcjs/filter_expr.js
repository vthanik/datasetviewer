// Editing the active free-text filter by column.
//
// The filter is a single SAS-style expression (e.g.
// `SEX = "M" and AGE >= 70`). The per-column "Add Filter" dialog needs to
// REPLACE the clause for a column it is re-applied to, while leaving clauses
// for other columns intact -- otherwise re-filtering a column produces a
// contradictory `rincome in (...) and rincome = "..."`.
//
// splitTopLevelAnd mirrors sql.js whereFromExpr's tokenizer: it consumes
// double-quoted runs ("" is an escaped ") and single-quoted runs ('' is an
// escaped ', used by DATE '...' / TIMESTAMP '...' / TIME '...') wholesale, and
// only treats " and " as a separator at parenthesis depth 0 and outside any
// quoted run. So a value containing " and ", "(", or a quote -- e.g.
// "safe and sound" or "AMERICAN INDIAN OR ALASKA NATIVE" -- is never mis-split.

// Split an expression into its top-level AND-clauses.
export function splitTopLevelAnd(expr) {
  const s = String(expr || "");
  const parts = [];
  let buf = "";
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      // Consume the whole quoted run, including doubled escapes ("" / '').
      buf += ch;
      i++;
      while (i < s.length) {
        buf += s[i];
        if (s[i] === ch) {
          if (s[i + 1] === ch) {
            buf += s[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "(") {
      depth++;
      buf += ch;
      i++;
      continue;
    }
    if (ch === ")") {
      depth--;
      buf += ch;
      i++;
      continue;
    }
    if (depth === 0) {
      const m = s.slice(i).match(/^\s+and\s+/i);
      if (m) {
        parts.push(buf);
        buf = "";
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// The column a clause filters on: the first identifier, ignoring a leading
// "(" (a parenthesised compound like "(AGE >= 70 and AGE < 80)") or a leading
// "!"/"not " (a negated free-text clause). Returns null when none is found.
export function leadingColumn(seg) {
  const s = String(seg || "").replace(/^[(!\s]+/, "").replace(/^not\s+/i, "");
  const m = s.match(/^([A-Za-z_][\w.]*)/);
  return m ? m[1] : null;
}

// Replace the existing top-level clause(s) for `colName` with `newClause`,
// in place (the first matching clause keeps its slot; later same-column
// clauses are dropped); clauses for other columns are kept and AND-combined.
// When the column is not yet filtered, the new clause is appended.
//
// Best-effort: a hand-typed top-level `or` spanning the column is dropped
// wholesale. The dialog never emits top-level `or`, and the engine validates
// the result before it is committed, so an invalid replacement is rejected
// rather than silently applied.
export function replaceColumnClause(expr, colName, newClause) {
  const target = String(colName).toLowerCase();
  const segs = splitTopLevelAnd(expr);
  const out = [];
  let replaced = false;
  for (const seg of segs) {
    const lead = leadingColumn(seg);
    if (lead && lead.toLowerCase() === target) {
      if (!replaced) {
        out.push(newClause);
        replaced = true;
      }
      continue;
    }
    out.push(seg);
  }
  if (!replaced) out.push(newClause);
  return out.join(" and ");
}
