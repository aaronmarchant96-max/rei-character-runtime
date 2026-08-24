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
The plugin registers no script command, performs no network request, executes
no game action, and does not read or write save files.

Build with:

```bash
npm run bridge:build
```

The ignored output is `.local/xobse/EchoForgeBridge.dll`. Runtime installation
is a separate measured operation.
