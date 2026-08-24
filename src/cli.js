#!/usr/bin/env node
import { createCharacterRuntime, createDemoProvider } from "./runtime.js";

const playerText = process.argv.slice(2).join(" ").trim();

if (!playerText) {
  console.error('Usage: npm run demo -- "Your question"');
  process.exitCode = 1;
} else {
  const converse = createCharacterRuntime({ dialogueProvider: createDemoProvider() });
  const result = await converse({
    character: {
      id: "original-guide",
      name: "Mara Varen",
      persona: "A cautious, observant traveler created for this demonstration."
    },
    playerText,
    world: { location: "A fictional roadside inn" }
  });

  console.log(JSON.stringify(result, null, 2));
}
