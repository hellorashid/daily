# Daily

Daily is a macOS-first Tauri menu bar app for lightweight daily markdown notes.

## What It Does

- Lives in the menu bar and opens as a compact tray window
- Stores one markdown file per day in a user-selected folder
- Opens or creates `YYYY-MM-DD.md` automatically
- Uses a live-preview markdown editor with fast keyboard editing

## Stack

- Tauri 2
- React 19
- TypeScript
- CodeMirror 6

## Development

```bash
npm install
npm run tauri dev
```

## Quality Checks

```bash
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Packaging

```bash
npm run tauri build -- --bundles app
```

The packaged macOS app bundle is emitted under `src-tauri/target/release/bundle/macos/`.

## Manual Releases

Daily uses GitHub Releases as the updater feed, but releases are published manually from macOS instead of CI.

Before publishing:

```bash
gh auth login
```

Make sure your updater private key exists at `~/.tauri/daily-updater.key`, or set `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PATH` yourself.

Then publish the release:

```bash
npm run release:github
```

That command:

- builds both `aarch64-apple-darwin` and `x86_64-apple-darwin`
- signs the updater bundles
- generates `latest.json` for the Tauri updater
- creates or updates the matching GitHub Release on `hellorashid/daily`

## Current Scope

This repo is intentionally focused on the single-window menu bar MVP:

- sticky header with date navigation
- in-app settings for choosing the notes folder
- local markdown note creation and autosave
- simple Finder open action for the selected folder
