# REI Character Runtime

An evidence-driven experiment in giving legacy-game characters contextual
dialogue, bounded memory, and generated speech—without giving a language model
unrestricted control of the game.

The intended player experience is simple:

1. Target a character in a supported game.
2. Press a hotkey and type a question.
3. Receive an in-character subtitle and spoken response.

The current prototype proves the game-independent conversation and voice
boundary: typed input becomes a validated response envelope, an auditable
routing receipt, and local audible speech. It does **not** yet connect to
Oblivion. The default demo remains deterministic and offline; the optional
`--dialogue=ollama` workflow calls a local dialogue-model provider.

## Run the vertical slice

Node.js 20 or newer is the only requirement.

```bash
npm test
npm run demo -- "Have you seen anything near the ruins?"
npm run voice -- "Have you seen anything near the ruins?"
```

The `voice` command uses the machine's installed Speech Dispatcher backend and
waits for playback to complete. It is a local plumbing test, not character voice
cloning; voice quality and alternative backends will be evaluated separately.

### Optional local neural voice

Piper runs locally but is installed separately under its GPL-3.0 license:

```bash
python3 -m venv .venv
.venv/bin/pip install piper-tts
mkdir -p .local/voices
.venv/bin/python3 -m piper.download_voices \
  --data-dir .local/voices en_US-lessac-medium
npm run voice:neural -- "Have you seen anything near the ruins?"
```

The selected model and its metadata remain local and are excluded from Git.
Its model card identifies the source dataset and training provenance. Treat
commercial voice rights as a separate clearance question; this prototype does
not clone a Bethesda performer.

### Optional local dynamic dialogue

Install Ollama and its 1.4 GB `qwen3:1.7b` model locally. The measured 0.32.15
CPU archive expands to approximately 2.1 GB:

```bash
curl -fL https://ollama.com/download/ollama-linux-amd64.tar.zst \
  -o /tmp/rei-ollama-linux-amd64.tar.zst
mkdir -p .local/ollama
tar --zstd -xf /tmp/rei-ollama-linux-amd64.tar.zst -C .local/ollama
```

Start the temporary server, pull the model once, and then combine dynamic
dialogue with the neural voice:

```bash
# Terminal 1
npm run ollama:serve

# Terminal 2
.local/ollama/bin/ollama pull qwen3:1.7b
npm run npc:local -- "Have you seen anything near the ruins?"
```

The dialogue adapter binds to Ollama's localhost API, disables model thinking,
requires structured output, limits supplied context, and preserves literal token
and duration metrics. A grounding gate requires relevant fact citations, retries
one invalid answer, and uses a safe uncertainty fallback if correction fails.
The current Mara profile and location are fictional test fixtures, not Oblivion
assets.

Keep the Ollama server in the foreground only for active tests and stop it with
`Ctrl+C` afterward. It is bound to localhost with cloud features disabled, but
Ollama 0.32.15 still advertises a broad built-in browser-origin allowlist. Do not
expose port `11434` or configure this prototype as a persistent service.

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

## Project records

- [Project charter](docs/PROJECT_CHARTER.md) — purpose, users, claims, and scope
- [Architecture](docs/ARCHITECTURE.md) — trust boundaries and component map
- [Roadmap](docs/ROADMAP.md) — falsifiable milestones
- [Experiment log](docs/EXPERIMENT_LOG.md) — measured facts and observations
- [Activity ledger](docs/ACTIVITY_LEDGER.md) — effort converted into capability
- [Voice and rights](docs/VOICE_AND_RIGHTS.md) — licensing and consent boundaries

## Boundaries

- No Bethesda assets, dialogue, or voice recordings are included.
- Do not clone or distribute a person's voice without permission.
- Language models may propose actions; only a game adapter may validate and
  execute an allow-listed action.
- Measurements are reported as measurements, not promotional estimates.

## Status

Experimental pre-alpha. The current code is a contract harness, not a game mod.
