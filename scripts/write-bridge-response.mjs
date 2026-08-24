import {
  createDeterministicBridgeText,
  writeBridgeResponse
} from "../src/bridge.js";

const args = process.argv.slice(2);
const outputArgument = args.find((argument) => argument.startsWith("--output="));
const outputPath = outputArgument?.slice("--output=".length);
const playerText = args.filter((argument) => argument !== outputArgument).join(" ").trim();

if (!outputPath || !playerText) {
  console.error('Usage: npm run bridge:fixture -- --output=/absolute/path/response.txt "Player text"');
  process.exitCode = 1;
} else {
  const text = createDeterministicBridgeText(playerText);
  const receipt = await writeBridgeResponse({ outputPath, text });
  console.log(JSON.stringify({ text, receipt }, null, 2));
}
