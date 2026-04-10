# Documentation Guide (`DOC.md`)

This file defines how to document code files in this repository.

## Goals

- Help new contributors understand module boundaries quickly.
- Explain non-obvious behavior and tradeoffs.
- Keep comments concise and useful.
- Avoid stale or redundant commentary.

## What To Document

### 1) File-Level Module Header (required for new modules)

Add a short header comment near the top of the file (about 5-10 lines).

Include:
- What this module owns.
- What this module does **not** own.
- Main inputs/outputs.
- Important side effects (if any).

### 2) Exported API Docs (required)

Document exported functions, classes, and exported complex types with JSDoc.

Include:
- Purpose.
- Key parameters and return value.
- Important guarantees/caveats.

Skip long prose. Keep it direct.

### 3) Inline Comments (selective)

Use inline comments only for logic that is hard to infer from code.

Good candidates:
- Timer coordination and cancellation tokens.
- Race-condition prevention.
- Subtle ordering constraints.
- Data normalization or compatibility behavior.

Do not add comments for obvious statements.

## What Not To Document

- Restating code line-by-line.
- Historical notes that belong in commits/PR descriptions.
- Product-level user docs (belongs in `README.md`).
- Implementation speculation or TODO essays.

## Style Rules

- Prefer plain language and short sentences.
- Explain intent first, then mechanism when needed.
- Keep docs close to the code they describe.
- Update docs in the same change that updates behavior.
- Default to ASCII.

## Templates

### File header template

```ts
/**
 * Owns: <primary responsibility>
 * Out of scope: <what is handled elsewhere>
 * Inputs/Outputs: <important contracts>
 * Side effects: <fs/network/timers/global state> (if applicable)
 */
```

### Exported function template

```ts
/**
 * <One-sentence purpose>.
 *
 * @param <name> <meaning and constraints>
 * @returns <result and key guarantee>
 */
```

### Tricky logic comment template

```ts
// We use a monotonic request token so stale async responses cannot overwrite newer state.
```

## Review Checklist

Before merging, confirm:
- New modules include a clear header.
- Exported APIs are documented.
- Confusing logic has brief rationale comments.
- No noisy or redundant comments were introduced.
- Existing docs were updated if behavior changed.

## Scope and Ownership

- `DOC.md`: code documentation standards.
- `README.md`: project/product usage and setup.
- `docs/` (if added): architecture and deeper design docs.
