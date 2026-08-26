import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendSessionRecord,
  createSpokenTurnRecord,
  describeTargetKnowledge
} from "../src/session.js";

const target = {
  schemaVersion: 2,
  game: "oblivion-2009",
  referenceFormId: "00028B74",
  actorKind: "npc",
  displayName: "Baurus",
  locationFormId: "0002C16E",
  locationName: "Cloud Ruler Temple"
};

function validTurn() {
  return {
    speech: "I cannot say for certain.",
    subtitle: "I cannot say for certain.",
    proposedActions: [],
    executedActions: [],
    ttsRequest: {
      characterId: "oblivion-2009:00028B74",
      text: "I cannot say for certain."
    },
    dialogueReceipt: { provider: "test" },
    augmentation: {
      answerMode: "unknown",
      usedFactKeys: [],
      uncertainty: "explicit",
      humanControl: "player-decides",
      actionAuthority: "none"
    },
    receipt: { characterId: "oblivion-2009:00028B74" },
    voiceReceipt: {
      characterId: "oblivion-2009:00028B74",
      status: "played"
    }
  };
}

test("augmentation session makes known and unknown target context explicit", () => {
  assert.deepEqual(describeTargetKnowledge(target), {
    knownFacts: {
      game: "oblivion-2009",
      referenceFormId: "00028B74",
      actorKind: "npc",
      displayName: "Baurus",
      locationFormId: "0002C16E",
      locationName: "Cloud Ruler Temple"
    },
    unknownFacts: [
      "canonicalBiography",
      "canonicalDialogue"
    ]
  });
});

test("spoken-turn record requires identity continuity and no actions", () => {
  const record = createSpokenTurnRecord({ target, question: "Who are you?", turn: validTurn() });
  assert.equal(record.characterId, "oblivion-2009:00028B74");
  assert.deepEqual(record.augmentation, {
    answerMode: "unknown",
    usedFactKeys: [],
    uncertainty: "explicit",
    humanControl: "player-decides",
    actionAuthority: "none"
  });
  assert.equal(record.profileReceipt, null);
  assert.equal(record.materialReceipt, null);
  assert.equal(record.cActivity.kind, "c-activity-interaction-evidence");
  assert.equal(record.cActivity.status, "passed");
  assert.deepEqual(record.cActivity.signals, []);

  const mismatched = validTurn();
  mismatched.voiceReceipt.characterId = "oblivion-2009:DEADBEEF";
  assert.throws(
    () => createSpokenTurnRecord({ target, question: "Who are you?", turn: mismatched }),
    /identity continuity/u
  );

  const actionable = validTurn();
  actionable.proposedActions = [{ type: "follow" }];
  assert.throws(
    () => createSpokenTurnRecord({ target, question: "Who are you?", turn: actionable }),
    /must not contain actions/u
  );
});

test("knowledge description exposes a matched profile without claiming dialogue import", () => {
  const description = describeTargetKnowledge({
    schemaVersion: 2,
    game: "oblivion-2009",
    referenceFormId: "00028B76",
    actorKind: "npc",
    displayName: "Nels the Naughty",
    locationFormId: "00027D53",
    locationName: "Summitmist Manor"
  });

  assert.equal(description.knownFacts.profileId, "oblivion:nels-the-naughty");
  assert.equal(description.knownFacts.profileFactKeys.includes("profile.origin"), true);
  assert.equal(description.unknownFacts.includes("canonicalBiography"), false);
  assert.equal(description.unknownFacts.includes("canonicalDialogue"), true);
});

test("session evidence appends one JSON record per line", async () => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-session-test-"));
  const outputPath = join(directory, "session.jsonl");
  try {
    await appendSessionRecord(outputPath, { event: "session-start", schemaVersion: 1 });
    await appendSessionRecord(outputPath, { event: "session-stop", schemaVersion: 1 });
    const lines = (await readFile(outputPath, "utf8")).trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).event, "session-start");
    assert.equal(JSON.parse(lines[1]).event, "session-stop");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
