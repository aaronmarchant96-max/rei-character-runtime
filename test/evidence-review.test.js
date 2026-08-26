import test from "node:test";
import assert from "node:assert/strict";
import {
  createAcceptedFixture,
  createInteractionId,
  createReviewRecord,
  findPendingInteractions
} from "../src/evidence-review.js";

function spokenTurn(overrides = {}) {
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
      humanControl: "player-decides",
      actionAuthority: "none"
    },
    dialogueReceipt: {
      provider: "prepared-character-material",
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
    voiceReceipt: {
      characterId: "oblivion-2009:00028B76",
      model: "en_GB-northern_english_male-medium",
      status: "played",
      latencyMs: 5900,
      measurementMode: "measured"
    },
    proposedActions: [],
    executedActions: [],
    recordedAt: "2026-08-25T03:00:08.896Z",
    ...overrides
  };
}

test("interaction IDs are content-addressed and deterministic", () => {
  const first = spokenTurn();
  const second = structuredClone(first);
  assert.equal(createInteractionId(first), createInteractionId(second));
  second.response = "A different answer.";
  assert.notEqual(createInteractionId(first), createInteractionId(second));
});

test("accepted and rejected reviews retain evidence without copying dialogue", () => {
  const accepted = createReviewRecord({
    record: spokenTurn(),
    source: { sessionPath: ".local/sessions/example.jsonl", lineNumber: 2 },
    verdict: "accepted",
    reviewer: "project-owner",
    reviewedAt: "2026-08-26T12:00:00.000Z"
  });
  assert.equal(accepted.verdict, "accepted");
  assert.equal(accepted.evidence.status, "passed");
  assert.equal(Object.hasOwn(accepted, "response"), false);

  const rejected = createReviewRecord({
    record: spokenTurn(),
    source: { sessionPath: ".local/sessions/example.jsonl", lineNumber: 2 },
    verdict: "rejected",
    flags: ["wrong-lore", "too-slow", "wrong-lore"],
    reviewer: "project-owner",
    reviewedAt: "2026-08-26T12:00:00.000Z"
  });
  assert.deepEqual(rejected.flags, ["wrong-lore", "too-slow"]);

  assert.throws(
    () => createReviewRecord({
      record: spokenTurn(),
      source: { sessionPath: "example.jsonl", lineNumber: 2 },
      verdict: "rejected",
      flags: [],
      reviewer: "project-owner"
    }),
    /rejection flag/u
  );
});

test("reviewed interactions leave the pending queue while skipped ones do not", () => {
  const first = spokenTurn();
  const second = spokenTurn({ question: "Where are you from?" });
  const sessions = [
    { record: first, sessionPath: "one.jsonl", lineNumber: 2 },
    { record: second, sessionPath: "one.jsonl", lineNumber: 3 }
  ];
  const reviews = [{ interactionId: createInteractionId(first) }];

  assert.deepEqual(findPendingInteractions(sessions, reviews), [sessions[1]]);
});

test("an accepted review can promote the exact interaction into a local fixture", () => {
  const record = spokenTurn();
  const review = createReviewRecord({
    record,
    source: { sessionPath: "example.jsonl", lineNumber: 2 },
    verdict: "accepted",
    reviewer: "project-owner",
    reviewedAt: "2026-08-26T12:00:00.000Z"
  });
  const fixture = createAcceptedFixture({
    record,
    review,
    fixtureId: "nels-family-candidate",
    maxDialogueLatencyMs: 250
  });

  assert.equal(fixture.review.verdict, "human-accepted");
  assert.equal(fixture.expectations.maxDialogueLatencyMs, 250);
  assert.equal(fixture.expectations.requiredVoiceModel, "en_GB-northern_english_male-medium");

  const different = spokenTurn({ response: "Different." });
  assert.throws(
    () => createAcceptedFixture({
      record: different,
      review,
      fixtureId: "wrong-interaction"
    }),
    /does not match/u
  );
});
