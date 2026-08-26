#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${project_root}/.local/native-pickup-state-test"
mkdir -p "${project_root}/.local"
g++ -std=c++17 -Wall -Wextra -Werror \
  "${project_root}/test/native-pickup-state.cpp" \
  -o "${output}"
"${output}"
