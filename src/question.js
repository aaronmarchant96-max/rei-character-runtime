import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { normalizeBridgeText } from "./bridge.js";

export const MAX_QUESTION_ENVELOPE_BYTES = 768;

export function parseQuestionEnvelope(value) {
  if (typeof value !== "string") throw new TypeError("question envelope must be a string");
  if (Buffer.byteLength(value, "utf8") > MAX_QUESTION_ENVELOPE_BYTES) {
    throw new RangeError("question envelope must be at most 768 UTF-8 bytes");
  }
  let question;
  try {
    question = JSON.parse(value);
  } catch {
    throw new TypeError("question envelope must be valid JSON");
  }
  if (!question || Array.isArray(question) || typeof question !== "object") {
    throw new TypeError("question envelope must be a JSON object");
  }
  const expectedKeys = ["game", "question", "schemaVersion", "targetReferenceFormId"];
  const actualKeys = Object.keys(question).sort();
  if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError("question envelope contains unexpected or missing fields");
  }
  if (question.schemaVersion !== 1) {
    throw new TypeError("question envelope schemaVersion must be 1");
  }
  if (question.game !== "oblivion-2009") {
    throw new TypeError("question envelope game must be oblivion-2009");
  }
  if (!/^[0-9A-F]{8}$/u.test(question.targetReferenceFormId)) {
    throw new TypeError("question targetReferenceFormId must be 8 uppercase hexadecimal characters");
  }
  return {
    schemaVersion: 1,
    game: question.game,
    targetReferenceFormId: question.targetReferenceFormId,
    question: normalizeBridgeText(question.question)
  };
}

export async function readQuestionEnvelope(inputPath) {
  if (typeof inputPath !== "string" || !isAbsolute(inputPath)) {
    throw new TypeError("inputPath must be an absolute path");
  }
  const value = await readFile(inputPath, "utf8");
  return {
    question: parseQuestionEnvelope(value),
    receipt: {
      inputPath,
      bytes: Buffer.byteLength(value, "utf8"),
      sha256: createHash("sha256").update(value, "utf8").digest("hex"),
      measurementMode: "measured"
    }
  };
}
