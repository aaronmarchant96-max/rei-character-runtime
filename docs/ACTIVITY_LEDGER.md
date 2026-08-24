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

## Unmeasured fields for future activities

- Human elapsed time
- AI-assisted activity time and token cost
- Rework avoided
- Percentage of runtime code reused by a second adapter
- Marginal cost and effort per supported game
