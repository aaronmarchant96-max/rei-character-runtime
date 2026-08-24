# Open-source influences and adoption gates

This record identifies projects that may accelerate EchoForge without obscuring
provenance, licensing, or the boundary between architectural influence and code
reuse. It is an engineering record, not legal advice.

Last reviewed: 2026-08-24

## Use categories

| Category | Meaning |
|---|---|
| Reference | Learn concepts and independently implement them; copy no code or assets |
| Interface | Use a documented public API or ABI; do not copy upstream implementation |
| External process | Invoke a separately installed component across a file, CLI, or localhost boundary |
| Development tool | Use during development or catalogue generation; do not ship it with EchoForge |
| Direct candidate | Source inclusion or linking may be considered after version, license, notice, security, and verification gates |
| Hold | Do not depend on, vendor, or copy until missing terms or maintenance risks are resolved |

## Influence matrix

| Project | Useful capability or lesson | Reported terms | EchoForge category | Current decision |
|---|---|---|---|---|
| [xOBSE](https://github.com/llde/xOBSE) | Original Oblivion lifecycle, messaging, main-loop tasks, text input, crosshair reference, and UI commands | No top-level license file was found in the checked-out `22.13` source; upstream asks plugin authors to publish source | Interface | Use documented interfaces and independently defined minimal ABI fields. Do not vendor implementation source. Clarify upstream terms before copying beyond interface definitions. |
| [Mantella](https://github.com/art-from-the-machine/Mantella) | STT → LLM → TTS sequencing, NPC context, conversation state, interruption, and memory architecture | AGPL-3.0 | Reference | Study behavior and boundaries. Do not copy or combine its code into the MIT repository without a deliberate license decision. |
| [HerikaServer / CHIM](https://github.com/abeiro/HerikaServer) | External game/server boundary, multi-NPC conversation, world events, providers, and tool mediation | License not verified in this review | Reference | Architectural comparison only. No code reuse until exact repository and component terms are recorded. |
| [MinAI](https://github.com/MinLL/MinAI) | Controlled connections between an LLM and game/mod capabilities | License not verified; upstream currently marks the project deprecated | Reference / Hold | Learn from its action-mediation problems and migration history. Add no dependency and copy no code. |
| [GenericMenuFramework](https://genericmenuframework.readthedocs.io/en/latest/) | Oblivion generic menus, text, lists, scrolling, and UI events | Documentation grants free use, including commercial use, with attribution; it also labels the framework work-in-progress | Reference / Hold | Use its documentation to understand Oblivion UI. Do not bundle it until source, version, attribution, MenuQue dependency, and compatibility are verified. |
| [MenuQue](https://github.com/kyoma/MenuQue) | Extended Oblivion menu events and tile manipulation | Linked GitHub repository is empty; source and distribution terms unresolved | Hold | Do not vendor. Consider only as a separately installed user dependency after a reproducible source and rights review. |
| [Ollama](https://github.com/ollama/ollama) | Local structured dialogue and literal runtime metrics | MIT; individual model licenses remain separate | External process | Continue the localhost-only optional integration. Pin and record the Ollama version, model identity, model hash, and model license independently. |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) | Fast local neural speech through CLI, Python, HTTP, or C/C++ APIs | GPL-3.0; individual voice-model and dataset terms remain separate | External process | Keep the engine, environment, and voice model outside the MIT repository. Preserve the current process boundary and voice manifest. |
| [miniaudio](https://github.com/mackron/miniaudio) | Dynamic WAV playback, decoding, mixing, and optional 3D spatialization from a small C library | Public domain or MIT No Attribution | Direct candidate | Evaluate only after external Piper playback is proven while Oblivion runs. First native experiment must be non-positional playback with a fixed generated WAV and a reversible plugin build. |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Local microphone transcription and voice-activity experiments | MIT; converted model terms and provenance remain separate | External process / Direct candidate | Defer until typed in-game conversation is stable. Benchmark a separately installed process before considering native integration. |
| [SQLite](https://github.com/sqlite/sqlite) | Per-NPC memory, provenance, expiry, retrieval, and transaction safety | Core implementation is public domain | Direct candidate | Adopt only after a memory claim, schema, retention policy, and counterfactual test exist. Do not store unlimited transcripts by default. |
| [xEdit / TES4Edit](https://github.com/TES5Edit/TES5Edit) | Read and inspect Oblivion actor records; support catalogue-generation experiments | MPL-2.0 | Development tool | Use as an external tool. Generated catalogues must separately document source records, exclusions, game-asset rights, transformation, and whether distribution is permitted. |

## Influence without imitation

EchoForge may reuse proven architectural ideas while keeping its own evidence
and safety contract:

```text
xOBSE game primitives
        +
Mantella/CHIM conversation lessons
        +
REI routing, grounding, validation, and receipts
        +
CARDO activity and experimental evidence
        =
EchoForge's independently implemented runtime
```

The projects above are not evidence that their behavior works in original
Oblivion, on this Linux/Proton environment, or inside EchoForge. Each adopted
capability needs its own fixture, acceptance test, measured run, and failure
record.

## Required adoption record

Before adding any external source, library, service, model, dataset, mod, or
tool, record:

1. Canonical project and artifact URL.
2. Pinned version, tag, commit, file hash, and retrieval date.
3. Code license and required notices.
4. Separate model, voice, dataset, game-data, and performer terms.
5. Integration mode: reference, interface, external process, development tool,
   dynamic link, static link, or vendored source.
6. Why the dependency is necessary and the smallest viable alternative.
7. Trust boundary, permissions, network behavior, files touched, and removal path.
8. Acceptance claim, fixture, test, measurement mode, and stop conditions.
9. Distribution decision: local experiment only, source distribution, binary
   distribution, hosted service, or commercial use.
10. A `NOTICE` or attribution update when required.

Missing or ambiguous terms mean `Hold`; popularity, public source, or technical
usefulness does not substitute for permission.

## Current implementation choices

- **Keep:** xOBSE documented interfaces, project-local Ollama, and separately
  installed Piper.
- **Next without a new dependency:** prove xOBSE crosshair selection and text
  input using deterministic dialogue and the existing file bridge.
- **Evaluate after that:** external Piper playback while the game runs, followed
  by a fixed-WAV miniaudio experiment if native playback is still justified.
- **Defer:** microphone input, persistent memory, bounded actions, custom menu
  dependencies, positional audio, and lip synchronization until their preceding
  milestones are measured.

## Prohibited shortcuts

- Do not copy implementation code from a reference-only or unverified project.
- Do not treat a GitHub repository as permission to reuse its contents.
- Do not allow a model to invoke arbitrary xOBSE, console, UI, or file commands.
- Do not ship downloaded voices, models, game records, dialogue, audio, or art
  merely because the surrounding engine is open source.
- Do not describe architectural similarity as code lineage.
- Do not add a dependency before its narrower no-dependency experiment fails or
  proves insufficient.
