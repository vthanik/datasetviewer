// Strict, type-aware validation of the free-text filter expression. The engine
// (and R) silently coerce a quoted number or an unquoted character value, so a
// type mistake runs instead of failing. SAS rejects it; we do the same -- fail
// fast, before the query runs, with a clear message.
//
// Rule: numeric columns take unquoted numbers; character/boolean columns take
// quoted values. The check is conservative: it only flags comparisons it can
// confidently parse (a known column, a comparison operator or IN, then a
// literal), so it never rejects a valid expression it does not fully understand.

const CMP = ["<=", ">=", "<>", "!=", "==", "=", "<", ">"];

function tokenize(s) {
  const toks = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '"' || ch === "'") {
      const q = ch;
      let raw = ch;
      let j = i + 1;
      while (j < n) {
        raw += s[j];
        if (s[j] === q) {
          if (s[j + 1] === q) {
            raw += s[j + 1];
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      toks.push({ t: "str", v: raw });
      i = j;
    } else if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let j = i;
      while (j < n && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: "num", v: s.slice(i, j) });
      i = j;
    } else if (/[A-Za-z_.]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.]/.test(s[j])) j++;
      const w = s.slice(i, j);
      const lw = w.toLowerCase();
      toks.push(
        ["and", "or", "not", "in"].includes(lw) ? { t: "kw", v: lw } : { t: "id", v: w }
      );
      i = j;
    } else {
      const op = CMP.find((o) => s.startsWith(o, i));
      if (op) {
        toks.push({ t: "op", v: op });
        i += op.length;
      } else if (ch === "(") {
        toks.push({ t: "lp" });
        i++;
      } else if (ch === ")") {
        toks.push({ t: "rp" });
        i++;
      } else {
        toks.push({ t: "other", v: ch });
        i++;
      }
    }
  }
  return toks;
}

function checkValue(col, kind, val) {
  if (kind === "number" && val.t === "str") {
    const inner = val.v.slice(1, -1);
    const ex = /^-?\d+(\.\d+)?$/.test(inner) ? inner : "0";
    const e = new Error(
      `"${col}" is numeric. Use an unquoted number, for example ${col} = ${ex}.`
    );
    e.userFacing = true;
    throw e;
  }
  if ((kind === "string" || kind === "bool") && val.t === "num") {
    const e = new Error(
      `"${col}" is character. Quote the value, for example ${col} = "${val.v}".`
    );
    e.userFacing = true;
    throw e;
  }
}

function checkInList(col, kind, toks, start) {
  // toks[start] should be "(": validate each literal up to the matching ")".
  if (!toks[start] || toks[start].t !== "lp") return;
  for (let m = start + 1; m < toks.length && toks[m].t !== "rp"; m++) {
    if (toks[m].t === "str" || toks[m].t === "num") checkValue(col, kind, toks[m]);
  }
}

// Throw a user-facing Error on the first clear type violation; return otherwise.
export function validateFilterTypes(expr, kindMap) {
  if (!expr || !kindMap) return;
  const toks = tokenize(String(expr));
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== "id") continue;
    const kind = kindMap[t.v];
    if (kind !== "number" && kind !== "string" && kind !== "bool") continue;

    const next = toks[k + 1];
    if (!next) continue;
    if (next.t === "op") {
      if (toks[k + 2]) checkValue(t.v, kind, toks[k + 2]);
    } else if (next.t === "kw" && next.v === "in") {
      checkInList(t.v, kind, toks, k + 2);
    } else if (next.t === "kw" && next.v === "not") {
      const inTok = toks[k + 2];
      if (inTok && inTok.t === "kw" && inTok.v === "in") checkInList(t.v, kind, toks, k + 3);
    }
  }
}
