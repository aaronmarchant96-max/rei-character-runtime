const PROFILE_CATALOG = {
  schemaVersion: 1,
  catalogId: "oblivion-profile-v1",
  profiles: {
    "00028B76": {
      profileId: "oblivion:nels-the-naughty",
      expectedName: "Nels the Naughty",
      persona: "A sociable, hard-drinking Nord who masks grief with tavern humor and distrusts the Imperial Legion.",
      facts: {
        "profile.origin": "Nels comes from a small village in Skyrim.",
        "profile.family": "His daughter Olga died when bandits attacked his village.",
        "profile.legion": "He resents the Imperial Legion because it failed to protect his village.",
        "profile.ambition": "He hopes to open a tavern called The Hoary Boar if he ever gets enough gold.",
        "profile.relationship.dovesi": "Dovesi reminds him of his daughter, so he feels protective toward her."
      },
      retrievals: [
        {
          intent: "relationship-dovesi",
          triggers: ["dovesi"],
          factKeys: ["profile.relationship.dovesi"]
        },
        {
          intent: "family-daughter",
          triggers: ["daughter", "olga"],
          factKeys: ["profile.family"]
        },
        {
          intent: "imperial-legion",
          triggers: ["imperial legion", "legion"],
          factKeys: ["profile.legion"]
        },
        {
          intent: "tavern-ambition",
          triggers: ["hoary boar", "tavern", "enough gold", "dream", "ambition"],
          factKeys: ["profile.ambition"]
        },
        {
          intent: "origin",
          triggers: ["where are you from", "where did you come from", "homeland", "origin", "skyrim"],
          factKeys: ["profile.origin"]
        }
      ],
      voice: {
        modelId: "en_GB-northern_english_male-medium",
        usePolicy: "local-attribution-sharealike-prototype",
        datasetLicense: "CC-BY-SA-4.0",
        source: "https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/northern_english_male/medium"
      },
      provenance: {
        mode: "secondary-source-paraphrase",
        reviewedAt: "2026-08-24",
        sources: [
          "https://elderscrolls.fandom.com/wiki/Nels_the_Naughty"
        ]
      }
    }
  }
};

const FORM_ID_PATTERN = /^[0-9A-F]{8}$/u;
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9:-]{2,79}$/u;
const FACT_KEY_PATTERN = /^profile\.[a-z][a-z0-9.]{1,78}$/u;
const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;

function requireExactKeys(value, allowed, field) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`${field} has unsupported fields: ${extras.join(", ")}`);
}

function requireBoundedText(value, field, maximum = 240) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maximum) {
    throw new TypeError(`${field} must be a non-empty string of at most ${maximum} characters`);
  }
  return value.trim();
}

export function parseOblivionProfileCatalog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("profile catalog must be an object");
  }
  requireExactKeys(value, ["schemaVersion", "catalogId", "profiles"], "profile catalog");
  if (value.schemaVersion !== 1) throw new TypeError("profile catalog schemaVersion must be 1");
  const catalogId = requireBoundedText(value.catalogId, "profile catalog catalogId", 80);
  if (!value.profiles || typeof value.profiles !== "object" || Array.isArray(value.profiles)) {
    throw new TypeError("profile catalog profiles must be an object");
  }

  const profiles = {};
  for (const [referenceFormId, candidate] of Object.entries(value.profiles)) {
    if (!FORM_ID_PATTERN.test(referenceFormId)) {
      throw new TypeError("profile reference Form IDs must be 8 uppercase hexadecimal characters");
    }
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError(`profile ${referenceFormId} must be an object`);
    }
    requireExactKeys(
      candidate,
      ["profileId", "expectedName", "persona", "facts", "retrievals", "voice", "provenance"],
      `profile ${referenceFormId}`
    );
    const profileId = requireBoundedText(candidate.profileId, "profileId", 80);
    if (!PROFILE_ID_PATTERN.test(profileId)) throw new TypeError("profileId has an invalid format");
    const expectedName = requireBoundedText(candidate.expectedName, "expectedName", 120);
    const persona = requireBoundedText(candidate.persona, "persona", 500);

    if (!candidate.facts || typeof candidate.facts !== "object" || Array.isArray(candidate.facts)) {
      throw new TypeError("profile facts must be an object");
    }
    const factEntries = Object.entries(candidate.facts);
    if (factEntries.length === 0 || factEntries.length > 12) {
      throw new TypeError("profile facts must contain between 1 and 12 entries");
    }
    const facts = Object.fromEntries(factEntries.map(([key, fact]) => {
      if (!FACT_KEY_PATTERN.test(key)) throw new TypeError(`invalid profile fact key: ${key}`);
      return [key, requireBoundedText(fact, `profile fact ${key}`)];
    }));

    if (!Array.isArray(candidate.retrievals) || candidate.retrievals.length === 0
      || candidate.retrievals.length > 12) {
      throw new TypeError("profile retrievals must contain between 1 and 12 entries");
    }
    const retrievals = candidate.retrievals.map((retrieval, index) => {
      if (!retrieval || typeof retrieval !== "object" || Array.isArray(retrieval)) {
        throw new TypeError(`profile retrieval ${index} must be an object`);
      }
      requireExactKeys(retrieval, ["intent", "triggers", "factKeys"], `profile retrieval ${index}`);
      const intent = requireBoundedText(retrieval.intent, `profile retrieval ${index} intent`, 80);
      if (!Array.isArray(retrieval.triggers) || retrieval.triggers.length === 0 || retrieval.triggers.length > 8) {
        throw new TypeError(`profile retrieval ${index} triggers must contain between 1 and 8 entries`);
      }
      const triggers = retrieval.triggers.map((trigger) => {
        const normalized = requireBoundedText(trigger, `profile retrieval ${index} trigger`, 80).toLowerCase();
        if (normalized.length < 4) throw new TypeError("profile retrieval triggers must be at least 4 characters");
        return normalized;
      });
      if (!Array.isArray(retrieval.factKeys) || retrieval.factKeys.length === 0) {
        throw new TypeError(`profile retrieval ${index} factKeys must be a non-empty array`);
      }
      const factKeys = retrieval.factKeys.map((key) => {
        if (!Object.hasOwn(facts, key)) throw new TypeError(`profile retrieval references unknown fact key: ${key}`);
        return key;
      });
      return Object.freeze({ intent, triggers: Object.freeze(triggers), factKeys: Object.freeze(factKeys) });
    });

    if (!candidate.voice || typeof candidate.voice !== "object" || Array.isArray(candidate.voice)) {
      throw new TypeError("profile voice must be an object");
    }
    requireExactKeys(candidate.voice, ["modelId", "usePolicy", "datasetLicense", "source"], "profile voice");
    const modelId = requireBoundedText(candidate.voice.modelId, "voice modelId", 80);
    if (!VOICE_ID_PATTERN.test(modelId)) throw new TypeError("voice modelId has an invalid format");
    const usePolicy = requireBoundedText(candidate.voice.usePolicy, "voice usePolicy", 80);
    const datasetLicense = requireBoundedText(candidate.voice.datasetLicense, "voice datasetLicense", 80);
    const voiceSource = requireBoundedText(candidate.voice.source, "voice source", 300);
    if (!voiceSource.startsWith("https://")) throw new TypeError("voice source must use HTTPS");

    if (!candidate.provenance || typeof candidate.provenance !== "object" || Array.isArray(candidate.provenance)) {
      throw new TypeError("profile provenance must be an object");
    }
    requireExactKeys(candidate.provenance, ["mode", "reviewedAt", "sources"], "profile provenance");
    const mode = requireBoundedText(candidate.provenance.mode, "provenance mode", 80);
    const reviewedAt = requireBoundedText(candidate.provenance.reviewedAt, "provenance reviewedAt", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(reviewedAt)) throw new TypeError("reviewedAt must use YYYY-MM-DD");
    if (!Array.isArray(candidate.provenance.sources) || candidate.provenance.sources.length === 0) {
      throw new TypeError("profile provenance sources must be a non-empty array");
    }
    const sources = candidate.provenance.sources.map((source) => {
      const url = requireBoundedText(source, "provenance source", 300);
      if (!url.startsWith("https://")) throw new TypeError("provenance sources must use HTTPS");
      return url;
    });

    profiles[referenceFormId] = Object.freeze({
      profileId,
      expectedName,
      persona,
      facts: Object.freeze(facts),
      retrievals: Object.freeze(retrievals),
      voice: Object.freeze({ modelId, usePolicy, datasetLicense, source: voiceSource }),
      provenance: Object.freeze({ mode, reviewedAt, sources: Object.freeze(sources) })
    });
  }

  return Object.freeze({ schemaVersion: 1, catalogId, profiles: Object.freeze(profiles) });
}

export const OBLIVION_PROFILE_CATALOG = parseOblivionProfileCatalog(PROFILE_CATALOG);

export function resolveOblivionProfile(target, catalog = OBLIVION_PROFILE_CATALOG) {
  const profile = catalog.profiles[target.referenceFormId];
  if (!profile) return null;
  if (target.displayName !== profile.expectedName) return null;
  return profile;
}

function normalizeQuestion(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

export function findProfileRetrieval(profile, playerText) {
  if (!profile) return null;
  const question = normalizeQuestion(playerText);
  return profile.retrievals.find((retrieval) =>
    retrieval.triggers.some((trigger) => question.includes(trigger))) ?? null;
}

export function selectProfileFacts(profile, playerText) {
  const retrieval = findProfileRetrieval(profile, playerText);
  if (!retrieval) return { retrieval: null, facts: {} };
  return {
    retrieval,
    facts: Object.fromEntries(retrieval.factKeys.map((key) => [key, profile.facts[key]]))
  };
}
