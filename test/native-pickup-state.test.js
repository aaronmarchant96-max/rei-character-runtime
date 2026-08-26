import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("native pickup lifecycle passes one oracle that rejects unsafe mutations", () => {
  assert.doesNotThrow(() => {
    execFileSync("bash", ["scripts/test-native-pickup-state.sh"], {
      cwd: process.cwd(),
      stdio: "pipe"
    });
  });
});
