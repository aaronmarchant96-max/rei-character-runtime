# Project charter

## Purpose

Build and evaluate a game-independent character runtime that can give characters
contextual dialogue, bounded memory, generated speech, and safely mediated game
actions. Original Oblivion is the first intended game adapter; a second Bethesda
game is the planned portability test.

## Player promise

The target experience is:

> Select a character, type or speak naturally, and receive a contextual spoken
> response without requiring VR.

This is a target, not a claim about the current build.

## Current verified capability

Typed CLI input can reach either a deterministic provider or a local Ollama
dialogue provider, pass through bounded fact and identity grounding, and
produce a subtitle, routing receipt, TTS request, and audible local speech
through Speech Dispatcher or Piper. The local verification suite passed 22
tests on 2026-08-24. A minimal xOBSE adapter displayed deterministic external
text inside original Oblivion, selected one crosshair actor with a single key,
and atomically exported its validated Form ID to the external runtime. In-game
text entry, subtitle presentation, and voice attachment remain unverified.

## Strategic role

REI AI is the primary long-term system. EchoForge is a bounded, independently
useful proving ground for REI routing, local inference, grounding, latency,
voice, evidence receipts, and safe action mediation in an unfamiliar runtime.

The Oblivion adapter is not evidence that CARDO can build any product. It is one
falsifiable transfer experiment. Reusable findings should flow back into REI;
game-specific code should remain behind the adapter boundary.

## Product hypothesis

CARDO REI methods can turn each implementation activity into verified reusable
capability, reducing uncertainty and potentially lowering the marginal effort
of later game adapters. Reduced marginal effort remains unproven until at least
two adapters are measured on a declared basis.

## Primary users

- A player who wants text or microphone conversations with legacy-game NPCs
- A mod author integrating a supported game through a narrow adapter
- A developer evaluating routing, memory, voice, latency, and cost evidence

## Design principles

1. Claim before code; define acceptance evidence before implementation.
2. Keep the character runtime independent from game-specific integration.
3. Models propose actions; trusted adapters validate and execute allow-listed actions.
4. Local-first operation is the baseline for cost, privacy, and offline testing.
5. Report measured, observed, estimated, and hypothesized results separately.
6. Do not include proprietary game assets or non-consensual voice clones.

## Initial non-goals

- Replacing authored quests or canonical game dialogue
- Giving a model arbitrary console or save-file access
- Claiming production stability, actor equivalence, or commercial clearance
- Solving spatial audio, lip synchronization, memory, and actions in one milestone
- Turning EchoForge into a universal creation platform before one game bridge is verified
