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
- `src/cli.js` is the current input and diagnostic harness.
- `test/runtime.test.js` verifies routing, validation, action non-execution, and
  voice command boundaries without requiring live audio.

## Current voice paths

```text
Control: ttsRequest -> Speech Dispatcher -> desktop audio
Effect:  ttsRequest -> Piper -> temporary WAV -> PulseAudio -> desktop audio
```

Piper output is generated in a unique temporary directory and deleted after
playback. The model and Python environment live in ignored local directories.

## Planned game boundary

The first Oblivion adapter should begin read-only:

1. Detect whether the bridge is connected.
2. Read the selected reference and current location.
3. Send allow-listed facts to the runtime.
4. Display a returned subtitle.
5. Play voice externally before attempting in-engine audio.

Quest state mutation, inventory changes, spawning, combat control, arbitrary
console commands, and save writes remain prohibited until separately designed
and tested.

## Evidence receipt contract

A successful turn currently records character ID, selected route, route reason,
measured runtime latency, and measurement mode. Voice playback additionally
records backend, model where applicable, status, and measured synthesis-plus-
playback latency.
