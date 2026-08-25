# Two-speed character material pipeline

## Product decision

EchoForge does not make the player wait for a larger model when the answer can
be prepared safely before play. Stronger models may help draft character
material outside the live path. Draft output remains untrusted and cannot enter
the game until it is reduced to bounded variants, tied to exact reviewed fact
keys, and admitted to the prepared-material catalogue.

```text
reviewed facts -> stronger model draft -> clause review -> approved variants
                                                        |
player question -> exact profile + retrieval match -----+
                                                        v
                                              immediate spoken turn

no approved exact match -> existing routed live-model path
```

## Admission contract

Each prepared entry declares:

- one stable material ID;
- one exact character profile ID;
- one retrieval intent and its exact ordered fact-key set;
- one to eight bounded speech variants;
- approval status, review mode, generator model, and review date.

The parser rejects drafts, extra fields, duplicate profile/intent pairs,
duplicate variants, malformed fact keys, control characters, and oversized
content. Runtime selection fails closed unless profile, retrieval intent, and
fact keys all match. A mismatch uses the existing dialogue provider; prepared
material never broadens what is known.

## Runtime behavior

Approved variants rotate deterministically using the character's prior turn
count. A prepared turn records the catalogue, material, variant, fact keys,
approval provenance, zero model tokens, zero provider cost, and zero live-model
attempts. The normal route receipt, memory isolation, voice selection, and
no-action boundary still apply.

This first slice covers only Nels's `family-daughter` retrieval. It proves the
pipeline shape, not broad NPC coverage or automatic semantic validation.
Additional entries require the same evidence and review discipline.

## Boundaries

- Generator output is never self-approving.
- Structural validation does not prove semantic entailment; clause review is
  still required.
- Prepared dialogue does not authorize game actions or modify saves.
- Stored conversation remains non-canonical and cannot create new prepared
  facts.
- Voice rights remain governed separately by `VOICE_AND_RIGHTS.md`.
