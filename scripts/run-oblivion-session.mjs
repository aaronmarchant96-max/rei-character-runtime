import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createRoutedOllamaDialogueProvider } from "../src/dialogue.js";
import { createFileCharacterMemoryStore } from "../src/memory.js";
import { appendSessionRecord, createSpokenTurnRecord, describeTargetKnowledge } from "../src/session.js";
import { readTargetEnvelope } from "../src/target.js";
import { runTargetConversation } from "../src/target-turn.js";
import { speakPiperTtsRequest } from "../src/voice.js";

const OLLAMA_TAGS_ENDPOINT = "http://127.0.0.1:11434/api/tags";
const POLL_INTERVAL_MS = 250;
const OLLAMA_START_ATTEMPTS = 80;

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function ollamaIsReady() {
  try {
    const response = await fetch(OLLAMA_TAGS_ENDPOINT, {
      signal: AbortSignal.timeout(750)
    });
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
  for (let attempt = 0; attempt < OLLAMA_START_ATTEMPTS; attempt += 1) {
    if (child.exitCode !== null) throw new Error("project-local Ollama exited during startup");
    if (await ollamaIsReady()) return child;
    await wait(POLL_INTERVAL_MS);
  }
  child.kill("SIGTERM");
  throw new Error("project-local Ollama did not become ready within 20 seconds");
}

function defaultTargetPath() {
  return resolve(
    homedir(),
    ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Oblivion",
    "Data/OBSE/Plugins/EchoForge/target.json"
  );
}

async function readTargetSnapshot(inputPath) {
  const metadata = await stat(inputPath);
  const result = await readTargetEnvelope(inputPath);
  return { ...result, fileIdentity: `${metadata.mtimeMs}:${metadata.size}` };
}

async function waitForTarget(inputPath, previousFileIdentity = "") {
  for (;;) {
    try {
      const snapshot = await readTargetSnapshot(inputPath);
      if (snapshot.fileIdentity !== previousFileIdentity) return snapshot;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await wait(POLL_INTERVAL_MS);
  }
}

function showTarget(target) {
  const knowledge = describeTargetKnowledge(target);
  console.log(`\nSelected ${target.actorKind}: ${target.referenceFormId}`);
  console.log(`Known: ${JSON.stringify(knowledge.knownFacts)}`);
  console.log(`Unknown: ${knowledge.unknownFacts.join(", ")}`);
}

async function main() {
  const inputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--input="));
  const inputPath = resolve(
    inputArgument?.slice("--input=".length)
      || process.env.ECHOFORGE_TARGET_PATH
      || defaultTargetPath()
  );
  const sessionPath = resolve(
    ".local/sessions",
    `oblivion-${new Date().toISOString().replace(/[:.]/gu, "-")}.jsonl`
  );
  const dialogueProvider = createRoutedOllamaDialogueProvider();
  const memoryStore = createFileCharacterMemoryStore();
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let ownedOllama = null;

  terminal.once("SIGINT", () => terminal.close());
  await appendSessionRecord(sessionPath, {
    schemaVersion: 1,
    event: "session-start",
    recordedAt: new Date().toISOString(),
    targetPath: inputPath,
    dialogueProvider: "ollama-local",
    voiceBackend: "piper-local"
  });

  try {
    console.log("EchoForge supervised Oblivion session");
    console.log(`Local evidence: ${sessionPath}`);
    console.log("Starting or reusing the local model...");
    ownedOllama = await ensureLocalOllama();
    console.log("Ready. In Oblivion, aim at an NPC or creature and tap U.");

    let snapshot = await waitForTarget(inputPath);
    while (!terminal.closed) {
      showTarget(snapshot.target);
      const question = (await terminal.question(
        "Question (/retarget, /facts, or /quit): "
      )).trim();
      if (question === "/quit") break;
      if (question === "/facts") continue;
      if (question === "/retarget") {
        console.log("Waiting for a new U-key target...");
        snapshot = await waitForTarget(inputPath, snapshot.fileIdentity);
        continue;
      }
      if (!question) continue;

      console.log("Generating and validating a target-bound response...");
      try {
        const output = await runTargetConversation({
          target: snapshot.target,
          playerText: question,
          dialogueProvider,
          speak: speakPiperTtsRequest,
          memoryStore
        });
        const record = createSpokenTurnRecord({
          target: snapshot.target,
          question,
          turn: output.turn
        });
        await appendSessionRecord(sessionPath, {
          ...record,
          recordedAt: new Date().toISOString(),
          humanControl: "question-authored"
        });
        console.log(`Response: ${output.turn.speech}`);
        const support = output.turn.augmentation;
        console.log(
          `Support: ${support.answerMode}; facts=${support.usedFactKeys.join(",") || "none"}; control=${support.humanControl}`
        );
        console.log(`Voice: ${output.turn.voiceReceipt.status}`);
      } catch (error) {
        await appendSessionRecord(sessionPath, {
          schemaVersion: 1,
          event: "turn-failed",
          recordedAt: new Date().toISOString(),
          target: snapshot.target,
          question,
          error: error.message
        });
        console.error(`Turn failed safely: ${error.message}`);
      }

      try {
        const latest = await readTargetSnapshot(inputPath);
        if (latest.fileIdentity !== snapshot.fileIdentity) snapshot = latest;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    if (!terminal.closed) throw error;
  } finally {
    await appendSessionRecord(sessionPath, {
      schemaVersion: 1,
      event: "session-stop",
      recordedAt: new Date().toISOString()
    });
    terminal.close();
    if (ownedOllama && ownedOllama.exitCode === null) ownedOllama.kill("SIGTERM");
    console.log(`Session stopped. Evidence retained at ${sessionPath}`);
  }
}

main().catch((error) => {
  console.error(`EchoForge session failed: ${error.message}`);
  process.exitCode = 1;
});
