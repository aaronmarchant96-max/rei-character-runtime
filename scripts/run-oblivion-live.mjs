import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { writeBridgeResponse } from "../src/bridge.js";
import { createOllamaDialogueProvider } from "../src/dialogue.js";
import { bindQuestionToTarget } from "../src/live-turn.js";
import { readQuestionEnvelope } from "../src/question.js";
import { appendSessionRecord, createSpokenTurnRecord } from "../src/session.js";
import { readTargetEnvelope } from "../src/target.js";
import { runTargetConversation } from "../src/target-turn.js";
import { speakPiperTtsRequest } from "../src/voice.js";

const POLL_INTERVAL_MS = 250;
const OLLAMA_TAGS_ENDPOINT = "http://127.0.0.1:11434/api/tags";
let stopping = false;

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function ollamaIsReady() {
  try {
    const response = await fetch(OLLAMA_TAGS_ENDPOINT, { signal: AbortSignal.timeout(750) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureLocalOllama() {
  if (await ollamaIsReady()) return null;
  const child = spawn(resolve(".local/ollama/bin/ollama"), ["serve"], {
    env: {
      ...process.env,
      OLLAMA_HOST: "127.0.0.1:11434",
      OLLAMA_NO_CLOUD: "1",
      OLLAMA_MODELS: resolve(".local/ollama-models")
    },
    stdio: "ignore"
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error("project-local Ollama exited during startup");
    if (await ollamaIsReady()) return child;
    await wait(POLL_INTERVAL_MS);
  }
  child.kill("SIGTERM");
  throw new Error("project-local Ollama did not become ready within 20 seconds");
}

function gameBridgeDirectory() {
  return resolve(
    homedir(),
    ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Oblivion",
    "Data/OBSE/Plugins/EchoForge"
  );
}

async function fileIdentity(path) {
  try {
    const metadata = await stat(path);
    return `${metadata.mtimeMs}:${metadata.size}`;
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function main() {
  const bridgeDirectory = gameBridgeDirectory();
  const questionPath = resolve(bridgeDirectory, "question.json");
  const targetPath = resolve(bridgeDirectory, "target.json");
  const responsePath = resolve(bridgeDirectory, "response.txt");
  const sessionPath = resolve(
    ".local/sessions",
    `oblivion-live-${new Date().toISOString().replace(/[:.]/gu, "-")}.jsonl`
  );
  const dialogueProvider = createOllamaDialogueProvider();
  const ownedOllama = await ensureLocalOllama();
  let lastQuestionIdentity = await fileIdentity(questionPath);

  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  await appendSessionRecord(sessionPath, {
    schemaVersion: 1,
    event: "live-session-start",
    recordedAt: new Date().toISOString(),
    questionPath,
    targetPath,
    responsePath
  });
  console.log("EchoForge live Oblivion runtime ready.");
  console.log("Aim at an NPC or creature, press Y, type a question, then press Enter.");
  console.log(`Evidence: ${sessionPath}`);

  try {
    while (!stopping) {
      const identity = await fileIdentity(questionPath);
      if (identity && identity !== lastQuestionIdentity) {
        lastQuestionIdentity = identity;
        try {
          const [{ question, receipt: questionReceipt }, { target, receipt: targetReceipt }] =
            await Promise.all([
              readQuestionEnvelope(questionPath),
              readTargetEnvelope(targetPath)
            ]);
          const bound = bindQuestionToTarget({ question, target });
          console.log(`Question for ${bound.target.displayName || bound.target.referenceFormId}: ${bound.question}`);
          const output = await runTargetConversation({
            target: bound.target,
            playerText: bound.question,
            dialogueProvider,
            speak: speakPiperTtsRequest
          });
          const responseReceipt = await writeBridgeResponse({
            outputPath: responsePath,
            text: output.turn.speech
          });
          await appendSessionRecord(sessionPath, {
            ...createSpokenTurnRecord({
              target: bound.target,
              question: bound.question,
              turn: output.turn
            }),
            recordedAt: new Date().toISOString(),
            humanControl: "in-game-question-authored",
            questionReceipt,
            targetReceipt,
            responseReceipt
          });
          console.log(`Response: ${output.turn.speech}`);
          console.log(`Voice: ${output.turn.voiceReceipt.status}`);
        } catch (error) {
          await appendSessionRecord(sessionPath, {
            schemaVersion: 1,
            event: "live-turn-failed",
            recordedAt: new Date().toISOString(),
            error: error.message
          });
          console.error(`Turn failed safely: ${error.message}`);
        }
      }
      await wait(POLL_INTERVAL_MS);
    }
  } finally {
    await appendSessionRecord(sessionPath, {
      schemaVersion: 1,
      event: "live-session-stop",
      recordedAt: new Date().toISOString()
    });
    if (ownedOllama && ownedOllama.exitCode === null) ownedOllama.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(`EchoForge live runtime failed: ${error.message}`);
  process.exitCode = 1;
});
