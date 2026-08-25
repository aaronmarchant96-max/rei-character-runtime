# CARDO REI Activity ledger

The ledger records how activity becomes reusable capability. Effort and savings
are not estimated retroactively; they will be added only when captured during
the activity.

| Date | Activity | Evidence | Capability created | Reuse enabled | Status |
|---|---|---|---|---|---|
| 2026-08-24 | Bootstrap runtime contract | commit `6a4d5b1`; local tests | Validated turn envelope, routing receipt, TTS request, action separation | Any CLI, UI, or game adapter can target one contract | verified |
| 2026-08-24 | Add system speech control | commit `f7ba349`; audible desktop run | Small local voice-adapter boundary and fallback | Baseline for future TTS comparisons | verified |
| 2026-08-24 | Add Piper neural voice | commit `445d38e`; audible desktop run; model hashes | Higher-quality local CPU speech path | Same dialogue can be evaluated across voice backends | verified |
| 2026-08-24 | Establish local dialogue baseline | Ollama receipt; EXP-004 | Structured CPU-local character dialogue with literal token and duration metrics | Dialogue providers can be compared behind one contract | measured, integration pending |
| 2026-08-24 | Add grounding and retry gate | 16 tests; two EXP-004 live controls | Unsupported answers are corrected or replaced before TTS | Game adapters can rely on an explicit pre-voice policy | verified on two controls |
| 2026-08-24 | Complete dynamic spoken turn | EXP-005 desktop receipts | Typed input reaches grounded local dialogue and audible neural speech | Same end-to-end contract can be placed behind a game bridge | verified on one live turn |
| 2026-08-24 | Capture clean Oblivion baseline | EXP-006 manifest, hashes, and generated configuration | Known Steam/Proton starting state with existing-save risk identified | Later adapter failures can be separated from installation drift | verified; save isolation pending |
| 2026-08-24 | Install and verify xOBSE | EXP-007 archive, payload, loader, runtime logs, and hashes | Reversible script-extender entry point on Steam Proton | EchoForge can now target a measured plugin boundary | verified; no EchoForge plugin yet |
| 2026-08-24 | Prove external text inside Oblivion | 19 tests; EXP-008; xOBSE and bridge logs; human visual confirmation | Atomic Node-to-xOBSE file contract and delayed in-game message display | Dialogue providers can target a measured game-side text boundary | verified proof path; NPC interaction pending |
| 2026-08-24 | Add one-key Oblivion character targeting | 19 tests; EXP-009; bridge log; human confirmation of visible ID | Edge-triggered actor-only crosshair selection with a Form-ID receipt | A future dialogue request can be bound to a player-selected character | verified with `U`; external round trip pending |
| 2026-08-24 | Export selected Oblivion actor identity | 22 tests; EXP-010; 94-byte live envelope and hash receipt | Atomic game-to-runtime target contract with strict external validation | Dialogue orchestration can receive the exact player-selected reference | verified for one creature; name/location pending |
| 2026-08-24 | Bind selected NPC to local dialogue and voice | 24 tests; EXP-011; Ollama/Piper receipts; human audible confirmation | Exact game Form ID persists through routing, grounding, and playback | One selected actor can drive a safe external spoken turn | audible desktop playback verified; spatial attachment pending |
| 2026-08-24 | Encode a supervised augmentation session | 27 tests; EXP-012 JSONL and live receipts | One command exposes knowns/unknowns, preserves player authority, validates dialogue, speaks it, and records evidence | Repeated actor questions can use the same inspectable workflow | verified on one external turn; in-game UI pending |
| 2026-08-24 | Ground dialogue in live actor and location context | 28 tests; EXP-013; 184-byte schema-v2 envelope and spoken-turn receipts | Game-derived name and location cross the native boundary as allow-listed facts | Selected NPCs can answer identity/location questions without invented context | verified for one NPC/interior cell; broader corpus pending |
| 2026-08-24 | Complete the first live Oblivion conversation loop | 34 tests; native key-map compile test; EXP-014; bridge and JSONL receipts; human confirmation | One `Y` press now connects aimed actor, typed question, local grounded dialogue, Piper speech, and returned in-game text | Same evidence-bearing loop can now host voice-selection and knowledge experiments | verified for two questions; generic voice and sparse facts remain |
| 2026-08-24 | Add the first strict NPC profile and voice mapping | 41 tests; EXP-015; local Ollama and Piper controls | Exact Form ID plus game-derived name can select bounded sourced facts and a policy-labelled voice without relaxing fallback | Additional NPCs can be added as reviewed data entries instead of runtime exceptions | locally verified for Nels; live audible confirmation pending |
| 2026-08-24 | Repair profiled answer latency and failed voice audition | 43 tests; EXP-016 failed-live receipt and local repair controls | Exact reviewed facts bypass model retries while unknowns retain grounded Ollama fallback; voice policy is replaceable data | Profile-backed questions can be fast, cheap, and auditable without weakening unknown handling | 0.29 ms pre-speech control verified; replacement voice acceptance pending |
| 2026-08-24 | Re-anchor profiles as a dynamic character engine | 44 tests; EXP-017 routed local controls | Retrieval selects context while models generate wording across social, grounded, and unknown modes | Personality, future memory, and model economics can evolve independently behind one evidence contract | locally verified; live and voice-quality acceptance pending |
| 2026-08-24 | Add bounded persistent NPC conversation memory | 49 tests; EXP-018 paired remembered/stateless control; local persistence and isolation tests | Same-NPC follow-ups recover prior topics and re-retrieve canonical evidence without sharing memory across actors | Conversations can accumulate useful continuity while prompt growth remains capped | one two-turn Nels fixture; broad quality and long-session effects unmeasured |
| 2026-08-24 | Evaluate Mantella's Skyrim Llama 3 8B fine-tune locally | EXP-019 structured and raw-dialogue controls; literal Ollama/RAM receipts | NPC-specific training can add fantasy flavor but does not guarantee grounding, compatibility, or playable latency | Future model promotion must measure the full runtime contract rather than parameter count or specialization alone | rejected for live routing: 53.33 s structured turn, repetition, and unsupported details |

## Decision ledger

### ADR-001 — game-independent core

- Decision: keep dialogue, routing, validation, and voice orchestration outside
  the game adapter.
- Why: legacy games require different integration mechanisms, while character
  behavior and evidence contracts should transfer.
- Test: measure reused versus adapter-specific work during the second game integration.

### ADR-002 — model actions are proposals

- Decision: language-model output cannot directly execute game actions.
- Why: malformed or manipulated output must not modify game state or saves.
- Test: acceptance tests require proposed actions to leave `executedActions` empty.

### ADR-003 — local voice baseline

- Decision: establish local speech before evaluating hosted or cloning systems.
- Why: it creates a zero-API-cost privacy baseline and isolates voice plumbing
  from provider availability.
- Test: the fixed sentence must play locally with network access disabled after setup.

### ADR-004 — external Piper installation

- Decision: invoke Piper as a separately installed optional GPL component rather
  than bundle it into the MIT repository.
- Why: preserve an explicit license boundary and keep large models out of Git.
- Follow-up: obtain legal review before making distribution or commercial compatibility claims.

### ADR-005 — local structured dialogue control

- Decision: use project-local Ollama with `qwen3:1.7b` as the first dynamic
  dialogue control.
- Why: it runs without an API key, exposes literal performance counters, and
  supports schema-constrained output on the target CPU.
- Limitation: one successful response does not establish character quality,
  lore compliance, or acceptable warm latency.

### ADR-006 — grounding before voice

- Decision: require relevant fact-key citations, deterministic structural
  validation, one corrective retry, and a safe uncertainty fallback before TTS.
- Why: the first integrated response passed its JSON schema while inventing
  unsupported environmental details.
- Limitation: lexical fact relevance is an initial control, not proof of semantic
  truth. A scenario corpus and stronger entailment evaluation remain required.

### ADR-007 — EchoForge as a bounded REI proving ground

- Decision: treat EchoForge as a focused game-runtime experiment while REI AI
  remains the primary long-term system.
- Why: Oblivion exercises routing, grounding, local inference, voice, latency,
  receipts, and action boundaries in a concrete environment without requiring
  game-specific architecture to enter the REI core.
- Test: verify one original Oblivion NPC text-and-voice bridge, then record which
  capabilities transfer back to REI and which remain adapter-specific.
- Stop condition: do not generalize CARDO into a universal product workflow from
  this single adapter result.

### ADR-008 — supported xOBSE display path

- Decision: use xOBSE's console interface to run a sanitized `MessageBoxEX`
  statement for the first visible bridge proof.
- Why: direct HUD queue calls returned success before and after a 120-frame
  delay but produced no visible text under the measured Proton environment.
- Boundary: the plugin constructs only one fixed command type from a bounded
  response, replaces quotes and button separators, escapes percent signs, and
  exposes no arbitrary command interface to a model or player.
- Follow-up: replace the modal proof UI with a tested NPC-associated subtitle
  path rather than treating `MessageBoxEX` as the final experience.

### ADR-009 — augmentation support belongs in the response contract

- Decision: carry epistemic support alongside actual in-character responses:
  known/unknown mode, exact supplied fact keys, explicit uncertainty, retained
  human decision authority, and no model action authority.
- Why: augmentation should improve the player's ability to understand and
  decide without polluting character speech with system language or turning the
  model into an autonomous game controller.
- A activity: the player selects a character, asks a question, and hears the
  validated response.
- B activity: the supervised launcher consolidates model startup, target
  inspection, repeated turns, playback, and evidence capture.
- C activity: the response contract and experiment ledger make future
  grounding and workflow improvements comparable rather than anecdotal.
- Test: every recorded supervised turn must retain identity continuity, human
  control, zero action authority, and the response's fact-use/uncertainty state.

### ADR-010 — version game-derived context explicitly

- Decision: introduce target-envelope schema v2 for bounded nullable actor
  display name, location Form ID, and cell/worldspace display name while
  retaining strict schema-v1 read compatibility.
- Why: stale target files must remain diagnosable during plugin upgrades, and
  game-derived context must not be confused with generated biography.
- Boundary: native strings are capped at 80 bytes, sanitized, JSON-escaped, and
  validated again outside the game. Missing data remains `null`.
- Test: reject unexpected fields, malformed Form IDs, control characters, and
  envelopes over 512 UTF-8 bytes before dialogue.

## Unmeasured fields for future activities

- Human elapsed time
- AI-assisted activity time and token cost
- Rework avoided
- Percentage of runtime code reused by a second adapter
- Marginal cost and effort per supported game
