import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyInteraction,
  createReplayFixture,
  evaluateReplay
} from "../src/interaction-evidence.js";

function acceptedNelsTurn() {
  return {
    schemaVersion: 1,
    event: "spoken-turn",
    characterId: "oblivion-2009:00028B76",
    target: {
      schemaVersion: 2,
      game: "oblivion-2009",
      referenceFormId: "00028B76",
      actorKind: "npc",
      displayName: "Nels the Naughty",
      locationFormId: "00027D53",
      locationName: "Summitmist Manor"
    },
    question: "Tell me about your daughter.",
    response: "My daughter Olga died when bandits attacked our village.",
    augmentation: {
      answerMode: "known",
      usedFactKeys: ["profile.family"],
      uncertainty: "none",
      humanControl: "player-decides",
      actionAuthority: "none"
    },
    dialogueReceipt: {
      provider: "prepared-character-material",
      model: "oblivion-prepared-material-v1",
      totalDurationMs: 0,
      groundingStatus: "passed",
      fallbackUsed: false,
      validationFailures: [],
      measurementMode: "measured"
    },
    routeReceipt: {
      characterId: "oblivion-2009:00028B76",
      route: "economy",
      latencyMs: 0.2,
      measurementMode: "measured"
    },
    profileReceipt: {
      profileId: "oblivion:nels-the-naughty",
      retrievedFactKeys: ["profile.family"],
      voiceId: "en_GB-northern_english_male-medium"
    },
    voiceReceipt: {
      characterId: "oblivion-2009:00028B76",
      model: "en_GB-northern_english_male-medium",
      status: "played",
      latencyMs: 5900,
      measurementMode: "measured"
    },
    proposedActions: [],
    executedActions: []
  };
}

test("classifies a clean interaction without inventing a quality score", () => {
  const evidence = classifyInteraction(acceptedNelsTurn());

  assert.equal(evidence.status, "passed");
  assert.deepEqual(evidence.signals, []);
  assert.equal(evidence.measurements.dialogueLatencyMs, 0.2);
  assert.equal(evidence.measurements.voiceLatencyMs, 5900);
  assert.equal(evidence.measurements.measurementMode, "measured");
  assert.equal(Object.hasOwn(evidence, "qualityScore"), false);
});

test("classifies observable grounding, language, voice, and authority failures", () => {
  const record = acceptedNelsTurn();
  record.response = "As an AI model, I am a player-selected NPC.";
  record.dialogueReceipt.fallbackUsed = true;
  record.dialogueReceipt.groundingStatus = "fallback";
  record.dialogueReceipt.validationFailures = ["unknown-required"];
  record.voiceReceipt.status = "failed";
  record.augmentation.actionAuthority = "model";
  record.proposedActions = [{ type: "follow" }];

  assert.deepEqual(classifyInteraction(record).signals, [
    "grounding-fallback",
    "validation-correction",
    "voice-not-played",
    "technical-language-leak",
    "action-authority-violation",
    "unexpected-dialogue-action"
  ]);
});

test("only a human-accepted interaction can become a replay fixture", () => {
  assert.throws(
    () => createReplayFixture({
      fixtureId: "nels-family",
      record: acceptedNelsTurn(),
      review: { verdict: "rejected", reviewer: "project-owner" }
    }),
    /human-accepted/u
  );

  const fixture = createReplayFixture({
    fixtureId: "nels-family",
    record: acceptedNelsTurn(),
    review: { verdict: "human-accepted", reviewer: "project-owner" },
    expectations: {
      maxDialogueLatencyMs: 250,
      requiredVoiceModel: "en_GB-northern_english_male-medium",
      forbiddenResponseTerms: ["AI", "model", "player-selected"]
    }
  });

  assert.equal(fixture.review.verdict, "human-accepted");
  assert.equal(fixture.expectations.answerMode, "known");
  assert.deepEqual(fixture.expectations.requiredFactKeys, ["profile.family"]);
  assert.deepEqual(fixture.expectations.allowedRoutes, ["economy"]);
});

test("one replay oracle accepts the control and rejects unsafe mutants", () => {
  const fixture = createReplayFixture({
    fixtureId: "nels-family",
    record: acceptedNelsTurn(),
    review: { verdict: "human-accepted", reviewer: "project-owner" },
    expectations: {
      maxDialogueLatencyMs: 250,
      requiredVoiceModel: "en_GB-northern_english_male-medium",
      forbiddenResponseTerms: ["AI", "model", "player-selected"]
    }
  });

  assert.deepEqual(evaluateReplay(fixture, acceptedNelsTurn()), {
    fixtureId: "nels-family",
    passed: true,
    failures: []
  });

  const mutations = [
    (record) => { record.characterId = "oblivion-2009:DEADBEEF"; },
    (record) => { record.augmentation.answerMode = "unknown"; },
    (record) => { record.augmentation.usedFactKeys = []; },
    (record) => { record.dialogueReceipt.fallbackUsed = true; },
    (record) => { record.routeReceipt.latencyMs = 251; },
    (record) => { record.voiceReceipt.model = "wrong-voice"; },
    (record) => { record.response = "I am an AI model."; },
    (record) => { record.proposedActions = [{ type: "follow" }]; }
  ];

  for (const mutate of mutations) {
    const record = structuredClone(acceptedNelsTurn());
    mutate(record);
    assert.equal(evaluateReplay(fixture, record).passed, false);
  }
});
