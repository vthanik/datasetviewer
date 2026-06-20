// Pure-logic tests for cell display + payload decode. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellText, isMissing, NA_TEXT } from "../../srcjs/grid_cells.js";
import { b64ToBytes } from "../../srcjs/parquet_decode.js";

test("cellText shows NA for missing, NaN for the IEEE value", () => {
  assert.equal(cellText(53), "53");
  assert.equal(cellText("M"), "M");
  assert.equal(cellText(null), NA_TEXT); // missing -> visible token
  assert.equal(cellText(undefined), NA_TEXT);
  assert.equal(cellText(""), ""); // empty string stays distinct from NA
  assert.equal(cellText(NaN), "NaN"); // genuine NaN is a real value
  assert.equal(cellText(0), "0"); // falsy but not missing
  assert.equal(cellText(false), "false");
});

test("isMissing flags only null/undefined, not NaN or empty string", () => {
  assert.equal(isMissing(null), true);
  assert.equal(isMissing(undefined), true);
  assert.equal(isMissing(NaN), false);
  assert.equal(isMissing(""), false);
  assert.equal(isMissing(0), false);
});

test("b64ToBytes decodes base64 to a Uint8Array", () => {
  // "PAR1" is the Parquet magic; base64 of those four bytes is "UEFSMQ=="
  const bytes = b64ToBytes("UEFSMQ==");
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(Array.from(bytes), [0x50, 0x41, 0x52, 0x31]);
});
