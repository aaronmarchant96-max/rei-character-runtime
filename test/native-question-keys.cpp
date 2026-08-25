#include "../native/xobse/question_keys.h"

static_assert(echoforge::TranslateQuestionKey(0x1E, false) == 'a');
static_assert(echoforge::TranslateQuestionKey(0x1E, true) == 'A');
static_assert(echoforge::TranslateQuestionKey(0x02, false) == '1');
static_assert(echoforge::TranslateQuestionKey(0x02, true) == '!');
static_assert(echoforge::TranslateQuestionKey(0x35, true) == '?');
static_assert(echoforge::TranslateQuestionKey(0x39, false) == ' ');
static_assert(echoforge::TranslateQuestionKey(0x1C, false) == '\0');

int main() {}
