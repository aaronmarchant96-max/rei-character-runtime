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
constexpr UInt32 kTasks2Interface = 11;
constexpr UInt32 kMessagePostLoadGame = 8;
constexpr UInt32 kMessageGameInitialized = 11;
constexpr std::size_t kMaxResponseBytes = 240;
constexpr UInt32 kDisplayDelayFrames = 120;

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

PluginHandle g_pluginHandle = 0xFFFFFFFF;
MessagingInterface* g_messaging = nullptr;
Tasks2Interface* g_tasks = nullptr;
ConsoleInterface* g_console = nullptr;
void* g_displayTask = nullptr;
UInt32 g_displayDelayFrames = 0;
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

void HandleObseMessage(MessagingInterface::Message* message) {
  if (!message) return;
  if (message->type == kMessageGameInitialized) {
    AppendLog("game-initialized");
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
  g_tasks = static_cast<Tasks2Interface*>(obse->QueryInterface(kTasks2Interface));
  if (!g_console || g_console->version < 2 || !g_console->RunScriptLine2) return false;
  if (!g_messaging || g_messaging->version < 1 || !g_messaging->RegisterListener) return false;
  if (!g_tasks || g_tasks->version < 1 || !g_tasks->EnqueueTaskRemovable
      || !g_tasks->IsTaskPresentRemovable) return false;
  if (!g_messaging->RegisterListener(g_pluginHandle, "OBSE", HandleObseMessage)) return false;
  AppendLog("plugin-loaded");
  return true;
}
