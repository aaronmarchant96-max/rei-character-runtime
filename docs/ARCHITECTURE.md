# Architecture and trust boundaries

## Component map

```text
Untrusted / variable                         Trusted / deterministic

player input -----> character context -----> route decision
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
- `src/bridge.js` validates and atomically publishes a bounded text response for
  a game adapter.
- `src/session.js` validates target knowledge, identity continuity, human
  control, and append-only local session evidence.
- `src/cli.js` is the current input and diagnostic harness.
- `scripts/run-oblivion-session.mjs` supervises a player-authored sequence of
  selected-target turns and owns only the local model process it starts.
- `native/xobse/echoforge_bridge.cpp` is a minimal original-Oblivion adapter. It
  reads the response after a successful save load and schedules an xOBSE
  `MessageBoxEX` call on the game main loop. It also edge-detects `U` or `F10`,
  reads the crosshair reference from the version-pinned Oblivion 1.2.0416 HUD
  layout, accepts only NPC/creature base-form types, and displays the reference
  Form ID.
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

The next adapter increments remain:

1. Add easy bounded in-game text entry.
2. Add additional allow-listed actor/world facts behind explicit measurements.
3. Replace the proof message box with an NPC-associated subtitle.
4. Associate the external voice turn with the in-game NPC before attempting
   spatial engine audio.

Quest state mutation, inventory changes, spawning, combat control, arbitrary
console commands, and save writes remain prohibited until separately designed
and tested.

## Evidence receipt contract

A successful turn currently records character ID, selected route, route reason,
measured runtime latency, and measurement mode. Local-model turns also carry an
augmentation record declaring whether the response is known or unknown, the
supplied fact keys it used, explicit uncertainty, human decision authority, and
the absence of model action authority. Voice playback additionally records
backend, model where applicable, status, and measured synthesis-plus-playback
latency.
