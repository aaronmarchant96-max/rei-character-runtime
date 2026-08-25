# Voice, licensing, and consent boundaries

This is an engineering record, not legal advice.

## Current components

| Component | Role | Repository treatment |
|---|---|---|
| Speech Dispatcher | Basic local playback control | External operating-system component |
| Piper 1.7.0 | Optional neural TTS engine | External GPL-3.0-or-later installation |
| `en_US-lessac-medium` | Current local voice model | Downloaded locally; excluded from Git |
| `en_US-ryan-medium` | Nels prototype voice | Downloaded locally; excluded from Git; source dataset is CC BY-NC-SA 4.0 |
| REI Character Runtime | Orchestration and evidence code | MIT-licensed repository |

The Piper model card identifies English (United States), one speaker, medium
quality, 22,050 Hz, its source dataset, and that the model was trained from
scratch. Repository-level labels do not replace review of the underlying
dataset, performer consent, model terms, and intended distribution.

## Non-negotiable boundaries

- Do not clone a living or identifiable person's voice without informed permission.
- Do not ship Bethesda voice recordings, extracted game assets, or derived models.
- Do not market a synthetic voice as an original performer.
- Keep original or explicitly licensed character voices distinguishable from
  canonical game performances.
- Record the engine, model, model hash, source, license, and consent basis for
  every distributable voice.

## Prototype versus distribution

Local experimentation and public distribution are different risk surfaces. A
voice that is acceptable for a private technical experiment is not automatically
cleared for a downloadable mod, commercial workflow, hosted service, or demo reel.

The Nels registry entry therefore records
`local-noncommercial-prototype`. It is a voice-selection experiment, not a
rights clearance. The model card reports a RyanSpeech source dataset under CC
BY-NC-SA 4.0 and fine-tuning from Lessac. The runtime records the selected model
in the voice receipt while the model and configuration remain ignored locally.

Before distribution, complete a voice manifest with:

```text
voice_id
engine and version
model and cryptographic hash
model source
engine license
model license
dataset license
speaker consent or provenance
allowed uses
attribution requirements
review date
```

## Current claim boundary

The project can accurately say that local neural speech was generated and played
on the target laptop using Piper and a documented public model. It cannot yet
claim commercial clearance, voice cloning, equivalence to a game actor, stable
real-time performance, or permission to distribute the downloaded model.
