import test from "node:test";
import assert from "node:assert/strict";
import {
  findProfileRetrieval,
  OBLIVION_PROFILE_CATALOG,
  parseOblivionProfileCatalog,
  resolveOblivionProfile,
  selectProfileFacts
} from "../src/oblivion-profiles.js";

test("Nels resolves only from the exact profiled identity", () => {
  const profile = resolveOblivionProfile({
    referenceFormId: "00028B76",
    displayName: "Nels the Naughty"
  });

  assert.equal(profile.profileId, "oblivion:nels-the-naughty");
  assert.equal(profile.voice.modelId, "en_GB-northern_english_male-medium");
  assert.equal(profile.voice.datasetLicense, "CC-BY-SA-4.0");
  assert.match(profile.facts["profile.ambition"], /Hoary Boar/u);
  assert.equal(resolveOblivionProfile({
    referenceFormId: "00028B76",
    displayName: "Different NPC"
  }), null);
  assert.equal(resolveOblivionProfile({
    referenceFormId: "00000001",
    displayName: "Nels the Naughty"
  }), null);
  assert.equal(resolveOblivionProfile({ referenceFormId: "00028B76" }), null);
});

test("reviewed profile questions select facts without scripting the response", () => {
  const profile = resolveOblivionProfile({
    referenceFormId: "00028B76",
    displayName: "Nels the Naughty"
  });
  assert.equal(findProfileRetrieval(profile, "Tell me about your daughter").intent, "family-daughter");
  const selected = selectProfileFacts(profile, "Tell me about your daughter");
  assert.deepEqual(selected.facts, {
    "profile.family": "His daughter Olga died when bandits attacked his village."
  });
  assert.equal(Object.hasOwn(selected.retrieval, "speech"), false);
  assert.deepEqual(selectProfileFacts(profile, "What color is the moon?").facts, {});
});

test("profile catalog parser rejects undeclared fields", () => {
  const candidate = JSON.parse(JSON.stringify(OBLIVION_PROFILE_CATALOG));
  candidate.profiles["00028B76"].unreviewedDialogue = ["copied game line"];

  assert.throws(
    () => parseOblivionProfileCatalog(candidate),
    /unsupported fields: unreviewedDialogue/u
  );
});
