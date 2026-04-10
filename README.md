# Wit

Wit is an Electron desktop app for long-form writing in local plain-text projects, with autosave, compressed full snapshots, and optional Git snapshot commits.

## Features

- Opens a local project folder and builds a file tree for supported writing files
- Supports `.txt`, `.md`, `.markdown`, `.text`, and `.wxt` files
- Creates, renames, moves, and deletes files/folders from the UI (including context menus and drag/drop moves)
- Saves with `Cmd/Ctrl+S` and autosaves on a configurable interval (minimum `5s`)
- Tracks project word count and accumulated writing time
- Creates compressed project snapshots in `.wit/snapshots/*.json.gz`
- Optionally creates Git commits during snapshots (Git repo only), with optional remote push
- Persists per-project settings (writing, editor, autosave, Git snapshot behavior)
- Restores the last opened project and last opened file on relaunch
- Includes light/dark theme, smart quotes, editor typography controls, and sidebar visibility/size controls

## Data on Disk

Wit stores project metadata in a hidden `.wit` directory inside each project:

- `.wit/config.json`: project settings and last opened file path
- `.wit/stats.json`: accumulated writing time
- `.wit/snapshots/version.json`: snapshot storage version
- `.wit/snapshots/<timestamp>.json.gz`: full-project compressed snapshots

Additional behavior:

- If a project has no `.gitignore`, Wit creates one with `.wit/snapshots/`
- Last opened project path is stored in Electron user data as `last-project.json` (outside the project folder)
- Snapshots are full backups (not incremental diffs)
- A new snapshot archive is only created when files or file list changed since the latest snapshot

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
