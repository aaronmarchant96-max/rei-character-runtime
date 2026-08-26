#include <windows.h>

#include <cstdint>
#include <cmath>
#include <cstdio>
#include <cstring>

#include "question_keys.h"

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
constexpr std::uint16_t kF10ScanCode = 0x44;
constexpr std::uint16_t kUScanCode = 0x16;
constexpr std::uint16_t kYScanCode = 0x15;
constexpr std::uint16_t kIScanCode = 0x17;
constexpr std::uint16_t kEnterScanCode = 0x1C;
constexpr std::uint16_t kEscapeScanCode = 0x01;
constexpr std::uintptr_t kHudInfoMenuPointerAddress = 0x00B3B33C;
constexpr std::size_t kHudCrosshairReferenceOffset = 0x54;
constexpr std::size_t kFormTypeOffset = 0x04;
constexpr std::size_t kFormIdOffset = 0x0C;
constexpr std::size_t kReferenceBaseFormOffset = 0x1C;
constexpr std::size_t kReferenceParentCellOffset = 0x40;
constexpr std::size_t kReferencePositionOffset = 0x2C;
constexpr std::size_t kActorBaseFullNameDataOffset = 0xA4;
constexpr std::size_t kActorBaseFullNameLengthOffset = 0xA8;
constexpr std::size_t kCellFullNameDataOffset = 0x1C;
constexpr std::size_t kCellFullNameLengthOffset = 0x20;
constexpr std::size_t kCellWorldspaceOffset = 0x50;
constexpr std::size_t kMaxGameTextBytes = 80;
constexpr std::size_t kMaxQuestionBytes = 240;
constexpr std::uint8_t kNpcFormType = 0x23;
constexpr std::uint8_t kCreatureFormType = 0x24;
constexpr std::uint8_t kIngredientFormType = 0x19;
constexpr UInt32 kFormQuestItemFlag = 0x00000400;
constexpr UInt32 kReferenceDisabledFlag = 0x00000800;
constexpr UInt32 kReferenceTakenFlags = 0x00000022;
constexpr float kMaximumPickupDistanceUnits = 500.0F;
// Oblivion.esm IDLE record: PicUpObjectGround.
constexpr UInt32 kPickupGroundIdleFormId = 0x0003ECAA;
constexpr DWORD kPickupAnimationLeadTimeMs = 900;
constexpr std::uintptr_t kLookupFormByIdAddress = 0x0046B250;
constexpr std::uintptr_t kIsOffLimitsToPlayerAddress = 0x004DEBF0;

struct BoundedGameText {
  char value[kMaxGameTextBytes + 1];
  bool present;
};

struct PendingPickup {
  bool active;
  UInt32 actorReferenceFormId;
  UInt32 itemReferenceFormId;
  UInt32 itemBaseFormId;
  DWORD animationStartedAt;
};

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
void* g_targetHotkeyTask = nullptr;
bool g_activationWasPressed = false;
bool g_talkWasPressed = false;
bool g_actionWasPressed = false;
bool g_inputPollingLogged = false;
char g_oblivionRoot[MAX_PATH] = {};
bool g_nativeQuestionActive = false;
bool g_questionSubmitWasPressed = false;
bool g_questionCancelWasPressed = false;
UInt32 g_questionTargetFormId = 0;
UInt32 g_linkedActorFormId = 0;
PendingPickup g_pendingPickup = {};
FILETIME g_lastResponseWriteTime = {};
bool g_responseWatchInitialized = false;
char g_capturedQuestion[kMaxQuestionBytes + 1] = {};
std::size_t g_capturedQuestionLength = 0;
bool g_questionKeyWasPressed[256] = {};

void CaptureQuestionKeystrokes() {
  const bool shifted = g_input->IsKeyPressedReal(0x2A)
    || g_input->IsKeyPressedReal(0x36);
  for (std::uint16_t scanCode = 0; scanCode < 256; ++scanCode) {
    const bool pressed = g_input->IsKeyPressedReal(scanCode);
    if (pressed && !g_questionKeyWasPressed[scanCode]) {
      if (scanCode == 0x0E) {
        if (g_capturedQuestionLength > 0) {
          g_capturedQuestion[--g_capturedQuestionLength] = '\0';
        }
      } else {
        const char character = echoforge::TranslateQuestionKey(scanCode, shifted);
        if (character != '\0' && g_capturedQuestionLength < kMaxQuestionBytes) {
          g_capturedQuestion[g_capturedQuestionLength++] = character;
          g_capturedQuestion[g_capturedQuestionLength] = '\0';
        }
      }
    }
    g_questionKeyWasPressed[scanCode] = pressed;
  }
}

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

bool PublishActionReceipt(
  UInt32 actorFormId,
  UInt32 itemReferenceFormId,
  UInt32 itemBaseFormId,
  const char* status,
  const char* reason
) {
  char receiptPath[MAX_PATH] = {};
  char temporaryPath[MAX_PATH] = {};
  if (!BuildPath(
        receiptPath,
        sizeof(receiptPath),
        "Data\\OBSE\\Plugins\\EchoForge\\action-receipt.json"
      )
      || !BuildPath(
        temporaryPath,
        sizeof(temporaryPath),
        "Data\\OBSE\\Plugins\\EchoForge\\action-receipt.json.tmp"
      )) {
    AppendLog("action-receipt-path-too-long");
    return false;
  }
  char envelope[320] = {};
  const int written = std::snprintf(
    envelope,
    sizeof(envelope),
    "{\"schemaVersion\":1,\"action\":\"pick-up-item\","
    "\"actorReferenceFormId\":\"%08X\",\"itemReferenceFormId\":\"%08X\","
    "\"itemBaseFormId\":\"%08X\",\"status\":\"%s\",\"reason\":\"%s\"}",
    actorFormId,
    itemReferenceFormId,
    itemBaseFormId,
    status,
    reason
  );
  if (written <= 0 || static_cast<std::size_t>(written) >= sizeof(envelope)) {
    AppendLog("action-receipt-envelope-too-large");
    return false;
  }
  FILE* file = std::fopen(temporaryPath, "wb");
  if (!file) {
    AppendLog("action-receipt-temporary-open-failed");
    return false;
  }
  const std::size_t length = static_cast<std::size_t>(written);
  const bool wrote = std::fwrite(envelope, 1, length, file) == length
    && std::fflush(file) == 0;
  const bool closed = std::fclose(file) == 0;
  if (!wrote || !closed) {
    DeleteFileA(temporaryPath);
    AppendLog("action-receipt-temporary-write-failed");
    return false;
  }
  if (!MoveFileExA(
        temporaryPath,
        receiptPath,
        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
      )) {
    DeleteFileA(temporaryPath);
    AppendLog("action-receipt-atomic-replace-failed");
    return false;
  }
  return true;
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

void PollResponseFile() {
  char path[MAX_PATH] = {};
  if (!BuildPath(path, sizeof(path), "Data\\OBSE\\Plugins\\EchoForge\\response.txt")) return;
  WIN32_FILE_ATTRIBUTE_DATA attributes = {};
  if (!GetFileAttributesExA(path, GetFileExInfoStandard, &attributes)) return;
  if (!g_responseWatchInitialized) {
    g_lastResponseWriteTime = attributes.ftLastWriteTime;
    g_responseWatchInitialized = true;
    return;
  }
  if (CompareFileTime(&attributes.ftLastWriteTime, &g_lastResponseWriteTime) == 0) return;
  g_lastResponseWriteTime = attributes.ftLastWriteTime;

  char response[kMaxResponseBytes + 1] = {};
  char script[(kMaxResponseBytes * 2) + 32] = {};
  if (!ReadResponse(response, sizeof(response))
      || !BuildMessageBoxScript(response, script, sizeof(script))) {
    AppendLog("response-live-read-failed");
    return;
  }
  const bool ran = g_console->RunScriptLine2(script, nullptr, true);
  AppendLog(ran ? "response-live-messagebox-ran" : "response-live-messagebox-failed");
}

BoundedGameText ReadGameText(void* object, std::size_t dataOffset, std::size_t lengthOffset) {
  BoundedGameText result = {{}, false};
  if (!object) return result;
  const char* source = *reinterpret_cast<char**>(
    static_cast<std::uint8_t*>(object) + dataOffset
  );
  const std::uint16_t sourceLength = *reinterpret_cast<std::uint16_t*>(
    static_cast<std::uint8_t*>(object) + lengthOffset
  );
  if (!source || sourceLength == 0) return result;

  const std::size_t boundedLength = sourceLength < kMaxGameTextBytes
    ? sourceLength
    : kMaxGameTextBytes;
  std::size_t writeIndex = 0;
  bool previousWasSpace = false;
  for (std::size_t readIndex = 0; readIndex < boundedLength; ++readIndex) {
    unsigned char character = static_cast<unsigned char>(source[readIndex]);
    if (character == '\0') break;
    if (character < 0x20 || character == 0x7F) character = ' ';
    if (character >= 0x80) character = '?';
    if (character == ' ') {
      if (writeIndex == 0 || previousWasSpace) continue;
      previousWasSpace = true;
    } else {
      previousWasSpace = false;
    }
    result.value[writeIndex++] = static_cast<char>(character);
  }
  while (writeIndex > 0 && result.value[writeIndex - 1] == ' ') --writeIndex;
  result.value[writeIndex] = '\0';
  result.present = writeIndex > 0;
  return result;
}

bool EncodeNullableJsonText(
  const BoundedGameText& text,
  char* output,
  std::size_t capacity
) {
  if (!text.present) {
    return std::snprintf(output, capacity, "null") == 4;
  }
  std::size_t writeIndex = 0;
  if (capacity < 3) return false;
  output[writeIndex++] = '"';
  for (std::size_t readIndex = 0; text.value[readIndex] != '\0'; ++readIndex) {
    const char character = text.value[readIndex];
    if (character == '"' || character == '\\') {
      if (writeIndex + 2 >= capacity) return false;
      output[writeIndex++] = '\\';
    } else if (writeIndex + 1 >= capacity) {
      return false;
    }
    output[writeIndex++] = character;
  }
  if (writeIndex + 2 > capacity) return false;
  output[writeIndex++] = '"';
  output[writeIndex] = '\0';
  return true;
}

bool PublishTarget(
  UInt32 formId,
  const char* actorKind,
  const BoundedGameText& displayName,
  UInt32 locationFormId,
  bool hasLocation,
  const BoundedGameText& locationName
) {
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

  char displayNameJson[(kMaxGameTextBytes * 2) + 3] = {};
  char locationNameJson[(kMaxGameTextBytes * 2) + 3] = {};
  if (!EncodeNullableJsonText(displayName, displayNameJson, sizeof(displayNameJson))
      || !EncodeNullableJsonText(locationName, locationNameJson, sizeof(locationNameJson))) {
    AppendLog("target-name-encoding-failed");
    return false;
  }
  char locationFormIdJson[16] = {};
  const int locationWritten = hasLocation
    ? std::snprintf(locationFormIdJson, sizeof(locationFormIdJson), "\"%08X\"", locationFormId)
    : std::snprintf(locationFormIdJson, sizeof(locationFormIdJson), "null");
  if (locationWritten <= 0
      || static_cast<std::size_t>(locationWritten) >= sizeof(locationFormIdJson)) {
    AppendLog("target-location-id-encoding-failed");
    return false;
  }

  char envelope[512] = {};
  const int written = std::snprintf(
    envelope,
    sizeof(envelope),
    "{\"schemaVersion\":2,\"game\":\"oblivion-2009\","
    "\"referenceFormId\":\"%08X\",\"actorKind\":\"%s\","
    "\"displayName\":%s,\"locationFormId\":%s,\"locationName\":%s}",
    formId,
    actorKind,
    displayNameJson,
    locationFormIdJson,
    locationNameJson
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

UInt32 ReadUInt32At(void* base, std::size_t offset) {
  if (!base) return 0;
  return *reinterpret_cast<UInt32*>(static_cast<std::uint8_t*>(base) + offset);
}

void* LookupFormById(UInt32 formId) {
  using LookupFormByIdFunction = void* (__cdecl*)(UInt32);
  const auto lookup = reinterpret_cast<LookupFormByIdFunction>(kLookupFormByIdAddress);
  return lookup(formId);
}

bool ItemIsOffLimits(void* itemReference) {
  using IsOffLimitsFunction = bool (__attribute__((fastcall)) *)(void* object);
  const auto isOffLimits = reinterpret_cast<IsOffLimitsFunction>(
    kIsOffLimitsToPlayerAddress
  );
  return isOffLimits(itemReference);
}

float ReferenceDistance(void* first, void* second) {
  const float* firstPosition = reinterpret_cast<float*>(
    static_cast<std::uint8_t*>(first) + kReferencePositionOffset
  );
  const float* secondPosition = reinterpret_cast<float*>(
    static_cast<std::uint8_t*>(second) + kReferencePositionOffset
  );
  const float x = firstPosition[0] - secondPosition[0];
  const float y = firstPosition[1] - secondPosition[1];
  const float z = firstPosition[2] - secondPosition[2];
  return std::sqrt((x * x) + (y * y) + (z * z));
}

bool DispatchPickup(void* itemReference, UInt32 actorReferenceFormId) {
  char script[48] = {};
  const int written = std::snprintf(
    script,
    sizeof(script),
    "Activate %08X 1",
    actorReferenceFormId
  );
  return written > 0
    && static_cast<std::size_t>(written) < sizeof(script)
    && g_console->RunScriptLine2(script, itemReference, true);
}

bool BeginAnimatedPickup(
  void* actorReference,
  UInt32 actorReferenceFormId,
  UInt32 itemReferenceFormId,
  UInt32 itemBaseFormId
) {
  if (g_pendingPickup.active) return false;
  char script[48] = {};
  const int written = std::snprintf(
    script,
    sizeof(script),
    "PlayIdle %08X 1",
    kPickupGroundIdleFormId
  );
  const bool animationDispatched = written > 0
    && static_cast<std::size_t>(written) < sizeof(script)
    && g_console->RunScriptLine2(script, actorReference, true);
  if (!animationDispatched) return false;
  g_pendingPickup = {
    true,
    actorReferenceFormId,
    itemReferenceFormId,
    itemBaseFormId,
    GetTickCount()
  };
  PublishActionReceipt(
    actorReferenceFormId,
    itemReferenceFormId,
    itemBaseFormId,
    "animating",
    "pickup-ground-animation-dispatched"
  );
  AppendLog("pickup-ground-animation-dispatched");
  return true;
}

void FinishPendingPickup(const char* status, const char* reason, const char* message) {
  const PendingPickup pickup = g_pendingPickup;
  g_pendingPickup = {};
  PublishActionReceipt(
    pickup.actorReferenceFormId,
    pickup.itemReferenceFormId,
    pickup.itemBaseFormId,
    status,
    reason
  );
  char script[240] = {};
  const int written = std::snprintf(
    script,
    sizeof(script),
    "MessageBoxEX \"EchoForge: %s\"",
    message
  );
  if (written > 0 && static_cast<std::size_t>(written) < sizeof(script)) {
    g_console->RunScriptLine2(script, nullptr, true);
  }
  AppendLog(reason);
}

void PollPendingPickup() {
  if (!g_pendingPickup.active
      || GetTickCount() - g_pendingPickup.animationStartedAt < kPickupAnimationLeadTimeMs) {
    return;
  }
  void* actorReference = LookupFormById(g_pendingPickup.actorReferenceFormId);
  void* actorBaseForm = ReadPointerAt(actorReference, kReferenceBaseFormOffset);
  void* itemReference = LookupFormById(g_pendingPickup.itemReferenceFormId);
  void* itemBaseForm = ReadPointerAt(itemReference, kReferenceBaseFormOffset);
  const std::uint8_t actorType = actorBaseForm
    ? *(static_cast<std::uint8_t*>(actorBaseForm) + kFormTypeOffset)
    : 0;
  const std::uint8_t itemType = itemBaseForm
    ? *(static_cast<std::uint8_t*>(itemBaseForm) + kFormTypeOffset)
    : 0;
  if (!actorReference
      || ReadUInt32At(actorReference, kFormIdOffset) != g_pendingPickup.actorReferenceFormId
      || actorType != kNpcFormType
      || !itemReference
      || ReadUInt32At(itemReference, kFormIdOffset) != g_pendingPickup.itemReferenceFormId
      || ReadUInt32At(itemBaseForm, kFormIdOffset) != g_pendingPickup.itemBaseFormId
      || itemType != kIngredientFormType
      || ReadPointerAt(actorReference, kReferenceParentCellOffset)
        != ReadPointerAt(itemReference, kReferenceParentCellOffset)
      || ReferenceDistance(actorReference, itemReference) > kMaximumPickupDistanceUnits) {
    FinishPendingPickup(
      "failed",
      "pickup-state-changed-during-animation",
      "Pickup stopped because the actor or item moved out of range."
    );
    return;
  }
  const UInt32 itemFlags = ReadUInt32At(itemReference, 0x08);
  if ((itemFlags & kReferenceDisabledFlag) != 0
      || (itemFlags & kReferenceTakenFlags) == kReferenceTakenFlags
      || (ReadUInt32At(itemBaseForm, 0x08) & kFormQuestItemFlag) != 0
      || ItemIsOffLimits(itemReference)) {
    FinishPendingPickup(
      "failed",
      "pickup-item-became-unavailable",
      "Pickup stopped because the item is no longer allowed."
    );
    return;
  }
  const bool dispatched = DispatchPickup(
    itemReference,
    g_pendingPickup.actorReferenceFormId
  );
  FinishPendingPickup(
    dispatched ? "completed" : "failed",
    dispatched ? "pickup-completed-after-animation" : "pickup-transfer-failed-after-animation",
    dispatched ? "Animated pickup completed." : "Oblivion rejected the pickup after the animation."
  );
}

bool PublishQuestion(UInt32 formId, const char* input) {
  char normalized[kMaxQuestionBytes + 1] = {};
  std::size_t normalizedLength = 0;
  bool previousWasSpace = false;
  for (std::size_t index = 0; input[index] != '\0' && index < kMaxQuestionBytes; ++index) {
    unsigned char character = static_cast<unsigned char>(input[index]);
    if (character < 0x20 || character == 0x7F) character = ' ';
    if (character >= 0x80) character = '?';
    if (character == ' ') {
      if (normalizedLength == 0 || previousWasSpace) continue;
      previousWasSpace = true;
    } else {
      previousWasSpace = false;
    }
    normalized[normalizedLength++] = static_cast<char>(character);
  }
  while (normalizedLength > 0 && normalized[normalizedLength - 1] == ' ') {
    --normalizedLength;
  }
  normalized[normalizedLength] = '\0';
  if (normalizedLength == 0) {
    AppendLog("question-empty");
    return false;
  }

  char questionJson[(kMaxQuestionBytes * 2) + 3] = {};
  std::size_t jsonIndex = 0;
  questionJson[jsonIndex++] = '"';
  for (std::size_t index = 0; normalized[index] != '\0'; ++index) {
    const char character = normalized[index];
    if (character == '"' || character == '\\') questionJson[jsonIndex++] = '\\';
    questionJson[jsonIndex++] = character;
  }
  questionJson[jsonIndex++] = '"';
  questionJson[jsonIndex] = '\0';

  char questionPath[MAX_PATH] = {};
  char temporaryPath[MAX_PATH] = {};
  if (!BuildPath(questionPath, sizeof(questionPath), "Data\\OBSE\\Plugins\\EchoForge\\question.json")
      || !BuildPath(
        temporaryPath,
        sizeof(temporaryPath),
        "Data\\OBSE\\Plugins\\EchoForge\\question.json.tmp"
      )) {
    AppendLog("question-path-too-long");
    return false;
  }
  char envelope[768] = {};
  const int written = std::snprintf(
    envelope,
    sizeof(envelope),
    "{\"schemaVersion\":1,\"game\":\"oblivion-2009\","
    "\"targetReferenceFormId\":\"%08X\",\"question\":%s}",
    formId,
    questionJson
  );
  if (written <= 0 || static_cast<std::size_t>(written) >= sizeof(envelope)) {
    AppendLog("question-envelope-too-large");
    return false;
  }
  FILE* file = std::fopen(temporaryPath, "wb");
  if (!file) {
    AppendLog("question-temporary-open-failed");
    return false;
  }
  const std::size_t length = static_cast<std::size_t>(written);
  const bool wrote = std::fwrite(envelope, 1, length, file) == length
    && std::fflush(file) == 0;
  const bool closed = std::fclose(file) == 0;
  if (!wrote || !closed) {
    DeleteFileA(temporaryPath);
    AppendLog("question-temporary-write-failed");
    return false;
  }
  if (!MoveFileExA(
        temporaryPath,
        questionPath,
        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
      )) {
    DeleteFileA(temporaryPath);
    AppendLog("question-atomic-replace-failed");
    return false;
  }
  AppendLog("question-published");
  return true;
}

void CloseNativeQuestion(const char* logMessage) {
  g_console->RunScriptLine2("CloseTextInput", nullptr, true);
  g_nativeQuestionActive = false;
  g_questionTargetFormId = 0;
  g_questionSubmitWasPressed = false;
  g_questionCancelWasPressed = false;
  AppendLog(logMessage);
}

void SubmitNativeQuestion() {
  char question[kMaxQuestionBytes + 1] = {};
  const bool read = g_capturedQuestionLength > 0;
  if (read) std::memcpy(question, g_capturedQuestion, sizeof(question));
  const UInt32 formId = g_questionTargetFormId;
  CloseNativeQuestion(read ? "question-native-input-read" : "question-native-input-read-failed");
  if (read) {
    AppendLog(PublishQuestion(formId, question)
      ? "question-native-dialog-submitted"
      : "question-native-dialog-publish-failed");
  }
}

void PollNativeQuestion() {
  if (!g_nativeQuestionActive) return;
  if (!g_console->RunScriptLine2("UpdateTextInput", nullptr, true)) {
    CloseNativeQuestion("question-native-update-failed");
    return;
  }
  CaptureQuestionKeystrokes();
  const bool submitPressed = g_input->IsKeyPressedReal(kEnterScanCode);
  const bool cancelPressed = g_input->IsKeyPressedReal(kEscapeScanCode);
  if (submitPressed && !g_questionSubmitWasPressed) {
    SubmitNativeQuestion();
    return;
  }
  if (cancelPressed && !g_questionCancelWasPressed) {
    CloseNativeQuestion("question-native-dialog-cancelled");
    return;
  }
  g_questionSubmitWasPressed = submitPressed;
  g_questionCancelWasPressed = cancelPressed;
}

void CaptureTargetQuestion() {
  if (g_nativeQuestionActive) return;
  void* hudInfoMenu = *reinterpret_cast<void**>(kHudInfoMenuPointerAddress);
  void* crosshairReference = ReadPointerAt(hudInfoMenu, kHudCrosshairReferenceOffset);
  void* baseForm = ReadPointerAt(crosshairReference, kReferenceBaseFormOffset);
  const std::uint8_t formType = baseForm
    ? *(static_cast<std::uint8_t*>(baseForm) + kFormTypeOffset)
    : 0;
  if (!crosshairReference || (formType != kNpcFormType && formType != kCreatureFormType)) {
    g_console->RunScriptLine2(
      "MessageBoxEX \"EchoForge: Aim at an NPC or creature, then tap Y.\"",
      nullptr,
      true
    );
    AppendLog("question-hotkey-rejected-target");
    return;
  }
  const UInt32 formId = *reinterpret_cast<UInt32*>(
    static_cast<std::uint8_t*>(crosshairReference) + kFormIdOffset
  );
  const char* actorKind = formType == kNpcFormType ? "npc" : "creature";
  const BoundedGameText displayName = ReadGameText(
    baseForm,
    kActorBaseFullNameDataOffset,
    kActorBaseFullNameLengthOffset
  );
  void* parentCell = ReadPointerAt(crosshairReference, kReferenceParentCellOffset);
  BoundedGameText locationName = ReadGameText(
    parentCell,
    kCellFullNameDataOffset,
    kCellFullNameLengthOffset
  );
  if (!locationName.present) {
    void* worldspace = ReadPointerAt(parentCell, kCellWorldspaceOffset);
    locationName = ReadGameText(
      worldspace,
      kCellFullNameDataOffset,
      kCellFullNameLengthOffset
    );
  }
  const UInt32 locationFormId = parentCell
    ? *reinterpret_cast<UInt32*>(static_cast<std::uint8_t*>(parentCell) + kFormIdOffset)
    : 0;
  if (!PublishTarget(
        formId,
        actorKind,
        displayName,
        locationFormId,
        parentCell != nullptr,
        locationName
      )) {
    AppendLog("question-target-publish-failed");
    return;
  }
  g_linkedActorFormId = formId;
  const bool opened = g_console->RunScriptLine2(
    "OpenTextInput \"EchoForge question: | Send\" 0 240",
    nullptr,
    true
  );
  if (!opened) {
    AppendLog("question-native-open-failed");
    return;
  }
  g_questionTargetFormId = formId;
  g_capturedQuestion[0] = '\0';
  g_capturedQuestionLength = 0;
  for (std::uint16_t scanCode = 0; scanCode < 256; ++scanCode) {
    g_questionKeyWasPressed[scanCode] = g_input->IsKeyPressedReal(scanCode);
  }
  g_nativeQuestionActive = true;
  g_questionSubmitWasPressed = true;
  g_questionCancelWasPressed = false;
  AppendLog("question-native-dialog-opened");
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
  const BoundedGameText displayName = ReadGameText(
    baseForm,
    kActorBaseFullNameDataOffset,
    kActorBaseFullNameLengthOffset
  );
  void* parentCell = ReadPointerAt(crosshairReference, kReferenceParentCellOffset);
  BoundedGameText locationName = ReadGameText(
    parentCell,
    kCellFullNameDataOffset,
    kCellFullNameLengthOffset
  );
  if (!locationName.present) {
    void* worldspace = ReadPointerAt(parentCell, kCellWorldspaceOffset);
    locationName = ReadGameText(
      worldspace,
      kCellFullNameDataOffset,
      kCellFullNameLengthOffset
    );
  }
  const UInt32 locationFormId = parentCell
    ? *reinterpret_cast<UInt32*>(static_cast<std::uint8_t*>(parentCell) + kFormIdOffset)
    : 0;
  if (!PublishTarget(
        formId,
        actorKind,
        displayName,
        locationFormId,
        parentCell != nullptr,
        locationName
      )) {
    const bool ran = g_console->RunScriptLine2(
      "MessageBoxEX \"EchoForge: Target export failed. Check bridge.log.\"",
      nullptr,
      true
    );
    AppendLog(ran ? "target-hotkey-export-failure-shown" : "target-hotkey-script-failed");
    return;
  }
  g_linkedActorFormId = formId;
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

void RejectPickup(
  UInt32 itemReferenceFormId,
  UInt32 itemBaseFormId,
  const char* reason,
  const char* playerMessage
) {
  PublishActionReceipt(
    g_linkedActorFormId,
    itemReferenceFormId,
    itemBaseFormId,
    "denied",
    reason
  );
  char script[240] = {};
  const int written = std::snprintf(
    script,
    sizeof(script),
    "MessageBoxEX \"EchoForge: %s\"",
    playerMessage
  );
  if (written > 0 && static_cast<std::size_t>(written) < sizeof(script)) {
    g_console->RunScriptLine2(script, nullptr, true);
  }
  AppendLog(reason);
}

void AttemptPickup() {
  if (g_pendingPickup.active) {
    RejectPickup(0, 0, "pickup-already-in-progress", "A pickup is already in progress.");
    return;
  }
  if (g_linkedActorFormId == 0) {
    RejectPickup(0, 0, "pickup-no-linked-actor", "Link an NPC with U first.");
    return;
  }

  void* actorReference = LookupFormById(g_linkedActorFormId);
  void* actorBaseForm = ReadPointerAt(actorReference, kReferenceBaseFormOffset);
  const std::uint8_t actorType = actorBaseForm
    ? *(static_cast<std::uint8_t*>(actorBaseForm) + kFormTypeOffset)
    : 0;
  if (!actorReference
      || ReadUInt32At(actorReference, kFormIdOffset) != g_linkedActorFormId
      || actorType != kNpcFormType) {
    RejectPickup(0, 0, "pickup-linked-actor-unavailable", "Linked NPC is unavailable. Link again with U.");
    g_linkedActorFormId = 0;
    return;
  }

  void* hudInfoMenu = *reinterpret_cast<void**>(kHudInfoMenuPointerAddress);
  void* itemReference = ReadPointerAt(hudInfoMenu, kHudCrosshairReferenceOffset);
  void* itemBaseForm = ReadPointerAt(itemReference, kReferenceBaseFormOffset);
  const UInt32 itemReferenceFormId = ReadUInt32At(itemReference, kFormIdOffset);
  const UInt32 itemBaseFormId = ReadUInt32At(itemBaseForm, kFormIdOffset);
  const std::uint8_t itemType = itemBaseForm
    ? *(static_cast<std::uint8_t*>(itemBaseForm) + kFormTypeOffset)
    : 0;
  if (!itemReference || !itemBaseForm || itemType != kIngredientFormType) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-target-not-ingredient",
      "Aim at an apple or another ordinary ingredient, then tap I."
    );
    return;
  }

  if (ReadPointerAt(actorReference, kReferenceParentCellOffset)
      != ReadPointerAt(itemReference, kReferenceParentCellOffset)) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-target-different-cell",
      "The linked NPC and item are not in the same cell."
    );
    return;
  }
  const UInt32 itemFlags = ReadUInt32At(itemReference, 0x08);
  if ((itemFlags & kReferenceDisabledFlag) != 0
      || (itemFlags & kReferenceTakenFlags) == kReferenceTakenFlags) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-item-unavailable",
      "That item is no longer available."
    );
    return;
  }
  if ((ReadUInt32At(itemBaseForm, 0x08) & kFormQuestItemFlag) != 0) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-protected-item",
      "Quest or protected ingredients are not allowed."
    );
    return;
  }
  if (ItemIsOffLimits(itemReference)) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-owned-item",
      "That ingredient is owned or off limits."
    );
    return;
  }
  if (ReferenceDistance(actorReference, itemReference) > kMaximumPickupDistanceUnits) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-item-too-far",
      "The ingredient is too far from the linked NPC."
    );
    return;
  }

  if (!BeginAnimatedPickup(
        actorReference,
        g_linkedActorFormId,
        itemReferenceFormId,
        itemBaseFormId
      )) {
    RejectPickup(
      itemReferenceFormId,
      itemBaseFormId,
      "pickup-ground-animation-failed",
      "Oblivion could not start the pickup animation."
    );
  }
}

bool PollTargetHotkey() {
  if (!g_inputPollingLogged) {
    AppendLog("target-hotkey-polling");
    g_inputPollingLogged = true;
  }
  PollPendingPickup();
  if (g_nativeQuestionActive) {
    PollNativeQuestion();
    return false;
  }
  PollResponseFile();
  const bool pressed = g_input->IsKeyPressedReal(kF10ScanCode)
    || g_input->IsKeyPressedReal(kUScanCode);
  if (pressed && !g_activationWasPressed) DisplayTargetReceipt();
  g_activationWasPressed = pressed;
  const bool talkPressed = g_input->IsKeyPressedReal(kYScanCode);
  if (talkPressed && !g_talkWasPressed) CaptureTargetQuestion();
  g_talkWasPressed = talkPressed;
  const bool actionPressed = g_input->IsKeyPressedReal(kIScanCode);
  if (actionPressed && !g_actionWasPressed) AttemptPickup();
  g_actionWasPressed = actionPressed;
  return false;
}

void HandleObseMessage(MessagingInterface::Message* message) {
  if (!message) return;
  if (message->type == kMessageGameInitialized) {
    AppendLog("game-initialized");
    if (!g_targetHotkeyTask || !g_tasks->IsTaskPresentRemovable(g_targetHotkeyTask)) {
      g_targetHotkeyTask = g_tasks->EnqueueTaskRemovable(PollTargetHotkey);
      AppendLog(g_targetHotkeyTask
        ? "target-hotkey-enabled-f10-or-u-talk-y-pickup-i"
        : "target-hotkey-enable-failed");
    }
    return;
  }
  if (message->type != kMessagePostLoadGame) return;
  if (!message->data) {
    AppendLog("save-load-failed");
    return;
  }
  g_pendingPickup = {};
  g_responseWatchInitialized = false;
  AppendLog("response-stale-replay-suppressed");
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
