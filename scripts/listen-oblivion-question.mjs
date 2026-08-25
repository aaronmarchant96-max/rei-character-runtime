import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readQuestionEnvelope } from "../src/question.js";

const inputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--input="));
const inputPath = resolve(inputArgument?.slice("--input=".length) || resolve(
  homedir(),
  ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Oblivion",
  "Data/OBSE/Plugins/EchoForge/question.json"
));
let lastFileIdentity = "";
let reading = false;

console.log(`EchoForge question listener ready: ${inputPath}`);
console.log("In Oblivion, aim at an NPC or creature and tap Y.");

async function poll() {
  if (reading) return;
  reading = true;
  try {
    const metadata = await stat(inputPath);
    const fileIdentity = `${metadata.mtimeMs}:${metadata.size}`;
    if (fileIdentity === lastFileIdentity) return;
    lastFileIdentity = fileIdentity;
    const result = await readQuestionEnvelope(inputPath);
    console.log(JSON.stringify({ event: "question-submitted", ...result }, null, 2));
  } catch (error) {
    if (error?.code !== "ENOENT") console.error(`EchoForge rejected question: ${error.message}`);
  } finally {
    reading = false;
  }
}

await poll();
const interval = setInterval(poll, 250);
function stop() {
  clearInterval(interval);
  process.exitCode = 0;
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
