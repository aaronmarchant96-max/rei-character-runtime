#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_directory="${project_root}/.local/xobse"
compiler="${CXX:-i686-w64-mingw32-g++}"

command -v "${compiler}" >/dev/null
mkdir -p "${output_directory}"

"${compiler}" \
  -std=c++17 \
  -O2 \
  -DNDEBUG \
  -shared \
  -static-libgcc \
  -static-libstdc++ \
  -Wl,--subsystem,windows \
  "${project_root}/native/xobse/echoforge_bridge.cpp" \
  "${project_root}/native/xobse/exports.def" \
  -o "${output_directory}/EchoForgeBridge.dll"

sha256sum "${output_directory}/EchoForgeBridge.dll"
i686-w64-mingw32-objdump -p "${output_directory}/EchoForgeBridge.dll" \
  | sed -n '/Export Address Table/,/Import Address Table/p'
