# Evidence-first roadmap

## Product hypothesis

A game-independent character runtime can support typed, contextual, spoken NPC
conversation in original Oblivion and later transfer to another Bethesda game
at lower marginal integration effort.

That is a hypothesis until the milestones below are measured.

## Milestone 0 — deterministic contract

Claim: typed input produces a validated response envelope, routing receipt, and
TTS request without network access.

Acceptance evidence:

- Empty input is rejected.
- Character identity and player input are kept separate.
- Model output cannot directly execute a game action.
- Every successful turn contains route and latency provenance.

## Milestone 1 — voice bench

Claim: a consent-safe voice adapter can turn the response text into audible
speech on the target computer.

Measure time to first audio, total synthesis time, real-time factor, failures,
and hardware/software versions. Compare a fast local fixed voice with any
higher-quality voice option on the same response corpus.

## Milestone 2 — original Oblivion text bridge

Claim: targeting one NPC and entering text can round-trip through an xOBSE game
adapter and display the validated response as a subtitle without modifying a
save irreversibly.

## Milestone 3 — in-game voice

Claim: the selected NPC can play generated speech with acceptable stability.
Spatial audio and lip synchronization are separate experiments, not assumed
parts of this milestone.

## Milestone 4 — memory and world state

Claim: bounded retrieved memories and allow-listed game facts improve character
consistency without increasing unsupported statements beyond the agreed
threshold.

## Milestone 5 — transfer experiment

Adapt the runtime to Fallout 3 or New Vegas. Record runtime reuse, adapter-only
work, elapsed human activity, failures, and total integration effort. This is
the test of the CARDO REI bootstrapping thesis—not a presumed outcome.
