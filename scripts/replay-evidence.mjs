#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRoutedOllamaDialogueProvider } from "../src/dialogue.js";
import { evaluateReplay } from "../src/interaction-evidence.js";
import { createSpokenTurnRecord } from "../src/session.js";
import { runTargetConversation } from "../src/target-turn.js";

async function fixturePaths(arguments_) {
  if (arguments_.length > 0) return arguments_.map((path) => resolve(path));
  const directory = resolve("fixtures/replay");
  return (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => resolve(directory, name));
}

function replayVoice(ttsRequest) {
  return {
    characterId: ttsRequest.characterId,
    backend: "replay-no-audio",
    model: ttsRequest.voiceId ?? null,
    status: "played",
    latencyMs: 0,
    measurementMode: "replayed"
  };
}

const paths = await fixturePaths(process.argv.slice(2));
if (paths.length === 0) throw new Error("no replay fixtures found");
const dialogueProvider = createRoutedOllamaDialogueProvider();
let failures = 0;

for (const path of paths) {
  const fixture = JSON.parse(await readFile(path, "utf8"));
  const output = await runTargetConversation({
    target: fixture.input.target,
    playerText: fixture.input.question,
    dialogueProvider,
    speak: async (request) => replayVoice(request)
  });
  const record = createSpokenTurnRecord({
    target: output.target,
    question: fixture.input.question,
    turn: output.turn
  });
  const result = evaluateReplay(fixture, record);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${fixture.fixtureId}`);
  if (!result.passed) {
    failures += 1;
    for (const failure of result.failures) console.log(`  - ${failure}`);
  }
}

if (failures > 0) process.exitCode = 1;
