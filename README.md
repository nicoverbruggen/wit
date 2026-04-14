<p align="center">
  <img src="icon.svg" alt="Wit" width="72" height="72">
</p>

<h1 align="center">Wit</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/github/package-json/dependency-version/nicoverbruggen/wit/dev/electron?logo=electron&logoColor=white&color=47848F" alt="Electron">
  <img src="https://img.shields.io/github/package-json/dependency-version/nicoverbruggen/wit/dev/typescript?logo=typescript&logoColor=white&color=3178C6" alt="TypeScript">
  <img src="https://img.shields.io/github/package-json/v/nicoverbruggen/wit" alt="Version">
</p>

**Wit** is an Electron desktop app for long-form writing in local plain-text projects, with autosave, zipped full-project snapshots, and optional Git snapshot commits (currently behind a feature flag).

> "There's always another text document to edit."

## Features

- Opens a local project folder and builds a file tree for supported writing files
- Supports `.txt`, `.md`, `.markdown`, and `.text` files
- Creates, renames, moves, and deletes files/folders from the UI (including context menus and drag/drop moves)
- Saves with `Cmd/Ctrl+S` and autosaves on a configurable interval (minimum `5s`)
- Tracks project word count and accumulated writing time
- Creates project snapshots as zip archives in `.wit/snapshots/*.zip`
- Optionally creates Git commits during snapshots (Git repo only), with optional remote push
- Persists per-project settings (writing, editor, autosave, Git snapshot behavior)
- Restores the last opened project and last opened file on relaunch
- Includes light/dark theme, smart quotes, editor typography controls, and sidebar visibility/size controls

## Data on Disk

Wit stores project metadata in a hidden `.wit` directory inside each project:

- `.wit/config.json`: project settings and last opened file path
- `.wit/stats.json`: accumulated writing time
- `.wit/snapshots/version.json`: snapshot storage version
- `.wit/snapshots/<timestamp>.zip`: full-project zip snapshots
- `.wit/snapshots/latest.json`: rolling manifest listing files in the most recent snapshot (used to detect file-list changes)

Additional behavior:

- If a project has no `.gitignore`, Wit creates one with `.wit/snapshots/`
- Last opened project path is stored in Electron user data as `last-project.json` (outside the project folder)
- Snapshots are full backups (not incremental diffs)
- A new snapshot archive is only created when files or the file list have changed since the latest snapshot

## Project Settings

Stored per project in `.wit/config.json`:

- Writing: show word count, show writing time, show current-file bar, smart quotes, default new-file extension
- Editor: theme (`light`/`dark`), font family, text zoom (`50-250%`), line height (`1.2-2.4`), paragraph spacing, max width (`360-1200px`)
- Autosave/Snapshots: autosave interval, snapshot storage size limit, Git snapshots, push remote (`Don't push` by default)

## Shortcuts

- `Cmd/Ctrl+O`: Open project
- `Cmd/Ctrl+N`: New file
- `Cmd/Ctrl+S`: Save current file
- `Cmd/Ctrl+B`: Toggle sidebar
- `Cmd/Ctrl+=`: Zoom in editor text
- `Cmd/Ctrl+-`: Zoom out editor text
- `Cmd/Ctrl+0`: Reset editor text zoom
- Fullscreen toggle is available from the toolbar and app menu

## Development

```bash
npm install
npm run start
```

`npm run dev` is currently an alias for `npm run start`.

UI assets bundled at build time include Inter (UI), Material Symbols (icons), and the packaged writing fonts in `font/`.

## Scripts

```bash
npm run clean
npm run build
npm run start
npm run lint
npm run typecheck
npm run test:core
npm run test:e2e
npm test
```

## Packaging

```bash
npm run dist:mac
npm run dist:linux
npm run dist:win
```

### macOS notarization

To prepare macOS notarization credentials with Apple's `notarytool`, store a reusable Keychain profile on the machine that performs the release build:

```bash
xcrun notarytool store-credentials "wit-notary" \
  --apple-id "you@example.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "abcd-efgh-ijkl-mnop"
```

After that succeeds, export the profile name before building:

```bash
export APPLE_KEYCHAIN_PROFILE="wit-notary"
```

You can verify that the saved profile is available with:

```bash
xcrun notarytool history --keychain-profile "wit-notary"
```

After building, validate the signed and notarized app bundle:

```bash
spctl -a -vvv -t exec "release/mac-arm64/Wit.app"
xcrun stapler validate "release/mac-arm64/Wit.app"
```

`spctl` should report `accepted` with `source=Notarized Developer ID`, and `stapler validate` should succeed.

Helper scripts:

- `build/build_macos.sh`
- `build/build_linux.sh`
- `build/build_windows.sh`

## Project Structure

- `src/main`: Electron main process, IPC handlers, project/session/snapshot services
- `src/preload`: secure renderer API bridge
- `src/renderer`: HTML, CSS, and renderer-side UI logic
- `src/shared`: shared IPC/types/utilities/defaults
- `tests/core`: Node test runner service and contract tests
- `tests/e2e`: Playwright Electron end-to-end tests
