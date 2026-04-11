# Filesystem Observation

## Goal

Pick up external filesystem changes (files/folders added, removed, renamed, modified outside of Wit) and reflect them in the project tree and the open editor — optimized for dense trees (10k+ files) from day one.

## Current state (observations)

The renderer's tree pipeline is full-rebuild on every state change. There is no keyed model, no DOM identity, and no incremental apply path to hook a watcher into.

- `src/renderer/project/tree/view.ts:205` — `renderProjectTreeList` starts with `listElement.innerHTML = ""` and rebuilds every `<li>`, `<button>`, and event listener from scratch on every render.
- `src/renderer/shared/tree-model.ts:132` — `buildProjectTree` rebuilds the nested model from flat `files[]` / `folders[]` arrays on every call. Insertion uses linear `.find()` at each level (`insertPathIntoTree`, `insertFolderIntoTree`), so build cost is O(files × depth × siblings per level). For a dense tree this is already slow before any watcher is involved.
- No `Map<path, TreeNode>`, no `Map<path, HTMLElement>`. Tree node identity is thrown away each render, so there is nothing for an incremental patcher to key off of.
- `src/renderer/project/tree/entry-actions.ts:79` — after every user mutation (create / rename / delete / move), the flow is: wait for main to return fresh `metadata.files` / `metadata.folders` flat arrays → overwrite `project.files` / `project.folders` → call `renderFileList()`. The action pipeline is already "full re-list from main → full rebuild in renderer." A watcher bolted onto this path inherits the same O(n) rebuild cost.
- Upside: main already returns `files` and `folders` pre-sorted (`src/main/project-service/project-files.ts:98`, `:110`), so an O(n) sorted-merge build is trivially achievable — the current code just doesn't exploit it.

**Verdict:** the watcher is the small part. The real work is replacing the full-rebuild renderer with a keyed model and an incremental apply path. Without that, watching makes the UI slower, not more responsive.

## Design principles

1. **Deltas, not full re-lists.** Every change — user-initiated or filesystem-observed — flows as `{ added, removed, changed }` with relative paths. Never send the whole tree again after startup.
2. **One apply path for both sources.** User mutations and watcher events converge on the same `applyDelta` in the renderer. This is the key architectural win: the watcher is "free" once the apply path exists.
3. **Persistent DOM identity.** `<li>` / `<button>` nodes survive across deltas, keyed by path. Selection, scroll position, focus, in-flight rename inputs, drag state all stay intact without reconstruction.
4. **O(log n) sibling insertion.** Sorted sibling arrays with binary-search insertion, not linear `.find()` scans.
5. **Debounce and batch at the source.** The watcher emits coalesced batches; the renderer applies one DOM pass per batch.

## Implementation plan

Single PR, tight scope. Do not touch selection / rename / drag / context-menu semantics — only change *how* the DOM is produced and patched, and add the watcher at the end.

### 1. Keyed tree model (`src/renderer/shared/tree-model.ts`)

Replace the current flat-rebuild model with a keyed, mutable one:

- `ProjectTree` class/struct holding:
  - `nodesByPath: Map<string, TreeNode>`
  - `root: FolderNode` (with stable parent/children refs)
- `TreeNode` gains `parent: FolderNode | null`. Folder children stay as a sorted array but with binary-search insertion.
- Operations:
  - `buildFromSorted(files, folders)` — O(n) initial build that exploits the already-sorted input from main.
  - `addFile(path)`, `addFolder(path)` — create missing ancestor folders, insert at sorted position.
  - `remove(path)` — removes node and, for folders, the whole subtree (purging from `nodesByPath`).
  - `rename(fromPath, toPath)` — if parent is unchanged and only the basename differs, mutate in place to preserve identity; otherwise `remove` + `add` and let the view handle it as a move.
- All operations return a minimal `TreeDelta` describing what changed so the view can patch only those nodes.

### 2. Incremental view (`src/renderer/project/tree/view.ts`)

Replace `renderProjectTreeList` (full rebuild) with two entry points:

- `mountProjectTree(options)` — initial mount. Builds the DOM once using a `DocumentFragment`, populates `elementsByPath: Map<string, HTMLLIElement>`, binds listeners once per node.
- `applyTreeDelta(delta)` — surgical updates:
  - For `added`: create `<li>` / `<button>`, insert into parent `<ul>` at the correct sorted position, record in `elementsByPath`.
  - For `removed`: detach `<li>`, delete from `elementsByPath`. Folder removals cascade.
  - For `changed`: update label text, `title`, current-file marker, dirty dot, aria state — without recreating nodes.
  - For `selection` / `dirty` / `collapsed` changes: patch classes and attributes in place.

Event listeners are bound per-node at creation time and never rebound. Drag-source state keeps working because the `<button>` persists across deltas.

### 3. Action pipeline (`src/main/main.ts` + `src/renderer/project/tree/entry-actions.ts`)

Main's mutation handlers stop returning full `metadata.files` / `metadata.folders` and start returning `TreeDelta` instead:

- `newFile` → `{ added: { files: [path] } }`
- `newFolder` → `{ added: { folders: [path] } }`
- `deleteEntry` → `{ removed: { files: [...], folders: [...] } }` (folder delete expands to the subtree)
- `renameEntry` / `moveFile` → `{ renamed: [{ from, to, kind }] }`

The renderer's `applyProjectMetadataAfterMutation` becomes `applyProjectDelta`, which updates the in-memory model and calls `view.applyTreeDelta`. Word count / writing seconds / settings still come back as side-channel fields on the response, they don't need to become deltas.

### 4. Filesystem watcher (`src/main/project-watcher.ts`)

One watcher per open project.

- **Library**: `chokidar`. Rationale: Node's `fs.watch` with `recursive: true` does not work on Linux, and rolling our own recursive watcher misses atomic-save patterns (Vim's write-to-temp-then-rename), rapid rename chains, and cross-platform case handling. Chokidar absorbs all of that.
- **Config**:
  - `ignored`: mirror `shouldIgnoreDirectory` from `src/main/project-service/project-paths.ts` plus non-text files (use the same `isTextFile` predicate for the file filter).
  - `ignoreInitial: true` — we already have the initial listing from the project-open path.
  - `awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }` — swallows atomic-save unlink+add bursts.
  - `followSymlinks: false`.
- **Event handling**: coalesce on a 30 ms debounce into a single `TreeDelta`. Dedupe within the batch (e.g. add-then-remove within one batch cancels out). Filter every path through `ensureInsideProject` and `isTextFile` before emitting.
- **Rename detection**: chokidar fires `unlink` + `add` for renames. Within one batch, if we see an `unlink` at path A and an `add` at path B with the same basename + same parent, emit `renamed` instead of `removed` + `added` so the view preserves the node's DOM identity (selection, drag state, expansion).
- **Self-write suppression**: Wit's own writes (save, create, rename, delete) would fire the watcher and race with the mutation's own delta response. Suppress by tracking "expected paths" in a short-TTL set (`pendingSelfMutations: Map<path, expiresAt>`), populated by the main-side mutation handlers before they touch disk and cleared once the watcher observes the event (or the TTL expires). Ignore watcher events for paths currently in that set.
- **IPC**: one new channel, `project:tree-delta`, main → renderer. Payload is the coalesced `TreeDelta`. The renderer routes it through the same `applyProjectDelta` as user mutations.
- **Lifecycle**: start watcher on `project:open`, stop and `close()` it on `project:close` and on app quit. Only one active watcher at a time — Wit only has one open project.

### 5. Open-file reconciliation

The editor has to react when the currently open file changes or disappears on disk.

- **`changed` for the open file, buffer clean**: silently reload from disk. Preserve scroll position and cursor if possible.
- **`changed` for the open file, buffer dirty**: show a non-blocking conflict banner in the editor chrome — "File changed on disk" with "Reload (discard my edits)" and "Keep mine (overwrite on save)". Do not auto-reload.
- **`removed` for the open file**: mark the editor as orphaned (banner: "File no longer exists on disk"), do not auto-close, do not auto-save. Next save recreates the file.
- **`renamed` for the open file**: update the editor's tracked path in place, update title/breadcrumbs. No reload, no prompt.

## Out of scope

- Watching outside the project root.
- Detecting content-identical moves across renames (chokidar doesn't help here and the heuristic above is enough for the common case).
- Git-aware filtering beyond what `shouldIgnoreDirectory` already handles (`.git/`, `node_modules/`, etc.).
- Virtual scrolling for the tree itself. The incremental apply path makes 10k files feasible without it; if the tree ever needs 100k+ nodes, revisit.

## Testing

- **Unit** (`tests/core/`): tree model — build-from-sorted correctness, `add`/`remove`/`rename` delta shapes, subtree removal, binary-search insertion keeps sibling order.
- **Unit**: watcher coalescing — add+remove cancellation, rename detection from unlink+add pairs, self-write suppression, ignore filter.
- **E2E** (`tests/e2e/`): create a file externally (via `fs.writeFile` in the test) and assert it appears in the sidebar within a debounce window; delete externally and assert it disappears; rename externally and assert selection/expansion survives; modify the open file externally with a clean buffer and assert it reloads; modify with a dirty buffer and assert the conflict banner appears.
- **Perf sanity**: a dev-only script that generates a 10k-file tree and measures initial mount + one delta apply. No regression gate, just a number to keep honest.

## Rollout

Single PR. The refactor has no user-visible payoff without the watcher, and the watcher has no perf story without the refactor. Splitting them leaves the codebase in a worse intermediate state.
