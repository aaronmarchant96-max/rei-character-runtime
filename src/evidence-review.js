import { createHash } from "node:crypto";
import { classifyInteraction, createReplayFixture } from "./interaction-evidence.js";

export const REVIEW_FLAGS = Object.freeze([
  "wrong-lore",
  "wrong-voice",
  "too-slow",
  "broke-character",
  "irrelevant",
  "unsafe-action",
  "other"
]);

const DEFAULT_FORBIDDEN_RESPONSE_TERMS = Object.freeze([
  "AI",
  "language model",
  "prompt",
  "JSON",
  "player-selected",
  "factual information"
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireRecord(record) {
  if (!record || record.schemaVersion !== 1 || record.event !== "spoken-turn") {
    throw new TypeError("record must be a schema-v1 spoken-turn");
  }
  return record;
}

function normalizeFlags(flags) {
  const normalized = [...new Set((Array.isArray(flags) ? flags : []).map(String))];
  if (!normalized.every((flag) => REVIEW_FLAGS.includes(flag))) {
    throw new TypeError(`flags must use: ${REVIEW_FLAGS.join(", ")}`);
  }
  return normalized;
}

export function createInteractionId(record) {
  return createHash("sha256").update(stableJson(requireRecord(record))).digest("hex");
}

export function createReviewRecord({
  record,
  source,
  verdict,
  flags = [],
  reviewer,
  reviewedAt = new Date().toISOString()
}) {
  const normalizedRecord = requireRecord(record);
  const normalizedReviewer = String(reviewer ?? "").trim();
  if (!normalizedReviewer) throw new TypeError("reviewer must be a non-empty string");
  if (!["accepted", "rejected"].includes(verdict)) {
    throw new TypeError("verdict must be accepted or rejected");
  }
  const normalizedFlags = normalizeFlags(flags);
  if (verdict === "accepted" && normalizedFlags.length > 0) {
    throw new TypeError("accepted reviews must not carry rejection flags");
  }
  if (verdict === "rejected" && normalizedFlags.length === 0) {
    throw new TypeError("rejected reviews require at least one rejection flag");
  }
  const sessionPath = String(source?.sessionPath ?? "").trim();
  const lineNumber = Number(source?.lineNumber);
  if (!sessionPath || !Number.isSafeInteger(lineNumber) || lineNumber < 1) {
    throw new TypeError("source must identify a sessionPath and positive lineNumber");
  }

  return {
    schemaVersion: 1,
    event: "interaction-review",
    interactionId: createInteractionId(normalizedRecord),
    verdict,
    flags: normalizedFlags,
    reviewer: normalizedReviewer,
    reviewedAt: String(reviewedAt),
    source: {
      sessionPath,
      lineNumber,
      recordedAt: normalizedRecord.recordedAt == null
        ? null
        : String(normalizedRecord.recordedAt)
    },
    characterId: String(normalizedRecord.characterId),
    evidence: classifyInteraction(normalizedRecord)
  };
}

export function findPendingInteractions(interactions, reviews) {
  const reviewedIds = new Set((Array.isArray(reviews) ? reviews : [])
    .map((review) => String(review?.interactionId ?? ""))
    .filter(Boolean));
  return (Array.isArray(interactions) ? interactions : [])
    .filter(({ record }) => !reviewedIds.has(createInteractionId(record)));
}

export function createAcceptedFixture({
  record,
  review,
  fixtureId,
  maxDialogueLatencyMs = null
}) {
  const normalizedRecord = requireRecord(record);
  if (review?.verdict !== "accepted") {
    throw new TypeError("fixture promotion requires an accepted review");
  }
  if (review.interactionId !== createInteractionId(normalizedRecord)) {
    throw new TypeError("accepted review does not match the supplied interaction");
  }
  return createReplayFixture({
    fixtureId,
    record: normalizedRecord,
    review: {
      verdict: "human-accepted",
      reviewer: review.reviewer,
      reviewedAt: review.reviewedAt
    },
    expectations: {
      maxDialogueLatencyMs,
      requiredVoiceModel: normalizedRecord.voiceReceipt?.model ?? null,
      forbiddenResponseTerms: DEFAULT_FORBIDDEN_RESPONSE_TERMS
    }
  });
}
