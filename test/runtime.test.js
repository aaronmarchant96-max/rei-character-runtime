import test from "node:test";
import assert from "node:assert/strict";
import { chooseRoute, createCharacterRuntime } from "../src/runtime.js";
import { speakTtsRequest } from "../src/voice.js";

test("routine input takes the economy route", () => {
  assert.deepEqual(chooseRoute("Any news from the road?"), {
    route: "economy",
    reason: "short-routine-input"
  });
});

test("sensitive input takes the capable route", () => {
  assert.deepEqual(chooseRoute("Tell me the secret behind this quest."), {
    route: "capable",
    reason: "sensitive-topic"
  });
});

test("a turn returns evidence and never executes proposed actions", async () => {
  let now = 100;
  const converse = createCharacterRuntime({
    clock: { now: () => (now += 5) },
    dialogueProvider: async () => ({
      speech: "I saw torchlight beyond the ridge.",
      actions: [{ type: "give-item", id: "forbidden-item" }]
    })
  });

  const result = await converse({
    character: { id: "watcher", name: "The Watcher" },
    playerText: "What did you see?"
  });

  assert.equal(result.subtitle, result.speech);
  assert.deepEqual(result.ttsRequest, {
    characterId: "watcher",
    text: "I saw torchlight beyond the ridge."
  });
  assert.equal(result.proposedActions.length, 1);
  assert.deepEqual(result.executedActions, []);
  assert.deepEqual(result.receipt, {
    characterId: "watcher",
    route: "economy",
    routeReason: "short-routine-input",
    latencyMs: 5,
    measurementMode: "measured"
  });
});

test("invalid input and invalid provider output fail closed", async () => {
  const converse = createCharacterRuntime({ dialogueProvider: async () => ({ speech: "" }) });

  await assert.rejects(
    converse({ character: { id: "npc", name: "NPC" }, playerText: "hello" }),
    /proposal\.speech must be a non-empty string/u
  );
  await assert.rejects(
    converse({ character: { id: "npc", name: "NPC" }, playerText: " " }),
    /playerText must be a non-empty string/u
  );
});

test("the voice adapter speaks validated text and records measured playback", async () => {
  const spoken = [];
  let now = 20;
  const receipt = await speakTtsRequest(
    { characterId: "guide", text: "The road is quiet tonight." },
    {
      clock: { now: () => (now += 10) },
      runner: (text, callback) => {
        spoken.push(text);
        callback(null);
      }
    }
  );

  assert.deepEqual(spoken, ["The road is quiet tonight."]);
  assert.deepEqual(receipt, {
    characterId: "guide",
    backend: "speech-dispatcher",
    status: "played",
    latencyMs: 10,
    measurementMode: "measured"
  });
});

test("the voice adapter fails closed when playback fails", async () => {
  await assert.rejects(
    speakTtsRequest(
      { characterId: "guide", text: "Can you hear me?" },
      { runner: (_text, callback) => callback(new Error("backend unavailable")) }
    ),
    /local speech playback failed: backend unavailable/u
  );
});
