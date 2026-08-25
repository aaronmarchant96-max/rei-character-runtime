import { createCharacterRuntime } from "./runtime.js";
import { selectConversationContext } from "./memory.js";
import {
  OBLIVION_PROFILE_CATALOG,
  resolveOblivionProfile,
  selectProfileFacts
} from "./oblivion-profiles.js";
import { parseTargetEnvelope } from "./target.js";

function normalizeTarget(target) {
  return parseTargetEnvelope(JSON.stringify(target));
}

export function createTargetCharacter(target, catalog = OBLIVION_PROFILE_CATALOG) {
  const normalized = normalizeTarget(target);
  const label = normalized.actorKind === "npc" ? "NPC" : "creature";
  const profile = resolveOblivionProfile(normalized, catalog);
  return {
    id: `${normalized.game}:${normalized.referenceFormId}`,
    name: normalized.displayName || `Oblivion ${label} ${normalized.referenceFormId}`,
    persona: profile?.persona
      ?? `A player-selected ${label} in original Oblivion. No canonical biography or dialogue facts have been imported.`,
    ...(profile ? { voiceId: profile.voice.modelId } : {})
  };
}

export async function runTargetConversation({
  target,
  playerText,
  dialogueProvider,
  speak,
  memoryStore = null,
  profileCatalog = OBLIVION_PROFILE_CATALOG
}) {
  if (typeof speak !== "function") throw new TypeError("speak must be a function");
  const normalizedTarget = normalizeTarget(target);
  const profile = resolveOblivionProfile(normalizedTarget, profileCatalog);
  const character = createTargetCharacter(normalizedTarget, profileCatalog);
  const memory = memoryStore
    ? await memoryStore.load(character.id)
    : { schemaVersion: 1, characterId: character.id, totalTurns: 0, turns: [] };
  const conversationContext = selectConversationContext(memory, playerText);
  let selectedProfile = selectProfileFacts(profile, playerText);
  if (!selectedProfile.retrieval
    && /\b(that|this|it|they|them|he|she|her|him|those|these|earlier|before|again)\b/iu.test(playerText)) {
    for (const previous of [...conversationContext.turns].reverse()) {
      selectedProfile = selectProfileFacts(profile, `${playerText} ${previous.playerText}`);
      if (selectedProfile.retrieval) break;
    }
  }
  const converse = createCharacterRuntime({ dialogueProvider });
  const world = {
    "game.referenceFormId": normalizedTarget.referenceFormId,
    "game.actorKind": normalizedTarget.actorKind
  };
  if (normalizedTarget.locationFormId) {
    world["game.locationFormId"] = normalizedTarget.locationFormId;
  }
  if (normalizedTarget.locationName) {
    world["game.locationName"] = normalizedTarget.locationName;
  }
  Object.assign(world, selectedProfile.facts);
  const turn = await converse({
    character,
    playerText,
    world,
    conversationContext,
    retrievedFactKeys: selectedProfile.retrieval?.factKeys ?? []
  });
  turn.profileReceipt = profile
    ? {
        catalogId: profileCatalog.catalogId,
        profileId: profile.profileId,
        match: "form-id-and-name",
        factKeys: Object.keys(profile.facts),
        retrievalIntent: selectedProfile.retrieval?.intent ?? null,
        retrievedFactKeys: selectedProfile.retrieval?.factKeys ?? [],
        provenanceMode: profile.provenance.mode,
        provenanceReviewedAt: profile.provenance.reviewedAt,
        voiceId: profile.voice.modelId,
        voiceUsePolicy: profile.voice.usePolicy,
        voiceDatasetLicense: profile.voice.datasetLicense,
        voiceSource: profile.voice.source
      }
    : {
        catalogId: profileCatalog.catalogId,
        profileId: null,
        match: "generic-fallback",
        factKeys: [],
        retrievalIntent: null,
        retrievedFactKeys: [],
        provenanceMode: "none",
        provenanceReviewedAt: null,
        voiceId: null,
        voiceUsePolicy: null,
        voiceDatasetLicense: null,
        voiceSource: null
      };
  turn.voiceReceipt = await speak(turn.ttsRequest);
  if (memoryStore) {
    const stored = await memoryStore.append({
      characterId: character.id,
      playerText,
      npcText: turn.speech,
      answerMode: turn.augmentation?.answerMode ?? "unknown",
      usedFactKeys: turn.augmentation?.usedFactKeys ?? []
    });
    turn.memoryReceipt = {
      mode: "persistent-local",
      loadedTurns: memory.totalTurns,
      providedTurns: conversationContext.turns.length,
      providedTurnIds: conversationContext.turns.map((entry) => entry.turnId),
      contextCharacters: conversationContext.characterCount,
      relationship: conversationContext.relationship,
      storedTurnId: stored.turnId
    };
  } else {
    turn.memoryReceipt = {
      mode: "disabled",
      loadedTurns: 0,
      providedTurns: 0,
      providedTurnIds: [],
      contextCharacters: 0,
      relationship: conversationContext.relationship,
      storedTurnId: null
    };
  }
  return { target: normalizedTarget, turn };
}
