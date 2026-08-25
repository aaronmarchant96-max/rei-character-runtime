import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfileDialogueProvider,
  findProfileRetrieval,
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

test("reviewed profile questions bypass the model with exact fact evidence", async () => {
  const profile = resolveOblivionProfile({
    referenceFormId: "00028B76",
    displayName: "Nels the Naughty"
  });
  assert.equal(findProfileRetrieval(profile, "Tell me about your daughter").intent, "family-daughter");
  let fallbackCalls = 0;
  let now = 10;
  const provider = createProfileDialogueProvider({
    profile,
    clock: { now: () => (now += 0.25) },
    fallback: async () => {
      fallbackCalls += 1;
      return { speech: "fallback", actions: [] };
    }
  });

  const result = await provider({ playerText: "Tell me about your daughter" });
  assert.equal(result.speech, "My daughter Olga died when bandits attacked our village.");
  assert.deepEqual(result.augmentation.usedFactKeys, ["profile.family"]);
  assert.equal(result.providerReceipt.provider, "profile-retrieval");
  assert.equal(result.providerReceipt.totalDurationMs, 0.25);
  assert.equal(result.providerReceipt.inputTokens, 0);
  assert.equal(fallbackCalls, 0);

  const fallback = await provider({ playerText: "What color is the moon?" });
  assert.equal(fallback.speech, "fallback");
  assert.equal(fallbackCalls, 1);
});

test("profile catalog parser rejects undeclared fields", () => {
  const candidate = JSON.parse(JSON.stringify(OBLIVION_PROFILE_CATALOG));
  candidate.profiles["00028B76"].unreviewedDialogue = ["copied game line"];

  assert.throws(
    () => parseOblivionProfileCatalog(candidate),
    /unsupported fields: unreviewedDialogue/u
  );
});
