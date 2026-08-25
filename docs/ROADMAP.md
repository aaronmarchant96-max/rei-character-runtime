# Evidence-first roadmap

## Product hypothesis

A game-independent character runtime can support typed, contextual, spoken NPC
conversation in original Oblivion and later transfer to another Bethesda game
at lower marginal integration effort.

That is a hypothesis until the milestones below are measured.

## Milestone 0 — deterministic contract

Claim: typed input produces a validated response envelope, routing receipt, and
TTS request without network access.

Acceptance evidence:

- Empty input is rejected.
- Character identity and player input are kept separate.
- Model output cannot directly execute a game action.
- Every successful turn contains route and latency provenance.

## Milestone 1 — voice bench

Claim: a consent-safe voice adapter can turn the response text into audible
speech on the target computer.

Measure time to first audio, total synthesis time, real-time factor, failures,
and hardware/software versions. Compare a fast local fixed voice with any
higher-quality voice option on the same response corpus.

## Milestone 2 — original Oblivion text bridge

Prerequisite — clean Steam/Proton baseline:

- Install original Oblivion GOTY (2009), Steam App ID `22330`.
- Launch the unmodified game once, reach the main menu, and exit normally.
- Record the resolved install path, Proton prefix, executable identity, and game
  version before installing xOBSE or any EchoForge files.
- Keep existing saves outside the experiment until the adapter proves it can
  operate without irreversible modification.

Status: verified in EXP-006 on 2026-08-24. Steam Cloud restored 31 existing
saves. The project owner later authorized loading them for the bridge test; the
plugin itself does not read or write save files.

xOBSE prerequisite status: release `22.13` installed reversibly and verified by
loader/runtime logs in EXP-007.

Bridge status: accepted in EXP-014 after partial proofs in EXP-008 through
EXP-013. A deterministic
external response crossed the file boundary and appeared in-game through
`MessageBoxEX`. The plugin load, save event, delayed main-loop task, and script
execution were logged. A player-selected NPC produced a visible Form-ID receipt
after one `U` keypress. A later selected creature's exact Form ID crossed an
atomic JSON boundary and was validated by the external listener. In-game text
entry, exact target binding, external processing, and return display completed a
human-confirmed round trip. The current display is a message box rather than an
NPC-attached subtitle.

Claim: targeting one NPC and entering text can round-trip through an xOBSE game
adapter and display the validated response as a subtitle without modifying a
save irreversibly.

Acceptance evidence:

- The adapter targets only the declared original Oblivion installation.
- One test NPC can be selected without granting the model console access.
- Typed input crosses the game boundary and returns a validated subtitle.
- `executedActions` remains empty throughout the first bridge experiment.
- Removing the adapter restores the clean baseline without save repair.

## Milestone 3 — in-game voice

Claim: the selected NPC can play generated speech with acceptable stability.
Spatial audio and lip synchronization are separate experiments, not assumed
parts of this milestone.

Status: partial acceptance in EXP-011. Selected NPC `00028B74` remained bound
to a local Ollama dialogue receipt and a Piper `played` receipt. The project
owner heard the response on a repeat run. Playback used desktop audio and has
not been associated with the in-game NPC, so the milestone claim is not
complete.

EXP-012 adds a repeatable supervised session around this partial path. It does
not complete the milestone: playback remains desktop audio, but the player can
now author multiple questions while the response envelope exposes grounding
and preserves human control.

EXP-013 verified the first contextual voice input: schema v2 exported `Nels the
Naughty` and `Summitmist Manor` from the live game, and the grounded model
response used both. Piper reported `played`, but audio remains external and was
not human-confirmed for that run.

EXP-014 verified two questions authored through the in-game `Y` text box. Piper
playback and the returned in-game response were human-confirmed. Voice remains
one generic desktop model rather than NPC-specific or spatial audio, so this
milestone remains partial.

EXP-015 adds the first exact NPC-to-voice selection in the external runtime:
Nels maps to `en_US-ryan-medium`, while all unknown or mismatched actors retain
the default. Local synthesis is verified, but live audible confirmation and
spatial attachment remain outstanding. The selected model is noncommercial
prototype-only, not distribution-cleared.

The first live EXP-015 audition was rejected for voice quality. EXP-016 replaces
Ryan with `en_GB-northern_english_male-medium`, whose dataset is CC BY-SA 4.0.
Local playback is verified; player acceptance of the new voice remains pending.

## Milestone 4 — memory and world state

Claim: bounded retrieved memories and allow-listed game facts improve character
consistency without increasing unsupported statements beyond the agreed
threshold.

Status: first allow-listed game facts verified in EXP-013. This does not yet
measure memory or consistency across a corpus. EXP-014 demonstrated the current
boundary clearly: location was answered from exported facts, while an unsupported
preference question fell back rather than inventing a personality.

EXP-015 adds five provenance-labelled paraphrased facts for one exact Nels
identity. A local origin question passed the grounding gate using only
`profile.origin`; unsupported questions still use the existing uncertainty
path. This is one control, not a broad character-quality result.

The first live daughter question exposed a 24.5-second, two-attempt fallback.
EXP-016 adds deterministic retrieval for the five reviewed Nels facts. The same
question now reaches a grounded answer in 0.29 ms before speech with no model
call; unsupported questions still use Ollama.

## Milestone 5 — transfer experiment

Adapt the runtime to Fallout 3 or New Vegas. Record runtime reuse, adapter-only
work, elapsed human activity, failures, and total integration effort. This is
the test of the CARDO REI bootstrapping thesis—not a presumed outcome.
