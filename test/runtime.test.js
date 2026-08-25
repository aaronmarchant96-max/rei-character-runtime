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

test("Piper uses a validated per-character voice and records the selected model", async () => {
  const calls = [];
  const receipt = await speakPiperTtsRequest(
    { characterId: "nels", text: "I came down from Skyrim.", voiceId: "en_US-ryan-medium" },
    {
      pythonPath: "/test/python",
      modelDirectory: "/test/voices",
      runner: (command, args, callback) => {
        calls.push({ command, args });
        callback(null);
      }
    }
  );

  assert.equal(calls[0].args.includes("en_US-ryan-medium"), true);
  assert.equal(receipt.model, "en_US-ryan-medium");
  await assert.rejects(
    speakPiperTtsRequest(
      { characterId: "nels", text: "No.", voiceId: "../../unsafe" },
      { runner: () => assert.fail("invalid voice must not execute") }
    ),
    /voiceId has an invalid format/u
  );
});

test("runtime carries a configured voice into the TTS request", async () => {
  const converse = createCharacterRuntime({
    dialogueProvider: async () => ({ speech: "Aye.", actions: [] })
  });
  const result = await converse({
    character: {
      id: "oblivion-2009:00028B76",
      name: "Nels the Naughty",
      persona: "A Nord",
      voiceId: "en_US-ryan-medium"
    },
    playerText: "Are you a Nord?"
  });

  assert.deepEqual(result.ttsRequest, {
    characterId: "oblivion-2009:00028B76",
    text: "Aye.",
    voiceId: "en_US-ryan-medium"
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
  assert.doesNotMatch(request.messages[0].content, /Lantern Rest/u);
  assert.match(request.messages[0].content, /I heard a wolf/u);
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

test("social dialogue is generated in character without fabricated fact citations", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    modelByMode: { social: "qwen3:0.6b" },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "Well met, friend. Come, share a drink.",
            actions: [],
            usedFactKeys: [],
            answerMode: "social"
          }) },
          prompt_eval_count: 50,
          eval_count: 10,
          total_duration: 500_000_000,
          eval_duration: 250_000_000
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Nels", persona: "A sociable Nord fond of tavern humor" },
    playerText: "Hello",
    world: { "profile.family": "His daughter Olga died." },
    route: "economy"
  });

  assert.equal(request.model, "qwen3:0.6b");
  assert.match(request.messages[0].content, /casual social conversation/u);
  assert.doesNotMatch(request.messages[0].content, /daughter Olga/u);
  assert.equal(proposal.augmentation.answerMode, "social");
  assert.deepEqual(proposal.augmentation.usedFactKeys, []);
  assert.equal(proposal.providerReceipt.model, "qwen3:0.6b");
  assert.equal(proposal.providerReceipt.groundingStatus, "passed");
});

test("a continuity question receives bounded transcript and relationship context", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    modelByMode: { social: "qwen3:0.6b" },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "Aye, I remember our talk.",
            actions: [],
            usedFactKeys: [],
            answerMode: "social"
          }) },
          prompt_eval_count: 90,
          eval_count: 9
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Nels", persona: "A guarded Nord" },
    playerText: "Do you remember what we spoke about before?",
    world: {},
    conversationContext: {
      turns: [{
        turnId: "turn-000001",
        playerText: "Tell me about your daughter.",
        npcText: "Olga's loss is a wound I carry.",
        answerMode: "known",
        usedFactKeys: ["profile.family"]
      }],
      relationship: { turnCount: 1, familiarity: "met" }
    }
  });

  assert.equal(request.model, "qwen3:0.6b");
  assert.match(request.messages[0].content, /turn-000001/u);
  assert.match(request.messages[0].content, /not canonical evidence/u);
  assert.match(request.messages[0].content, /"familiarity":"met"/u);
  assert.equal(proposal.augmentation.answerMode, "social");
});

test("an explicit retrieved fact survives anaphoric follow-up filtering and selects grounded routing", async () => {
  let request;
  const provider = createOllamaDialogueProvider({
    modelByMode: { grounded: "qwen3:1.7b", unknown: "qwen3:0.6b" },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify({
            speech: "A father does not set such grief aside.",
            actions: [],
            usedFactKeys: ["profile.family"],
            answerMode: "known"
          }) }
        })
      };
    }
  });

  const proposal = await provider({
    character: { name: "Nels", persona: "A grieving Nord" },
    playerText: "How do you feel about that?",
    world: { "profile.family": "His daughter Olga died." },
    retrievedFactKeys: ["profile.family"],
    conversationContext: {
      turns: [{
        turnId: "turn-000001",
        playerText: "Tell me about your daughter.",
        npcText: "Olga's loss is a wound I carry.",
        answerMode: "known",
        usedFactKeys: ["profile.family"]
      }],
      relationship: { turnCount: 1, familiarity: "met" }
    }
  });

  assert.equal(request.model, "qwen3:1.7b");
  assert.match(request.messages[0].content, /His daughter Olga died/u);
  assert.equal(proposal.augmentation.answerMode, "known");
  assert.deepEqual(proposal.augmentation.usedFactKeys, ["profile.family"]);
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

test("Ollama retries invalid structured dialogue then fails closed", async () => {
  const provider = createOllamaDialogueProvider({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ message: { content: "not-json" } })
    })
  });

  const proposal = await provider({
    character: { name: "Mara", persona: "A traveler" },
    playerText: "What color is the moon?",
    world: {}
  });
  assert.equal(proposal.providerReceipt.attempts, 2);
  assert.equal(proposal.providerReceipt.fallbackUsed, true);
  assert.deepEqual(proposal.providerReceipt.validationFailures, ["structured-output-invalid"]);
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
