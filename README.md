# Wit

Wit is a minimalist Electron desktop app for writing long-form plain text projects.

It is built around local project folders, a distraction-light editor, project-scoped settings, automatic saves, and compressed full-project snapshots.

## Features

- Open a project directory and browse plain text or markdown files in the sidebar
- Create, rename, move, and delete project files and folders from the UI
- Use sidebar context menus for project, folder, and file actions
- Resize, hide, and restore the project sidebar from the main window chrome
- Edit the selected file in a centered writing view
- See centered empty states when no project or no file is open, including shortcut hints
- Save manually with `Cmd/Ctrl+S`
- Autosave on a configurable interval
- Create compressed full snapshots in `.wit/snapshots/<timestamp>.json.gz`
- Store snapshot storage version metadata in `.wit/snapshots/version.json`
- Optionally create Git commits during snapshots when the project is a Git repository
- Optionally choose a Git remote for automatic snapshot pushes, or leave it on `Don't push`
- Track total project writing time and word count
- Toggle footer metrics and the current-file bar from Project Settings
- Adjust editor font, text zoom, line height, and max width from Project Settings
- Toggle the sidebar and fullscreen from the top-left toolbar
- Restore the latest snapshot label when reopening a project

## Snapshot Storage

Wit stores its internal data in a hidden `.wit` directory inside the project.

Snapshot data currently uses:

- `.wit/snapshots/version.json` for the snapshot storage format version
- `.wit/snapshots/<timestamp>.json.gz` for each compressed full-project snapshot

Snapshots are full text backups rather than incremental diffs.

If a project is a Git repository, snapshot creation can also create a Git commit. Pushes are opt-in and target the selected remote only.

## Project Settings

Settings are stored per project in `.wit/config.json`.

Current settings include:

- Writing display options such as word count, writing time, and the current-file bar
- Editor appearance controls such as font, text zoom, line height, and max width
- Autosave interval
- Git snapshot behavior, including commit creation and optional remote selection

## Project Structure

- `src/main`: Electron main-process code, IPC handlers, project services, snapshot services
- `src/preload`: secure renderer bridge
- `src/renderer`: HTML, CSS, and renderer-side UI logic
- `src/shared`: shared TypeScript types
- `tests/core`: fast contract and service tests
- `tests/e2e`: Playwright Electron end-to-end tests

## Local Development

```bash
npm install
npm run start
```

The app is bundled with local fonts and Material Symbols for its UI icons.

## Quality Scripts

```bash
npm run typecheck
npm run lint
npm run build
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
