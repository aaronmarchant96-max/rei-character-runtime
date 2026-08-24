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

## EXP-006 — clean original Oblivion launch baseline

- Date: 2026-08-24
- Game: The Elder Scrolls IV: Oblivion Game of the Year Edition (2009)
- Steam App ID: `22330`
- Steam build ID: `1510065`
- Installed size reported by Steam: 5,987,389,233 bytes
- Compatibility runtime: Proton Experimental `11.0-100`
- First-launch result: main menu reached and game exited normally
- Renderer: AMD Radeon Graphics through RADV RENOIR
- Initial display configuration: fullscreen, 640×480
- Generated files: `Oblivion.ini`, `RendererInfo.txt`, and `BlendSettings.ini`
- `Oblivion.exe` SHA-256: `a8f313845c1545e9a60e1e995961eef4c033115da9443f6d756341df3c2b7dc6`
- `OblivionLauncher.exe` SHA-256: `060ff1f2530f86991290c37c8d8ddb78cbd9e60433a00cbf4c4d3d7934844692`
- `Oblivion.esm` SHA-256: `a26e21ea8c3041f8737ffb3a266129dedb7f8a88590625ecfecd5eb7f66b4a70`
- `Oblivion.ini` SHA-256 after first launch: `4d848614db7ea8e9dfab53f7448af962ab9166462ab8d14795c145de7986d717`
- `RendererInfo.txt` SHA-256: `856f9a5b05aa84fe3cb732a7596c730869b5c9e956e7fd8f5b34a00c754bb4db`
- Existing saves: 31 `.ess` files restored into the prefix; none were opened,
  copied, modified, or deleted during this measurement
- Mode: Steam manifest, local file hashes, generated configuration, and runtime
  files measured directly on the target laptop

The executable, launcher, and master-file hashes were unchanged across the
first launch. Before any adapter experiment, existing saves require an explicit
isolation or backup procedure. This experiment verifies installation and launch
only; it does not verify xOBSE or game integration.

## EXP-007 — reversible xOBSE runtime baseline

- Date: 2026-08-24
- xOBSE release: `22.13`
- Official release archive size: 5,520,478 bytes
- Official release archive SHA-256: `92d18411a9da803ffaac8c0b005cb6b37c4f9ce2f1571215f39363760d832bf2`
- Installation mode: official Steam Proton launcher substitution
- Original launcher: preserved with its EXP-006 SHA-256 in a hash-labelled
  backup file
- Loader result: hooked the Steam Oblivion process and launched successfully
- Runtime result: `OBSE: initialize (version = 22.13 010201A0)`
- Executable CRC reported by the loader: `A2408F04`
- Runtime result: plugin directory detected, engine reported `patched`, and
  xOBSE deinitialized normally
- `obse_loader.log` SHA-256: `74ec2dcdafc2abe8ad74873e1958df4e361c954922c85d8835b9cc5abd87e48f`
- `obse.log` SHA-256: `33ec5306cf0ab8bb20d499ce1389a4986ac7bda175f11350330f426dd1808b4b`
- Post-launch `Oblivion.exe` and `Oblivion.esm` hashes: unchanged from EXP-006
- Save handling: no save was intentionally loaded or modified by the
  installation procedure
- Mode: archive metadata, installed files, hashes, and runtime logs measured on
  the target laptop

This verifies the script-extender prerequisite and reversible launcher path. It
does not yet verify an EchoForge plugin, subtitle bridge, or NPC interaction.

## EXP-008 — external text rendered inside original Oblivion

- Date: 2026-08-24
- Game/runtime: original Oblivion GOTY, Steam App ID `22330`, xOBSE `22.13`,
  Proton Experimental `11.0-100`
- Input fixture: `External response reached Oblivion.`
- Published text: `EchoForge bridge: External response reached Oblivion.`
- Response size: 53 bytes
- Response SHA-256: `18ee8fbea22c6cb1e5270403f8d19ffb08e9b03a292107d96f43d500f70d8f40`
- Plugin SHA-256: `1d2985c91b9e7d470dc2670411bde1816babcc8c5be9f9fb19793621bac18026`
- Plugin result: xOBSE reported `EchoForgeBridge` loaded correctly
- Load event: xOBSE recorded a successful `.ess` load; no companion `.obse`
  file existed for that save
- Bridge result: `plugin-loaded`, `game-initialized`,
  `response-display-scheduled`, and `response-messagebox-script-ran`
- Human observation: the project owner confirmed that the expected response
  appeared in an in-game message box
- Test result immediately before installation: 19 passed, 0 failed
- Mode: hashes, test count, and logs measured locally; visible rendering is one
  human-observed run

Two display attempts failed before the working path:

| Attempt | Implementation | Logged result | Visible result |
|---|---|---|---|
| 1 | Direct HUD queue during post-load callback | `response-queued` | No message observed after about two minutes |
| 2 | Direct HUD queue after 120 main-loop frames | `response-queued-after-delay` | No message observed |
| 3 | Sanitized `MessageBoxEX` through xOBSE console interface after 120 frames | `response-messagebox-script-ran` | Expected popup observed |

This verifies an external deterministic text-to-game display path. It does not
verify NPC targeting, player input captured inside the game, model-generated
dialogue in the game, subtitle presentation, voice playback, save independence
across a corpus, or a complete round trip.

## EXP-009 — one-key NPC targeting inside original Oblivion

- Date: 2026-08-24
- Game/runtime: original Oblivion GOTY, Steam App ID `22330`, xOBSE `22.13`,
  Proton Experimental `11.0-100`
- Plugin SHA-256: `392d0818e52b8128d78c9919498b3fd58bdd44939d62f388e122faf76c4a9c2b`
- Activation: aim at an NPC or creature and tap `U`; `F10` remains an alternate
- Input result: `target-hotkey-polling` confirmed the xOBSE main-loop input task
- Target result: `target-hotkey-actor-receipt-ran` was recorded
- Human observation: the project owner confirmed that the target locked and an
  ID appeared in-game
- Test result immediately before installation: 19 passed, 0 failed
- Side effects: no commands registered, model calls made, actions executed, or
  save data read/written
- Mode: DLL hash, test count, and plugin events measured locally; visible target
  receipt confirmed by one human-observed run

The first attempt used only `F10`. The plugin loaded and registered its task,
but no key event was recorded on the measured ThinkPad/Proton path. A rebuilt
plugin retained `F10`, added the plain `U` key, and logged a one-time polling
heartbeat. `U` produced the expected actor receipt.

This verifies player-triggered selection of one live NPC/creature reference. It
does not yet verify the NPC name, location, external publication of the selected
reference, typed dialogue, subtitle output, voice attachment, or a complete
conversation round trip.
