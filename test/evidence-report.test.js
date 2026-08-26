import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceReport, renderEvidenceReportMarkdown } from "../src/evidence-report.js";
import { createInteractionId, createReviewRecord } from "../src/evidence-review.js";

function turn({
  id,
  name,
  actorKind = "npc",
  route = "economy",
  provider = "prepared-character-material",
  dialogueLatencyMs,
  voiceLatencyMs,
  response = "A grounded answer.",
  validationFailures = []
}) {
  const characterId = `oblivion-2009:${id}`;
  return {
    schemaVersion: 1,
    event: "spoken-turn",
    characterId,
    target: { actorKind, displayName: name },
    question: "A question?",
    response,
    augmentation: {
      answerMode: "known",
      usedFactKeys: ["profile.fact"],
      humanControl: "player-decides",
      actionAuthority: "none"
    },
    dialogueReceipt: {
      provider,
      groundingStatus: "passed",
      fallbackUsed: false,
      validationFailures,
      measurementMode: "measured"
    },
    routeReceipt: {
      characterId,
      route,
      latencyMs: dialogueLatencyMs,
      measurementMode: "measured"
    },
    voiceReceipt: {
      characterId,
      model: "test-voice",
      status: "played",
      latencyMs: voiceLatencyMs,
      measurementMode: "measured"
    },
    proposedActions: [],
    executedActions: []
  };
}

test("report separates human review coverage from automatic signals", () => {
  const acceptedTurn = turn({
    id: "00000001",
    name: "Accepted NPC",
    dialogueLatencyMs: 10,
    voiceLatencyMs: 100
  });
  const rejectedTurn = turn({
    id: "00000002",
    name: "Rejected NPC",
    provider: "ollama-local",
    dialogueLatencyMs: 30,
    voiceLatencyMs: 300,
    response: "As an AI model, I cannot answer.",
    validationFailures: ["unknown-required"]
  });
  const pendingTurn = turn({
    id: "00000003",
    name: "Pending Creature",
    actorKind: "creature",
    route: "capable",
    provider: "ollama-local",
    dialogueLatencyMs: 20,
    voiceLatencyMs: 200
  });
  const accepted = createReviewRecord({
    record: acceptedTurn,
    source: { sessionPath: "one.jsonl", lineNumber: 1 },
    verdict: "accepted",
    reviewer: "aaron",
    reviewedAt: "2026-08-26T12:00:00.000Z"
  });
  const rejected = createReviewRecord({
    record: rejectedTurn,
    source: { sessionPath: "one.jsonl", lineNumber: 2 },
    verdict: "rejected",
    flags: ["wrong-lore", "too-slow"],
    reviewer: "aaron",
    reviewedAt: "2026-08-26T12:01:00.000Z"
  });

  const report = buildEvidenceReport({
    interactions: [acceptedTurn, rejectedTurn, pendingTurn],
    reviews: [accepted, rejected],
    generatedAt: "2026-08-26T13:00:00.000Z"
  });

  assert.deepEqual(report.coverage, {
    totalInteractions: 3,
    reviewedInteractions: 2,
    acceptedInteractions: 1,
    rejectedInteractions: 1,
    pendingInteractions: 1,
    reviewCoverageRatio: 2 / 3
  });
  assert.deepEqual(report.humanReviewFlags, {
    "too-slow": 1,
    "wrong-lore": 1
  });
  assert.deepEqual(report.automaticSignals, {
    "technical-language-leak": 1,
    "validation-correction": 1
  });
  assert.deepEqual(report.latency.dialogueMs, {
    count: 3,
    min: 10,
    median: 20,
    p95: 30,
    max: 30,
    measurementMode: "measured"
  });
  assert.equal(report.cohorts.provider["ollama-local"], 2);
  assert.equal(report.cohorts.actorKind.creature, 1);
  assert.equal(Object.hasOwn(report, "policyRecommendation"), false);
});

test("report exposes duplicate and orphan review records instead of hiding them", () => {
  const record = turn({
    id: "00000001",
    name: "NPC",
    dialogueLatencyMs: 10,
    voiceLatencyMs: 100
  });
  const review = createReviewRecord({
    record,
    source: { sessionPath: "one.jsonl", lineNumber: 1 },
    verdict: "accepted",
    reviewer: "aaron",
    reviewedAt: "2026-08-26T12:00:00.000Z"
  });
  const orphan = { ...review, interactionId: "f".repeat(64) };

  const report = buildEvidenceReport({
    interactions: [record, structuredClone(record)],
    reviews: [review, structuredClone(review), orphan],
    generatedAt: "2026-08-26T13:00:00.000Z"
  });

  assert.equal(report.integrity.duplicateInteractionCount, 1);
  assert.equal(report.integrity.duplicateReviewCount, 1);
  assert.equal(report.integrity.orphanReviewCount, 1);
  assert.equal(report.coverage.totalInteractions, 1);
  assert.equal(report.coverage.reviewedInteractions, 1);
});

test("markdown report states denominators and evidence boundaries", () => {
  const record = turn({
    id: "00000001",
    name: "NPC",
    dialogueLatencyMs: 10,
    voiceLatencyMs: 100
  });
  const report = buildEvidenceReport({
    interactions: [record],
    reviews: [],
    generatedAt: "2026-08-26T13:00:00.000Z"
  });
  const markdown = renderEvidenceReportMarkdown(report);

  assert.match(markdown, /0 of 1 interactions reviewed/u);
  assert.match(markdown, /Automatic signals are deterministic heuristics/u);
  assert.match(markdown, /No routing or policy recommendation is produced/u);
  assert.equal(createInteractionId(record).length, 64);
});
