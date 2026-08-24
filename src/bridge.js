import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

export const MAX_BRIDGE_TEXT_BYTES = 240;

export function normalizeBridgeText(value) {
  if (typeof value !== "string") {
    throw new TypeError("bridge text must be a string");
  }
  const text = value.trim().replace(/\s+/gu, " ");
  if (!text) throw new TypeError("bridge text must be non-empty");
  if (/[\u0000-\u001F\u007F]/u.test(text)) {
    throw new TypeError("bridge text must not contain control characters");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BRIDGE_TEXT_BYTES) {
    throw new RangeError(`bridge text must be at most ${MAX_BRIDGE_TEXT_BYTES} UTF-8 bytes`);
  }
  return text;
}

export function createDeterministicBridgeText(playerText) {
  const input = normalizeBridgeText(playerText);
  return normalizeBridgeText(`EchoForge bridge: ${input}`);
}

export async function writeBridgeResponse({ outputPath, text }) {
  if (typeof outputPath !== "string" || !isAbsolute(outputPath)) {
    throw new TypeError("outputPath must be an absolute path");
  }
  const normalized = normalizeBridgeText(text);
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await writeFile(temporaryPath, normalized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  return {
    outputPath,
    bytes: Buffer.byteLength(normalized, "utf8"),
    sha256: createHash("sha256").update(normalized, "utf8").digest("hex"),
    measurementMode: "measured"
  };
}
