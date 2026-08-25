import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_STORED_TURNS = 24;
const MAX_CONTEXT_TURNS = 4;
const MAX_CONTEXT_CHARACTERS = 1_600;
const ANSWER_MODES = new Set(["known", "social", "unknown"]);

function boundedText(value, field, maximum) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim().slice(0, maximum);
}

function normalizeFactKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((key) => String(key).slice(0, 80)))].slice(0, 12);
}

function normalizeTurn(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`memory turn ${index} must be an object`);
  }
  const answerMode = ANSWER_MODES.has(value.answerMode) ? value.answerMode : "unknown";
  return Object.freeze({
    turnId: boundedText(value.turnId, `memory turn ${index} turnId`, 32),
    playerText: boundedText(value.playerText, `memory turn ${index} playerText`, 1_000),
    npcText: boundedText(value.npcText, `memory turn ${index} npcText`, 280),
    answerMode,
    usedFactKeys: Object.freeze(normalizeFactKeys(value.usedFactKeys)),
    recordedAt: typeof value.recordedAt === "string" ? value.recordedAt.slice(0, 40) : null
  });
}

function emptyMemory(characterId) {
  return Object.freeze({
    schemaVersion: 1,
    characterId,
    totalTurns: 0,
    turns: Object.freeze([])
  });
}

function parseMemory(value, expectedCharacterId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("character memory must be an object");
  }
  if (value.schemaVersion !== 1) throw new TypeError("character memory schemaVersion must be 1");
  const characterId = boundedText(value.characterId, "memory characterId", 160);
  if (characterId !== expectedCharacterId) throw new TypeError("character memory identity mismatch");
  if (!Number.isSafeInteger(value.totalTurns) || value.totalTurns < 0) {
    throw new TypeError("character memory totalTurns must be a non-negative integer");
  }
  if (!Array.isArray(value.turns) || value.turns.length > MAX_STORED_TURNS) {
    throw new TypeError(`character memory turns must contain at most ${MAX_STORED_TURNS} entries`);
  }
  const turns = value.turns.map(normalizeTurn);
  return Object.freeze({
    schemaVersion: 1,
    characterId,
    totalTurns: value.totalTurns,
    turns: Object.freeze(turns)
  });
}

function memoryPath(directory, characterId) {
  const digest = createHash("sha256").update(characterId).digest("hex");
  return resolve(directory, `${digest}.json`);
}

function tokens(value) {
  return new Set(String(value).toLowerCase().match(/[a-z0-9]+/gu)?.filter((word) => word.length > 3) ?? []);
}

function overlapScore(questionTokens, turn) {
  const turnTokens = tokens(`${turn.playerText} ${turn.npcText}`);
  return [...questionTokens].reduce((score, token) => score + (turnTokens.has(token) ? 1 : 0), 0);
}

function familiarityFor(totalTurns) {
  if (totalTurns === 0) return "stranger";
  if (totalTurns <= 2) return "met";
  if (totalTurns <= 5) return "acquaintance";
  return "familiar";
}

export function selectConversationContext(memory, playerText) {
  const questionTokens = tokens(playerText);
  const turns = Array.isArray(memory?.turns) ? memory.turns : [];
  const scored = turns.map((turn, index) => ({
    turn,
    index,
    score: overlapScore(questionTokens, turn)
  }));
  const relevant = scored
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.index - left.index)
    .slice(0, 2);
  const recent = scored.slice(-2).reverse();
  const selectedById = new Map();
  for (const candidate of [...relevant, ...recent]) {
    if (selectedById.size >= MAX_CONTEXT_TURNS) break;
    selectedById.set(candidate.turn.turnId, candidate);
  }
  const ordered = [...selectedById.values()].sort((left, right) => left.index - right.index);
  const selected = [];
  let characterCount = 0;
  for (const { turn } of ordered) {
    const size = turn.playerText.length + turn.npcText.length;
    if (characterCount + size > MAX_CONTEXT_CHARACTERS) continue;
    selected.push(turn);
    characterCount += size;
  }
  const totalTurns = Number.isSafeInteger(memory?.totalTurns) ? memory.totalTurns : turns.length;
  return Object.freeze({
    turns: Object.freeze(selected),
    characterCount,
    relationship: Object.freeze({
      turnCount: totalTurns,
      familiarity: familiarityFor(totalTurns)
    })
  });
}

export function createFileCharacterMemoryStore({
  directory = resolve(".local/character-memory"),
  now = () => new Date().toISOString()
} = {}) {
  const root = resolve(directory);
  return Object.freeze({
    async load(characterIdValue) {
      const characterId = boundedText(characterIdValue, "characterId", 160);
      try {
        const contents = await readFile(memoryPath(root, characterId), "utf8");
        return parseMemory(JSON.parse(contents), characterId);
      } catch (error) {
        if (error?.code === "ENOENT") return emptyMemory(characterId);
        throw error;
      }
    },

    async append(record) {
      const characterId = boundedText(record?.characterId, "record.characterId", 160);
      const current = await this.load(characterId);
      const totalTurns = current.totalTurns + 1;
      const turn = normalizeTurn({
        turnId: `turn-${String(totalTurns).padStart(6, "0")}`,
        playerText: record.playerText,
        npcText: record.npcText,
        answerMode: record.answerMode,
        usedFactKeys: record.usedFactKeys,
        recordedAt: now()
      }, current.turns.length);
      const next = {
        schemaVersion: 1,
        characterId,
        totalTurns,
        turns: [...current.turns, turn].slice(-MAX_STORED_TURNS)
      };
      await mkdir(root, { recursive: true });
      const outputPath = memoryPath(root, characterId);
      const temporaryPath = `${outputPath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(temporaryPath, outputPath);
      return turn;
    }
  });
}
