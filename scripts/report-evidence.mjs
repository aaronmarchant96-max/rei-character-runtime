#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { buildEvidenceReport, renderEvidenceReportMarkdown } from "../src/evidence-report.js";

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
      return [JSON.parse(line)];
    } catch {
      throw new Error(`${path}:${index + 1} is not valid JSON`);
    }
  });
}

async function loadInteractions(sessionDirectory) {
  const names = (await readdir(sessionDirectory)).filter((name) => name.endsWith(".jsonl")).sort();
  const interactions = [];
  for (const name of names) {
    const path = resolve(sessionDirectory, name);
    for (const record of await readJsonLines(path)) {
      if (record?.event === "spoken-turn") interactions.push(record);
    }
  }
  return interactions;
}

const sessionDirectory = resolve(option("sessions", ".local/sessions"));
const reviewsPath = resolve(option("reviews", ".local/evidence/reviews.jsonl"));
const outputBase = resolve(option("output", ".local/evidence/report"));
const interactions = await loadInteractions(sessionDirectory);
const reviews = await readJsonLines(reviewsPath, { missingIsEmpty: true });
const report = buildEvidenceReport({ interactions, reviews });
const jsonPath = `${outputBase}.json`;
const markdownPath = `${outputBase}.md`;

await mkdir(dirname(outputBase), { recursive: true });
await Promise.all([
  writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  }),
  writeFile(markdownPath, renderEvidenceReportMarkdown(report), {
    encoding: "utf8",
    mode: 0o600
  })
]);

console.log("EchoForge C-Activity evidence report");
console.log(
  `Coverage: ${report.coverage.reviewedInteractions}/${report.coverage.totalInteractions} reviewed; ${report.coverage.pendingInteractions} pending`
);
console.log(
  `Human flags: ${JSON.stringify(report.humanReviewFlags)}; automatic signals: ${JSON.stringify(report.automaticSignals)}`
);
console.log(
  `Measured samples: dialogue=${report.latency.dialogueMs.count}; voice=${report.latency.voiceMs.count}`
);
console.log(`JSON: ${relative(process.cwd(), jsonPath)}`);
console.log(`Markdown: ${relative(process.cwd(), markdownPath)}`);
console.log("Policy authority: none");
