# Human–AI augmentation design

EchoForge is designed as an augmentation system, not an autonomous player and
not merely an NPC text generator. The human supplies intent and judgment; the
software extends what the human can inspect, create, test, and experience.

## H-LAM/T mapping

Doug Engelbart described an augmented system as a human using language,
artifacts, and methodology in which the human is trained. EchoForge maps that
framework to a concrete game-development loop:

| Element | EchoForge implementation |
|---|---|
| Human | The player selects the actor, authors each question, judges the result, and decides what happens next. |
| Language | Target envelopes, routes, grounding states, receipts, experiments, and A/B/C activity provide shared precise terms. |
| Artifacts | Oblivion, xOBSE, the Node runtime, Ollama, Piper, tests, the CLI, and evidence records. |
| Methodology | Claim → measurement → test → implementation → live verification → recorded limitation. |
| Training | The builder learns the system by operating, diagnosing, and improving the real workflow. |

Primary references:

- [Augmenting Human Intellect: A Conceptual Framework (1962)](https://dougengelbart.org/pubs/augment-3906-Framework.html)
- [Toward High-Performance Organizations: A Strategic Role for Groupware (1991)](https://dougengelbart.org/pubs/augment-132803-Bootstrapping.html)
- [Engelbart's ABC Model](https://dougengelbart.org/content/view/230/)

## The two-channel response

The player experiences the first channel; the system and developer can inspect
the second:

```text
speech: "I can't say that I've noticed anything certain about that."
augmentation:
  answerMode: unknown
  usedFactKeys: []
  uncertainty: explicit
  humanControl: player-decides
  actionAuthority: none
```

The augmentation channel is part of the actual response envelope. It is not
spoken as NPC dialogue. This preserves immersion while making the model's
epistemic boundary inspectable. A response cannot gain game authority by
claiming that it has it.

EXP-013 exercised the known path with live game-derived facts: the selected
actor name became `identity.name`, the current cell/worldspace name became
`game.locationName`, and the response cited those exact keys. Biography and
canonical dialogue remained explicitly unknown.

## A, B, and C activity

- **A activity — use the capability:** select an NPC, ask a question, receive a
  grounded subtitle/speech response.
- **B activity — improve the capability:** add better context extraction,
  in-game input, NPC-associated audio, memory, and evaluation fixtures.
- **C activity — improve how improvements are made:** standardize response
  evidence, automate the supervised loop, compare experiments, and transfer
  reusable contracts into a second game adapter.

C activity is not a marketing label or a claim that the workflow can build
anything. Its value must be demonstrated through measured reductions in rework,
faster verified experiments, or reuse across adapters. Those values remain
unmeasured until captured prospectively.

## Non-negotiable human-control boundary

- The human selects the target and authors the question.
- The model may produce speech and structured support.
- Unsupported statements are retried or replaced before speech.
- The current supervised session accepts no proposed or executed actions.
- Inventory, quests, combat, spawning, console commands, and saves remain
  outside the model boundary.
