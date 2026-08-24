import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

export const MAX_TARGET_ENVELOPE_BYTES = 256;

export function parseTargetEnvelope(value) {
  if (typeof value !== "string") {
    throw new TypeError("target envelope must be a string");
  }
  if (Buffer.byteLength(value, "utf8") > MAX_TARGET_ENVELOPE_BYTES) {
    throw new RangeError(`target envelope must be at most ${MAX_TARGET_ENVELOPE_BYTES} UTF-8 bytes`);
  }

  let target;
  try {
    target = JSON.parse(value);
  } catch {
    throw new TypeError("target envelope must be valid JSON");
  }
  if (!target || Array.isArray(target) || typeof target !== "object") {
    throw new TypeError("target envelope must be a JSON object");
  }

  const expectedKeys = ["actorKind", "game", "referenceFormId", "schemaVersion"];
  const actualKeys = Object.keys(target).sort();
  if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError("target envelope contains unexpected or missing fields");
  }
  if (target.schemaVersion !== 1) {
    throw new TypeError("target envelope schemaVersion must be 1");
  }
  if (target.game !== "oblivion-2009") {
    throw new TypeError("target envelope game must be oblivion-2009");
  }
  if (!/^[0-9A-F]{8}$/u.test(target.referenceFormId)) {
    throw new TypeError("target referenceFormId must be 8 uppercase hexadecimal characters");
  }
  if (target.actorKind !== "npc" && target.actorKind !== "creature") {
    throw new TypeError("target actorKind must be npc or creature");
  }

  return {
    schemaVersion: target.schemaVersion,
    game: target.game,
    referenceFormId: target.referenceFormId,
    actorKind: target.actorKind
  };
}

export async function readTargetEnvelope(inputPath) {
  if (typeof inputPath !== "string" || !isAbsolute(inputPath)) {
    throw new TypeError("inputPath must be an absolute path");
  }
  const value = await readFile(inputPath, "utf8");
  const target = parseTargetEnvelope(value);
  return {
    target,
    receipt: {
      inputPath,
      bytes: Buffer.byteLength(value, "utf8"),
      sha256: createHash("sha256").update(value, "utf8").digest("hex"),
      measurementMode: "measured"
    }
  };
}
