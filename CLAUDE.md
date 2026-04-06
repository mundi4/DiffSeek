# CLAUDE.md — DiffSeek

Guidance for AI assistants working on this codebase.

## Project Overview

**DiffSeek** is a real-time, browser-based HTML/text diff visualization tool. It compares two documents side-by-side with instant highlighting as you type — no "Run" button.

Key constraints that shape all design decisions:
- Runs entirely in the browser via `file://` protocol (no web server)
- Chromium-only (Edge/Chrome) — no Firefox support
- Completely offline — designed for air-gapped corporate environments
- Output is a single self-contained HTML file with all assets inlined

## Repository Structure

This is an **npm workspaces monorepo** with two packages:

```
/
├── core/              # Diff engine — zero React dependency
│   ├── src/
│   │   ├── engine/        # DiffseekEngine orchestrator + diff pipeline
│   │   ├── diff/          # Histogram & patience diff algorithms
│   │   ├── tokenization/  # HTML/text tokenizer (Korean law doc support)
│   │   ├── editor/        # contentEditable wrapper
│   │   ├── renderer/      # Canvas-based highlight rendering
│   │   ├── sanitize/      # HTML sanitization on paste
│   │   ├── diff-worker/   # Web Worker for off-thread diffing
│   │   ├── palette/       # Color schemes
│   │   ├── constants/     # VOID_ELEMENTS and other maps
│   │   ├── utils/         # Shared utilities
│   │   ├── types.ts       # Shared types (Span, Palette, DiffEntry, etc.)
│   │   └── index.ts       # Public API exports
│   └── tests/             # Unit tests (tokenizer, etc.)
├── app/               # React UI
│   ├── src/
│   │   ├── bridge/        # useCoreBinding, useCoreActions (engine ↔ atoms)
│   │   ├── components/    # React UI components
│   │   ├── states/        # Jotai atoms
│   │   ├── hooks/         # Custom React hooks
│   │   ├── App.tsx        # Root component
│   │   └── main.tsx       # React entry point
│   ├── index.html
│   └── vite.config.ts
├── test/              # Integration tests
├── scripts/           # Build orchestration (build.ts)
├── package.json       # Monorepo root, npm workspaces
├── vitest.config.ts   # Test config (jsdom environment)
└── tsconfig.base.json # Shared TypeScript config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.9 (strict, ES2024) |
| UI framework | React 19.2 |
| Build tool | Vite 8 + Rolldown |
| State management | Jotai 2.18 |
| UI components | Mantine 8.3, Tabler Icons |
| Optimizer | React Compiler (`@rolldown/plugin-babel`) |
| Test runner | Vitest 4.1 (jsdom environment) |

## Development Workflows

### Install
```bash
npm install
```

### Dev server
```bash
npm run dev          # Vite HMR at http://localhost:8200
```

The `@core` alias points to `core/src` during development. If you change files in `core/src`, changes are picked up automatically via the alias. No separate compilation step needed for dev.

### Production build
```bash
npm run build        # Runs scripts/build.ts
```

The build script does the following in order:
1. Compiles `core/` via `tsc` → `core/dist/`
2. **Temporarily** rewrites `app/vite.config.ts` to point `@core` → `core/dist/` (required for TypeScript `const enum` inlining by esbuild)
3. Runs Vite build → `app/dist/index.html` (single self-contained file)
4. Restores `app/vite.config.ts` to the dev alias (`core/src`)

**Do not manually edit `app/vite.config.ts` during a build.** The build script modifies and restores it automatically.

### Tests
```bash
npm run test         # Run all tests (vitest)
npm run test:ui      # Interactive vitest UI
```

Test results are written to `test-results.json`. Tests use a jsdom environment to simulate the DOM.

## Key Source Files

### Core engine

| File | Purpose |
|------|---------|
| `core/src/engine/diffseek-engine.ts` | Central orchestrator; manages editors, diff pipeline, events, keyboard shortcuts |
| `core/src/engine/diff-pipeline.ts` | Coordinates tokenize → diff → render workflow |
| `core/src/engine/anchor-manager.ts` | Identifies matching line pairs for sync mode alignment |
| `core/src/diff/run-histogram-diff.ts` | Primary diff algorithm (histogram-based) |
| `core/src/diff/patience-diff.ts` | Fallback diff for large files |
| `core/src/diff/get-default-diff-options.ts` | Default `DiffOptions` values |
| `core/src/tokenization/tokenize.ts` | Tokenizes HTML/text into semantic units; Korean law heading support |
| `core/src/editor/editor.ts` | `contentEditable` wrapper with debounced tokenization and undo/redo |
| `core/src/renderer/Renderer.ts` | Canvas-based highlight rendering, scroll-synced |
| `core/src/sanitize/sanitize.ts` | Sanitizes pasted HTML; whitelist-based |
| `core/src/diff-worker/worker.ts` | Web Worker entry point for off-thread diff computation |
| `core/src/palette/default-palette.ts` | Default color scheme |
| `core/src/index.ts` | Public API: `DiffseekEngine`, `getDefaultDiffOptions`, palette exports |
| `core/src/types.ts` | Shared types: `Span`, `Palette`, `DiffEntry`, `DiffOptions` |

### App UI

| File | Purpose |
|------|---------|
| `app/src/App.tsx` | Root component; creates engine instance, mounts DOM, keyboard handlers |
| `app/src/main.tsx` | React entry point with Mantine provider |
| `app/src/bridge/useCoreBinding.ts` | Subscribes to engine events and syncs them into Jotai atoms |
| `app/src/bridge/useCoreActions.ts` | Action dispatch layer (calls engine methods from UI) |
| `app/src/states/coreAtoms.ts` | All Jotai atoms (sync mode, diff options, diff context, etc.) |
| `app/src/components/sidebar-footer.tsx` | Sidebar footer bar (sync/whitespace toggles, diff status) |
| `app/src/components/OptionsModal.tsx` | Diff algorithm options dialog |
| `app/src/components/DiffList.tsx` | Sidebar list of all diffs |
| `app/src/components/OutlineModal.tsx` | Document outline (F9) |
| `app/src/components/BusyIndicator.tsx` | Loading spinner during diff computation |

## Architecture Patterns

### Strict core/app separation
`core/` has **zero React dependency**. It is pure TypeScript DOM logic. `app/` is React UI only. Never add React imports to `core/`.

### Event-driven bridge
The engine emits typed events (`statusChanged`, `diffContextChanged`, `syncModeChanged`, etc.). The bridge layer (`useCoreBinding.ts`) subscribes and writes to Jotai atoms. React components only read atoms — they never call engine methods directly (they go through `useCoreActions`).

### Web Worker for diffing
Heavy diff computation runs in a Web Worker (`diff-worker/worker.ts`) to avoid blocking the main thread. DOM-dependent steps (tokenization, rendering) still run on the main thread.

### Canvas highlight rendering
Diff highlights are drawn on a `<canvas>` overlay, not injected into the DOM. This is intentional — injecting DOM nodes during editing breaks cursor position and Korean IME (Input Method Editor) composition state. The canvas is redrawn on every scroll and resize.

### Const enum build trick
TypeScript `const enum` values must be inlined at compile time. During production build, `scripts/build.ts` temporarily rewrites the `@core` alias in `app/vite.config.ts` to point to the compiled `core/dist/` so esbuild can inline them. The alias is restored after the build completes.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `DiffseekEngine`, `Renderer` |
| Functions/methods | camelCase | `tokenize`, `buildDiffInput` |
| Constants | SCREAMING_SNAKE_CASE | `VOID_ELEMENTS`, `MAX_LENGTH_FOR_EXECCOMMAND_PASTE` |
| Files (utilities) | kebab-case | `run-histogram-diff.ts`, `get-diff-hue.ts` |
| Jotai atoms | camelCaseAtom | `syncModeAtom`, `diffContextAtom` |
| Path aliases | `@core` → `core/src`, `@` → `app/src` | `import { ... } from "@core/types"` |

## Critical Design Decisions

These are load-bearing decisions. Do not change them without understanding the full rationale.

1. **No "Run" button** — Diffs update in real-time on every keystroke. Tokenization is debounced 200ms; diffing runs immediately after. Do not add artificial delays.

2. **Canvas rendering for highlights** — DOM injection for highlights was abandoned because it breaks cursor position and Korean IME composition. Canvas redraws are fast and non-destructive to the DOM.

3. **Sync mode is read-only** — When sync mode is enabled (F2), editors become non-editable. Allowing edits during alignment causes cursor and scroll instability due to DOM re-layout from padding injection.

4. **Single-file IIFE output** — The build produces one `index.html` with everything inlined (assets limit: 4MB+). This is required for `file://` protocol deployment. Do not add code splitting or external chunks.

5. **`execCommand` for paste** — `document.execCommand("insertHTML", ...)` is used for small pastes because it preserves undo/redo history. It's skipped for large documents (too slow; deprecated and unoptimized by browsers). Large paste operations intentionally break undo history.

6. **Diff colors are carefully chosen** — The color palette avoids red tones (poor contrast on white backgrounds). Do not casually change palette values.

7. **`app/vite.config.ts` is auto-modified during build** — The build script rewrites and restores the alias. Do not commit a version of `vite.config.ts` that points to `core/dist/`.

## Keyboard Shortcuts

| Key | Action | Implementation |
|-----|--------|----------------|
| F2 | Toggle sync (alignment) mode | `engine.syncMode = !engine.syncMode` |
| F9 | Open document outline modal | `setOutlineOpened(true)` |
| Alt+1 | Paste to left editor | `engine.pasteBomb("left")` |
| Alt+2 | Paste to right editor | `engine.pasteBomb("right")` |
| Ctrl+↑/↓ | Scroll nudge | `engine.scrollNudge(side, direction)` |

## State Persistence

Jotai's `atomWithStorage` persists these to `localStorage`:

| Key | Atom | Description |
|-----|------|-------------|
| `diffseek_diffOptions` | `diffOptionsAtom` | Diff algorithm settings (whitespace mode, patience options, etc.) |
| `diffseek_editableInSyncMode` | `editableInSyncModeAtom` | Whether editors are editable in sync mode |

## Public Engine API

```typescript
import { DiffseekEngine, getDefaultDiffOptions } from "@core";

const engine = new DiffseekEngine();
document.body.appendChild(engine.workspaceEl);

// Events
engine.on("diffContextChanged", (ctx) => { /* ctx.diffs, ctx.timing */ });
engine.on("statusChanged", (status) => { /* "idle" | "tokenizing" | "diffing" | ... */ });
engine.on("syncModeChanged", (enabled) => { /* boolean */ });

// Options
engine.updateDiffOptions({ whitespace: "collapse" });

// Sync mode
engine.syncMode = true;    // F2 toggles this
```

## DiffOptions Reference

```typescript
type DiffOptions = {
  whitespace: "collapse" | "ignore";      // Normalize or fully ignore whitespace
  mergeNonWordTokens: boolean;            // Merge punctuation into adjacent tokens
  mergeLetterNumberBoundary: boolean;     // Treat "英1" as one token vs two
  allowStandaloneLawArticle: boolean;     // Korean law article number recognition
  usePatience: boolean;                   // Use patience diff for large files
  patienceMinLines: number;               // Line threshold to activate patience diff
  patienceMinTokens: number;              // Token threshold to activate patience diff
  localSAHybridRatio: number;             // Balance between SA and LCS scoring
};
```

## Known Constraints & Limitations

- **Chromium only** — Edge and Chrome. Firefox lacks required behavior for `contentEditable` and canvas compositing.
- **`file://` protocol** — Must be opened as a local file, not served via HTTP/HTTPS.
- **Completely offline** — No fetch/XHR calls. No CDN dependencies.
- **Corporate DRM clipboard delays** — Pasting from DRM-protected apps (e.g., Word with DRM) may silently paste the previous clipboard content. Retry Ctrl+V until it succeeds.
- **Large file performance** — Performance degrades with 100k+ tokens. The patience diff fallback helps but doesn't eliminate this.
- **No undo after large paste** — `execCommand` is bypassed for large content; the undo stack is not updated.
- **No image comparison** — A pixel-comparison feature using `pixelmatch` was explored and removed; results were unsatisfactory.
