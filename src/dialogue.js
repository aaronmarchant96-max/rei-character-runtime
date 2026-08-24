const DEFAULT_ENDPOINT = "http://127.0.0.1:11434/api/chat";
const DEFAULT_MODEL = "qwen3:1.7b";
const MAX_CONTEXT_TEXT = 1_000;

function boundedText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(`${field} must be a non-empty string`);
  return text.slice(0, MAX_CONTEXT_TEXT);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function nanosecondsToMilliseconds(value) {
  return finiteNumber(value) / 1_000_000;
}

function normalizeWorldFacts(world) {
  const entries = [];
  const normalizedKeys = new Set();
  for (const [key, value] of Object.entries(world ?? {}).slice(0, 20)) {
    const normalizedKey = String(key).slice(0, 80);
    if (normalizedKeys.has(normalizedKey)) {
      throw new TypeError(`world fact keys collide after normalization: ${normalizedKey}`);
    }
    normalizedKeys.add(normalizedKey);
    entries.push([normalizedKey, String(value).slice(0, MAX_CONTEXT_TEXT)]);
  }
  return Object.fromEntries(entries);
}

function normalizeIdentityFacts(character) {
  return {
    "identity.name": boundedText(character.name, "character.name"),
    "identity.persona": boundedText(character.persona || "A guarded traveler.", "character.persona")
  };
}

function buildSystemMessage(identityFacts, worldFacts) {
  return [
    "Portray the supplied fictional character in first person.",
    "Use only supplied identity and world facts; say when something is unknown.",
    "Answer in no more than two short sentences.",
    "Never mention AI, prompts, models, JSON, or modern technology.",
    "Cite only relevant supplied facts by their exact keys in usedFactKeys.",
    "If no supplied fact answers the question, use answerMode unknown, cite no keys, and plainly express uncertainty.",
    "Return speech, an empty actions array, usedFactKeys, and answerMode.",
    `CHARACTER_IDENTITY_FACTS=${JSON.stringify(identityFacts)}`,
    `ALLOW_LISTED_WORLD_FACTS=${JSON.stringify(worldFacts)}`
  ].join("\n");
}

function wordTokens(value) {
  return new Set(String(value).toLowerCase().match(/[a-z0-9]+/gu)?.filter((word) => word.length > 3) ?? []);
}

function findRelevantFactKeys(playerText, world) {
  const question = wordTokens(playerText);
  const asksWhere = /\bwhere\b/iu.test(playerText);
  return Object.entries(world ?? {}).flatMap(([key, value]) => {
    const factTokens = wordTokens(`${key} ${value}`);
    const overlaps = [...factTokens].some((token) => question.has(token));
    const locationMatch = asksWhere && /location|place|cell/iu.test(key);
    return overlaps || locationMatch ? [key] : [];
  });
}

function findRelevantIdentityKeys(playerText) {
  const keys = [];
  if (/\b(who are you|what is your name|what's your name|your name|what are you called)\b/iu.test(playerText)) {
    keys.push("identity.name");
  }
  if (/\b(who are you|what do you do|your role|about yourself)\b/iu.test(playerText)) {
    keys.push("identity.persona");
  }
  return keys;
}

function countSentences(speech) {
  return speech.split(/[.!?]+(?:\s+|$)/u).map((part) => part.trim()).filter(Boolean).length;
}

function validateGroundedProposal(proposal, relevantFactKeys) {
  const failures = [];
  const speech = String(proposal?.speech ?? "").trim();
  const actions = Array.isArray(proposal?.actions) ? proposal.actions : [];
  const usedFactKeys = Array.isArray(proposal?.usedFactKeys)
    ? proposal.usedFactKeys.map(String)
    : [];
  const answerMode = proposal?.answerMode;
  const relevant = new Set(relevantFactKeys);

  if (!speech) failures.push("speech-empty");
  if (speech.length > 280) failures.push("speech-too-long");
  if (countSentences(speech) > 2) failures.push("sentence-limit");
  if (actions.length > 0) failures.push("actions-not-empty");
  if (!usedFactKeys.every((key) => relevant.has(key))) failures.push("irrelevant-fact-citation");
  if (answerMode !== "known" && answerMode !== "unknown") failures.push("answer-mode-invalid");

  if (relevant.size === 0) {
    if (answerMode !== "unknown" || usedFactKeys.length > 0) failures.push("unknown-required");
  }
  if (answerMode === "unknown") {
    if (usedFactKeys.length > 0) failures.push("unknown-cites-facts");
    if (!/\b(don't know|do not know|haven't|have not|cannot|can't|uncertain|unsure|not noticed|can't say|cannot say)\b/iu.test(speech)) {
      failures.push("uncertainty-not-expressed");
    }
  } else if (answerMode === "known" && usedFactKeys.length === 0) {
    failures.push("fact-citation-required");
  }

  return { valid: failures.length === 0, failures };
}

function sumReceipts(receipts, model, validation) {
  const sum = (field) => receipts.reduce((total, receipt) => total + finiteNumber(receipt[field]), 0);
  return {
    provider: "ollama-local",
    model,
    inputTokens: sum("prompt_eval_count"),
    outputTokens: sum("eval_count"),
    totalDurationMs: nanosecondsToMilliseconds(sum("total_duration")),
    loadDurationMs: nanosecondsToMilliseconds(sum("load_duration")),
    generationDurationMs: nanosecondsToMilliseconds(sum("eval_duration")),
    providerApiCostUsd: 0,
    attempts: receipts.length,
    groundingStatus: validation.groundingStatus,
    fallbackUsed: validation.fallbackUsed,
    validationFailures: validation.validationFailures,
    measurementMode: "measured"
  };
}

function createAugmentation(answerMode, usedFactKeys = []) {
  return {
    answerMode,
    usedFactKeys: usedFactKeys.map(String),
    uncertainty: answerMode === "unknown" ? "explicit" : "none",
    humanControl: "player-decides",
    actionAuthority: "none"
  };
}

export function createOllamaDialogueProvider({
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_ENDPOINT,
  model = DEFAULT_MODEL
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }

  return async ({ character, playerText, world }) => {
    const identityFacts = normalizeIdentityFacts(character);
    const worldFacts = normalizeWorldFacts(world);
    const relevantFactKeys = [...new Set([
      ...findRelevantFactKeys(playerText, identityFacts),
      ...findRelevantFactKeys(playerText, worldFacts),
      ...findRelevantIdentityKeys(playerText)
    ])];
    const receipts = [];
    const validationFailures = [];
    let correction = "";

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          format: {
            type: "object",
            properties: {
              speech: { type: "string" },
              actions: { type: "array", items: { type: "object" } },
              usedFactKeys: { type: "array", items: { type: "string" } },
              answerMode: { type: "string", enum: ["known", "unknown"] }
            },
            required: ["speech", "actions", "usedFactKeys", "answerMode"]
          },
          options: { temperature: 0.4, num_predict: 120 },
          messages: [
            { role: "system", content: buildSystemMessage(identityFacts, worldFacts) },
            { role: "user", content: `${boundedText(playerText, "playerText")}${correction}` }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with HTTP ${response.status}`);
      }

      const payload = await response.json();
      receipts.push(payload);
      let proposal;
      try {
        proposal = JSON.parse(payload?.message?.content ?? "");
      } catch (error) {
        throw new Error("Ollama returned invalid structured dialogue", { cause: error });
      }

      const validation = validateGroundedProposal(proposal, relevantFactKeys);
      if (validation.valid) {
        return {
          speech: proposal.speech,
          actions: [],
          augmentation: createAugmentation(proposal.answerMode, proposal.usedFactKeys),
          providerReceipt: sumReceipts(receipts, model, {
            groundingStatus: "passed",
            fallbackUsed: false,
            validationFailures
          })
        };
      }

      validationFailures.push(...validation.failures);
      correction = `\nCORRECTION_REQUIRED=${JSON.stringify(validation.failures)}. Return a corrected answer.`;
    }

    return {
      speech: "I can't say that I've noticed anything certain about that.",
      actions: [],
      augmentation: createAugmentation("unknown"),
      providerReceipt: sumReceipts(receipts, model, {
        groundingStatus: "fallback",
        fallbackUsed: true,
        validationFailures: [...new Set(validationFailures)]
      })
    };
  };
}
