// Pure-logic tests for cell display + payload decode. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellText } from "../../srcjs/grid_cells.js";
import { b64ToBytes } from "../../srcjs/parquet_decode.js";

test("cellText stringifies values and blanks null/undefined", () => {
  assert.equal(cellText(53), "53");
  assert.equal(cellText("M"), "M");
  assert.equal(cellText(null), "");
  assert.equal(cellText(undefined), "");
  assert.equal(cellText(0), "0"); // falsy but not null
  assert.equal(cellText(false), "false");
});

test("b64ToBytes decodes base64 to a Uint8Array", () => {
  // "PAR1" is the Parquet magic; base64 of those four bytes is "UEFSMQ=="
  const bytes = b64ToBytes("UEFSMQ==");
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(Array.from(bytes), [0x50, 0x41, 0x52, 0x31]);
});
