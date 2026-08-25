import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePreparedMaterialCatalog,
  selectPreparedMaterial
} from "../src/prepared-material.js";

function fixtureCatalog(overrides = {}) {
  return {
    schemaVersion: 1,
    catalogId: "test-material-v1",
    materials: [
      {
        materialId: "nels-family-v1",
        profileId: "oblivion:nels-the-naughty",
        retrievalIntent: "family-daughter",
        factKeys: ["profile.family"],
        variants: [
          "Olga was my daughter. She died when bandits attacked our village.",
          "My daughter Olga died when bandits attacked our village."
        ],
        approval: {
          status: "approved",
          mode: "agent-reviewed-against-fact-keys",
          generatorModel: "Qwen/Qwen3-4B-Instruct-2507",
          reviewedAt: "2026-08-24"
        },
        ...overrides
      }
    ]
  };
}

test("prepared material parser preserves bounded approval provenance", () => {
  const catalog = parsePreparedMaterialCatalog(fixtureCatalog());

  assert.equal(catalog.materials[0].approval.status, "approved");
  assert.equal(catalog.materials[0].variants.length, 2);
  assert.equal(Object.isFrozen(catalog.materials[0]), true);
});

test("prepared material rejects unapproved, ambiguous, and undeclared data", () => {
  assert.throws(
    () => parsePreparedMaterialCatalog(fixtureCatalog({
      approval: {
        status: "draft",
        mode: "model-output",
        generatorModel: "test-model",
        reviewedAt: "2026-08-24"
      }
    })),
    /approval status must be approved/u
  );
  assert.throws(
    () => parsePreparedMaterialCatalog({
      ...fixtureCatalog(),
      materials: [...fixtureCatalog().materials, ...fixtureCatalog().materials]
    }),
    /duplicate prepared material/u
  );
  assert.throws(
    () => parsePreparedMaterialCatalog(fixtureCatalog({ unexpected: true })),
    /unsupported fields/u
  );
});

test("prepared material rotates deterministically and requires exact fact keys", () => {
  const catalog = parsePreparedMaterialCatalog(fixtureCatalog());
  const request = {
    catalog,
    profile: { profileId: "oblivion:nels-the-naughty" },
    retrieval: { intent: "family-daughter", factKeys: ["profile.family"] }
  };

  const first = selectPreparedMaterial({ ...request, turnCount: 0 });
  const second = selectPreparedMaterial({ ...request, turnCount: 1 });
  const mismatch = selectPreparedMaterial({
    ...request,
    retrieval: { intent: "family-daughter", factKeys: ["profile.origin"] },
    turnCount: 0
  });

  assert.equal(first.proposal.speech, fixtureCatalog().materials[0].variants[0]);
  assert.equal(second.proposal.speech, fixtureCatalog().materials[0].variants[1]);
  assert.equal(first.receipt.variantIndex, 0);
  assert.equal(second.receipt.variantIndex, 1);
  assert.equal(mismatch, null);
});
