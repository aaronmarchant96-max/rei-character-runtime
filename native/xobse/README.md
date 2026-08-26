# EchoForge xOBSE bridge

This directory contains source for a minimal 32-bit xOBSE plugin. It defines
only the stable ABI fields needed for plugin query/load and lifecycle messaging;
no xOBSE source or Bethesda asset is copied into this repository.

The first bridge reads at most 240 bytes from:

```text
Data/OBSE/Plugins/EchoForge/response.txt
```

After Oblivion reports a successful save load, the plugin waits 120 game frames,
sanitizes the text and script-significant characters, then uses xOBSE's console
interface to execute a fixed `MessageBoxEX` statement. Direct HUD queue calls
returned success but did not render under the measured Steam Proton setup, so
the modal message box is the first proof UI rather than the final subtitle UX.
The dialogue path registers no script command and performs no network request.
An experimental pickup path is isolated behind explicit `U` then `I` targeting
and fixed native checks; it may mutate the selected NPC's inventory and
therefore requires a disposable-save acceptance test.

Build with:

```bash
npm run bridge:build
```

The ignored output is `.local/xobse/EchoForgeBridge.dll`. Runtime installation
is a separate measured operation.

## Experimental pickup control

1. Aim at an NPC and tap `U` to link that exact reference.
2. Aim at an apple or another ordinary ingredient near the linked NPC.
3. Tap `I` once.

The plugin resolves the linked NPC again by Form ID and requires an NPC and
ingredient in the same cell. It rejects disabled/taken, quest/protected,
owned/off-limits, or distant ingredients and every non-ingredient target. An
accepted attempt asks the linked NPC to play Oblivion's native ground-pickup
idle, waits briefly, revalidates the same actor and item, and only then uses the
ingredient's normal activation behavior with that NPC as the activator. The
engine remains responsible for whether it can play the animation and complete
the activation. It atomically writes the exact IDs and action state to:

```text
Data/OBSE/Plugins/EchoForge/action-receipt.json
```

This version-pinned animated-pickup candidate has compiled but is not yet
live-verified. It does not make the NPC walk to a distant item; pathfinding is a
separate AI-package experiment. The model cannot supply script text or bypass
the fixed checks.
Existing `response.txt` content is treated as stale when a save loads and is
not replayed; only a later file change can display a dialogue response.
