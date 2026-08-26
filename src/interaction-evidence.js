const TECHNICAL_LANGUAGE = /\b(ai|language model|model|prompt|json|player-selected|factual information)\b/iu;

function requireSpokenTurn(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError("record must be an object");
  }
  if (record.event !== "spoken-turn" || record.schemaVersion !== 1) {
    throw new TypeError("record must be a schema-v1 spoken-turn");
  }
  if (typeof record.characterId !== "string" || !record.characterId) {
    throw new TypeError("record.characterId must be a non-empty string");
  }
  return record;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function finiteMeasurement(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function classifyInteraction(input) {
  const record = requireSpokenTurn(input);
  const signals = [];
  if (record.dialogueReceipt?.fallbackUsed === true
    || record.dialogueReceipt?.groundingStatus === "fallback") {
    signals.push("grounding-fallback");
  }
  if (stringArray(record.dialogueReceipt?.validationFailures).length > 0) {
    signals.push("validation-correction");
  }
  if (record.voiceReceipt?.status !== "played") signals.push("voice-not-played");
  if (TECHNICAL_LANGUAGE.test(String(record.response ?? ""))) {
    signals.push("technical-language-leak");
  }
  if (record.augmentation?.actionAuthority !== "none"
    || record.augmentation?.humanControl !== "player-decides") {
    signals.push("action-authority-violation");
  }
  if (stringArray(record.proposedActions).length > 0
    || stringArray(record.executedActions).length > 0) {
    signals.push("unexpected-dialogue-action");
  }

  const measuredReceipts = [
    record.dialogueReceipt,
    record.routeReceipt,
    record.voiceReceipt
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    kind: "c-activity-interaction-evidence",
    status: signals.length === 0 ? "passed" : "attention-required",
    signals,
    measurements: {
      dialogueLatencyMs: finiteMeasurement(record.routeReceipt?.latencyMs),
      providerDurationMs: finiteMeasurement(record.dialogueReceipt?.totalDurationMs),
      voiceLatencyMs: finiteMeasurement(record.voiceReceipt?.latencyMs),
      inputTokens: finiteMeasurement(record.dialogueReceipt?.inputTokens),
      outputTokens: finiteMeasurement(record.dialogueReceipt?.outputTokens),
      providerApiCostUsd: finiteMeasurement(record.dialogueReceipt?.providerApiCostUsd),
      measurementMode: measuredReceipts.length > 0
        && measuredReceipts.every((receipt) => receipt.measurementMode === "measured")
        ? "measured"
        : "unknown"
    }
  };
}

function normalizeTerms(value) {
  return [...new Set(stringArray(value).map((term) => term.trim()).filter(Boolean))];
}

export function createReplayFixture({ fixtureId, record: input, review, expectations = {} }) {
  const record = requireSpokenTurn(input);
  const normalizedId = String(fixtureId ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedId)) {
    throw new TypeError("fixtureId must be a lowercase kebab-case identifier");
  }
  if (review?.verdict !== "human-accepted" || !String(review?.reviewer ?? "").trim()) {
    throw new TypeError("replay fixtures require a named human-accepted review");
  }
  const maxDialogueLatencyMs = expectations.maxDialogueLatencyMs == null
    ? null
    : finiteMeasurement(expectations.maxDialogueLatencyMs);
  if (expectations.maxDialogueLatencyMs != null && maxDialogueLatencyMs == null) {
    throw new TypeError("maxDialogueLatencyMs must be a non-negative finite number");
  }

  const usedFactKeys = stringArray(record.augmentation?.usedFactKeys);
  return {
    schemaVersion: 1,
    fixtureId: normalizedId,
    source: {
      evidenceMode: "human-observed",
      sourceEvent: "spoken-turn",
      ...(record.recordedAt ? { recordedAt: String(record.recordedAt) } : {})
    },
    review: {
      verdict: "human-accepted",
      reviewer: String(review.reviewer).trim(),
      ...(review.reviewedAt ? { reviewedAt: String(review.reviewedAt) } : {})
    },
    input: {
      target: structuredClone(record.target),
      question: String(record.question ?? "")
    },
    expectations: {
      characterId: record.characterId,
      answerMode: String(record.augmentation?.answerMode ?? "unknown"),
      requiredFactKeys: usedFactKeys,
      allowedFactKeys: usedFactKeys,
      allowedRoutes: [String(record.routeReceipt?.route ?? "unknown")],
      allowedProviders: [String(record.dialogueReceipt?.provider ?? "unknown")],
      groundingStatus: "passed",
      fallbackUsed: false,
      actionAuthority: "none",
      maxProposedActions: 0,
      maxExecutedActions: 0,
      maxDialogueLatencyMs,
      requiredVoiceModel: expectations.requiredVoiceModel == null
        ? null
        : String(expectations.requiredVoiceModel),
      forbiddenResponseTerms: normalizeTerms(expectations.forbiddenResponseTerms)
    }
  };
}

export function evaluateReplay(fixture, input) {
  const record = requireSpokenTurn(input);
  if (!fixture || fixture.schemaVersion !== 1 || typeof fixture.fixtureId !== "string") {
    throw new TypeError("fixture must be a schema-v1 replay fixture");
  }
  if (fixture.review?.verdict !== "human-accepted") {
    throw new TypeError("fixture must retain a human-accepted review");
  }
  const expected = fixture.expectations ?? {};
  const failures = [];
  const actualFactKeys = stringArray(record.augmentation?.usedFactKeys);
  const actualFacts = new Set(actualFactKeys);
  const allowedFacts = new Set(stringArray(expected.allowedFactKeys));

  if (record.characterId !== expected.characterId
    || record.routeReceipt?.characterId !== expected.characterId
    || record.voiceReceipt?.characterId !== expected.characterId) {
    failures.push("identity-continuity-regressed");
  }
  if (record.augmentation?.answerMode !== expected.answerMode) {
    failures.push("answer-mode-regressed");
  }
  if (!stringArray(expected.requiredFactKeys).every((key) => actualFacts.has(key))) {
    failures.push("required-fact-missing");
  }
  if (!actualFactKeys.every((key) => allowedFacts.has(key))) {
    failures.push("unexpected-fact-used");
  }
  if (!stringArray(expected.allowedRoutes).includes(String(record.routeReceipt?.route))) {
    failures.push("route-regressed");
  }
  if (!stringArray(expected.allowedProviders).includes(String(record.dialogueReceipt?.provider))) {
    failures.push("provider-regressed");
  }
  if (record.dialogueReceipt?.groundingStatus !== expected.groundingStatus
    || record.dialogueReceipt?.fallbackUsed !== expected.fallbackUsed) {
    failures.push("grounding-regressed");
  }
  if (record.augmentation?.actionAuthority !== expected.actionAuthority
    || record.augmentation?.humanControl !== "player-decides") {
    failures.push("action-authority-regressed");
  }
  if (stringArray(record.proposedActions).length > expected.maxProposedActions
    || stringArray(record.executedActions).length > expected.maxExecutedActions) {
    failures.push("unexpected-action");
  }
  const dialogueLatencyMs = finiteMeasurement(record.routeReceipt?.latencyMs);
  if (expected.maxDialogueLatencyMs != null
    && (dialogueLatencyMs == null || dialogueLatencyMs > expected.maxDialogueLatencyMs)) {
    failures.push("dialogue-latency-regressed");
  }
  if (expected.requiredVoiceModel != null
    && record.voiceReceipt?.model !== expected.requiredVoiceModel) {
    failures.push("voice-selection-regressed");
  }
  const response = String(record.response ?? "").toLocaleLowerCase("en-US");
  if (normalizeTerms(expected.forbiddenResponseTerms)
    .some((term) => response.includes(term.toLocaleLowerCase("en-US")))) {
    failures.push("forbidden-language-present");
  }

  return {
    fixtureId: fixture.fixtureId,
    passed: failures.length === 0,
    failures
  };
}
