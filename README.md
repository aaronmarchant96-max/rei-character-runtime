# REI Character Runtime

An evidence-driven experiment in giving legacy-game characters contextual
dialogue, bounded memory, and generated speech—without giving a language model
unrestricted control of the game.

The intended player experience is simple:

1. Target a character in a supported game.
2. Press a hotkey and type a question.
3. Receive an in-character subtitle and spoken response.

This first commit is deliberately smaller. It proves the game-independent
conversation boundary: typed input becomes a validated response envelope, an
auditable routing receipt, and a structured request for a future text-to-speech
adapter. It does **not** yet connect to Oblivion, call an AI provider, or generate
audio.

## Run the vertical slice

Node.js 20 or newer is the only requirement.

```bash
npm test
npm run demo -- "Have you seen anything near the ruins?"
```

The demo provider is deterministic and offline. That makes the contract
testable before model, voice, and game integrations introduce nondeterminism.

## Architecture

```text
Game adapter -> character context -> REI route -> dialogue provider
     ^                                      |             |
     |                                      v             v
allow-listed actions <- validated envelope + receipt -> TTS adapter
```

Planned adapters:

- Original Oblivion through xOBSE
- Fallout 3 through FOSE or a separately evaluated Tale of Two Wastelands path
- Local and hosted dialogue models selected by measurable cost/latency needs
- Local speech recognition and consent-safe text-to-speech voices

See [docs/ROADMAP.md](docs/ROADMAP.md) for the falsifiable milestones.

## Boundaries

- No Bethesda assets, dialogue, or voice recordings are included.
- Do not clone or distribute a person's voice without permission.
- Language models may propose actions; only a game adapter may validate and
  execute an allow-listed action.
- Measurements are reported as measurements, not promotional estimates.

## Status

Experimental pre-alpha. The current code is a contract harness, not a game mod.
