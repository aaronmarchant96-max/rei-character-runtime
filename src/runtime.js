import { performance } from "node:perf_hooks";

const SIMPLE_WORD_LIMIT = 18;

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeProviderReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null;
  return {
    provider: String(receipt.provider ?? "unknown"),
    model: String(receipt.model ?? "unknown"),
    inputTokens: Math.max(0, Number(receipt.inputTokens) || 0),
    outputTokens: Math.max(0, Number(receipt.outputTokens) || 0),
    totalDurationMs: Math.max(0, Number(receipt.totalDurationMs) || 0),
    loadDurationMs: Math.max(0, Number(receipt.loadDurationMs) || 0),
    generationDurationMs: Math.max(0, Number(receipt.generationDurationMs) || 0),
    providerApiCostUsd: Math.max(0, Number(receipt.providerApiCostUsd) || 0),
    attempts: Math.max(0, Number(receipt.attempts) || 0),
    groundingStatus: ["passed", "fallback"].includes(receipt.groundingStatus)
      ? receipt.groundingStatus
      : "unknown",
    fallbackUsed: receipt.fallbackUsed === true,
    validationFailures: Array.isArray(receipt.validationFailures)
      ? receipt.validationFailures.map(String)
      : [],
    measurementMode: receipt.measurementMode === "measured" ? "measured" : "unknown"
  };
}

function normalizeAugmentation(augmentation) {
  if (!augmentation || typeof augmentation !== "object" || Array.isArray(augmentation)) return null;
  const answerMode = augmentation.answerMode;
  if (!["known", "social", "unknown"].includes(answerMode)) {
    throw new TypeError("proposal.augmentation.answerMode must be known, social, or unknown");
  }
  return {
    answerMode,
    usedFactKeys: Array.isArray(augmentation.usedFactKeys)
      ? augmentation.usedFactKeys.map(String)
      : [],
    uncertainty: answerMode === "unknown" ? "explicit" : "none",
    humanControl: "player-decides",
    actionAuthority: "none"
  };
}

export function chooseRoute(playerText) {
  const text = requireText(playerText, "playerText");
  const wordCount = text.split(/\s+/u).length;
  const sensitive = /\b(quest|murder|steal|attack|secret|betray|dead|kill)\b/iu.test(text);

  if (sensitive || wordCount > SIMPLE_WORD_LIMIT) {
    return { route: "capable", reason: sensitive ? "sensitive-topic" : "complex-input" };
  }
  return { route: "economy", reason: "short-routine-input" };
}

export function createCharacterRuntime({ dialogueProvider, clock = performance } = {}) {
  if (typeof dialogueProvider !== "function") {
    throw new TypeError("dialogueProvider must be a function");
  }

  return async function converse({ character, playerText, world = {} }) {
    const id = requireText(character?.id, "character.id");
    const name = requireText(character?.name, "character.name");
    const voiceId = character?.voiceId == null ? null : requireText(character.voiceId, "character.voiceId");
    const input = requireText(playerText, "playerText");
    const routeDecision = chooseRoute(input);
    const started = clock.now();

    const proposal = await dialogueProvider({
      character: { id, name, persona: String(character.persona ?? "") },
      playerText: input,
      world: Object.freeze({ ...world }),
      route: routeDecision.route
    });

    const speech = requireText(proposal?.speech, "proposal.speech");
    const proposedActions = Array.isArray(proposal?.actions) ? proposal.actions : [];

    return {
      speech,
      subtitle: speech,
      proposedActions,
      executedActions: [],
      augmentation: normalizeAugmentation(proposal?.augmentation),
      ttsRequest: {
        characterId: id,
        text: speech,
        ...(voiceId ? { voiceId } : {})
      },
      dialogueReceipt: normalizeProviderReceipt(proposal?.providerReceipt),
      receipt: {
        characterId: id,
        route: routeDecision.route,
        routeReason: routeDecision.reason,
        latencyMs: Math.max(0, clock.now() - started),
        measurementMode: "measured"
      }
    };
  };
}

export function createDemoProvider() {
  return async ({ character, playerText }) => ({
    speech: `${character.name} considers your question: “${playerText}”`,
    actions: []
  });
}
