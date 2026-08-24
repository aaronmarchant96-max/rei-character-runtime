#!/usr/bin/env node
import { createCharacterRuntime, createDemoProvider } from "./runtime.js";
import { createOllamaDialogueProvider } from "./dialogue.js";
import { speakPiperTtsRequest, speakTtsRequest } from "./voice.js";

const args = process.argv.slice(2);
const shouldSpeak = args.includes("--speak");
const backendArgument = args.find((argument) => argument.startsWith("--backend="));
const backend = backendArgument?.split("=", 2)[1] ?? "system";
const dialogueArgument = args.find((argument) => argument.startsWith("--dialogue="));
const dialogue = dialogueArgument?.split("=", 2)[1] ?? "demo";
const supportedDialogueModes = new Set(["demo", "ollama"]);
const playerText = args
  .filter((argument) => argument !== "--speak"
    && !argument.startsWith("--backend=")
    && !argument.startsWith("--dialogue="))
  .join(" ")
  .trim();

if (!supportedDialogueModes.has(dialogue)) {
  console.error(`Unsupported dialogue mode: ${dialogue || "(empty)"}. Use demo or ollama.`);
  process.exitCode = 1;
} else if (!playerText) {
  console.error('Usage: npm run demo -- "Your question"');
  process.exitCode = 1;
} else {
  const dialogueProvider = dialogue === "ollama"
    ? createOllamaDialogueProvider()
    : createDemoProvider();
  const converse = createCharacterRuntime({ dialogueProvider });
  const result = await converse({
    character: {
      id: "original-guide",
      name: "Mara Varen",
      persona: "A cautious, observant traveler created for this demonstration."
    },
    playerText,
    world: { location: "A fictional roadside inn" }
  });

  if (shouldSpeak) {
    result.voiceReceipt = backend === "piper"
      ? await speakPiperTtsRequest(result.ttsRequest)
      : await speakTtsRequest(result.ttsRequest);
  }

  console.log(JSON.stringify(result, null, 2));
}
