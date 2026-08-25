import test from "node:test";
import assert from "node:assert/strict";
import { runTargetConversation } from "../src/target-turn.js";

test("selected Oblivion identity binds the same character to dialogue and voice", async () => {
  const calls = [];
  const target = {
    schemaVersion: 2,
    game: "oblivion-2009",
    referenceFormId: "00028B74",
    actorKind: "npc",
    displayName: "Baurus",
    locationFormId: "0002C16E",
    locationName: "Cloud Ruler Temple"
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
  assert.equal(calls[0].request.character.name, "Baurus");
  assert.equal(calls[0].request.world["game.referenceFormId"], "00028B74");
  assert.equal(calls[0].request.world["game.locationName"], "Cloud Ruler Temple");
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

test("profiled Nels receives bounded facts and his configured prototype voice", async () => {
  let dialogueRequest;
  let voiceRequest;
  const output = await runTargetConversation({
    target: {
      schemaVersion: 2,
      game: "oblivion-2009",
      referenceFormId: "00028B76",
      actorKind: "npc",
      displayName: "Nels the Naughty",
      locationFormId: "00027D53",
      locationName: "Summitmist Manor"
    },
    playerText: "What color is the moon?",
    dialogueProvider: async (request) => {
      dialogueRequest = request;
      return { speech: "I come from a small village in Skyrim.", actions: [] };
    },
    speak: async (request) => {
      voiceRequest = request;
      return {
        characterId: request.characterId,
        backend: "test-voice",
        model: request.voiceId,
        status: "played",
        latencyMs: 1,
        measurementMode: "measured"
      };
    }
  });

  assert.match(dialogueRequest.character.persona, /Nord/u);
  assert.equal(dialogueRequest.world["profile.origin"], "Nels comes from a small village in Skyrim.");
  assert.equal(dialogueRequest.world["profile.ambition"].includes("Hoary Boar"), true);
  assert.equal(voiceRequest.voiceId, "en_GB-northern_english_male-medium");
  assert.equal(output.turn.profileReceipt.profileId, "oblivion:nels-the-naughty");
  assert.equal(output.turn.profileReceipt.voiceUsePolicy, "local-attribution-sharealike-prototype");
  assert.equal(output.turn.profileReceipt.voiceDatasetLicense, "CC-BY-SA-4.0");
  assert.equal(output.turn.profileReceipt.factKeys.length, 5);
});

test("Nels daughter question uses deterministic profile retrieval instead of the model", async () => {
  let modelCalls = 0;
  let voiceRequest;
  const output = await runTargetConversation({
    target: {
      schemaVersion: 2,
      game: "oblivion-2009",
      referenceFormId: "00028B76",
      actorKind: "npc",
      displayName: "Nels the Naughty",
      locationFormId: "00027D53",
      locationName: "Summitmist Manor"
    },
    playerText: "Tell me about your daughter",
    dialogueProvider: async () => {
      modelCalls += 1;
      return { speech: "model should not run", actions: [] };
    },
    speak: async (request) => {
      voiceRequest = request;
      return {
        characterId: request.characterId,
        backend: "test-voice",
        model: request.voiceId,
        status: "played",
        latencyMs: 1,
        measurementMode: "measured"
      };
    }
  });

  assert.equal(modelCalls, 0);
  assert.equal(output.turn.speech, "My daughter Olga died when bandits attacked our village.");
  assert.deepEqual(output.turn.augmentation.usedFactKeys, ["profile.family"]);
  assert.equal(output.turn.dialogueReceipt.provider, "profile-retrieval");
  assert.equal(output.turn.dialogueReceipt.inputTokens, 0);
  assert.equal(voiceRequest.voiceId, "en_GB-northern_english_male-medium");
});

test("a mismatched target name keeps the generic facts and voice", async () => {
  let dialogueRequest;
  let voiceRequest;
  const output = await runTargetConversation({
    target: {
      schemaVersion: 2,
      game: "oblivion-2009",
      referenceFormId: "00028B76",
      actorKind: "npc",
      displayName: "Different NPC",
      locationFormId: null,
      locationName: null
    },
    playerText: "Hello",
    dialogueProvider: async (request) => {
      dialogueRequest = request;
      return { speech: "Hello.", actions: [] };
    },
    speak: async (request) => {
      voiceRequest = request;
      return { status: "played" };
    }
  });

  assert.equal(dialogueRequest.world["profile.origin"], undefined);
  assert.equal(voiceRequest.voiceId, undefined);
  assert.equal(output.turn.profileReceipt.match, "generic-fallback");
});
