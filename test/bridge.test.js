import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDeterministicBridgeText,
  normalizeBridgeText,
  writeBridgeResponse
} from "../src/bridge.js";

test("bridge text is deterministic and single-line", () => {
  assert.equal(
    createDeterministicBridgeText("  Have you seen\nanything near the ruins?  "),
    "EchoForge bridge: Have you seen anything near the ruins?"
  );
});

test("bridge text rejects empty and oversized UTF-8 payloads", () => {
  assert.throws(() => normalizeBridgeText(" \n\t "), /non-empty/u);
  assert.throws(() => normalizeBridgeText("é".repeat(121)), /240 UTF-8 bytes/u);
});

test("bridge response is published atomically with a measured receipt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "echoforge-bridge-test-"));
  const outputPath = join(directory, "response.txt");
  try {
    const receipt = await writeBridgeResponse({
      outputPath,
      text: "EchoForge bridge online."
    });

    assert.equal(await readFile(outputPath, "utf8"), "EchoForge bridge online.");
    assert.deepEqual(receipt, {
      outputPath,
      bytes: 24,
      sha256: "05491f407ab1ce207edee0e330072b1c2c5d3eccb931073f60dd833b59bcee15",
      measurementMode: "measured"
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Oblivion bridge uses xOBSE-native text input instead of an OS window", async () => {
  const source = await readFile("native/xobse/echoforge_bridge.cpp", "utf8");

  assert.equal(source.includes('OpenTextInput \\"EchoForge question:'), true);
  assert.match(source, /RunScriptLine2\("UpdateTextInput"/u);
  assert.match(source, /CaptureQuestionKeystrokes\(\)/u);
  assert.match(source, /TranslateQuestionKey/u);
  assert.match(source, /g_questionKeyWasPressed/u);
  assert.doesNotMatch(source, /GetInputText|EchoForgeCaptureQuestion/u);
  assert.doesNotMatch(source, /PrintToFile/u);
  assert.match(source, /RunScriptLine2\("CloseTextInput"/u);
  assert.match(source, /PollResponseFile\(\)/u);
  assert.match(source, /response-live-messagebox-ran/u);
  assert.match(source, /response-stale-replay-suppressed/u);
  assert.doesNotMatch(source, /DisplayResponseWhenReady|response-display-scheduled/u);
  assert.match(source, /question-target-publish-failed/u);
  assert.doesNotMatch(source, /CreateWindowExA|QuestionWindowProcedure/u);
});

test("Oblivion pickup dispatch stages a native reach animation before transfer", async () => {
  const source = await readFile("native/xobse/echoforge_bridge.cpp", "utf8");

  assert.match(source, /kIScanCode/u);
  assert.match(source, /g_linkedActorFormId/u);
  assert.match(source, /kIngredientFormType/u);
  assert.match(source, /kFormQuestItemFlag/u);
  assert.match(source, /ItemIsOffLimits/u);
  assert.match(source, /kMaximumPickupDistanceUnits/u);
  assert.match(source, /kPickupGroundIdleFormId = 0x0003ECAA/u);
  assert.match(source, /"PlayIdle %08X 1"/u);
  assert.match(source, /BeginAnimatedPickup/u);
  assert.match(source, /PollPendingPickup/u);
  assert.match(source, /pickup-ground-animation-dispatched/u);
  assert.match(source, /pickup-completed-after-animation/u);
  assert.match(source, /DispatchPickup/u);
  assert.match(source, /"Activate %08X 1"/u);
  assert.match(source, /RunScriptLine2\(script, itemReference, true\)/u);
  assert.match(source, /action-receipt\.json/u);
  assert.doesNotMatch(source, /kActivateActionVirtualIndex/u);
  assert.doesNotMatch(source, /AddItem|RemoveItem|SetStage|ForceActorValue/u);
});
