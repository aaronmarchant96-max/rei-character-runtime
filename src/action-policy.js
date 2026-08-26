const FORM_ID_PATTERN = /^[0-9A-F]{8}$/u;
const MAX_PICKUP_DISTANCE_UNITS = 500;

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expected, field) {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (actual.length !== allowed.length
      || actual.some((key, index) => key !== allowed[index])) {
    throw new TypeError(`${field} contains unexpected or missing fields`);
  }
}

function requireFormId(value, field) {
  if (typeof value !== "string" || !FORM_ID_PATTERN.test(value)) {
    throw new TypeError(`${field} must be 8 uppercase hexadecimal characters`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") throw new TypeError(`${field} must be boolean`);
  return value;
}

function parsePickupProposal(value) {
  const proposal = requireObject(value, "action proposal");
  requireExactKeys(
    proposal,
    ["schemaVersion", "type", "actorReferenceFormId", "itemReferenceFormId", "quantity"],
    "action proposal"
  );
  if (proposal.schemaVersion !== 1) throw new TypeError("action proposal schemaVersion must be 1");
  if (proposal.type !== "pick-up-item") throw new TypeError("unsupported action type");
  if (proposal.quantity !== 1) throw new TypeError("pickup quantity must be exactly 1");
  return Object.freeze({
    schemaVersion: 1,
    type: "pick-up-item",
    actorReferenceFormId: requireFormId(proposal.actorReferenceFormId, "actorReferenceFormId"),
    itemReferenceFormId: requireFormId(proposal.itemReferenceFormId, "itemReferenceFormId"),
    quantity: 1
  });
}

function parseSnapshot(value) {
  const snapshot = requireObject(value, "action snapshot");
  requireExactKeys(snapshot, ["schemaVersion", "actor", "item"], "action snapshot");
  if (snapshot.schemaVersion !== 1) throw new TypeError("action snapshot schemaVersion must be 1");

  const actor = requireObject(snapshot.actor, "action snapshot actor");
  requireExactKeys(
    actor,
    ["referenceFormId", "actorKind", "alive", "conscious", "inCombat"],
    "action snapshot actor"
  );
  if (actor.actorKind !== "npc" && actor.actorKind !== "creature") {
    throw new TypeError("action snapshot actorKind must be npc or creature");
  }

  const item = requireObject(snapshot.item, "action snapshot item");
  requireExactKeys(
    item,
    ["referenceFormId", "itemKind", "distanceUnits", "reachable", "enabled", "ownership"],
    "action snapshot item"
  );
  if (item.itemKind !== "ordinary" && item.itemKind !== "quest") {
    throw new TypeError("action snapshot itemKind must be ordinary or quest");
  }
  if (!Number.isFinite(item.distanceUnits) || item.distanceUnits < 0) {
    throw new TypeError("action snapshot distanceUnits must be a non-negative finite number");
  }
  if (!["unowned", "actor", "player", "other"].includes(item.ownership)) {
    throw new TypeError("action snapshot ownership is unsupported");
  }

  return {
    schemaVersion: 1,
    actor: {
      referenceFormId: requireFormId(actor.referenceFormId, "action snapshot actor referenceFormId"),
      actorKind: actor.actorKind,
      alive: requireBoolean(actor.alive, "action snapshot actor alive"),
      conscious: requireBoolean(actor.conscious, "action snapshot actor conscious"),
      inCombat: requireBoolean(actor.inCombat, "action snapshot actor inCombat")
    },
    item: {
      referenceFormId: requireFormId(item.referenceFormId, "action snapshot item referenceFormId"),
      itemKind: item.itemKind,
      distanceUnits: item.distanceUnits,
      reachable: requireBoolean(item.reachable, "action snapshot item reachable"),
      enabled: requireBoolean(item.enabled, "action snapshot item enabled"),
      ownership: item.ownership
    }
  };
}

function deny(reason, action) {
  return { status: "denied", reason, action, executedActions: [] };
}

export function evaluateActionProposal(value, worldSnapshot) {
  const action = parsePickupProposal(value);
  const snapshot = parseSnapshot(worldSnapshot);

  if (snapshot.actor.referenceFormId !== action.actorReferenceFormId) {
    return deny("actor-identity-mismatch", action);
  }
  if (snapshot.item.referenceFormId !== action.itemReferenceFormId) {
    return deny("item-identity-mismatch", action);
  }
  if (snapshot.actor.actorKind !== "npc") return deny("actor-not-npc", action);
  if (!snapshot.actor.alive || !snapshot.actor.conscious) return deny("actor-unavailable", action);
  if (snapshot.actor.inCombat) return deny("actor-in-combat", action);
  if (!snapshot.item.enabled) return deny("item-unavailable", action);
  if (snapshot.item.itemKind === "quest") return deny("protected-item", action);
  if (snapshot.item.ownership === "other") return deny("owned-by-other", action);
  if (snapshot.item.distanceUnits > MAX_PICKUP_DISTANCE_UNITS) return deny("item-too-far", action);
  if (!snapshot.item.reachable) return deny("item-unreachable", action);

  return {
    status: "approved",
    reason: "allow-listed-pickup",
    action,
    executedActions: []
  };
}
