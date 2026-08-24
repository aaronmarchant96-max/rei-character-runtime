import test from "node:test";
import assert from "node:assert/strict";
import { runTargetConversation } from "../src/target-turn.js";

test("selected Oblivion identity binds the same character to dialogue and voice", async () => {
  const calls = [];
  const target = {
    schemaVersion: 1,
    game: "oblivion-2009",
    referenceFormId: "00028B74",
    actorKind: "npc"
  };

  const output = await runTargetConversation({
    target,
    playerText: "Who are you?",
    dialogueProvider: async (request) => {
      calls.push({ type: "dialogue", request });
      return { speech: "I am the person you selected.", actions: [] };
    },
    speak: async (request) => {
      calls.push({ type: "voice", request });
      return {
        characterId: request.characterId,
        backend: "test-voice",
        status: "played",
        latencyMs: 1,
        measurementMode: "measured"
      };
    }
  });

  assert.equal(calls[0].request.character.id, "oblivion-2009:00028B74");
  assert.equal(calls[0].request.world["game.referenceFormId"], "00028B74");
  assert.deepEqual(calls[1].request, {
    characterId: "oblivion-2009:00028B74",
    text: "I am the person you selected."
  });
  assert.equal(output.target.referenceFormId, "00028B74");
  assert.equal(output.turn.executedActions.length, 0);
  assert.equal(output.turn.voiceReceipt.status, "played");
});

test("target conversation rejects unsupported target data before dialogue", async () => {
  let called = false;
  await assert.rejects(
    runTargetConversation({
      target: {
        schemaVersion: 1,
        game: "oblivion-2009",
        referenceFormId: "not-a-form",
        actorKind: "npc"
      },
      playerText: "Hello",
      dialogueProvider: async () => {
        called = true;
        return { speech: "Hello", actions: [] };
      },
      speak: async () => ({ status: "played" })
    }),
    /8 uppercase hexadecimal/u
  );
  assert.equal(called, false);
});
