import { createCharacterRuntime } from "./runtime.js";
import { OBLIVION_PROFILE_CATALOG, resolveOblivionProfile } from "./oblivion-profiles.js";
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
  profileCatalog = OBLIVION_PROFILE_CATALOG
}) {
  if (typeof speak !== "function") throw new TypeError("speak must be a function");
  const normalizedTarget = normalizeTarget(target);
  const profile = resolveOblivionProfile(normalizedTarget, profileCatalog);
  const character = createTargetCharacter(normalizedTarget, profileCatalog);
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
  if (profile) Object.assign(world, profile.facts);
  const turn = await converse({
    character,
    playerText,
    world
  });
  turn.profileReceipt = profile
    ? {
        catalogId: profileCatalog.catalogId,
        profileId: profile.profileId,
        match: "form-id-and-name",
        factKeys: Object.keys(profile.facts),
        provenanceMode: profile.provenance.mode,
        provenanceReviewedAt: profile.provenance.reviewedAt,
        voiceId: profile.voice.modelId,
        voiceUsePolicy: profile.voice.usePolicy
      }
    : {
        catalogId: profileCatalog.catalogId,
        profileId: null,
        match: "generic-fallback",
        factKeys: [],
        provenanceMode: "none",
        provenanceReviewedAt: null,
        voiceId: null,
        voiceUsePolicy: null
      };
  turn.voiceReceipt = await speak(turn.ttsRequest);
  return { target: normalizedTarget, turn };
}
