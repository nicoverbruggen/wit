# Wit

Wit is a minimalist Electron desktop app for writing books/novels in plain text projects.

This repository now contains a first working prototype built with:

- Electron
- TypeScript
- HTML + CSS

## What the prototype does

- Opens a project directory and lists plain text/markdown files in a sidebar
- Lets you create new writing files (`.txt`, `.md`, `.markdown`, `.text`)
- Edits the selected file in a distraction-light editor
- Saves manually with `Cmd/Ctrl + S`
- Autosaves on a configurable interval (default: 60s)
- Saves on window close (sync save for unsaved current file)
- Stores snapshot system version metadata in `.wit/snapshots/version.json`
- Creates compressed full snapshots under `.wit/snapshots/<timestamp>.json.gz` on each autosave tick
- Optionally runs git snapshot commits on each snapshot (setting toggle)
- Tracks total writing time in `.wit/stats.json` based on active typing intervals
- Shows total project word count (toggleable)
- Applies smart quotes while typing (toggleable)
- Supports zoom in/out/reset controls

## Project structure

- `src/main`: Electron main process, IPC, project/snapshot services
- `src/preload`: secure preload bridge API
- `src/renderer`: HTML/CSS/UI logic
- `src/shared`: shared TypeScript types
- `build`: platform build scripts

## Local development

```bash
npm install
npm run start
```

## Quality scripts

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

## Notes

- The app stores internal metadata in a hidden `.wit` directory inside the selected writing project.
- A custom font slot is available in `src/renderer/assets/fonts/`; the current prototype defaults to serif fallbacks aimed at long-form writing comfort.
