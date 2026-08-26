#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  createAcceptedFixture,
  createInteractionId,
  createReviewRecord,
  findPendingInteractions
} from "../src/evidence-review.js";
import { classifyInteraction } from "../src/interaction-evidence.js";
import { appendSessionRecord } from "../src/session.js";

function option(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
    ?? fallback;
}

async function readJsonLines(path, { missingIsEmpty = false } = {}) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (missingIsEmpty && error?.code === "ENOENT") return [];
    throw error;
  }
  return text.split("\n").flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [{ value: JSON.parse(line), lineNumber: index + 1 }];
    } catch {
      throw new Error(`${path}:${index + 1} is not valid JSON`);
    }
  });
}

async function loadInteractions(sessionDirectory) {
  const names = (await readdir(sessionDirectory))
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .reverse();
  const interactions = [];
  for (const name of names) {
    const path = resolve(sessionDirectory, name);
    for (const { value, lineNumber } of await readJsonLines(path)) {
      if (value?.event === "spoken-turn") {
        interactions.push({
          record: value,
          sessionPath: relative(process.cwd(), path),
          lineNumber
        });
      }
    }
  }
  return interactions;
}

function slug(value) {
  return String(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60)
    .replace(/-$/u, "");
}

function suggestedFixtureId(record) {
  const character = record.target?.displayName || record.characterId;
  const question = String(record.question).split(/\s+/u).slice(0, 6).join(" ");
  return slug(`${character}-${question}`) || `interaction-${createInteractionId(record).slice(0, 8)}`;
}

function milliseconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)} ms` : "unknown";
}

function showInteraction(interaction, index, total) {
  const { record } = interaction;
  const evidence = classifyInteraction(record);
  console.log(`\n[${index + 1}/${total}] ${record.target?.displayName || record.characterId}`);
  console.log(`Recorded: ${record.recordedAt ?? "unknown"}`);
  console.log(`Question: ${record.question}`);
  console.log(`Response: ${record.response}`);
  console.log(
    `Support: ${record.augmentation?.answerMode ?? "unknown"}; facts=${record.augmentation?.usedFactKeys?.join(", ") || "none"}`
  );
  console.log(
    `Route: ${record.routeReceipt?.route ?? "unknown"}; provider=${record.dialogueReceipt?.provider ?? "unknown"}; dialogue=${milliseconds(record.routeReceipt?.latencyMs)}`
  );
  console.log(
    `Voice: ${record.voiceReceipt?.model ?? "unknown"}; status=${record.voiceReceipt?.status ?? "unknown"}; latency=${milliseconds(record.voiceReceipt?.latencyMs)}`
  );
  console.log(`Automatic signals: ${evidence.signals.join(", ") || "none"}`);
}

async function writeCandidate(directory, fixture, interactionId) {
  await mkdir(directory, { recursive: true });
  const preferred = resolve(directory, `${fixture.fixtureId}.json`);
  try {
    await writeFile(preferred, `${JSON.stringify(fixture, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx"
    });
    return preferred;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const fallback = resolve(directory, `${fixture.fixtureId}-${interactionId.slice(0, 8)}.json`);
  await writeFile(fallback, `${JSON.stringify(fixture, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  return fallback;
}

const sessionDirectory = resolve(option("sessions", ".local/sessions"));
const reviewsPath = resolve(option("reviews", ".local/evidence/reviews.jsonl"));
const candidateDirectory = resolve(option("fixtures", ".local/replay-candidates"));
const reviewer = option("reviewer", "project-owner").trim();
if (!reviewer) throw new Error("--reviewer must not be empty");

const interactions = await loadInteractions(sessionDirectory);
const reviews = (await readJsonLines(reviewsPath, { missingIsEmpty: true })).map(({ value }) => value);
const pending = findPendingInteractions(interactions, reviews);
if (pending.length === 0) {
  console.log(`No pending spoken turns in ${relative(process.cwd(), sessionDirectory) || "."}.`);
  process.exit(0);
}

const terminal = createInterface({ input: process.stdin, output: process.stdout });
terminal.once("SIGINT", () => terminal.close());
let accepted = 0;
let rejected = 0;
let skipped = 0;
const rejectionKeys = new Map([
  ["l", "wrong-lore"],
  ["v", "wrong-voice"],
  ["t", "too-slow"],
  ["c", "broke-character"],
  ["i", "irrelevant"],
  ["u", "unsafe-action"],
  ["o", "other"]
]);

try {
  for (let index = 0; index < pending.length && !terminal.closed; index += 1) {
    const interaction = pending[index];
    const { record, sessionPath, lineNumber } = interaction;
    showInteraction(interaction, index, pending.length);
    const choice = (await terminal.question(
      "[a]ccept [l]ore [v]oice [t]oo-slow [c]haracter [i]rrelevant [u]nsafe [o]ther [s]kip [q]uit: "
    )).trim().toLocaleLowerCase("en-US");
    if (choice === "q") break;
    if (choice === "s" || (!rejectionKeys.has(choice) && choice !== "a")) {
      skipped += 1;
      continue;
    }

    if (choice === "a") {
      const evidence = classifyInteraction(record);
      if (evidence.signals.length > 0) {
        const confirmation = await terminal.question(
          `Signals are present (${evidence.signals.join(", ")}). Type ACCEPT to continue: `
        );
        if (confirmation.trim() !== "ACCEPT") {
          skipped += 1;
          continue;
        }
      }
      const suggestion = suggestedFixtureId(record);
      const requestedFixtureId = (await terminal.question(`Fixture ID [${suggestion}]: `)).trim();
      const fixtureId = slug(requestedFixtureId) || suggestion;
      const latencyText = (await terminal.question(
        `Maximum dialogue latency ms (observed ${milliseconds(record.routeReceipt?.latencyMs)}; blank = unbounded): `
      )).trim();
      const maxDialogueLatencyMs = latencyText === "" ? null : Number(latencyText);
      if (latencyText !== "" && (!Number.isFinite(maxDialogueLatencyMs) || maxDialogueLatencyMs < 0)) {
        console.log("Invalid latency ceiling; interaction left pending.");
        skipped += 1;
        continue;
      }
      const review = createReviewRecord({
        record,
        source: { sessionPath, lineNumber },
        verdict: "accepted",
        reviewer
      });
      const fixture = createAcceptedFixture({
        record,
        review,
        fixtureId,
        maxDialogueLatencyMs
      });
      const candidatePath = await writeCandidate(candidateDirectory, fixture, review.interactionId);
      await appendSessionRecord(reviewsPath, review);
      accepted += 1;
      console.log(`Accepted candidate: ${relative(process.cwd(), candidatePath)}`);
      continue;
    }

    const review = createReviewRecord({
      record,
      source: { sessionPath, lineNumber },
      verdict: "rejected",
      flags: [rejectionKeys.get(choice)],
      reviewer
    });
    await appendSessionRecord(reviewsPath, review);
    rejected += 1;
    console.log(`Rejected: ${review.flags[0]}`);
  }
} finally {
  terminal.close();
}

console.log(`Review complete: ${accepted} accepted, ${rejected} rejected, ${skipped} skipped.`);
console.log(`Reviews: ${relative(process.cwd(), reviewsPath)}`);
if (accepted > 0) console.log(`Local candidates: ${relative(process.cwd(), candidateDirectory)}`);
