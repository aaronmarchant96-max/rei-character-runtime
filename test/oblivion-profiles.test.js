import test from "node:test";
import assert from "node:assert/strict";
import {
  OBLIVION_PROFILE_CATALOG,
  parseOblivionProfileCatalog,
  resolveOblivionProfile
} from "../src/oblivion-profiles.js";

test("Nels resolves only from the exact profiled identity", () => {
  const profile = resolveOblivionProfile({
    referenceFormId: "00028B76",
    displayName: "Nels the Naughty"
  });

  assert.equal(profile.profileId, "oblivion:nels-the-naughty");
  assert.equal(profile.voice.modelId, "en_US-ryan-medium");
  assert.equal(profile.voice.usePolicy, "local-noncommercial-prototype");
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

test("profile catalog parser rejects undeclared fields", () => {
  const candidate = JSON.parse(JSON.stringify(OBLIVION_PROFILE_CATALOG));
  candidate.profiles["00028B76"].unreviewedDialogue = ["copied game line"];

  assert.throws(
    () => parseOblivionProfileCatalog(candidate),
    /unsupported fields: unreviewedDialogue/u
  );
});
