#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <cstring>

namespace {

using UInt32 = std::uint32_t;
using PluginHandle = UInt32;

constexpr UInt32 kPluginInfoVersion = 3;
constexpr UInt32 kMinimumObseVersion = 22;
constexpr UInt32 kSupportedOblivionVersion = 0x010201A0;
constexpr UInt32 kConsoleInterface = 0;
constexpr UInt32 kMessagingInterface = 4;
constexpr UInt32 kInputInterface = 9;
constexpr UInt32 kTasks2Interface = 11;
constexpr UInt32 kMessagePostLoadGame = 8;
constexpr UInt32 kMessageGameInitialized = 11;
constexpr std::size_t kMaxResponseBytes = 240;
constexpr UInt32 kDisplayDelayFrames = 120;
constexpr std::uint16_t kF10ScanCode = 0x44;
constexpr std::uint16_t kUScanCode = 0x16;
constexpr std::uintptr_t kHudInfoMenuPointerAddress = 0x00B3B33C;
constexpr std::size_t kHudCrosshairReferenceOffset = 0x54;
constexpr std::size_t kFormTypeOffset = 0x04;
constexpr std::size_t kFormIdOffset = 0x0C;
constexpr std::size_t kReferenceBaseFormOffset = 0x1C;
constexpr std::uint8_t kNpcFormType = 0x23;
constexpr std::uint8_t kCreatureFormType = 0x24;

struct PluginInfo {
  UInt32 infoVersion;
  const char* name;
  UInt32 version;
};

struct ConsoleInterface {
  UInt32 version;
  bool (*RunScriptLine)(const char* script);
  bool (*RunScriptLine2)(const char* script, void* callingReference, bool suppressConsoleOutput);
};

struct ObseInterface {
  UInt32 obseVersion;
  UInt32 oblivionVersion;
  UInt32 editorVersion;
  UInt32 isEditor;
  bool (*RegisterCommand)(void* info);
  void (*SetOpcodeBase)(UInt32 opcode);
  void* (*QueryInterface)(UInt32 id);
  PluginHandle (*GetPluginHandle)();
  bool (*RegisterTypedCommand)(void* info, UInt32 returnType);
  const char* (*GetOblivionDirectory)();
  bool (*GetPluginLoaded)(const char* pluginName);
  UInt32 (*GetPluginVersion)(const char* pluginName);
};

struct MessagingInterface {
  struct Message {
    const char* sender;
    UInt32 type;
    UInt32 dataLen;
    void* data;
  };
  using EventCallback = void (*)(Message* message);

  UInt32 version;
  bool (*RegisterListener)(PluginHandle listener, const char* sender, EventCallback handler);
  bool (*Dispatch)(PluginHandle sender, UInt32 messageType, void* data, UInt32 dataLen, const char* receiver);
};

struct Tasks2Interface {
  UInt32 version;
  void* (*EnqueueTask)(void (*task)());
  void (*RemoveTask)(void* task);
  bool (*IsTaskPresent)(void* task);
  void (*ReEnqueueTask)(void* task);
  void* (*EnqueueTaskRemovable)(bool (*task)());
  void (*RemoveTaskRemovable)(void* task);
  bool (*IsTaskPresentRemovable)(void* task);
  void (*ReEnqueueTaskRemovable)(void* task);
  bool (*HasTasks)();
};

struct InputInterface {
  void (*DisableInputKey)(std::uint16_t keyCode);
  void (*EnableInputKey)(std::uint16_t keyCode);
  void (*DisableInputControl)(std::uint16_t controlCode);
  void (*EnableInputControl)(std::uint16_t controlCode);
  bool (*IsKeyPressedReal)(std::uint16_t keyCode);
  bool (*IsKeyPressedSimulated)(std::uint16_t keyCode);
  bool (*IsControlPressedReal)(std::uint16_t controlCode);
  bool (*IsControlPressedSimulated)(std::uint16_t controlCode);
};

PluginHandle g_pluginHandle = 0xFFFFFFFF;
MessagingInterface* g_messaging = nullptr;
Tasks2Interface* g_tasks = nullptr;
InputInterface* g_input = nullptr;
ConsoleInterface* g_console = nullptr;
void* g_displayTask = nullptr;
void* g_targetHotkeyTask = nullptr;
UInt32 g_displayDelayFrames = 0;
bool g_activationWasPressed = false;
bool g_inputPollingLogged = false;
char g_oblivionRoot[MAX_PATH] = {};

bool BuildPath(char* destination, std::size_t capacity, const char* relativePath) {
  const int written = std::snprintf(destination, capacity, "%s%s", g_oblivionRoot, relativePath);
  return written > 0 && static_cast<std::size_t>(written) < capacity;
}

void AppendLog(const char* message) {
  char path[MAX_PATH] = {};
  if (!BuildPath(path, sizeof(path), "Data\\OBSE\\Plugins\\EchoForge\\bridge.log")) return;
  if (FILE* file = std::fopen(path, "ab")) {
    std::fprintf(file, "%s\r\n", message);
    std::fclose(file);
  }
}

bool ReadResponse(char* output, std::size_t capacity) {
  char path[MAX_PATH] = {};
  if (!BuildPath(path, sizeof(path), "Data\\OBSE\\Plugins\\EchoForge\\response.txt")) {
    AppendLog("response-path-too-long");
    return false;
  }
  FILE* file = std::fopen(path, "rb");
  if (!file) {
    AppendLog("response-not-found");
    return false;
  }

  const std::size_t length = std::fread(output, 1, kMaxResponseBytes, file);
  const bool oversized = std::fgetc(file) != EOF;
  std::fclose(file);
  if (oversized || length == 0 || length >= capacity) {
    AppendLog(oversized ? "response-too-large" : "response-empty");
    return false;
  }

  output[length] = '\0';
  std::size_t writeIndex = 0;
  bool previousWasSpace = false;
  for (std::size_t readIndex = 0; readIndex < length; ++readIndex) {
    unsigned char character = static_cast<unsigned char>(output[readIndex]);
    const bool isSpace = character == ' ' || character == '\r' || character == '\n' || character == '\t';
    if (character < 0x20 || character == 0x7F) {
      if (!isSpace) continue;
      character = ' ';
    }
    if (character == ' ') {
      if (previousWasSpace || writeIndex == 0) continue;
      previousWasSpace = true;
    } else {
      previousWasSpace = false;
    }
    output[writeIndex++] = static_cast<char>(character);
  }
  while (writeIndex > 0 && output[writeIndex - 1] == ' ') --writeIndex;
  output[writeIndex] = '\0';
  if (writeIndex == 0) {
    AppendLog("response-empty-after-sanitization");
    return false;
  }
  return true;
}

bool BuildMessageBoxScript(const char* response, char* output, std::size_t capacity) {
  constexpr char kPrefix[] = "MessageBoxEX \"";
  constexpr char kSuffix[] = "\"";
  std::size_t writeIndex = 0;
  for (char character : kPrefix) {
    if (character == '\0') break;
    if (writeIndex + 1 >= capacity) return false;
    output[writeIndex++] = character;
  }
  for (std::size_t readIndex = 0; response[readIndex] != '\0'; ++readIndex) {
    char character = response[readIndex];
    if (character == '"') character = '\'';
    if (character == '|' || character == '@') character = ' ';
    if (character == '%') {
      if (writeIndex + 2 >= capacity) return false;
      output[writeIndex++] = '%';
    } else if (writeIndex + 1 >= capacity) {
      return false;
    }
    output[writeIndex++] = character;
  }
  for (char character : kSuffix) {
    if (character == '\0') break;
    if (writeIndex + 1 >= capacity) return false;
    output[writeIndex++] = character;
  }
  output[writeIndex] = '\0';
  return true;
}

bool DisplayResponseWhenReady() {
  if (g_displayDelayFrames > 0) {
    --g_displayDelayFrames;
    return false;
  }

  char response[kMaxResponseBytes + 1] = {};
  if (ReadResponse(response, sizeof(response))) {
    char script[(kMaxResponseBytes * 2) + 32] = {};
    if (!BuildMessageBoxScript(response, script, sizeof(script))) {
      AppendLog("response-script-too-large");
    } else {
      const bool ran = g_console->RunScriptLine2(script, nullptr, true);
      AppendLog(ran ? "response-messagebox-script-ran" : "response-messagebox-script-failed");
    }
  }
  g_displayTask = nullptr;
  return true;
}

bool PublishTarget(UInt32 formId, const char* actorKind) {
  char targetPath[MAX_PATH] = {};
  char temporaryPath[MAX_PATH] = {};
  if (!BuildPath(targetPath, sizeof(targetPath), "Data\\OBSE\\Plugins\\EchoForge\\target.json")
      || !BuildPath(
        temporaryPath,
        sizeof(temporaryPath),
        "Data\\OBSE\\Plugins\\EchoForge\\target.json.tmp"
      )) {
    AppendLog("target-path-too-long");
    return false;
  }

  char envelope[192] = {};
  const int written = std::snprintf(
    envelope,
    sizeof(envelope),
    "{\"schemaVersion\":1,\"game\":\"oblivion-2009\","
    "\"referenceFormId\":\"%08X\",\"actorKind\":\"%s\"}",
    formId,
    actorKind
  );
  if (written <= 0 || static_cast<std::size_t>(written) >= sizeof(envelope)) {
    AppendLog("target-envelope-too-large");
    return false;
  }

  FILE* file = std::fopen(temporaryPath, "wb");
  if (!file) {
    AppendLog("target-temporary-open-failed");
    return false;
  }
  const std::size_t length = static_cast<std::size_t>(written);
  const bool wrote = std::fwrite(envelope, 1, length, file) == length
    && std::fflush(file) == 0;
  const bool closed = std::fclose(file) == 0;
  if (!wrote || !closed) {
    DeleteFileA(temporaryPath);
    AppendLog("target-temporary-write-failed");
    return false;
  }
  if (!MoveFileExA(
        temporaryPath,
        targetPath,
        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
      )) {
    DeleteFileA(temporaryPath);
    AppendLog("target-atomic-replace-failed");
    return false;
  }
  AppendLog(actorKind[0] == 'n' ? "target-published-npc" : "target-published-creature");
  return true;
}

void* ReadPointerAt(void* base, std::size_t offset) {
  if (!base) return nullptr;
  return *reinterpret_cast<void**>(static_cast<std::uint8_t*>(base) + offset);
}

void DisplayTargetReceipt() {
  void* hudInfoMenu = *reinterpret_cast<void**>(kHudInfoMenuPointerAddress);
  void* crosshairReference = ReadPointerAt(hudInfoMenu, kHudCrosshairReferenceOffset);
  if (!crosshairReference) {
    const bool ran = g_console->RunScriptLine2(
      "MessageBoxEX \"EchoForge: Aim at an NPC or creature, then tap U.\"",
      nullptr,
      true
    );
    AppendLog(ran ? "target-hotkey-no-crosshair-target" : "target-hotkey-script-failed");
    return;
  }

  void* baseForm = ReadPointerAt(crosshairReference, kReferenceBaseFormOffset);
  const std::uint8_t formType = baseForm
    ? *(static_cast<std::uint8_t*>(baseForm) + kFormTypeOffset)
    : 0;
  if (formType != kNpcFormType && formType != kCreatureFormType) {
    const bool ran = g_console->RunScriptLine2(
      "MessageBoxEX \"EchoForge: That target is not an NPC or creature.\"",
      nullptr,
      true
    );
    AppendLog(ran ? "target-hotkey-rejected-non-actor" : "target-hotkey-script-failed");
    return;
  }

  const UInt32 formId = *reinterpret_cast<UInt32*>(
    static_cast<std::uint8_t*>(crosshairReference) + kFormIdOffset
  );
  const char* actorKind = formType == kNpcFormType ? "npc" : "creature";
  if (!PublishTarget(formId, actorKind)) {
    const bool ran = g_console->RunScriptLine2(
      "MessageBoxEX \"EchoForge: Target export failed. Check bridge.log.\"",
      nullptr,
      true
    );
    AppendLog(ran ? "target-hotkey-export-failure-shown" : "target-hotkey-script-failed");
    return;
  }
  char script[160] = {};
  const int written = std::snprintf(
    script,
    sizeof(script),
    "MessageBoxEX \"EchoForge target linked.%%rNPC/creature Form ID: %%x8\" %u",
    formId
  );
  if (written <= 0 || static_cast<std::size_t>(written) >= sizeof(script)) {
    AppendLog("target-hotkey-script-too-large");
    return;
  }
  const bool ran = g_console->RunScriptLine2(script, nullptr, true);
  AppendLog(ran ? "target-hotkey-actor-receipt-ran" : "target-hotkey-script-failed");
}

bool PollTargetHotkey() {
  if (!g_inputPollingLogged) {
    AppendLog("target-hotkey-polling");
    g_inputPollingLogged = true;
  }
  const bool pressed = g_input->IsKeyPressedReal(kF10ScanCode)
    || g_input->IsKeyPressedReal(kUScanCode);
  if (pressed && !g_activationWasPressed) DisplayTargetReceipt();
  g_activationWasPressed = pressed;
  return false;
}

void HandleObseMessage(MessagingInterface::Message* message) {
  if (!message) return;
  if (message->type == kMessageGameInitialized) {
    AppendLog("game-initialized");
    if (!g_targetHotkeyTask || !g_tasks->IsTaskPresentRemovable(g_targetHotkeyTask)) {
      g_targetHotkeyTask = g_tasks->EnqueueTaskRemovable(PollTargetHotkey);
      AppendLog(g_targetHotkeyTask
        ? "target-hotkey-enabled-f10-or-u"
        : "target-hotkey-enable-failed");
    }
    return;
  }
  if (message->type != kMessagePostLoadGame) return;
  if (!message->data) {
    AppendLog("save-load-failed");
    return;
  }
  if (g_displayTask && g_tasks->IsTaskPresentRemovable(g_displayTask)) {
    AppendLog("response-display-already-pending");
    return;
  }
  g_displayDelayFrames = kDisplayDelayFrames;
  g_displayTask = g_tasks->EnqueueTaskRemovable(DisplayResponseWhenReady);
  AppendLog(g_displayTask ? "response-display-scheduled" : "response-display-schedule-failed");
}

}  // namespace

extern "C" __declspec(dllexport) bool OBSEPlugin_Query(
  const ObseInterface* obse,
  PluginInfo* info
) {
  if (!obse || !info) return false;
  info->infoVersion = kPluginInfoVersion;
  info->name = "EchoForgeBridge";
  info->version = 1;
  if (obse->isEditor) return false;
  return obse->obseVersion >= kMinimumObseVersion
    && obse->oblivionVersion == kSupportedOblivionVersion;
}

extern "C" __declspec(dllexport) bool OBSEPlugin_Load(const ObseInterface* obse) {
  if (!obse || !obse->QueryInterface || !obse->GetPluginHandle || !obse->GetOblivionDirectory) {
    return false;
  }
  const char* root = obse->GetOblivionDirectory();
  if (!root || std::strlen(root) >= sizeof(g_oblivionRoot)) return false;
  std::strcpy(g_oblivionRoot, root);

  g_pluginHandle = obse->GetPluginHandle();
  g_console = static_cast<ConsoleInterface*>(obse->QueryInterface(kConsoleInterface));
  g_messaging = static_cast<MessagingInterface*>(obse->QueryInterface(kMessagingInterface));
  g_input = static_cast<InputInterface*>(obse->QueryInterface(kInputInterface));
  g_tasks = static_cast<Tasks2Interface*>(obse->QueryInterface(kTasks2Interface));
  if (!g_console || g_console->version < 2 || !g_console->RunScriptLine2) return false;
  if (!g_messaging || g_messaging->version < 1 || !g_messaging->RegisterListener) return false;
  if (!g_tasks || g_tasks->version < 1 || !g_tasks->EnqueueTaskRemovable
      || !g_tasks->IsTaskPresentRemovable) return false;
  if (!g_input || !g_input->IsKeyPressedReal) return false;
  if (!g_messaging->RegisterListener(g_pluginHandle, "OBSE", HandleObseMessage)) return false;
  AppendLog("plugin-loaded");
  return true;
}
