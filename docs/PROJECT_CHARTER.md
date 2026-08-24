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

At commit `445d38e`, typed CLI input produces a deterministic response envelope,
routing receipt, subtitle, TTS request, and audible local speech through either
Speech Dispatcher or Piper. No game adapter or dialogue model is connected.

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
