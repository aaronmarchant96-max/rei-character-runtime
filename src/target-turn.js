import { createCharacterRuntime } from "./runtime.js";
import { parseTargetEnvelope } from "./target.js";

function normalizeTarget(target) {
  return parseTargetEnvelope(JSON.stringify(target));
}

export function createTargetCharacter(target) {
  const normalized = normalizeTarget(target);
  const label = normalized.actorKind === "npc" ? "NPC" : "creature";
  return {
    id: `${normalized.game}:${normalized.referenceFormId}`,
    name: `Oblivion ${label} ${normalized.referenceFormId}`,
    persona: `A player-selected ${label} in original Oblivion. No canonical biography or dialogue facts have been imported.`
  };
}

export async function runTargetConversation({
  target,
  playerText,
  dialogueProvider,
  speak
}) {
  if (typeof speak !== "function") throw new TypeError("speak must be a function");
  const normalizedTarget = normalizeTarget(target);
  const character = createTargetCharacter(normalizedTarget);
  const converse = createCharacterRuntime({ dialogueProvider });
  const turn = await converse({
    character,
    playerText,
    world: {
      "game.referenceFormId": normalizedTarget.referenceFormId,
      "game.actorKind": normalizedTarget.actorKind
    }
  });
  turn.voiceReceipt = await speak(turn.ttsRequest);
  return { target: normalizedTarget, turn };
}
