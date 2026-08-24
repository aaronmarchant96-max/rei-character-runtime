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
