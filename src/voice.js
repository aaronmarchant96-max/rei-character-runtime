import { execFile } from "node:child_process";
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
