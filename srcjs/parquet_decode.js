// Decode the base64 Parquet payload into bytes for the engine. Pure and
// node-testable (no DOM dependency beyond atob, which is global in modern
// browsers and node >= 16).

export function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
