import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseQuestionEnvelope, readQuestionEnvelope } from "../src/question.js";

const validEnvelope = JSON.stringify({
  schemaVersion: 1,
  game: "oblivion-2009",
  targetReferenceFormId: "00028B76",
  question: "Who are you, and where are we?"
});

test("question envelope binds bounded player text to one selected actor", () => {
  assert.deepEqual(parseQuestionEnvelope(validEnvelope), {
    schemaVersion: 1,
    game: "oblivion-2009",
    targetReferenceFormId: "00028B76",
    question: "Who are you, and where are we?"
  });
});

test("question envelope rejects extra fields, invalid IDs, and oversized text", () => {
  assert.throws(
    () => parseQuestionEnvelope(JSON.stringify({
      schemaVersion: 1,
      game: "oblivion-2009",
      targetReferenceFormId: "28b76",
      question: "Hello"
    })),
    /8 uppercase hexadecimal/u
  );
  assert.throws(
    () => parseQuestionEnvelope(JSON.stringify({
      schemaVersion: 1,
      game: "oblivion-2009",
      targetReferenceFormId: "00028B76",
      question: "Hello",
      action: "attack"
    })),
    /unexpected or missing/u
  );
  assert.throws(
    () => parseQuestionEnvelope(JSON.stringify({
      schemaVersion: 1,
      game: "oblivion-2009",
      targetReferenceFormId: "00028B76",
      question: "é".repeat(121)
    })),
    /240 UTF-8 bytes/u
  );
});

test("question reader returns literal file evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-question-test-"));
  const inputPath = join(directory, "question.json");
  try {
    await writeFile(inputPath, validEnvelope, "utf8");
    const result = await readQuestionEnvelope(inputPath);
    assert.equal(result.question.question, "Who are you, and where are we?");
    assert.equal(result.receipt.bytes, Buffer.byteLength(validEnvelope));
    assert.match(result.receipt.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(result.receipt.measurementMode, "measured");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
