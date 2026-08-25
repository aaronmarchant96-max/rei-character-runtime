#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${project_root}/.local/native-question-keys-test"
mkdir -p "${project_root}/.local"
g++ -std=c++17 -Wall -Wextra -Werror \
  "${project_root}/test/native-question-keys.cpp" \
  -o "${output}"
"${output}"
