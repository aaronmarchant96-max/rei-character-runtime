const MATERIAL_CATALOG = {
  schemaVersion: 1,
  catalogId: "oblivion-prepared-material-v1",
  materials: [
    {
      materialId: "nels-family-v1",
      profileId: "oblivion:nels-the-naughty",
      retrievalIntent: "family-daughter",
      factKeys: ["profile.family"],
      variants: [
        "Olga was my daughter. She died when bandits attacked our village.",
        "My daughter Olga died when bandits attacked our village.",
        "I lost my daughter Olga when bandits attacked our village."
      ],
      approval: {
        status: "approved",
        mode: "agent-reviewed-against-fact-keys",
        generatorModel: "Qwen/Qwen3-4B-Instruct-2507",
        reviewedAt: "2026-08-24"
      }
    }
  ]
};

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9:-]{2,79}$/u;
const FACT_KEY_PATTERN = /^profile\.[a-z][a-z0-9.]{1,78}$/u;

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

function requireExactKeys(value, allowed, field) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`${field} has unsupported fields: ${extras.join(", ")}`);
}

function requireText(value, field, maximum = 280) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new TypeError(`${field} must be a non-empty string of at most ${maximum} characters`);
  }
  if (/[\u0000-\u001F\u007F]/u.test(value)) {
    throw new TypeError(`${field} must not contain control characters`);
  }
  return value.trim();
}

function requireIdentifier(value, field) {
  const identifier = requireText(value, field, 80);
  if (!IDENTIFIER_PATTERN.test(identifier)) throw new TypeError(`${field} has an invalid format`);
  return identifier;
}

function freezeMaterial(candidate, index) {
  requireObject(candidate, `prepared material ${index}`);
  requireExactKeys(
    candidate,
    ["materialId", "profileId", "retrievalIntent", "factKeys", "variants", "approval"],
    `prepared material ${index}`
  );
  const materialId = requireIdentifier(candidate.materialId, `prepared material ${index} materialId`);
  const profileId = requireIdentifier(candidate.profileId, `prepared material ${index} profileId`);
  const retrievalIntent = requireIdentifier(
    candidate.retrievalIntent,
    `prepared material ${index} retrievalIntent`
  );
  if (!Array.isArray(candidate.factKeys) || candidate.factKeys.length === 0 || candidate.factKeys.length > 12) {
    throw new TypeError(`prepared material ${index} factKeys must contain between 1 and 12 entries`);
  }
  const factKeys = candidate.factKeys.map((key) => {
    if (typeof key !== "string" || !FACT_KEY_PATTERN.test(key)) {
      throw new TypeError(`prepared material ${index} contains an invalid fact key`);
    }
    return key;
  });
  if (new Set(factKeys).size !== factKeys.length) {
    throw new TypeError(`prepared material ${index} factKeys must be unique`);
  }
  if (!Array.isArray(candidate.variants) || candidate.variants.length === 0 || candidate.variants.length > 8) {
    throw new TypeError(`prepared material ${index} variants must contain between 1 and 8 entries`);
  }
  const variants = candidate.variants.map((variant, variantIndex) =>
    requireText(variant, `prepared material ${index} variant ${variantIndex}`));
  if (new Set(variants).size !== variants.length) {
    throw new TypeError(`prepared material ${index} variants must be unique`);
  }

  requireObject(candidate.approval, `prepared material ${index} approval`);
  requireExactKeys(
    candidate.approval,
    ["status", "mode", "generatorModel", "reviewedAt"],
    `prepared material ${index} approval`
  );
  if (candidate.approval.status !== "approved") {
    throw new TypeError(`prepared material ${index} approval status must be approved`);
  }
  const mode = requireIdentifier(candidate.approval.mode, `prepared material ${index} approval mode`);
  const generatorModel = requireText(
    candidate.approval.generatorModel,
    `prepared material ${index} generatorModel`,
    120
  );
  const reviewedAt = requireText(candidate.approval.reviewedAt, `prepared material ${index} reviewedAt`, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(reviewedAt)) {
    throw new TypeError(`prepared material ${index} reviewedAt must use YYYY-MM-DD`);
  }

  return Object.freeze({
    materialId,
    profileId,
    retrievalIntent,
    factKeys: Object.freeze(factKeys),
    variants: Object.freeze(variants),
    approval: Object.freeze({ status: "approved", mode, generatorModel, reviewedAt })
  });
}

export function parsePreparedMaterialCatalog(value) {
  requireObject(value, "prepared material catalog");
  requireExactKeys(value, ["schemaVersion", "catalogId", "materials"], "prepared material catalog");
  if (value.schemaVersion !== 1) throw new TypeError("prepared material catalog schemaVersion must be 1");
  const catalogId = requireIdentifier(value.catalogId, "prepared material catalog catalogId");
  if (!Array.isArray(value.materials) || value.materials.length === 0 || value.materials.length > 200) {
    throw new TypeError("prepared material catalog materials must contain between 1 and 200 entries");
  }
  const materials = value.materials.map(freezeMaterial);
  const identities = materials.map((material) => `${material.profileId}:${material.retrievalIntent}`);
  if (new Set(identities).size !== identities.length) {
    throw new TypeError("duplicate prepared material profile and retrieval intent");
  }
  return Object.freeze({ schemaVersion: 1, catalogId, materials: Object.freeze(materials) });
}

function sameFactKeys(expected, observed) {
  if (!Array.isArray(observed) || expected.length !== observed.length) return false;
  return expected.every((key, index) => key === observed[index]);
}

export function selectPreparedMaterial({ catalog, profile, retrieval, turnCount = 0 }) {
  if (!catalog || !profile || !retrieval) return null;
  const material = catalog.materials.find((candidate) =>
    candidate.profileId === profile.profileId
      && candidate.retrievalIntent === retrieval.intent) ?? null;
  if (!material || !sameFactKeys(material.factKeys, retrieval.factKeys)) return null;
  const normalizedTurnCount = Math.max(0, Math.floor(Number(turnCount) || 0));
  const variantIndex = normalizedTurnCount % material.variants.length;
  return {
    proposal: {
      speech: material.variants[variantIndex],
      actions: [],
      augmentation: {
        answerMode: "known",
        usedFactKeys: [...material.factKeys]
      },
      providerReceipt: {
        provider: "prepared-character-material",
        model: catalog.catalogId,
        inputTokens: 0,
        outputTokens: 0,
        totalDurationMs: 0,
        loadDurationMs: 0,
        generationDurationMs: 0,
        providerApiCostUsd: 0,
        attempts: 0,
        groundingStatus: "passed",
        fallbackUsed: false,
        validationFailures: [],
        measurementMode: "measured"
      }
    },
    receipt: {
      catalogId: catalog.catalogId,
      materialId: material.materialId,
      profileId: material.profileId,
      retrievalIntent: material.retrievalIntent,
      usedFactKeys: [...material.factKeys],
      variantIndex,
      variantCount: material.variants.length,
      approvalStatus: material.approval.status,
      approvalMode: material.approval.mode,
      generatorModel: material.approval.generatorModel,
      reviewedAt: material.approval.reviewedAt
    }
  };
}

export const OBLIVION_PREPARED_MATERIAL_CATALOG = parsePreparedMaterialCatalog(MATERIAL_CATALOG);
