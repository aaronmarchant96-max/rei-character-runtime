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

## EXP-010 — selected actor identity crossed into the external runtime

- Date: 2026-08-24
- Game/runtime: original Oblivion GOTY, Steam App ID `22330`, xOBSE `22.13`,
  Proton Experimental `11.0-100`
- Plugin SHA-256: `a01a2e4c1211c857123de7f4a25f0a885aac7fcdab747f70b1bc7f32d3075a35`
- Activation: `npm run target:listen`, then aim in-game and tap `U`
- Selected reference Form ID: `0004F9D3`
- Actor kind: `creature`
- Envelope size: 94 bytes
- Envelope SHA-256: `57390bccc155a96f56cc3558e2eae221e633d7e4ffc042e1a1c5a8b8050e63fe`
- Native result: `target-published-creature`
- External result: the strict schema validator emitted `target-selected` with
  the same Form ID and actor kind
- Rejection result: `target-hotkey-rejected-non-actor` was recorded before the
  accepted selection and did not publish a target
- Test result immediately before installation: 22 passed, 0 failed
- Side effects: no model calls, game actions, command registration, network
  requests, or save reads/writes
- Mode: DLL/envelope hashes, byte count, plugin events, and listener receipt
  measured locally in one live run

The native bridge writes a fixed four-field JSON envelope to a temporary file
and replaces `target.json` with Windows write-through rename semantics. The
external runtime accepts only schema version 1, game `oblivion-2009`, an
eight-character uppercase hexadecimal Form ID, and actor kind `npc` or
`creature`. Unknown, missing, malformed, ambiguous, and oversized values fail
validation.

This verifies the first game-to-runtime identity boundary. It does not yet
verify the actor name, location, dialogue request, model response, subtitle,
voice attachment, or a complete conversation round trip.

## EXP-011 — selected NPC bound to local dialogue and Piper playback

- Date: 2026-08-24
- Selected reference Form ID: `00028B74`
- Actor kind: `npc`
- Target envelope: 89 bytes; SHA-256
  `aeffb2038c3a0ddbfa0bb2e0f381b6d9569fc0b272acccdde0eba56b20bda2e4`
- Question: `Who are you?`
- Runtime character ID: `oblivion-2009:00028B74`
- Response: `I can't say that I've noticed anything certain about that.`
- Route: `economy`; reason: `short-routine-input`
- Dialogue provider/model: `ollama-local` / `qwen3:1.7b`
- Input/output tokens: 426 / 142
- Dialogue attempts: 2
- Dialogue duration: 18,365.646535 ms
- Runtime turn latency: 18,417.439125 ms
- Grounding result: fallback after `unknown-cites-facts` and
  `uncertainty-not-expressed` validation failures
- Provider API cost: $0
- Proposed/executed actions: 0 / 0
- Voice backend/model: `piper-local` / `en_US-lessac-medium`
- Voice status: `played`; latency: 5,368.534380000001 ms
- Test result immediately before the live turn: 24 passed, 0 failed
- Mode: target, dialogue, routing, grounding, and voice values copied literally
  from the live measured receipts

The grounding layer rejected two model attempts and supplied its known safe
uncertainty fallback before voice playback. This is expected while the target
contract contains only a Form ID and actor kind: no canonical NPC name,
biography, location, or dialogue facts were invented.

The first playback occurred while the project owner had YouTube playing, so it
was not treated as audible confirmation. A repeat run used the same target,
question, response, 89-byte target envelope, and target hash. The repeat
dialogue receipt recorded 426 input tokens, 145 output tokens, two attempts,
17,426.717854 ms total duration, and the safe fallback. Its Piper receipt
recorded `played` in 4,882.317866000001 ms. The project owner then confirmed
hearing the expected sentence through the laptop speakers.

This verifies identity continuity from a live Oblivion selection through an
external local-model and audibly confirmed TTS turn. It does not verify in-game
text entry, an in-game subtitle, spatial NPC audio, lip sync, or a canonical
game-character personality.

## EXP-012 — supervised augmentation session carries epistemic support

- Date: 2026-08-24
- Command: `npm run oblivion:session`
- Selected reference Form ID: `00028B77`
- Actor kind: `npc`
- Human-authored question: `Have you seen anything strange near the ruins?`
- Response: `I can't say that I've noticed anything certain about that.`
- Augmentation result: `answerMode=unknown`, no fact keys used, uncertainty
  explicit, `humanControl=player-decides`, `actionAuthority=none`
- Human input authority: `question-authored`
- Dialogue provider/model: `ollama-local` / `qwen3:1.7b`
- Input/output tokens: 437 / 70
- Dialogue attempts: 2
- Dialogue duration: 14,161.799822 ms
- Runtime turn latency: 14,181.127207 ms
- Grounding result: fallback after `irrelevant-fact-citation` and
  `unknown-cites-facts` validation failures
- Provider API cost: $0
- Proposed/executed actions: 0 / 0
- Voice backend/model: `piper-local` / `en_US-lessac-medium`
- Voice status: `played`; latency: 5,022.2810629999985 ms
- Test result immediately before the live turn: 27 passed, 0 failed
- Evidence format: three local JSONL records—session start, spoken turn, and
  session stop
- Mode: target, response, augmentation, dialogue, routing, and voice values
  copied literally from the live retained record

The runner exposed the facts known from the target envelope and named the
canonical name, location, biography, and dialogue as unknown before accepting
the question. The model's invalid attempts were not spoken. The safe fallback
preserved those unknowns, and the launcher stopped normally after `/quit`.

This verifies a repeatable external human–AI augmentation loop in which the
human selects the actor and authors the question while the system supplies a
grounded spoken response and inspectable support. It does not verify that audio
was heard during this particular run, in-game text entry, subtitles, spatial
audio, canonical character facts, memory, or game actions.

## EXP-013 — live actor name and location ground the response

- Date: 2026-08-24
- Game/runtime: original Oblivion GOTY, Steam App ID `22330`, xOBSE `22.13`,
  Proton Experimental `11.0-100`
- Live plugin SHA-256: `bbf1c934f77dbb9e2492d6554d64583de86272959e222e8d5d0d51c161c62b87`
- Activation: aim at the NPC and tap `U`, then run
  `npm run oblivion:session`
- Target schema version: 2
- Selected actor: `Nels the Naughty`; Form ID `00028B76`; kind `npc`
- Current location: `Summitmist Manor`; cell Form ID `00027D53`
- Target envelope: 184 bytes; SHA-256
  `a8300d368cb8ed3771f45640b2cd6842ab8696d47fcb15ec0cbe7963c9d78ec9`
- Human-authored question: `Who are you, and where are we?`
- Response: `I am Nels the Naughty, a player-selected NPC in the original
  Oblivion. We are located at Summitmist Manor.`
- Used fact keys: `identity.name`, `identity.persona`, `game.locationName`,
  `game.locationFormId`
- Augmentation result: `answerMode=known`, uncertainty none,
  `humanControl=player-decides`, `actionAuthority=none`
- Dialogue provider/model: `ollama-local` / `qwen3:1.7b`
- Input/output tokens: 457 / 155
- Dialogue attempts: 2
- Dialogue duration: 27,083.453053 ms
- Runtime turn latency: 27,104.828305000003 ms
- Grounding result: passed after one `irrelevant-fact-citation` validation
  failure; fallback not used
- Provider API cost: $0
- Proposed/executed actions: 0 / 0
- Voice backend/model: `piper-local` / `en_US-lessac-medium`
- Voice status: `played`; latency: 10,072.809524000004 ms
- Final verification after source-format repair: 28 passed, 0 failed
- Mode: native target values, byte/hash receipt, response, grounding, routing,
  and voice values copied literally from live retained records

The first selection after installation still emitted schema v1 because the
previous DLL remained loaded in the running game. Fully exiting and relaunching
Oblivion loaded schema v2; the next selection produced the enriched envelope.
This is a native lifecycle requirement, not a schema fallback.

The response demonstrates that actual game-derived identity and location can
cross the xOBSE boundary and ground local dialogue. It does not establish
canonical personality, biography, dialogue style, persistent memory, audible
human confirmation for this run, in-game subtitles, spatial audio, lip sync,
or game-action execution.

## EXP-014 — live typed question returns spoken and in-game response

- Date: 2026-08-24
- Game/runtime: original Oblivion GOTY, Steam App ID `22330`, xOBSE `22.13`
- Live plugin SHA-256:
  `911cda6b0bfe18efa90d9537ea58ab6ac9cc656b458f2de467e954efe1c4e073`
- Launcher: `npm run oblivion:live`
- Activation: aim at the NPC, press `Y`, type in the native editor, press Enter
- Selected actor: `Nels the Naughty`; Form ID `00028B76`
- Current location: `Summitmist Manor`; cell Form ID `00027D53`
- Question 1: `where are we ?`
- Response 1: `We are in Summitmist Manor.`
- Grounding 1: passed in one attempt using `game.locationFormId` and
  `game.locationName`; 215 input tokens, 41 output tokens, 3,974.235579 ms
- Voice 1: Piper `en_US-lessac-medium`, `played`, 4,343.401934999973 ms
- Question 2: `whats your faverite thing about the 7`
- Response 2: `I can't say that I've noticed anything certain about that.`
- Grounding 2: safe fallback after two attempts; 477 input tokens, 99 output
  tokens, 11,002.256669 ms
- Voice 2: Piper `en_US-lessac-medium`, `played`, 5,694.692871000152 ms
- Provider API cost: $0 for both turns
- Proposed/executed actions: 0 / 0 for both turns
- Final local verification: 34 passed, 0 failed; native scan-code compile test
  passed; production DLL build passed
- Human observation: the project owner confirmed that the response worked in
  game, while noting that the voice did not match the NPC and available
  knowledge remained limited

Bridge logs retained `question-native-input-read`, `question-published`,
`question-native-dialog-submitted`, and `response-live-messagebox-ran`. The
JSONL record preserved exact target, question, response, grounding, routing,
voice, byte-count, and hash receipts. This verifies the first complete live
typed conversation loop. It does not verify an NPC-specific voice, spatial
audio, canonical personality or lore, lip sync, persistent memory, or actions.

## EXP-015 — exact Nels profile selects grounded lore and distinct voice

- Date: 2026-08-24
- Profile match: Form ID `00028B76` plus name `Nels the Naughty`
- Profile facts: 5 short secondary-source paraphrases; no dialogue lines
- Question: `Where are you from?`
- Response: `I am from a small village in Skyrim.`
- Used fact key: `profile.origin`
- Dialogue provider/model: `ollama-local` / `qwen3:1.7b`
- Input/output tokens: 639 / 88 across two attempts
- Dialogue duration: 13,010.098936 ms
- Runtime turn latency: 13,050.450527 ms
- Grounding: passed after one `irrelevant-fact-citation` rejection
- Provider API cost: $0
- Selected voice: `en_US-ryan-medium`
- Voice policy: `local-noncommercial-prototype`
- Voice model SHA-256:
  `abf4c274862564ed647ba0d2c47f8ee7c9b717d27bdad9219100eb310db4047a`
- Generated WAV: 91,180 bytes; SHA-256
  `344279144a0813bced7aee929969d3798e2e8494f425e6ca739dda884b37aab6`
- Verification: 41 tests passed; native key-map compile test passed
- Mode: model file, synthesis artifact, dialogue, routing, grounding, and test
  values measured locally; lore facts are labelled secondary-source paraphrase

The model card identifies RyanSpeech under CC BY-NC-SA 4.0 and says the model
was fine-tuned from Lessac. The voice is therefore kept out of Git and is not
treated as commercially cleared. The model response and WAV synthesis were
verified locally, but playback was intentionally skipped in this control. A
live in-game audible turn is still required before claiming the new profile and
voice were heard in Oblivion.

## EXP-016 — failed daughter turn drives deterministic retrieval repair

### Live failure

- Date: 2026-08-24
- Question: `tell me about your daughter`
- Visible response: `I can't say that I've noticed anything certain about that.`
- Dialogue provider/model: `ollama-local` / `qwen3:1.7b`
- Input/output tokens: 643 / 145 across two attempts
- Dialogue duration: 24,479.640757 ms
- Runtime turn latency: 24,505.076913000026 ms
- Validation failures: `sentence-limit`, `irrelevant-fact-citation`, and
  `unknown-cites-facts`
- Voice: `en_US-ryan-medium`, played in 5,399.213179000013 ms
- Human observation: response took too long, returned the safe fallback, and
  the voice did not sound like a normal NPC voice
- Mode: exact values retained in the live JSONL record; quality is one human
  observation

### Local repair control

- Identical question and Nels identity
- Response: `My daughter Olga died when bandits attacked our village.`
- Dialogue provider/model: `profile-retrieval` / `deterministic-v1`
- Used fact key: `profile.family`
- Input/output model tokens: 0 / 0
- Dialogue duration: 0.104575999999998 ms
- Runtime turn latency: 0.2850360000000016 ms
- Model calls: 0
- Grounding: passed in one deterministic retrieval
- Replacement voice: `en_GB-northern_english_male-medium`
- Dataset license recorded by registry: CC BY-SA 4.0
- Voice model SHA-256:
  `57a219ae8e638873db7d18893304be5069c42868f392bb95c3ff17f0690d0689`
- Voice synthesis-plus-playback latency: 4,579.350079 ms
- Final verification: 43 tests passed; native key-map compile test passed
- Mode: dialogue, route, voice, model hash, and test values measured locally

This repair does not weaken the uncertainty boundary. Only explicit reviewed
triggers can use deterministic profile retrieval; other questions still reach
Ollama and its grounding gate. Live in-game confirmation and human acceptance
of the replacement voice remain outstanding.

## EXP-017 — dynamic character generation with mode-based routing

- Date: 2026-08-24
- Runtime: local Ollama 0.32.15, CPU-only
- Profile: exact Nels Form ID/name match
- Retrieval behavior: selects fact keys only; contains no response text

### Social control

- Question: `hello`
- Generated response: `Hello! I'm Nels the Naughty, a Nord who masks grief
  with tavern humor and distrusts the Imperial Legion. I'm here to chat with
  you.`
- Answer mode: `social`; used fact keys: none
- Model: `qwen3:0.6b`
- Input/output tokens: 205 / 57
- Attempts: 1; grounding passed; fallback not used
- Model duration: 2,182.516997 ms
- Runtime turn latency: 2,217.844684 ms
- Provider API cost: $0

### Grounded biography control

- Question: `tell me about your daughter`
- Retrieved keys: `profile.family` only
- Generated response: `Olga was my daughter, but she died when bandits
  attacked my village. I still remember the pain of that loss.`
- Answer mode: `known`; used key: `profile.family`
- Model: `qwen3:1.7b`
- Input/output tokens: 214 / 56
- Attempts: 1; grounding passed; fallback not used
- Model duration: 5,212.811291 ms
- Runtime turn latency: 5,217.308881000001 ms
- Provider API cost: $0

- Final verification: 44 tests passed; native key-map compile test passed
- Voice in both controls: intentionally skipped to isolate dialogue timing
- Mode: prompts, outputs, tokens, routing, durations, and tests measured locally

An intermediate 0.6B grounded control failed after 4,937.507171 ms with
`unknown-cites-facts` and `structured-output-invalid`, confirming that the
smaller model is not reliable enough for the current grounded schema. This is
why the live configuration uses it for social/unknown turns but retains 1.7B
for retrieved biography. The social output is responsive but still less
polished than desired; live player acceptance, memory, and relationship state
remain unverified.

## EXP-018 — bounded persistent memory versus stateless follow-up

- Date: 2026-08-24
- Runtime: local Ollama 0.32.15, CPU-only
- Profile: exact Nels Form ID/name match
- Fixture: ask about Nels's daughter, then ask `How do you feel about that?`
- Voice: skipped to isolate dialogue and context timing

### Remembered effect

- Prior turns loaded/provided: 1 / 1
- Provided memory ID: `turn-000001`
- Transcript context: 162 characters
- Relationship state: 1 prior turn / `met`
- Re-retrieved canonical key: `profile.family`
- Model: `qwen3:1.7b`
- Generated response: `I feel a mix of sorrow and humor. The loss of Olga was
  painful, but I carry that pain with me, and I laugh at it often.`
- Input/output tokens: 400 / 63
- Attempts: 1; grounding passed; fallback not used
- Model duration: 6,627.563198 ms
- Provider API cost: $0

### Stateless control

- Prior turns loaded/provided: 0 / 0
- Retrieved canonical keys: none
- Model: `qwen3:0.6b`
- Generated response: `I don't know how I feel about it. I'm just a Nord, and
  I don't really care about anything. I'm hiding my grief with the way I drink
  and the way I don't trust the Imperial Legion.`
- Input/output tokens: 312 / 71
- Attempts: 1; grounding passed; fallback not used
- Model duration: 3,503.929851 ms
- Provider API cost: $0
- Final verification: 49 tests passed; native key-map compile test passed

The effect resolved the pronoun to the earlier daughter topic and routed using
the reviewed fact rather than treating stored model text as canonical evidence.
It also consumed 88 more input tokens and took 3,123.633347 ms longer than the
stateless control. This is one paired observation, not evidence that additional
context improves every response. The bounded selector, NPC isolation, and
canonical-fact handoff are deterministic; broad coherence and player-perceived
quality still require a multi-turn evaluation corpus and live acceptance.

## EXP-019 — Mantella Skyrim Llama 3 8B compatibility gate

- Date: 2026-08-24
- Model: `art-from-the-machine/Mantella-Skyrim-Llama-3-8B-GGUF`
- Quantization: `Q4_K_M`; installed size reported by Ollama: 4.9 GB
- Runtime: project-local Ollama 0.32.15, CPU-only
- Upstream source:
  `https://huggingface.co/art-from-the-machine/Mantella-Skyrim-Llama-3-8B-GGUF`
- Upstream license: Apache-2.0
- Upstream status: model card labels the fine-tune outdated, worse than newer
  non-fine-tuned models, and no longer recommended for Mantella
- Training claim: 8,800+ player/NPC interactions; context length 8,192
- Production routing: unchanged
- Final verification: 49 tests passed; native key-map compile test passed

### EchoForge structured contract

The first cold request exceeded the runtime's 60-second deadline without a
response. A subsequent resident-model control completed with:

- Question: `Tell me about your daughter.`
- Response: `I don't like talking about that.` repeated three times
- Input/output tokens: 703 / 133
- Attempts: 2
- Validation failures: `sentence-limit`
- Grounding status: passed on the second attempt; fallback not used
- Total duration: 53,334.21392 ms
- Load duration: 4.336885 ms
- Generation duration: 49,813.065 ms
- Resident model allocation: 5.6 GB; processor: 100% CPU
- System state while resident: 1.5 GiB available RAM; 2.0 GiB swap used

### Matched current-model control

The same current prompt on `qwen3:1.7b` completed in one attempt:

- Input/output tokens: 330 / 63
- Total duration: 25,976.617475 ms
- Load duration after model swap: 12,587.391708 ms
- Generation duration: 6,439.512 ms
- Validation failures: none

Its answer nevertheless invented Olga's age, exposing that exact fact-key
citation does not yet prove every clause is entailed by the supplied fact.

### Raw role-play probe

With structured output removed and only a short persona/fact prompt retained,
the 8B model generated more fluent fantasy dialogue but invented Olga's traits,
pranks, additional village deaths, and a history of drinking after her death.

- Input/output tokens: 98 / 69
- Total duration: 47,535.094707 ms
- Load duration: 12,448.146054 ms
- Generation duration: 25,261.304 ms

The model is retained only as an ignored local research asset. It is rejected
for live routing because it misses the 60-second cold deadline, remains roughly
7.7 times slower under the structured contract (and 3.9 times slower in the raw
probe) than the matched 1.7B generation, repeats under the structured contract,
and adds unsupported details in raw dialogue.
The result also rejects the assumption that domain fine-tuning alone produces
a better evidence-bound character runtime.

## EXP-020 — Qwen3 4B Instruct 2507 promotion gate

- Date: 2026-08-24
- Candidate: `Qwen/Qwen3-4B-Instruct-2507`
- Quantization: LM Studio community `Q4_K_M`; installed size reported by
  Ollama: 2.5 GB
- Base-model source:
  `https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507`
- GGUF source:
  `https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF`
- Base-model license: Apache-2.0
- Runtime: project-local Ollama 0.32.15 on an isolated local port, CPU-only
- Voice: skipped to isolate dialogue latency and grounding
- Production routing: unchanged

The promotion claim was that a current 4B instruction model could produce more
capable character dialogue while remaining playable on the target laptop. Four
contract-level turns used the current EchoForge system prompt, structured output
schema, validation, Nels persona, and the same retrieved daughter fact used by
the live route.

### Candidate measurements

| Case | Wall time | Attempts | Result |
| --- | ---: | ---: | --- |
| Daughter, cold | 64,489.747072 ms | 2 | Grounding passed after `sentence-limit` correction |
| Unknown, warm | 15,976.954119 ms | 1 | Grounding passed |
| Social, warm | 18,263.739798 ms | 1 | Grounding passed |
| Daughter, warm | 39,897.474026 ms | 2 | Grounding passed after `sentence-limit` correction |

The daughter responses cited only `profile.family`, but added that Olga was a
"bright spark" or "bright soul" and described repeated drinking and joking as
Nels's coping behavior. Those details were not supplied as canonical facts.
The unknown answer did not invent an event near the ruins.

### Matched current-route control

The same four cases were then run on `qwen3:1.7b` through the same isolated
server and contract:

| Case | Wall time | Attempts | Result |
| --- | ---: | ---: | --- |
| Daughter, cold | 22,647.491061 ms | 2 | Safe fallback |
| Unknown, warm | 11,853.481078 ms | 2 | Grounding passed after correction |
| Social, warm | 7,433.143104 ms | 1 | Grounding passed |
| Daughter, warm | 14,317.585717 ms | 2 | Safe fallback |

The control was faster but failed to express the retrieved daughter fact in
both matched turns. The candidate expressed it, but its warm grounded response
still took 39.9 seconds and required a retry. This experiment therefore rejects
the candidate as a live-route replacement. It remains an ignored local research
asset. The next product hypothesis is a two-speed character system: keep the
player-facing path bounded and immediate, while stronger models prepare or
refresh reviewable character material outside the player's wait path.

## EXP-021 — two-speed prepared character material

- Date: 2026-08-24
- Generator model: `Qwen/Qwen3-4B-Instruct-2507`
- Source fact: `profile.family`
- Retrieval intent: `family-daughter`
- Material: three bounded variants under `nels-family-v1`
- Approval mode: `agent-reviewed-against-fact-keys`
- Voice: measurement stub; synthesis and playback intentionally excluded
- Final verification: 53 tests passed; native key-map compile test passed

EXP-020 produced expressive daughter answers but added unsupported traits and
coping behavior. For this control, those clauses were removed and the surviving
material was reduced to variants that state only that Olga was Nels's daughter
and died when bandits attacked their village. The runtime admits the material
only when profile ID, retrieval intent, and exact ordered fact keys match.

One local turn used the production target/profile/runtime boundary with a voice
stub and a dialogue provider that would throw if called:

- Question: `Tell me about your daughter.`
- Response: `Olga was my daughter. She died when bandits attacked our village.`
- Wall time: 2.4967979999999983 ms
- Runtime dialogue latency: 0.21862200000000342 ms
- Live model calls: 0
- Input/output tokens: 0 / 0
- Provider API cost: $0
- Model attempts: 0
- Grounding status: passed
- Selected variant: 0 of 3
- Proposed/executed actions: 0 / 0

Tests also verify that unapproved, ambiguous, malformed, or fact-key-mismatched
material is rejected and that an unmatched Nels question still calls the live
dialogue provider. This establishes the first two-speed contract for one fact;
it does not establish player preference, semantic validation automation, or
coverage beyond this Nels retrieval.

### Live Oblivion acceptance

The project owner then aimed at Nels and entered the same question through the
in-game `Y` editor. A screenshot confirmed the response appeared in Oblivion,
and the append-only session record reported:

- Recorded at: `2026-08-25T03:00:08.896Z`
- Character ID: `oblivion-2009:00028B76`
- Dialogue latency: 0.17371700002695434 ms
- Live model calls, tokens, attempts, and provider cost: 0
- Material: `nels-family-v1`, variant 0 of 3
- Retrieved/used fact key: `profile.family`
- Piper: `played` with `en_GB-northern_english_male-medium`
- Piper synthesis-plus-playback latency: 6,404.861363000004 ms
- Returned response: 65 bytes
- Response SHA-256:
  `d72c95098e5a4338aef7826718a1587bd7d7890d07538b34406ea79497d3b888`

An immediately preceding attempt targeted an `Everscamp`, so the exact-profile
gate correctly withheld Nels's prepared material and used the generic creature
path. Together, the two turns verify both live admission and live rejection for
one observed target each. The dominant remaining delay on the admitted turn was
voice synthesis and playback, not dialogue preparation.

## EXP-022 — first native pickup candidate rejected before dispatch

- Date: 2026-08-25
- Candidate commit: `728f07a`
- Linked actor: Nels `00028B76`
- Selected item reference: `000A7908`
- Selected item base: `0003369B` (player-observed sweetroll)
- Policy result: denied
- Receipt reason: `pickup-actor-unavailable`
- Game action dispatched: no
- Final verification after repair: 59 tests passed; strict 32-bit warning-free
  build passed

The live test exposed two independent defects. Loading the save replayed the
existing 56-byte `response.txt` from the prior daughter experiment even though
that file had not changed since 2026-08-24. The native candidate then preserved
the exact Nels and sweetroll identities but rejected the request through its
combined actor-state probe. Nels was visibly available; the probe was therefore
rejected as a reliable measurement rather than treated as game truth.

The repair suppresses pre-existing response content when a save loads and
removes the unreliable native actor-state probe. Exact NPC identity, same-cell
binding, ingredient type, reference availability, quest/protected flags,
ownership/off-limits state, and the 500-unit distance limit remain enforced.
Normal Oblivion activation remains responsible for final actor-state handling.
The repair is not a successful-pickup result; another live test is required.

That repeat test linked the same Nels reference and selected sweetroll reference
`000A7909`, again with base `0003369B`. All adapter checks passed and the game
remained stable, but the low-level activation virtual returned false, producing
`pickup-normal-activation-failed`; no action was claimed. The next candidate
removes that virtual call and instead invokes Oblivion's supported `Activate`
command on the already validated item reference with the exact linked NPC Form
ID as activator. It also requires another live test.

## EXP-023 — bounded inventory transfer succeeds without visible pickup

- Date: 2026-08-25
- Candidate commit: `f12d6f9`
- Linked actor: Nels `00028B76`
- Selected item base: `0003369B` (player-observed sweetroll)
- Adapter result: `pickup-normal-activation-dispatched`
- Human observation: the sweetroll disappeared from the world and appeared in
  Nels's inventory
- Human observation: Nels did not visibly reach for or grab the item
- Final verification before installation: 59 tests passed; strict 32-bit
  warning-free build passed
- Mode: native receipt and local checks measured; inventory presence and lack
  of animation human-observed in the live game

This verifies a bounded game-state mutation through normal activation, not a
physical NPC action sequence. Inventory transfer alone does not establish
pathfinding, animation, or embodied behavior.

The next candidate stages Oblivion.esm's `PicUpObjectGround` idle (`0003ECAA`),
waits 900 milliseconds, revalidates the exact actor and item, then performs the
already-proven activation transfer. Its receipt advances from `animating` to a
terminal `completed` or `failed` state. This candidate is compiled and locally
verified but has not yet been observed in game. It deliberately does not claim
walking or pathfinding.

The first animated live attempt selected sweetroll reference `000A790A` and
preserved the exact Nels and base-item identities, but failed closed with
`pickup-ground-animation-failed`; the item was not transferred. The raw numeric
idle Form ID did not satisfy `PlayIdle`'s idle-form reference parameter. The
next candidate resolves the same version-pinned idle through xOBSE's
`GetFormFromMod` expression before passing it to `PlayIdle`. It requires another
live test and does not yet establish that the animation plays.

The inline form-resolution candidate also failed closed with the same reason on
the next live run. The installed DLL hash matched the candidate, ruling out a
stale installation. The repeated result establishes that the temporary script
compiler path cannot express this `PlayIdle` argument reliably in the measured
xOBSE runtime; further syntax variants were stopped.

The next candidate mirrors xOBSE 22.13's own `Cmd_PlayIdle_Execute` queueing
path for the pinned Oblivion `1.2.0.416` runtime. It validates idle form
`0003ECAA`, resolves the actor's animation data through the version-pinned Actor
virtual table, and calls the same engine idle-queue function and arguments used
by xOBSE. Missing form, function, or animation data fails before transfer and
emits a distinct log reason. This native queue candidate is locally verified
but requires live observation; a successful queue still must not be reported as
a visible animation until the player sees it.

## EXP-024 — native gesture and transfer complete in sequence

- Date: 2026-08-26
- Candidate commit: `8fda57f`
- Linked actor: Nels `00028B76`
- Player observation: Nels visibly motioned to pick up the item
- Player observation: Nels did not walk from his position
- Player observation: the item appeared in Nels's inventory
- Local verification before installation: 59 tests passed; strict 32-bit build
  passed
- Mode: queue and transfer locally instrumented; gesture, locomotion absence,
  and inventory result human-observed

This verifies the native idle queue and delayed transfer as one visible action
sequence. It does not verify locomotion.

The next candidate adds a generated 260-byte `EchoForge.esp` containing one
scriptless, EchoForge-owned Find package. For an allowed item beyond the
140-unit gesture threshold, the bridge binds that exact reference as the
package target, starts it as the linked NPC's temporary script package, polls
proximity, and removes it before the verified gesture-and-transfer sequence. A
12-second timeout removes the package and fails closed. The bridge contains no
teleport or direct position command. This locomotion candidate is locally
verified but requires an in-game load and pathfinding test.

The first locomotion attempt failed before movement with
`pickup-walking-package-failed`; its generic message could not distinguish an
inactive ESP, an unresolved package, invalid target binding, or command
rejection. Inspection also found that command-based `SetPackageTarget` rejects
non-persistent world references in xOBSE, making that handoff unsuitable for an
ordinary placed ingredient.

## EXP-025 — preflighted pickup lifecycle candidate

- Date: 2026-08-26
- Candidate base: `a13ad42`
- Local verification: 61 tests passed; strict 32-bit build passed
- Live status: not yet tested
- Mode: source contracts and compiled adapter measured; gameplay result pending

This candidate resolves `EchoForge.esp` through Oblivion's loaded-mod table,
validates the package record, and binds the exact already-approved item through
the version-pinned native package layout. It publishes `capabilities.json` at
initialization and after save load. Pickup fails closed unless the input,
console, task queue, pickup idle, movement ESP, and movement package are all
available.

An accepted action now advances through named states: `validating`,
`queuing-movement`, `moving`, `arrived`, `animating`, `transferring`, and
`verifying`. Save loads interrupt in-flight work, movement timeouts remove the
temporary package, and a dispatched transfer is not marked complete until the
exact world reference becomes unavailable. This does not yet prove locomotion
or native inventory-container ownership; both remain live acceptance evidence.
