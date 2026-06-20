// The one place the SAS filter quote/escape grammar lives. Splits an expression
// into ordered runs: raw (unquoted) text and quoted literals. A quoted run
// records its quote char and its INNER value with doubled-quote escapes ("" or
// '') collapsed to a single quote. Callers (sql.js, codegen.js, filter_expr.js)
// re-emit or transform each run instead of each re-walking the quote grammar.
//
// A value containing " and ", "(", "or", or a quote -- e.g. "safe and sound" or
// "AMERICAN INDIAN OR ALASKA NATIVE" -- lands wholly inside one quoted run, so it
// can never be mis-split or mis-translated.
export function scanRuns(expr) {
  const s = String(expr || "");
  const runs = [];
  let raw = "";
  let i = 0;
  const pushRaw = () => {
    if (raw) {
      runs.push({ q: "", value: raw });
      raw = "";
    }
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      pushRaw();
      let val = "";
      i++;
      while (i < s.length) {
        if (s[i] === ch) {
          if (s[i + 1] === ch) {
            val += ch; // doubled quote is one literal quote
            i += 2;
            continue;
          }
          i++;
          break;
        }
        val += s[i];
        i++;
      }
      runs.push({ q: ch, value: val });
    } else {
      raw += ch;
      i++;
    }
  }
  pushRaw();
  return runs;
}

// Reproduce a quoted run's original source text, re-doubling embedded quotes.
export function requote(run) {
  return run.q + run.value.split(run.q).join(run.q + run.q) + run.q;
}
