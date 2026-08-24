# CARDO REI Activity ledger

The ledger records how activity becomes reusable capability. Effort and savings
are not estimated retroactively; they will be added only when captured during
the activity.

| Date | Activity | Evidence | Capability created | Reuse enabled | Status |
|---|---|---|---|---|---|
| 2026-08-24 | Bootstrap runtime contract | commit `6a4d5b1`; local tests | Validated turn envelope, routing receipt, TTS request, action separation | Any CLI, UI, or game adapter can target one contract | verified |
| 2026-08-24 | Add system speech control | commit `f7ba349`; audible desktop run | Small local voice-adapter boundary and fallback | Baseline for future TTS comparisons | verified |
| 2026-08-24 | Add Piper neural voice | commit `445d38e`; audible desktop run; model hashes | Higher-quality local CPU speech path | Same dialogue can be evaluated across voice backends | verified |

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

## Unmeasured fields for future activities

- Human elapsed time
- AI-assisted activity time and token cost
- Rework avoided
- Percentage of runtime code reused by a second adapter
- Marginal cost and effort per supported game
