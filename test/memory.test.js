import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFileCharacterMemoryStore,
  selectConversationContext
} from "../src/memory.js";

test("character memory persists turns and isolates different NPCs", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-memory-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createFileCharacterMemoryStore({
    directory,
    now: () => "2026-08-24T12:00:00.000Z"
  });

  await store.append({
    characterId: "oblivion-2009:00028B76",
    playerText: "Tell me about your daughter.",
    npcText: "Olga's loss is a wound I still carry.",
    answerMode: "known",
    usedFactKeys: ["profile.family"]
  });

  const nels = await store.load("oblivion-2009:00028B76");
  const baurus = await store.load("oblivion-2009:00028B74");
  assert.equal(nels.totalTurns, 1);
  assert.equal(nels.turns[0].turnId, "turn-000001");
  assert.deepEqual(nels.turns[0].usedFactKeys, ["profile.family"]);
  assert.equal(baurus.totalTurns, 0);
  assert.deepEqual(baurus.turns, []);
});

test("conversation selection is relevant, recent, and bounded", () => {
  const turns = Array.from({ length: 20 }, (_, index) => ({
    turnId: `turn-${String(index + 1).padStart(6, "0")}`,
    playerText: index === 3 ? "Tell me about your daughter Olga." : `Unrelated road question ${index}`,
    npcText: `A bounded response ${index}.`,
    answerMode: "social",
    usedFactKeys: []
  }));
  const context = selectConversationContext(
    { schemaVersion: 1, characterId: "npc", totalTurns: 20, turns },
    "How do you feel about your daughter?"
  );

  assert.equal(context.turns.length <= 4, true);
  assert.equal(context.characterCount <= 1_600, true);
  assert.equal(context.turns.some((turn) => turn.turnId === "turn-000004"), true);
  assert.equal(context.relationship.familiarity, "familiar");
  assert.equal(context.relationship.turnCount, 20);
});
