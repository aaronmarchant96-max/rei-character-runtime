import { classifyInteraction } from "./interaction-evidence.js";
import { createInteractionId } from "./evidence-review.js";

function increment(map, key) {
  const normalized = String(key ?? "unknown") || "unknown";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function measuredValue(receipt, field) {
  if (receipt?.measurementMode !== "measured") return null;
  const value = Number(receipt[field]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function distribution(values) {
  const sorted = values.filter((value) => value != null).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return {
      count: 0,
      min: null,
      median: null,
      p95: null,
      max: null,
      measurementMode: "unavailable"
    };
  }
  const percentile = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return {
    count: sorted.length,
    min: sorted[0],
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1),
    measurementMode: "measured"
  };
}

function normalizeInteraction(entry) {
  const record = entry?.record ?? entry;
  if (!record || record.schemaVersion !== 1 || record.event !== "spoken-turn") {
    throw new TypeError("interactions must contain schema-v1 spoken-turn records");
  }
  return record;
}

function normalizeReview(review) {
  if (!review || review.schemaVersion !== 1 || review.event !== "interaction-review") {
    throw new TypeError("reviews must contain schema-v1 interaction-review records");
  }
  if (typeof review.interactionId !== "string" || !review.interactionId) {
    throw new TypeError("review.interactionId must be a non-empty string");
  }
  return review;
}

export function buildEvidenceReport({ interactions, reviews, generatedAt = new Date().toISOString() }) {
  const interactionList = Array.isArray(interactions) ? interactions.map(normalizeInteraction) : [];
  const reviewList = Array.isArray(reviews) ? reviews.map(normalizeReview) : [];
  const uniqueInteractions = new Map();
  for (const record of interactionList) uniqueInteractions.set(createInteractionId(record), record);
  const latestReviews = new Map();
  for (const review of reviewList) latestReviews.set(review.interactionId, review);

  const humanFlags = new Map();
  const automaticSignals = new Map();
  const actorKind = new Map();
  const character = new Map();
  const route = new Map();
  const provider = new Map();
  const voiceModel = new Map();
  const reviewVerdict = new Map();
  const dialogueLatencies = [];
  const voiceLatencies = [];
  let accepted = 0;
  let rejected = 0;
  let reviewed = 0;

  for (const [interactionId, record] of uniqueInteractions) {
    for (const signal of classifyInteraction(record).signals) increment(automaticSignals, signal);
    increment(actorKind, record.target?.actorKind);
    increment(character, record.target?.displayName ?? record.characterId);
    increment(route, record.routeReceipt?.route);
    increment(provider, record.dialogueReceipt?.provider);
    increment(voiceModel, record.voiceReceipt?.model);
    dialogueLatencies.push(measuredValue(record.routeReceipt, "latencyMs"));
    voiceLatencies.push(measuredValue(record.voiceReceipt, "latencyMs"));

    const review = latestReviews.get(interactionId);
    if (!review) {
      increment(reviewVerdict, "pending");
      continue;
    }
    reviewed += 1;
    increment(reviewVerdict, review.verdict);
    if (review.verdict === "accepted") accepted += 1;
    if (review.verdict === "rejected") rejected += 1;
    for (const flag of Array.isArray(review.flags) ? review.flags : []) increment(humanFlags, flag);
  }

  const total = uniqueInteractions.size;
  const orphanReviewCount = [...latestReviews.keys()]
    .filter((interactionId) => !uniqueInteractions.has(interactionId)).length;

  return {
    schemaVersion: 1,
    kind: "c-activity-evidence-report",
    generatedAt: String(generatedAt),
    coverage: {
      totalInteractions: total,
      reviewedInteractions: reviewed,
      acceptedInteractions: accepted,
      rejectedInteractions: rejected,
      pendingInteractions: total - reviewed,
      reviewCoverageRatio: total === 0 ? null : reviewed / total
    },
    integrity: {
      interactionRecords: interactionList.length,
      reviewRecords: reviewList.length,
      duplicateInteractionCount: interactionList.length - uniqueInteractions.size,
      duplicateReviewCount: reviewList.length - latestReviews.size,
      orphanReviewCount
    },
    humanReviewFlags: sortedObject(humanFlags),
    automaticSignals: sortedObject(automaticSignals),
    latency: {
      dialogueMs: distribution(dialogueLatencies),
      voiceMs: distribution(voiceLatencies),
      percentileMethod: "nearest-rank"
    },
    cohorts: {
      actorKind: sortedObject(actorKind),
      character: sortedObject(character),
      route: sortedObject(route),
      provider: sortedObject(provider),
      voiceModel: sortedObject(voiceModel),
      reviewVerdict: sortedObject(reviewVerdict)
    },
    evidenceBoundary: {
      humanFlagsSource: "latest matched human review per interaction",
      automaticSignalsSource: "deterministic receipt classifier",
      latencySource: "spoken-turn receipts marked measured",
      policyAuthority: "none"
    }
  };
}

function percent(value) {
  return value == null ? "unavailable" : `${(value * 100).toFixed(1)}%`;
}

function latencyLine(name, stats) {
  if (stats.count === 0) return `- ${name}: unavailable (0 measured samples)`;
  return `- ${name}: median ${stats.median.toFixed(1)} ms; p95 ${stats.p95.toFixed(1)} ms; range ${stats.min.toFixed(1)}–${stats.max.toFixed(1)} ms (${stats.count} measured samples)`;
}

function countLines(values) {
  const entries = Object.entries(values);
  return entries.length === 0
    ? "- None"
    : entries.map(([key, count]) => `- ${key}: ${count}`).join("\n");
}

export function renderEvidenceReportMarkdown(report) {
  const coverage = report.coverage;
  return `# EchoForge C-Activity Evidence Report

Generated: ${report.generatedAt}

## Review coverage

${coverage.reviewedInteractions} of ${coverage.totalInteractions} interactions reviewed (${percent(coverage.reviewCoverageRatio)}).

- Accepted: ${coverage.acceptedInteractions}
- Rejected: ${coverage.rejectedInteractions}
- Pending: ${coverage.pendingInteractions}

## Human review flags

${countLines(report.humanReviewFlags)}

## Automatic signals

${countLines(report.automaticSignals)}

Automatic signals are deterministic heuristics, not human quality judgments.

## Measured latency

${latencyLine("Dialogue", report.latency.dialogueMs)}
${latencyLine("Voice", report.latency.voiceMs)}

Percentiles use the nearest-rank method. Only receipts explicitly marked measured are included.

## Integrity

- Duplicate interaction records: ${report.integrity.duplicateInteractionCount}
- Duplicate review records: ${report.integrity.duplicateReviewCount}
- Orphan review records: ${report.integrity.orphanReviewCount}

## Boundary

No routing or policy recommendation is produced. This report summarizes evidence and has no execution authority.
`;
}
