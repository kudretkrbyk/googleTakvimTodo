#!/usr/bin/env bash
set -euo pipefail
# The environment helper runs this script from the project root.
if [[ ! -f .env ]]; then
  echo 'Önce .env dosyasına Google Web Client ID ekleyin.' >&2
  exit 1
fi
# Gradle does not track .env changes as JavaScript inputs. Removing this generated
# output forces Metro to embed the current OAuth configuration on every test build.
rm -f android/app/build/generated/assets/react/release/index.android.bundle
(
  cd android
  ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures="${SADE_TEST_ARCHITECTURES:-arm64-v8a}" --max-workers=2
)
mkdir -p .local/artifacts
SADE_UNSIGNED_APK=android/app/build/outputs/apk/release/app-release-unsigned.apk
SADE_TEST_APK=.local/artifacts/sade-google-test-arm64.apk
SADE_APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
"$SADE_APKSIGNER" sign --ks android/app/debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$SADE_TEST_APK" "$SADE_UNSIGNED_APK"
"$SADE_APKSIGNER" verify "$SADE_TEST_APK"
echo "Test APK hazır: $SADE_TEST_APK (Metro gerektirmez; debug sertifikasıyla imzalıdır.)"
