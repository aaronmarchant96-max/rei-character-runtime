import test from "node:test";
import assert from "node:assert/strict";
import { createEchoForgePlugin } from "../scripts/build-oblivion-plugin.mjs";

test("generated Oblivion plugin contains one bounded Find package", () => {
  const plugin = createEchoForgePlugin();
  assert.equal(plugin.subarray(0, 4).toString("ascii"), "TES4");
  assert.equal(plugin.includes(Buffer.from("Oblivion.esm\0", "ascii")), true);
  assert.equal(plugin.includes(Buffer.from("EchoForgePickupTravel\0", "ascii")), true);
  const packageOffset = plugin.indexOf(Buffer.from("PACK", "ascii"), 20);
  const recordOffset = plugin.indexOf(Buffer.from("PACK", "ascii"), packageOffset + 4);
  assert.notEqual(packageOffset, -1);
  assert.notEqual(recordOffset, -1);
  assert.equal(plugin.readUInt32LE(recordOffset + 12), 0x00000800);
  const packageDataOffset = plugin.indexOf(Buffer.from("PKDT", "ascii"), recordOffset);
  assert.notEqual(packageDataOffset, -1);
  assert.equal(plugin.readUInt8(packageDataOffset + 10), 0);
  assert.equal(plugin.includes(Buffer.from("SCPT", "ascii")), false);
  assert.equal(plugin.includes(Buffer.from("SCTX", "ascii")), false);
});
