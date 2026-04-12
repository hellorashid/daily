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

## Current Scope

This repo is intentionally focused on the single-window menu bar MVP:

- sticky header with date navigation
- in-app settings for choosing the notes folder
- local markdown note creation and autosave
- simple Finder open action for the selected folder
