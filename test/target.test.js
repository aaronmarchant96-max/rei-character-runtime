import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_TARGET_ENVELOPE_BYTES,
  parseTargetEnvelope,
  readTargetEnvelope
} from "../src/target.js";

const validEnvelope = JSON.stringify({
  schemaVersion: 1,
  game: "oblivion-2009",
  referenceFormId: "001234AB",
  actorKind: "npc"
});

test("target envelope preserves one bounded Oblivion actor identity", () => {
  assert.deepEqual(parseTargetEnvelope(validEnvelope), {
    schemaVersion: 1,
    game: "oblivion-2009",
    referenceFormId: "001234AB",
    actorKind: "npc"
  });
});

test("target envelope rejects malformed, ambiguous, and oversized input", () => {
  assert.throws(() => parseTargetEnvelope("not-json"), /valid JSON/u);
  assert.throws(
    () => parseTargetEnvelope(JSON.stringify({
      schemaVersion: 1,
      game: "oblivion-2009",
      referenceFormId: "1234ab",
      actorKind: "npc"
    })),
    /8 uppercase hexadecimal/u
  );
  assert.throws(
    () => parseTargetEnvelope(JSON.stringify({
      schemaVersion: 1,
      game: "oblivion-2009",
      referenceFormId: "001234AB",
      actorKind: "door"
    })),
    /npc or creature/u
  );
  assert.throws(
    () => parseTargetEnvelope(`${validEnvelope}${" ".repeat(MAX_TARGET_ENVELOPE_BYTES)}`),
    /at most/u
  );
});

test("external runtime reads the exact atomically published target envelope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-target-test-"));
  const inputPath = join(directory, "target.json");
  try {
    await writeFile(inputPath, validEnvelope, "utf8");
    const result = await readTargetEnvelope(inputPath);
    assert.deepEqual(result.target, parseTargetEnvelope(validEnvelope));
    assert.equal(result.receipt.inputPath, inputPath);
    assert.equal(result.receipt.bytes, Buffer.byteLength(validEnvelope));
    assert.equal(result.receipt.measurementMode, "measured");
    assert.match(result.receipt.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(await readFile(inputPath, "utf8"), validEnvelope);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
