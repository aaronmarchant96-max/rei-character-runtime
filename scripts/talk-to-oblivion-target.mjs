import { homedir } from "node:os";
import { resolve } from "node:path";
import { createOllamaDialogueProvider } from "../src/dialogue.js";
import { readTargetEnvelope } from "../src/target.js";
import { runTargetConversation } from "../src/target-turn.js";
import { speakPiperTtsRequest } from "../src/voice.js";

const args = process.argv.slice(2);
const inputArgument = args.find((argument) => argument.startsWith("--input="));
const inputPath = resolve(
  inputArgument?.slice("--input=".length)
    || process.env.ECHOFORGE_TARGET_PATH
    || resolve(
      homedir(),
      ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Oblivion",
      "Data/OBSE/Plugins/EchoForge/target.json"
    )
);
const playerText = args
  .filter((argument) => argument !== inputArgument)
  .join(" ")
  .trim();

if (!playerText) {
  console.error('Usage: npm run npc:target -- "Your question"');
  process.exitCode = 1;
} else {
  const { target, receipt: targetReceipt } = await readTargetEnvelope(inputPath);
  const output = await runTargetConversation({
    target,
    playerText,
    dialogueProvider: createOllamaDialogueProvider(),
    speak: speakPiperTtsRequest
  });
  console.log(JSON.stringify({ targetReceipt, ...output }, null, 2));
}
