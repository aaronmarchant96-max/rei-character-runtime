import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readTargetEnvelope } from "../src/target.js";

const inputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--input="));
const configuredPath = inputArgument?.slice("--input=".length)
  || process.env.ECHOFORGE_TARGET_PATH
  || resolve(
    homedir(),
    ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Oblivion",
    "Data/OBSE/Plugins/EchoForge/target.json"
  );
const inputPath = resolve(configuredPath);
let lastFileIdentity = "";
let reading = false;

console.log(`EchoForge target listener ready: ${inputPath}`);
console.log("In Oblivion, aim at an NPC or creature and tap U.");

async function poll() {
  if (reading) return;
  reading = true;
  try {
    const metadata = await stat(inputPath);
    const fileIdentity = `${metadata.mtimeMs}:${metadata.size}`;
    if (fileIdentity === lastFileIdentity) return;
    lastFileIdentity = fileIdentity;
    const result = await readTargetEnvelope(inputPath);
    console.log(JSON.stringify({ event: "target-selected", ...result }, null, 2));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`EchoForge rejected target envelope: ${error.message}`);
    }
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
