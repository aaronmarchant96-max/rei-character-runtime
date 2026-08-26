import test from "node:test";
import assert from "node:assert/strict";
import { evaluateActionProposal } from "../src/action-policy.js";

const proposal = Object.freeze({
  schemaVersion: 1,
  type: "pick-up-item",
  actorReferenceFormId: "00028B76",
  itemReferenceFormId: "00123456",
  quantity: 1
});

function safeSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    actor: {
      referenceFormId: "00028B76",
      actorKind: "npc",
      alive: true,
      conscious: true,
      inCombat: false,
      ...overrides.actor
    },
    item: {
      referenceFormId: "00123456",
      itemKind: "ordinary",
      distanceUnits: 120,
      reachable: true,
      enabled: true,
      ownership: "unowned",
      ...overrides.item
    }
  };
}

test("an observed ordinary nearby item passes the pickup policy without executing", () => {
  const result = evaluateActionProposal(proposal, safeSnapshot());

  assert.deepEqual(result, {
    status: "approved",
    reason: "allow-listed-pickup",
    action: proposal,
    executedActions: []
  });
});

test("pickup policy denies protected, owned, distant, and unreachable items", () => {
  const controls = [
    [safeSnapshot({ item: { itemKind: "quest" } }), "protected-item"],
    [safeSnapshot({ item: { ownership: "other" } }), "owned-by-other"],
    [safeSnapshot({ item: { distanceUnits: 501 } }), "item-too-far"],
    [safeSnapshot({ item: { reachable: false } }), "item-unreachable"]
  ];

  for (const [snapshot, reason] of controls) {
    assert.deepEqual(evaluateActionProposal(proposal, snapshot), {
      status: "denied",
      reason,
      action: proposal,
      executedActions: []
    });
  }
});

test("pickup policy denies unavailable actors and identity mismatches", () => {
  const controls = [
    [safeSnapshot({ actor: { actorKind: "creature" } }), "actor-not-npc"],
    [safeSnapshot({ actor: { inCombat: true } }), "actor-in-combat"],
    [safeSnapshot({ actor: { conscious: false } }), "actor-unavailable"],
    [safeSnapshot({ actor: { referenceFormId: "00028B75" } }), "actor-identity-mismatch"],
    [safeSnapshot({ item: { referenceFormId: "00123457" } }), "item-identity-mismatch"]
  ];

  for (const [snapshot, reason] of controls) {
    assert.equal(evaluateActionProposal(proposal, snapshot).reason, reason);
  }
});

test("pickup policy rejects malformed or unsupported proposals before evaluation", () => {
  assert.throws(
    () => evaluateActionProposal({ ...proposal, type: "run-console-command" }, safeSnapshot()),
    /unsupported action type/u
  );
  assert.throws(
    () => evaluateActionProposal({ ...proposal, command: "kill" }, safeSnapshot()),
    /unexpected or missing fields/u
  );
  assert.throws(
    () => evaluateActionProposal({ ...proposal, actorReferenceFormId: "not-an-id" }, safeSnapshot()),
    /actorReferenceFormId/u
  );
});

test("pickup evaluation is deterministic and does not mutate its inputs", () => {
  const snapshot = safeSnapshot();
  const before = JSON.stringify({ proposal, snapshot });

  const first = evaluateActionProposal(proposal, snapshot);
  const second = evaluateActionProposal(proposal, snapshot);

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify({ proposal, snapshot }), before);
});
