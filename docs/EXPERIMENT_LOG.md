# Experiment log

This log separates machine measurements from human observations. Missing values
remain missing; they are never reconstructed from memory.

## Environment baseline — 2026-08-24

| Field | Literal value | Mode |
|---|---|---|
| Commit | `445d38e35595a001e21b719360799dab6c1ea6b7` | measured |
| Operating system | Linux Mint 22.3 | measured |
| Architecture | x86_64 | measured |
| CPU | AMD Ryzen 5 PRO 5650U with Radeon Graphics | measured |
| CPU topology | 6 cores / 12 logical CPUs | measured |
| Memory reported by `free -h` | 14 GiB total | measured |
| Node.js | v22.23.2 | measured |
| Python | 3.12.3 | measured |
| Piper | 1.7.0, GPL-3.0-or-later | measured |

## EXP-001 — deterministic conversation contract

- Date: 2026-08-24
- Commit: `6a4d5b1`
- Input: `Have you seen anything near the ruins?`
- Result: response envelope, subtitle, empty executed-action list, TTS request,
  and routing receipt returned successfully.
- Route: `economy`
- Route reason: `short-routine-input`
- Mode: measured by local CLI output
- Limitation: response text came from a deterministic demo provider, not an LLM.

## EXP-002 — system speech control

- Date: 2026-08-24
- Commit: `f7ba349`
- Backend: Speech Dispatcher via `spd-say`
- Network/API cost: $0 for the observed local run
- Playback result: audible on the target laptop
- Human observation: described as extremely “8 bit and robotic,” but compelling
  as proof of the speech path.
- Latency: not recorded in this log; the successful receipt was not preserved.
- Mode: playback is measured; quality statement is a single-user observation.

## EXP-003 — Piper neural speech

- Date: 2026-08-24
- Commit: `445d38e`
- Backend: Piper 1.7.0 using ONNX Runtime on CPU
- Model: `en_US-lessac-medium`, 22,050 Hz according to its model card
- Model file: 63,201,294 bytes
- Model SHA-256: `5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f`
- Configuration file: 4,885 bytes
- Configuration SHA-256: `efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0`
- Network/API cost: $0 for the observed local synthesis and playback
- Playback result: audible on the target laptop when run from the desktop terminal
- Human observation: described by the project owner as “the NPC voice spot on.”
- Latency: not recorded in this log; the receipt value has not been supplied.
- Mode: files, versions, and playback are measured; quality is a single-user observation.

## Failure evidence

| Experiment | Failure | Resolution | Reusable lesson |
|---|---|---|---|
| Piper setup | `ensurepip` unavailable | Installed Ubuntu `python3.12-venv` | Detect venv support during setup |
| Agent playback | PulseAudio connection refused from sandbox | Ran playback in the user's desktop terminal | Separate synthesis verification from desktop-audio verification |

## Next measurement

Repeat EXP-002 and EXP-003 using the same fixed sentence and preserve both
`voiceReceipt.latencyMs` values. Add time-to-first-audio and audio duration before
making comparative speed or real-time claims.

## EXP-004 — local structured dialogue baseline

- Date: 2026-08-24
- Runtime: Ollama 0.32.15, CPU-only
- Model: `qwen3:1.7b`, published Q4_K_M build
- Input: `Have you seen anything strange near the ruins?`
- Output: valid `speech` string and empty `actions` array
- Prompt tokens: 93
- Output tokens: 36
- Total duration: 6,011.664507 ms
- Model-load duration: 2,627.233078 ms
- Prompt-evaluation duration: 761.087 ms
- Generation duration: 2,611.664 ms
- Provider API cost: $0
- Observation: coherent and in format, but the answer was vague and introduced
  unsupported “lingering presence” language. Lore grounding requires evaluation.
- Mode: counts and durations measured by the local Ollama response; quality is
  a human observation from one prompt.

### EXP-004 grounding failure

A warm integrated run produced valid JSON and zero actions in 4,695.589379 ms,
but violated the two-sentence limit and invented maps, weapons, smoke, and old
wood. The implementation was not committed. This failure established that
schema validation alone is insufficient and directly motivated the fact-key,
retry, and safe-fallback gate.

### EXP-004 grounded controls after repair

| Control | Attempts | Grounding | Runtime latency | Result |
|---|---:|---|---:|---|
| Unsupported ruins question | 2 | passed after correction | 10,783.669928 ms | Expressed that it had not seen anything strange |
| Supplied location question | 1 | passed | 2,488.241421 ms | Returned the exact fictional roadside-inn location |

Both controls returned zero proposed/executed actions and `$0` provider API
cost. The unknown control's first attempt was rejected for an irrelevant fact
citation and failure to use unknown mode. These are two local runs, not a
character-quality benchmark.

Security observation: `OLLAMA_NO_CLOUD=1` was honored and the API bound to
`127.0.0.1`, but Ollama 0.32.15 retained broad built-in browser origins when a
narrow `OLLAMA_ORIGINS` value was supplied. The prototype therefore uses a
temporary foreground server and does not claim authenticated local API access.

## EXP-005 — grounded dialogue through neural voice

- Date: 2026-08-24
- Input: `Have you seen anything strange near the ruins?`
- Accepted speech: `I have not seen anything strange near the ruins.`
- Dialogue model: `qwen3:1.7b` through local Ollama
- Prompt/output tokens: 360 / 83 across two attempts
- Dialogue model duration: 9,190.44797 ms
- Runtime dialogue latency: 9,231.301604 ms
- Grounding: passed after the first attempt was rejected for an irrelevant fact
  citation and failure to use unknown mode
- Voice: `en_US-lessac-medium` through local Piper
- Voice synthesis-plus-playback latency: 4,260.188083 ms
- Voice status: played
- Proposed/executed actions: 0 / 0
- Provider API cost: $0
- Mode: values copied from the successful desktop CLI receipts; no combined
  latency was derived.

This establishes one complete typed-to-audible local turn. It does not establish
acceptable gameplay latency, broad grounding quality, or game integration.
