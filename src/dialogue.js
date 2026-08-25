const DEFAULT_ENDPOINT = "http://127.0.0.1:11434/api/chat";
const DEFAULT_MODEL = "qwen3:1.7b";
const MAX_CONTEXT_TEXT = 1_000;
export const LOCAL_CHARACTER_MODELS = Object.freeze({
  social: "qwen3:0.6b",
  grounded: "qwen3:1.7b",
  unknown: "qwen3:0.6b"
});

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

function buildSystemMessage(identityFacts, worldFacts, socialAllowed, relevantFactKeys, conversationContext) {
  return [
    "Portray the supplied fictional character in first person.",
    "Use the supplied persona for tone, temperament, and conversational style.",
    "Use only supplied identity and world facts for factual claims; say when something is unknown.",
    "You may express emotions consistent with the persona and supplied facts, but do not invent new people, events, traits, relationships, or repeated habits.",
    "Answer the current question directly instead of repeating the entire previous response.",
    "Answer in no more than three short sentences.",
    "Never mention AI, prompts, models, JSON, or modern technology.",
    "Cite only relevant supplied facts by their exact keys in usedFactKeys.",
    "Conversation memory is prior player/NPC dialogue, not canonical evidence. Use it only for continuity; never turn an unsupported earlier claim into a world fact.",
    "Use relationship familiarity only to adjust warmth and recognition. Never announce its label or turn count.",
    socialAllowed
      ? "This is casual social conversation: use answerMode social, cite no keys, and give one brief greeting or reply without volunteering biography, grief, factions, or world events."
      : "For a supported factual answer use answerMode known; otherwise use answerMode unknown and plainly express uncertainty.",
    "Return speech, an empty actions array, usedFactKeys, and answerMode.",
    `PERMITTED_USED_FACT_KEYS=${JSON.stringify(relevantFactKeys)}`,
    `CHARACTER_IDENTITY_FACTS=${JSON.stringify(identityFacts)}`,
    `ALLOW_LISTED_WORLD_FACTS=${JSON.stringify(worldFacts)}`,
    `BOUNDED_CONVERSATION_MEMORY=${JSON.stringify(conversationContext.turns)}`,
    `RELATIONSHIP_STATE=${JSON.stringify(conversationContext.relationship)}`
  ].join("\n");
}

export function isSocialInput(playerText) {
  return /^\s*(hello|hi|hey|greetings|hail|good (?:morning|afternoon|evening)|how are you|how do you fare|nice to meet you|thank you|thanks|farewell|goodbye)\b/iu
    .test(String(playerText));
}

function isContinuityInput(playerText) {
  return /\b(remember|earlier|before|again|we spoke|you said|last time|know me|met me|that|this|it)\b/iu
    .test(String(playerText));
}

function normalizeConversationContext(value) {
  const turns = Array.isArray(value?.turns)
    ? value.turns.slice(-4).map((turn) => ({
        turnId: String(turn?.turnId ?? "").slice(0, 32),
        playerText: String(turn?.playerText ?? "").slice(0, 1_000),
        npcText: String(turn?.npcText ?? "").slice(0, 280),
        answerMode: String(turn?.answerMode ?? "unknown").slice(0, 16),
        usedFactKeys: Array.isArray(turn?.usedFactKeys)
          ? turn.usedFactKeys.map(String).slice(0, 12)
          : []
      }))
    : [];
  const totalCharacters = turns.reduce(
    (total, turn) => total + turn.playerText.length + turn.npcText.length,
    0
  );
  if (totalCharacters > 1_600) throw new TypeError("conversation context exceeds 1600 characters");
  const turnCount = Math.max(0, Number(value?.relationship?.turnCount) || 0);
  const familiarity = ["stranger", "met", "acquaintance", "familiar"].includes(value?.relationship?.familiarity)
    ? value.relationship.familiarity
    : "stranger";
  return Object.freeze({
    turns: Object.freeze(turns),
    relationship: Object.freeze({ turnCount, familiarity })
  });
}

function wordTokens(value) {
  return new Set(String(value).toLowerCase().match(/[a-z0-9]+/gu)?.filter((word) => word.length > 3) ?? []);
}

function findRelevantFactKeys(playerText, world) {
  const question = wordTokens(playerText);
  const asksWhere = /\bwhere\b/iu.test(playerText);
  const asksOrigin = /\b(where (?:are|were|did) (?:you|he|she).*from|come from|origin|homeland)\b/iu.test(playerText);
  return Object.entries(world ?? {}).flatMap(([key, value]) => {
    const factTokens = wordTokens(`${key} ${value}`);
    const overlaps = [...factTokens].some((token) => question.has(token));
    const locationMatch = asksWhere && /location|place|cell/iu.test(key);
    const originMatch = asksOrigin && /origin|home|homeland/iu.test(key);
    return overlaps || locationMatch || originMatch ? [key] : [];
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

function validateGroundedProposal(proposal, relevantFactKeys, { socialAllowed = false } = {}) {
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
  if (countSentences(speech) > (socialAllowed ? 4 : 3)) failures.push("sentence-limit");
  if (actions.length > 0) failures.push("actions-not-empty");
  if (!usedFactKeys.every((key) => relevant.has(key))) failures.push("irrelevant-fact-citation");
  if (!["known", "social", "unknown"].includes(answerMode)) failures.push("answer-mode-invalid");

  if (socialAllowed && answerMode !== "social") failures.push("social-required");
  if (!socialAllowed && answerMode === "social") failures.push("social-not-allowed");
  if (relevant.size === 0 && !socialAllowed) {
    if (answerMode !== "unknown" || usedFactKeys.length > 0) failures.push("unknown-required");
  }
  if (answerMode === "social") {
    if (usedFactKeys.length > 0) failures.push("social-cites-facts");
  } else if (answerMode === "unknown") {
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
  model = DEFAULT_MODEL,
  modelByRoute = {},
  modelByMode = {}
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }

  return async ({
    character,
    playerText,
    world,
    route,
    conversationContext: rawConversationContext,
    retrievedFactKeys = []
  }) => {
    const identityFacts = normalizeIdentityFacts(character);
    const worldFacts = normalizeWorldFacts(world);
    const conversationContext = normalizeConversationContext(rawConversationContext);
    const explicitRetrievedKeys = Array.isArray(retrievedFactKeys)
      ? retrievedFactKeys.map(String).filter((key) => Object.hasOwn(worldFacts, key))
      : [];
    const relevantWorldFactKeys = [...new Set([
      ...findRelevantFactKeys(playerText, worldFacts),
      ...explicitRetrievedKeys
    ])];
    const relevantFactKeys = [...new Set([
      ...findRelevantFactKeys(playerText, identityFacts),
      ...relevantWorldFactKeys,
      ...findRelevantIdentityKeys(playerText)
    ])];
    const retrievedWorldFacts = Object.fromEntries(
      relevantWorldFactKeys.map((key) => [key, worldFacts[key]])
    );
    const socialAllowed = isSocialInput(playerText)
      || (conversationContext.turns.length > 0 && isContinuityInput(playerText) && relevantFactKeys.length === 0);
    const dialogueMode = socialAllowed
      ? "social"
      : relevantFactKeys.length > 0 ? "grounded" : "unknown";
    const selectedModel = modelByMode[dialogueMode] ?? modelByRoute[route] ?? model;
    const receipts = [];
    const validationFailures = [];
    let correction = "";

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model: selectedModel,
          stream: false,
          think: false,
          format: {
            type: "object",
            properties: {
              speech: { type: "string" },
              actions: { type: "array", items: { type: "object" } },
              usedFactKeys: { type: "array", items: { type: "string" } },
              answerMode: { type: "string", enum: ["known", "social", "unknown"] }
            },
            required: ["speech", "actions", "usedFactKeys", "answerMode"]
          },
          options: { temperature: 0.3, num_predict: 120 },
          messages: [
            {
              role: "system",
              content: buildSystemMessage(
                identityFacts,
                retrievedWorldFacts,
                socialAllowed,
                relevantFactKeys,
                conversationContext
              )
            },
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
      } catch {
        validationFailures.push("structured-output-invalid");
        correction = "\nCORRECTION_REQUIRED=[\"structured-output-invalid\"]. Return complete valid JSON only.";
        continue;
      }

      const validation = validateGroundedProposal(proposal, relevantFactKeys, { socialAllowed });
      if (validation.valid) {
        return {
          speech: proposal.speech,
          actions: [],
          augmentation: createAugmentation(proposal.answerMode, proposal.usedFactKeys),
          providerReceipt: sumReceipts(receipts, selectedModel, {
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
      speech: socialAllowed
        ? "Well met. What brings you my way?"
        : "I can't say that I've noticed anything certain about that.",
      actions: [],
      augmentation: createAugmentation(socialAllowed ? "social" : "unknown"),
      providerReceipt: sumReceipts(receipts, selectedModel, {
        groundingStatus: "fallback",
        fallbackUsed: true,
        validationFailures: [...new Set(validationFailures)]
      })
    };
  };
}

export function createRoutedOllamaDialogueProvider(options = {}) {
  return createOllamaDialogueProvider({
    ...options,
    modelByMode: options.modelByMode ?? LOCAL_CHARACTER_MODELS
  });
}
