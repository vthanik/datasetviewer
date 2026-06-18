// Decode the base64 Parquet payload into bytes for the engine. Pure and
// node-testable (no DOM dependency beyond atob, which is global in modern
// browsers and node >= 16).

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
