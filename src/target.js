import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

export const MAX_TARGET_ENVELOPE_BYTES = 512;

function validateNullableDisplayText(value, field) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 80) {
    throw new TypeError("target " + field + " must be null or a non-empty string of at most 80 characters");
  }
  if (/[\u0000-\u001F\u007F]/u.test(value)) {
    throw new TypeError("target " + field + " must not contain control characters");
  }
  return value.trim();
}

export function parseTargetEnvelope(value) {
  if (typeof value !== "string") {
    throw new TypeError("target envelope must be a string");
  }
  if (Buffer.byteLength(value, "utf8") > MAX_TARGET_ENVELOPE_BYTES) {
    throw new RangeError(
      "target envelope must be at most " + MAX_TARGET_ENVELOPE_BYTES + " UTF-8 bytes"
    );
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

  const expectedKeys = target.schemaVersion === 2
    ? [
        "actorKind",
        "displayName",
        "game",
        "locationFormId",
        "locationName",
        "referenceFormId",
        "schemaVersion"
      ]
    : ["actorKind", "game", "referenceFormId", "schemaVersion"];
  const actualKeys = Object.keys(target).sort();
  if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError("target envelope contains unexpected or missing fields");
  }
  if (target.schemaVersion !== 1 && target.schemaVersion !== 2) {
    throw new TypeError("target envelope schemaVersion must be 1 or 2");
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

  const displayName = target.schemaVersion === 2
    ? validateNullableDisplayText(target.displayName, "displayName")
    : null;
  const locationName = target.schemaVersion === 2
    ? validateNullableDisplayText(target.locationName, "locationName")
    : null;
  const locationFormId = target.schemaVersion === 2 ? target.locationFormId : null;
  if (locationFormId !== null && !/^[0-9A-F]{8}$/u.test(locationFormId)) {
    throw new TypeError("target locationFormId must be null or 8 uppercase hexadecimal characters");
  }

  return {
    schemaVersion: target.schemaVersion,
    game: target.game,
    referenceFormId: target.referenceFormId,
    actorKind: target.actorKind,
    displayName,
    locationFormId,
    locationName
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
