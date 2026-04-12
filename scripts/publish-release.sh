#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${RELEASE_ENV_FILE:-$ROOT_DIR/.env.release.local}"

if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%$'\r'}"

    if [[ -z "${line//[[:space:]]/}" ]]; then
      continue
    fi

    if [[ "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi

    if [[ ! "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      echo "Invalid line in ${ENV_FILE}: ${line}" >&2
      exit 1
    fi

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if (( ${#value} >= 2 )); then
      if [[ "$value" == '"'*'"' || "$value" == "'"*"'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    if [[ "$value" == "~/"* ]]; then
      value="${HOME}/${value#~/}"
    elif [[ "$value" == '$HOME/'* ]]; then
      value="${HOME}/${value#\$HOME/}"
    fi

    export "$key=$value"
  done < "$ENV_FILE"
fi

if [[ "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Builds both macOS updater targets, generates latest.json, and publishes a GitHub Release.

Usage:
  npm run release:github

Environment:
  RELEASE_ENV_FILE
  TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY_PATH
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  APPLE_SIGNING_IDENTITY
  APPLE_API_ISSUER
  APPLE_API_KEY
  APPLE_API_KEY_PATH
  APPLE_ID
  APPLE_PASSWORD
  APPLE_TEAM_ID
  RELEASE_BODY
  GITHUB_REPOSITORY
EOF
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This release script currently supports macOS only." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install gh and run 'gh auth login' first." >&2
  exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup is required to add macOS targets." >&2
  exit 1
fi

if ! xcrun --find notarytool >/dev/null 2>&1; then
  echo "Apple notarytool is required. Install Xcode or the Xcode Command Line Tools." >&2
  exit 1
fi

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version)")"
PRODUCT_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json', 'utf8')).productName)")"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
TAG="v${VERSION}"
PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [[ -z "${RELEASE_BODY:-}" ]]; then
  RELEASE_BODY="$(cat <<EOF
## Downloads

- Apple Silicon Macs (M1, M2, M3, M4): download \`Daily_${VERSION}_aarch64.dmg\`
- Intel Macs: download \`Daily_${VERSION}_x64.dmg\`

## Notes

- Most people should download a \`.dmg\` file.
- The \`.app.tar.gz\`, \`.sig\`, and \`latest.json\` files are used by the in-app updater.
EOF
)"
fi

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  key_path="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/daily-updater.key}"

  if [[ ! -f "$key_path" ]]; then
    echo "Missing updater private key at ${key_path}." >&2
    echo "Set TAURI_SIGNING_PRIVATE_KEY or place the key file there first." >&2
    exit 1
  fi

  export TAURI_SIGNING_PRIVATE_KEY="$key_path"
fi

export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  APPLE_SIGNING_IDENTITY="$(security find-identity -v -p codesigning | awk -F'"' '/Developer ID Application:/ { print $2; exit }')"

  if [[ -z "$APPLE_SIGNING_IDENTITY" ]]; then
    echo "No Developer ID Application certificate was found in your keychain." >&2
    echo "Install one locally or set APPLE_SIGNING_IDENTITY explicitly." >&2
    exit 1
  fi

  export APPLE_SIGNING_IDENTITY
fi

api_creds_present=0
apple_id_creds_present=0

if [[ -n "${APPLE_API_ISSUER:-}${APPLE_API_KEY:-}${APPLE_API_KEY_PATH:-}" ]]; then
  api_creds_present=1
fi

if [[ -n "${APPLE_ID:-}${APPLE_PASSWORD:-}${APPLE_TEAM_ID:-}" ]]; then
  apple_id_creds_present=1
fi

if (( api_creds_present )); then
  if [[ -z "${APPLE_API_ISSUER:-}" || -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_PATH:-}" ]]; then
    echo "App Store Connect notarization requires APPLE_API_ISSUER, APPLE_API_KEY, and APPLE_API_KEY_PATH." >&2
    exit 1
  fi

  if [[ ! -f "${APPLE_API_KEY_PATH}" ]]; then
    echo "APPLE_API_KEY_PATH does not point to a readable file: ${APPLE_API_KEY_PATH}" >&2
    exit 1
  fi
elif (( apple_id_creds_present )); then
  if [[ -z "${APPLE_ID:-}" || -z "${APPLE_PASSWORD:-}" || -z "${APPLE_TEAM_ID:-}" ]]; then
    echo "Apple ID notarization requires APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID." >&2
    exit 1
  fi
else
  echo "Missing notarization credentials." >&2
  echo "Set App Store Connect API values (APPLE_API_ISSUER, APPLE_API_KEY, APPLE_API_KEY_PATH)" >&2
  echo "or Apple ID values (APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID)." >&2
  echo "You can place them in ${ENV_FILE}." >&2
  exit 1
fi

echo "Using signing identity: ${APPLE_SIGNING_IDENTITY}"

rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/daily-release.XXXXXX")"
PLATFORMS_FILE="$TMP_DIR/platforms.txt"
LATEST_JSON_PATH="$TMP_DIR/latest.json"
trap 'rm -rf "$TMP_DIR"' EXIT

build_target() {
  local target="$1"
  npm run tauri build -- --target "$target"
}

stage_target_assets() {
  local target="$1"
  local platform_key="$2"
  local asset_suffix="$3"
  local bundle_dir="src-tauri/target/$target/release/bundle"
  local dmg_path
  local updater_path
  local sig_path
  local staged_dmg_path
  local staged_updater_name
  local staged_updater_path
  local staged_sig_path

  dmg_path="$(find "$bundle_dir/dmg" -maxdepth 1 -type f -name '*.dmg' | head -n 1)"
  updater_path="$(find "$bundle_dir/macos" -maxdepth 1 -type f -name '*.app.tar.gz' | head -n 1)"

  if [[ -z "$dmg_path" || -z "$updater_path" ]]; then
    echo "Missing expected artifacts for $target." >&2
    exit 1
  fi

  sig_path="${updater_path}.sig"

  if [[ ! -f "$sig_path" ]]; then
    echo "Missing updater signature for $target at $sig_path." >&2
    exit 1
  fi

  staged_dmg_path="$TMP_DIR/$(basename "$dmg_path")"
  staged_updater_name="${PRODUCT_NAME}_${VERSION}_${asset_suffix}.app.tar.gz"
  staged_updater_path="$TMP_DIR/$staged_updater_name"
  staged_sig_path="${staged_updater_path}.sig"

  cp "$dmg_path" "$staged_dmg_path"
  cp "$updater_path" "$staged_updater_path"
  cp "$sig_path" "$staged_sig_path"

  printf '%s|%s|%s\n' "$platform_key" "$staged_updater_name" "$staged_sig_path" >> "$PLATFORMS_FILE"
}

build_target "aarch64-apple-darwin"
build_target "x86_64-apple-darwin"

stage_target_assets "aarch64-apple-darwin" "darwin-aarch64" "aarch64"
stage_target_assets "x86_64-apple-darwin" "darwin-x86_64" "x64"

PLATFORMS_FILE="$PLATFORMS_FILE" \
LATEST_JSON_PATH="$LATEST_JSON_PATH" \
PUB_DATE="$PUB_DATE" \
REPO="$REPO" \
TAG="$TAG" \
VERSION="$VERSION" \
node --input-type=module <<'EOF'
import fs from 'node:fs'

const platforms = {}
const lines = fs
  .readFileSync(process.env.PLATFORMS_FILE, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

for (const line of lines) {
  const [platformKey, assetName, signaturePath] = line.split('|')
  platforms[platformKey] = {
    signature: fs.readFileSync(signaturePath, 'utf8').trim(),
    url: `https://github.com/${process.env.REPO}/releases/download/${process.env.TAG}/${assetName}`,
  }
}

const latest = {
  version: process.env.VERSION,
  notes: '',
  pub_date: process.env.PUB_DATE,
  platforms,
}

fs.writeFileSync(process.env.LATEST_JSON_PATH, `${JSON.stringify(latest, null, 2)}\n`)
EOF

upload_assets=()
while IFS= read -r asset; do
  upload_assets+=("$asset")
done < <(find "$TMP_DIR" -maxdepth 1 -type f ! -name 'platforms.txt' | sort)

if gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "${upload_assets[@]}" --clobber -R "$REPO"
  gh release edit "$TAG" --title "${PRODUCT_NAME} ${TAG}" --notes "$RELEASE_BODY" -R "$REPO"
else
  gh release create "$TAG" "${upload_assets[@]}" \
    --title "${PRODUCT_NAME} ${TAG}" \
    --notes "$RELEASE_BODY" \
    -R "$REPO"
fi

echo "Published $TAG to $REPO"
