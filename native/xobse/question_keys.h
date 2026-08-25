#pragma once

#include <cstdint>

namespace echoforge {

struct QuestionKey {
  std::uint16_t scanCode;
  char normal;
  char shifted;
};

inline constexpr QuestionKey kQuestionKeys[] = {
  {0x0C, '-', '_'}, {0x0D, '=', '+'},
  {0x10, 'q', 'Q'}, {0x11, 'w', 'W'}, {0x12, 'e', 'E'}, {0x13, 'r', 'R'},
  {0x14, 't', 'T'}, {0x15, 'y', 'Y'}, {0x16, 'u', 'U'}, {0x17, 'i', 'I'},
  {0x18, 'o', 'O'}, {0x19, 'p', 'P'}, {0x1A, '[', '{'}, {0x1B, ']', '}'},
  {0x1E, 'a', 'A'}, {0x1F, 's', 'S'}, {0x20, 'd', 'D'}, {0x21, 'f', 'F'},
  {0x22, 'g', 'G'}, {0x23, 'h', 'H'}, {0x24, 'j', 'J'}, {0x25, 'k', 'K'},
  {0x26, 'l', 'L'}, {0x27, ';', ':'}, {0x28, '\'', '"'}, {0x29, '`', '~'},
  {0x2B, '\\', '|'}, {0x2C, 'z', 'Z'}, {0x2D, 'x', 'X'}, {0x2E, 'c', 'C'},
  {0x2F, 'v', 'V'}, {0x30, 'b', 'B'}, {0x31, 'n', 'N'}, {0x32, 'm', 'M'},
  {0x33, ',', '<'}, {0x34, '.', '>'}, {0x35, '/', '?'}, {0x39, ' ', ' '}
};

constexpr char TranslateQuestionKey(std::uint16_t scanCode, bool shifted) {
  constexpr char unshiftedDigits[] = "1234567890";
  constexpr char shiftedDigits[] = "!@#$%^&*()";
  if (scanCode >= 0x02 && scanCode <= 0x0B) {
    return shifted ? shiftedDigits[scanCode - 0x02] : unshiftedDigits[scanCode - 0x02];
  }
  for (const QuestionKey& key : kQuestionKeys) {
    if (key.scanCode == scanCode) return shifted ? key.shifted : key.normal;
  }
  return '\0';
}

}  // namespace echoforge
