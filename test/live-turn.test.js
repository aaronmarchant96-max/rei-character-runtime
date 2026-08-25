import test from "node:test";
import assert from "node:assert/strict";
import { bindQuestionToTarget } from "../src/live-turn.js";

const target = {
  schemaVersion: 2,
  game: "oblivion-2009",
  referenceFormId: "00028B74",
  actorKind: "npc",
  displayName: "Mara Varen",
  locationFormId: "00001234",
  locationName: "The Market District"
};

test("live turn binds a submitted question to the exact aimed actor", () => {
  const result = bindQuestionToTarget({
    question: {
      schemaVersion: 1,
      game: "oblivion-2009",
      targetReferenceFormId: "00028B74",
      question: "Have you seen anything strange?"
    },
    target
  });
  assert.equal(result.question, "Have you seen anything strange?");
  assert.equal(result.target.displayName, "Mara Varen");
});

test("live turn rejects stale target identity", () => {
  assert.throws(() => bindQuestionToTarget({
    question: {
      schemaVersion: 1,
      game: "oblivion-2009",
      targetReferenceFormId: "DEADBEEF",
      question: "Who are you?"
    },
    target
  }), /does not match/u);
});
