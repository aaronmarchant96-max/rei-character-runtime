import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chooseRoute, createCharacterRuntime } from "../src/runtime.js";
import { createOllamaDialogueProvider } from "../src/dialogue.js";
import { speakPiperTtsRequest, speakTtsRequest } from "../src/voice.js";

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

test("Piper generates then plays neural speech with an evidence receipt", async () => {
  const calls = [];
  let now = 100;
  const receipt = await speakPiperTtsRequest(
    { characterId: "guide", text: "The old road remembers." },
    {
      clock: { now: () => (now += 25) },
      pythonPath: "/test/python",
      modelDirectory: "/test/voices",
      runner: (command, args, callback) => {
        calls.push({ command, args });
        callback(null);
      }
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "/test/python");
  assert.deepEqual(calls[0].args.slice(0, 6), [
    "-m", "piper", "--data-dir", "/test/voices", "-m", "en_US-lessac-medium"
  ]);
  assert.equal(calls[0].args.at(-1), "The old road remembers.");
  assert.equal(calls[1].command, "paplay");
  assert.deepEqual(receipt, {
    characterId: "guide",
    backend: "piper-local",
    model: "en_US-lessac-medium",
    status: "played",
    latencyMs: 25,
    measurementMode: "measured"
  });
});

test("Ollama receives bounded character facts and returns literal metrics", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "I heard a wolf.",
            actions: [],
            usedFactKeys: ["observation"],
            answerMode: "known"
          }) },
          prompt_eval_count: 88,
          eval_count: 12,
          total_duration: 2_500_000_000,
          load_duration: 500_000_000,
          eval_duration: 1_200_000_000
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A cautious traveler" },
    playerText: "What was your observation?",
    world: { location: "Lantern Rest", observation: "I heard a wolf." }
  });

  assert.equal(request.think, false);
  assert.equal(request.format.required.includes("speech"), true);
  assert.match(request.messages[0].content, /Lantern Rest/u);
  assert.deepEqual(proposal, {
    speech: "I heard a wolf.",
    actions: [],
    augmentation: {
      answerMode: "known",
      usedFactKeys: ["observation"],
      uncertainty: "none",
      humanControl: "player-decides",
      actionAuthority: "none"
    },
    providerReceipt: {
      provider: "ollama-local",
      model: "qwen3:1.7b",
      inputTokens: 88,
      outputTokens: 12,
      totalDurationMs: 2500,
      loadDurationMs: 500,
      generationDurationMs: 1200,
      providerApiCostUsd: 0,
      attempts: 1,
      groundingStatus: "passed",
      fallbackUsed: false,
      validationFailures: [],
      measurementMode: "measured"
    }
  });
});

test("Ollama retries an ungrounded answer then falls back safely", async () => {
  let attempts = 0;
  const provider = createOllamaDialogueProvider({
    fetchImpl: async () => {
      attempts += 1;
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "Travelers carry maps, weapons, and ancient secrets.",
            actions: [],
            usedFactKeys: [],
            answerMode: "known"
          }) },
          prompt_eval_count: 10,
          eval_count: 5,
          total_duration: 1_000_000_000,
          eval_duration: 500_000_000
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A traveler" },
    playerText: "What do the travelers carry?",
    world: { location: "Lantern Rest" }
  });

  assert.equal(attempts, 2);
  assert.equal(proposal.speech, "I can't say that I've noticed anything certain about that.");
  assert.deepEqual(proposal.augmentation, {
    answerMode: "unknown",
    usedFactKeys: [],
    uncertainty: "explicit",
    humanControl: "player-decides",
    actionAuthority: "none"
  });
  assert.equal(proposal.providerReceipt.groundingStatus, "fallback");
  assert.equal(proposal.providerReceipt.fallbackUsed, true);
  assert.equal(proposal.providerReceipt.inputTokens, 20);
  assert.equal(proposal.providerReceipt.validationFailures.includes("unknown-required"), true);
});

test("Ollama rejects unknown answers that cite facts", async () => {
  const provider = createOllamaDialogueProvider({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        message: { content: JSON.stringify({
          speech: "I do not know, though we are at Lantern Rest.",
          actions: [],
          usedFactKeys: ["location"],
          answerMode: "unknown"
        }) }
      })
    })
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A traveler" },
    playerText: "Where are we?",
    world: { location: "Lantern Rest" }
  });

  assert.equal(proposal.providerReceipt.groundingStatus, "fallback");
  assert.equal(proposal.providerReceipt.validationFailures.includes("unknown-cites-facts"), true);
});

test("Ollama fails closed on invalid structured dialogue", async () => {
  const provider = createOllamaDialogueProvider({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ message: { content: "not-json" } })
    })
  });

  await assert.rejects(
    provider({
      character: { name: "Mara", persona: "A traveler" },
      playerText: "Hello",
      world: {}
    }),
    /invalid structured dialogue/u
  );
});

test("CLI rejects unsupported dialogue modes instead of silently using demo", () => {
  const result = spawnSync(
    process.execPath,
    ["src/cli.js", "--dialogue=ollmaa", "Hello"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported dialogue mode: ollmaa/u);
  assert.equal(result.stdout, "");
});

test("Ollama validation ignores a relevant-looking 21st fact omitted from the prompt", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "I do not know anything certain about that.",
            actions: [],
            usedFactKeys: [],
            answerMode: "unknown"
          }) }
        })
      };
    }
  });
  const world = Object.fromEntries([
    ...Array.from({ length: 20 }, (_value, index) => [`fact${index}`, `value${index}`]),
    ["dragonRumor", "A dragon sleeps nearby"]
  ]);

  const proposal = await provider({
    character: { name: "Mara", persona: "A traveler" },
    playerText: "What is the dragon rumor?",
    world
  });

  assert.doesNotMatch(request.messages[0].content, /dragonRumor/u);
  assert.equal(proposal.providerReceipt.attempts, 1);
  assert.equal(proposal.providerReceipt.groundingStatus, "passed");
});

test("Ollama prompt and validation share the same truncated fact key", async () => {
  let request;
  const originalKey = `dragon-${"x".repeat(90)}`;
  const normalizedKey = originalKey.slice(0, 80);
  const provider = createOllamaDialogueProvider({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "The dragon is recorded as sleeping.",
            actions: [],
            usedFactKeys: [normalizedKey],
            answerMode: "known"
          }) }
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A traveler" },
    playerText: "What do you know about the dragon?",
    world: { [originalKey]: "The dragon is sleeping" }
  });

  assert.equal(request.messages[0].content.includes(normalizedKey), true);
  assert.equal(request.messages[0].content.includes(originalKey), false);
  assert.equal(proposal.providerReceipt.attempts, 1);
  assert.equal(proposal.providerReceipt.groundingStatus, "passed");
});

test("Ollama accepts identity-backed answers using explicit identity fact keys", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "I am Mara, a cautious traveler.",
            actions: [],
            usedFactKeys: ["identity.name", "identity.persona"],
            answerMode: "known"
          }) }
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A cautious traveler" },
    playerText: "Who are you?",
    world: {}
  });

  assert.match(request.messages[0].content, /"identity\.name":"Mara"/u);
  assert.match(request.messages[0].content, /"identity\.persona":"A cautious traveler"/u);
  assert.equal(proposal.providerReceipt.attempts, 1);
  assert.equal(proposal.providerReceipt.groundingStatus, "passed");
});

test("Ollama rejects world fact keys that collide after normalization", async () => {
  let requests = 0;
  const sharedPrefix = "x".repeat(80);
  const provider = createOllamaDialogueProvider({
    fetchImpl: async () => {
      requests += 1;
      throw new Error("fetch should not run");
    }
  });

  await assert.rejects(
    provider({
      character: { name: "Mara", persona: "A cautious traveler" },
      playerText: "What do you know?",
      world: {
        [`${sharedPrefix}-first`]: "First fact",
        [`${sharedPrefix}-second`]: "Second fact"
      }
    }),
    /world fact keys collide after normalization/u
  );
  assert.equal(requests, 0);
});
