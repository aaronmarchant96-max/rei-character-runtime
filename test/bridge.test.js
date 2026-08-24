import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDeterministicBridgeText,
  normalizeBridgeText,
  writeBridgeResponse
} from "../src/bridge.js";

test("bridge text is deterministic and single-line", () => {
  assert.equal(
    createDeterministicBridgeText("  Have you seen\nanything near the ruins?  "),
    "EchoForge bridge: Have you seen anything near the ruins?"
  );
});

test("bridge text rejects empty and oversized UTF-8 payloads", () => {
  assert.throws(() => normalizeBridgeText(" \n\t "), /non-empty/u);
  assert.throws(() => normalizeBridgeText("é".repeat(121)), /240 UTF-8 bytes/u);
});

test("bridge response is published atomically with a measured receipt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-bridge-test-"));
  const outputPath = join(directory, "response.txt");
  try {
    const receipt = await writeBridgeResponse({
      outputPath,
      text: "EchoForge bridge online."
    });

    assert.equal(await readFile(outputPath, "utf8"), "EchoForge bridge online.");
    assert.deepEqual(receipt, {
      outputPath,
      bytes: 24,
      sha256: "05491f407ab1ce207edee0e330072b1c2c5d3eccb931073f60dd833b59bcee15",
      measurementMode: "measured"
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
