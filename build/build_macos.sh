#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm install
export APPLE_KEYCHAIN_PROFILE="${APPLE_KEYCHAIN_PROFILE:-wit-notary}"

echo "Using notarization profile: $APPLE_KEYCHAIN_PROFILE"
xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" >/dev/null

npm run dist:mac
