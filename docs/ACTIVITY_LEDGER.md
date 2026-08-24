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
| 2026-08-24 | Add grounding and retry gate | 11 tests; two EXP-004 live controls | Unsupported answers are corrected or replaced before TTS | Game adapters can rely on an explicit pre-voice policy | verified on two controls |
| 2026-08-24 | Complete dynamic spoken turn | EXP-005 desktop receipts | Typed input reaches grounded local dialogue and audible neural speech | Same end-to-end contract can be placed behind a game bridge | verified on one live turn |

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

## Unmeasured fields for future activities

- Human elapsed time
- AI-assisted activity time and token cost
- Rework avoided
- Percentage of runtime code reused by a second adapter
- Marginal cost and effort per supported game
