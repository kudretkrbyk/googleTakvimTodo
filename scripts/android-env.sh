#!/usr/bin/env bash
set -euo pipefail
SADE_PROJECT_ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
if [[ -d "$SADE_PROJECT_ROOT/.local/jdk17" && -z "${JAVA_HOME:-}" ]]; then
  export JAVA_HOME="$SADE_PROJECT_ROOT/.local/jdk17"
fi
if [[ -d "$SADE_PROJECT_ROOT/.local/android-sdk" && -z "${ANDROID_HOME:-}" ]]; then
  export ANDROID_HOME="$SADE_PROJECT_ROOT/.local/android-sdk"
fi
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$SADE_PROJECT_ROOT/.local/gradle}"
if [[ -n "${JAVA_HOME:-}" ]]; then export PATH="$JAVA_HOME/bin:$PATH"; fi
if [[ -n "${ANDROID_HOME:-}" ]]; then export PATH="$ANDROID_HOME/platform-tools:$PATH"; fi
cd "$SADE_PROJECT_ROOT"
exec "$@"
