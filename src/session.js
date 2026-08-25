import { appendFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { resolveOblivionProfile } from "./oblivion-profiles.js";
import { parseTargetEnvelope } from "./target.js";

function normalizeQuestion(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("question must be a non-empty string");
  }
  const question = value.trim();
  if (question.length > 1_000) throw new RangeError("question must be at most 1000 characters");
  if (/[\u0000-\u001F\u007F]/u.test(question)) {
    throw new TypeError("question must not contain control characters");
  }
  return question;
}

function normalizeTarget(target) {
  return parseTargetEnvelope(JSON.stringify(target));
}

export function describeTargetKnowledge(target) {
  const normalized = normalizeTarget(target);
  const profile = resolveOblivionProfile(normalized);
  const knownFacts = {
    game: normalized.game,
    referenceFormId: normalized.referenceFormId,
    actorKind: normalized.actorKind
  };
  const unknownFacts = [];
  if (normalized.displayName) knownFacts.displayName = normalized.displayName;
  else unknownFacts.push("canonicalName");
  if (normalized.locationFormId) knownFacts.locationFormId = normalized.locationFormId;
  if (normalized.locationName) knownFacts.locationName = normalized.locationName;
  else unknownFacts.push("currentLocation");
  if (profile) {
    knownFacts.profileId = profile.profileId;
    knownFacts.profileFactKeys = Object.keys(profile.facts);
  } else {
    unknownFacts.push("canonicalBiography");
  }
  unknownFacts.push("canonicalDialogue");
  return {
    knownFacts,
    unknownFacts
  };
}

export function createSpokenTurnRecord({ target, question, turn }) {
  const normalized = normalizeTarget(target);
  const normalizedQuestion = normalizeQuestion(question);
  const characterId = `${normalized.game}:${normalized.referenceFormId}`;
  const observedCharacterIds = [
    turn?.receipt?.characterId,
    turn?.ttsRequest?.characterId,
    turn?.voiceReceipt?.characterId
  ];
  if (!observedCharacterIds.every((value) => value === characterId)) {
    throw new TypeError("turn failed selected-target identity continuity");
  }
  if ((turn?.proposedActions?.length ?? 0) > 0 || (turn?.executedActions?.length ?? 0) > 0) {
    throw new TypeError("supervised target turn must not contain actions");
  }
  if (turn?.augmentation?.humanControl !== "player-decides"
    || turn?.augmentation?.actionAuthority !== "none") {
    throw new TypeError("supervised target turn must preserve human control");
  }

  return {
    schemaVersion: 1,
    event: "spoken-turn",
    characterId,
    target: normalized,
    question: normalizedQuestion,
    response: String(turn?.speech ?? ""),
    augmentation: turn.augmentation,
    dialogueReceipt: turn?.dialogueReceipt ?? null,
    routeReceipt: turn?.receipt ?? null,
    profileReceipt: turn?.profileReceipt ?? null,
    materialReceipt: turn?.materialReceipt ?? null,
    memoryReceipt: turn?.memoryReceipt ?? null,
    voiceReceipt: turn?.voiceReceipt ?? null,
    proposedActions: [],
    executedActions: []
  };
}

export async function appendSessionRecord(outputPath, record) {
  if (typeof outputPath !== "string" || !isAbsolute(outputPath)) {
    throw new TypeError("outputPath must be an absolute path");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError("record must be an object");
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await appendFile(outputPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}
