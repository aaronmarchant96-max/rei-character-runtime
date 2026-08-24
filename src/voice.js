import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

function requireTtsRequest(request) {
  if (typeof request?.characterId !== "string" || request.characterId.trim() === "") {
    throw new TypeError("ttsRequest.characterId must be a non-empty string");
  }
  if (typeof request?.text !== "string" || request.text.trim() === "") {
    throw new TypeError("ttsRequest.text must be a non-empty string");
  }
  return { characterId: request.characterId.trim(), text: request.text.trim() };
}

function runSpeechDispatcher(text, callback) {
  execFile("spd-say", ["--wait", "--voice-type", "female1", text], callback);
}

export function speakTtsRequest(
  request,
  { runner = runSpeechDispatcher, clock = performance } = {}
) {
  const validated = requireTtsRequest(request);
  const started = clock.now();

  return new Promise((resolve, reject) => {
    runner(validated.text, (error) => {
      if (error) {
        reject(new Error(`local speech playback failed: ${error.message}`, { cause: error }));
        return;
      }

      resolve({
        characterId: validated.characterId,
        backend: "speech-dispatcher",
        status: "played",
        latencyMs: Math.max(0, clock.now() - started),
        measurementMode: "measured"
      });
    });
  });
}

function execute(command, args, runner = execFile) {
  return new Promise((resolvePromise, rejectPromise) => {
    runner(command, args, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}

export async function speakPiperTtsRequest(
  request,
  {
    runner = execFile,
    clock = performance,
    pythonPath = resolve(".venv/bin/python3"),
    modelDirectory = resolve(".local/voices"),
    temporaryRoot = tmpdir()
  } = {}
) {
  const validated = requireTtsRequest(request);
  const workDirectory = await mkdtemp(join(temporaryRoot, "rei-voice-"));
  const outputPath = join(workDirectory, "speech.wav");
  const started = clock.now();

  try {
    await execute(
      pythonPath,
      [
        "-m", "piper",
        "--data-dir", modelDirectory,
        "-m", "en_US-lessac-medium",
        "-f", outputPath,
        "--", validated.text
      ],
      runner
    );
    await execute("paplay", [outputPath], runner);

    return {
      characterId: validated.characterId,
      backend: "piper-local",
      model: "en_US-lessac-medium",
      status: "played",
      latencyMs: Math.max(0, clock.now() - started),
      measurementMode: "measured"
    };
  } catch (error) {
    throw new Error(`Piper speech playback failed: ${error.message}`, { cause: error });
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
