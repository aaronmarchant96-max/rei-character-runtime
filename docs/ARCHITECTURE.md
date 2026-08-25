# Architecture and trust boundaries

## Component map

```text
Untrusted / variable                         Trusted / deterministic

player input -----> character context -----> route decision
                           |                       |
                   bounded memory                 |
                           |                       |
                           v                       v
                     dialogue provider ----> response validator
                                                   |
                              +--------------------+------------------+
                              |                    |                  |
                              v                    v                  v
                           subtitle           TTS request      action proposal
                              |                    |                  |
                              v                    v                  v
                         game display         voice adapter     allow-list gate
                                                                      |
                                                                      v
                                                               game adapter
```

The language model boundary is intentionally untrusted. Provider output must be
validated before it becomes speech, memory, or a proposed action. A proposed
action is data; it is never proof that the action is permitted.

## Current implementation

- `src/runtime.js` validates input, chooses a route, invokes a dialogue provider,
  and emits the response and evidence receipt.
- `src/voice.js` validates TTS requests and delegates playback to an external
  local backend.
- `src/oblivion-profiles.js` validates a bounded, provenance-bearing overlay
  keyed by exact Form ID and game-derived name. It supplies paraphrased facts
  and an explicitly policy-labelled Piper model; a mismatch returns no overlay.
  Reviewed trigger phrases select the smallest relevant fact subset.
- `src/prepared-material.js` validates approved, model-assisted speech variants
  against one exact profile, retrieval intent, and ordered fact-key set. An
  exact match can answer without a live model call; every mismatch retains the
  existing routed provider. Generator output cannot approve itself.
- `src/bridge.js` validates and atomically publishes a bounded text response for
  a game adapter.
- `src/session.js` validates target knowledge, identity continuity, human
  control, and append-only local session evidence.
- `src/memory.js` isolates memory by exact character ID, atomically retains the
  last 24 successful turns, selects at most four relevant/recent turns under a
  1,600-character prompt budget, and derives a measured familiarity tier from
  total prior turn count.
- `src/cli.js` is the current input and diagnostic harness.
- `scripts/run-oblivion-session.mjs` supervises a player-authored sequence of
  selected-target turns and owns only the local model process it starts.
- `scripts/run-oblivion-live.mjs` watches atomic in-game question envelopes,
  requires exact target identity continuity, runs Ollama and Piper, publishes
  the response, and appends local turn evidence.
- `native/xobse/echoforge_bridge.cpp` is a minimal original-Oblivion adapter. It
  watches fresh responses and invokes xOBSE `MessageBoxEX` on the game main
  loop. It also edge-detects `U` or `F10`,
  reads the crosshair reference from the version-pinned Oblivion 1.2.0416 HUD
  layout, accepts only NPC/creature base-form types, and displays the reference
  Form ID.
  Pressing `Y` opens xOBSE's native text editor while the bridge captures a
  bounded US-keyboard DirectInput stream, atomically publishes the question,
  and silently refreshes the aimed actor envelope.
- The test suite verifies routing, validation, action non-execution, voice
  command boundaries, and deterministic atomic bridge publication without
  requiring live audio or a game installation.

## Current voice paths

```text
Control: ttsRequest -> Speech Dispatcher -> desktop audio
Effect:  ttsRequest -> Piper -> temporary WAV -> PulseAudio -> desktop audio
```

Piper output is generated in a unique temporary directory and deleted after
playback. The model and Python environment live in ignored local directories.

## Current game boundary

The first Oblivion adapter is intentionally narrow:

```text
Node fixture -> atomic response.txt -> xOBSE plugin -> delayed MessageBoxEX
player aims + taps U -> actor-only crosshair lookup -> Form-ID receipt
                         -> atomic target.json -> validated external listener
                         -> bounded actor name + current cell/worldspace context
                         -> bounded runtime turn -> Ollama -> Piper desktop audio
player aims + taps Y -> native editor + bounded raw keys -> question.json
                      -> exact identity check -> Ollama -> Piper + response.txt
                      -> fresh-response watch -> in-game MessageBoxEX
```

Verified in EXP-008:

- xOBSE loads the 32-bit plugin under Steam Proton.
- A successful save-load event schedules display after 120 game frames.
- The plugin reads no more than 240 bytes from one declared response file.
- No plugin command, network request, model call, action, or save mutation exists.

Verified in EXP-009:

- The xOBSE main-loop task polls supported input without disabling game input.
- One `U` keypress while aiming at an NPC produced a visible target receipt.
- Targeting records identity only; it cannot invoke dialogue or mutate the game.

The implementation routes missing and non-actor crosshair references to
explanatory messages; those two rejection paths still require live acceptance
tests.

Verified in EXP-010:

- The plugin atomically replaces one 256-byte-bounded target envelope.
- The external runtime requires an exact schema, game ID, uppercase Form ID,
  and `npc`/`creature` actor kind.
- One selected creature arrived as Form ID `0004F9D3`; the listener recorded
  the exact 94-byte payload and its SHA-256 digest.
- A non-actor selection was rejected before any target file replacement.
- A missing-crosshair rejection still requires a live acceptance test.

Verified in EXP-011:

- The selected Form ID becomes the runtime `characterId`.
- The same ID remains attached to both dialogue and Piper receipts.
- Grounding validation remains active and can replace an invalid model answer
  with the safe uncertainty fallback.
- Proposed and executed action arrays remain empty.
- Playback is external desktop audio; no spatial game-audio claim is made.

Verified in EXP-012:

- One command supervised local-model startup, target selection, typed input,
  validation, Piper playback, and append-only evidence.
- The actual response envelope retained `answerMode`, `usedFactKeys`, explicit
  uncertainty, `player-decides`, and `actionAuthority: none`.
- The measured unknown answer cited no facts and proposed/executed no actions.

Verified in EXP-013:

- Target schema v2 carried the game-derived actor name, parent-cell Form ID,
  and cell/worldspace display name through the strict external validator.
- The actor name became an identity fact and the location became an
  allow-listed world fact; the grounded response cited both.
- Schema v1 remains accepted but normalizes the three new values to `null`.

Verified in EXP-014:

- Two player-authored questions crossed the live in-game input boundary.
- Exact Form ID `00028B76` remained attached to target, dialogue, voice, and
  response receipts.
- A known location answer passed grounding in one attempt; an unsupported
  preference answer failed closed to explicit uncertainty.
- The project owner confirmed the response worked in game and identified the
  generic voice and sparse knowledge as the next limitations.

The next adapter increments remain:

1. Add additional allow-listed actor/world facts behind explicit measurements.
2. Expand the explicit voice-selection registry only with reviewed model cards
   and policies appropriate to each intended use.
3. Replace the proof message box with an NPC-associated subtitle.
4. Associate the external voice turn with the in-game NPC before attempting
   spatial engine audio.

## Dynamic character modes

The current dialogue boundary distinguishes a prepared path and three live
generation modes:

- `prepared`: an approved profile/intent/fact-key match rotates through bounded
  reviewed variants with zero live-model tokens or attempts.

- `social`: greetings and casual exchanges use persona for style without
  requiring a factual citation or inventing world events.
- `grounded`: a deterministic retriever supplies only relevant reviewed facts;
  generated speech must cite those exact keys.
- `unknown`: unsupported factual questions must express uncertainty and cite
  nothing.

When no prepared match exists, the live runner maps social and unknown turns to
`qwen3:0.6b` and grounded turns to `qwen3:1.7b`. Model output remains untrusted
in every live generation mode.

## Bounded memory boundary

Persistent memory has two distinct roles:

- Prior player/NPC text supplies conversational continuity but is explicitly
  labelled non-canonical. A generated statement cannot promote itself into
  lore merely because it was stored.
- A follow-up such as “How do you feel about that?” may use the prior player
  question to recover a reviewed profile retrieval. The current turn then
  receives the original canonical fact and must cite its fact key again.

Memory files live under ignored `.local/character-memory`, keyed by a SHA-256
digest of the exact game/Form-ID character identity. Different NPCs never share
a file. Retention and prompt limits prevent “more history” from becoming an
unbounded latency and context-cost increase. Familiarity currently means only
measured encounter count; trust, affection, hostility, and durable world events
are not yet inferred.

Quest state mutation, inventory changes, spawning, combat control, arbitrary
console commands, and save writes remain prohibited until separately designed
and tested.

## Evidence receipt contract

A successful turn currently records character ID, selected route, route reason,
measured runtime latency, and measurement mode. Memory-enabled turns also record
loaded/provided turn counts, provided IDs, context characters, familiarity, and
the newly stored turn ID. Local-model turns additionally carry an
augmentation record declaring whether the response is known or unknown, the
supplied fact keys it used, explicit uncertainty, human decision authority, and
the absence of model action authority. Voice playback additionally records
backend, model where applicable, status, and measured synthesis-plus-playback
latency.
Prepared turns additionally record catalogue and material IDs, exact fact keys,
variant index/count, generator model, approval mode/date, zero provider cost,
zero model tokens, and zero live-model attempts.
