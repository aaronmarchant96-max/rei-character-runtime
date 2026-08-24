import { performance } from "node:perf_hooks";

const SIMPLE_WORD_LIMIT = 18;

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
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
      ttsRequest: { characterId: id, text: speech },
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
