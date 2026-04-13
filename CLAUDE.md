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

## Diff Engine Internals — What Actually Matters

This section documents load-bearing details of the diff pipeline that are easy to miss and have caused regressions (see "Past regressions" below). Future assistants: read this before touching `run-histogram-diff.ts`, `build-diff-input.ts`, or `helpers.ts`.

### How `whitespace` option reshapes the input buffer

`buildDiffInput` (`core/src/diff/build-diff-input.ts`) materializes the **text buffer** that the diff operates on. Token offsets index into this buffer.

- **`whitespace: "collapse"`** — Inserts a single U+0020 after any token flagged `HAS_FOLLOWING_SPACE` or `LINE_END`, and also normalizes image token surroundings. A token's range `[offsets[i], offsets[i+1])` in the buffer **includes** its trailing normalized space. Example: `"hello world"` → buffer `"hello world "` (two tokens, each with trailing space in its range).
- **`whitespace: "ignore"`** — No spaces are inserted. Tokens are concatenated directly. Example: `"hello world"` → buffer `"helloworld"` (two tokens, back-to-back, no whitespace in between).

### How token IDs work

`buildIdTables` in `run-histogram-diff.ts` assigns each token an ID by hashing the bytes in its buffer range. Two tokens get the same ID iff their buffer slices are byte-equal. In collapse mode this includes the trailing space; in ignore mode it's just the token text.

Key consequence: **the SA/LCP anchor search only matches tokens that are byte-equal in the buffer.** If two sides tokenize the same normalized text into different token boundaries, the SA will not find a match between them.

### Why `consumeCommonEdges` / `matchPrefixTokens` / `matchSuffixTokens` exists

The critical case is `whitespace: "ignore"` when the two sides have identical normalized text but different token boundaries. Examples:

- lhs `"helloworld"` (1 token) vs rhs `"hello world"` (2 tokens) — both normalize to `"helloworld"`.
- lhs `"안녕하세요"` vs rhs `"안녕 하세요"` — both normalize to `"안녕하세요"`.
- lhs `"foo helloworld bar"` vs rhs `"foo hello world bar"` — anchors `"foo"` and `"bar"` line up, but the middle has a tokenization-boundary mismatch.

In these cases token IDs differ, so SA/LCP finds no anchor between the mismatched tokens. The correct result (all UNCHANGED) depends on `consumeCommonEdges` walking the buffer byte-by-byte across token boundaries via `matchPrefixTokens` / `matchSuffixTokens` to detect the cross-boundary match.

In `collapse` mode this machinery is **mostly redundant** because the SA already catches single-token-equality matches, but it is still called for ID-equality prefix/suffix trimming in the anchor branch (cheap, no harm).

### `diffCore` result type semantics

In the "no anchor found" else-branch of `diffCore`, leftover ranges are written with `type = DIFF_TYPE_UNCHANGED | (REMOVED if lhs left) | (ADDED if rhs left)`. So **when both sides have leftover tokens, they all become `DIFF_TYPE_MODIFIED` (0x3)**, not separate REMOVED/ADDED runs. Only ranges where exactly one side is empty produce pure REMOVED or ADDED. Also, the `lhsCount === 1 && rhsCount === 1` fast-path in `diffCore` writes `DIFF_TYPE_MODIFIED` when IDs differ. Tests must expect MODIFIED for tokens in both-sides-have-content regions.

### "Edge-walker" limitation and the small-range n*m fallback

`consumeCommonEdges` walks inward from the outer edges of a sub-range. When both outer edges fail their initial check, the walker terminates without ever examining the interior. Specifically:

- **Prefix walker** — breaks when the first characters of the outermost tokens differ (`lhsBuf[lhsOffset] !== rhsBuf[rhsOffset]`), because `matchPrefixTokens` returns `null` immediately.
- **Suffix walker** — breaks when the last tokens on both sides have the same byte length but different IDs (`if (lLen === rLen) break`). This heuristic is correct in isolation: given equal length and different IDs, no cross-boundary multi-token suffix match can exist that crosses BOTH last-token boundaries. But combined with a blocked prefix, the interior becomes invisible.

**Fallback**: `fallbackGreedyConsume` in `run-histogram-diff.ts` handles this when the sub-range is small. It's invoked from `diffCore`'s no-anchor `else` branch when:

1. `whitespace: "ignore"` mode
2. `n * m <= FALLBACK_NM_THRESHOLD` (currently `128`)

The function scans `(i, j)` starting-position pairs in **anti-diagonal order** (`d = i + j` increasing), calling `matchPrefixTokens(lhs, rhs, lhsLo+i, lhsHi, rhsLo+j, rhsHi)` on each. First match wins — since the range is small, the earliest "from-the-front" match is natural. Then:

- Tokens **before** the match on each side → emitted as `REMOVED`/`ADDED`/`MODIFIED` (whichever applies)
- The match itself → emitted as `UNCHANGED` (asymmetric n:m OK — `writeToResultBuffer` handles both sides independently)
- Cursor advances past the match, and the loop re-scans the remaining sub-range for more matches (greedy multi-match)
- Any final leftover → emitted as `REMOVED`/`ADDED`/`MODIFIED`

Total work is bounded by the initial `n * m` (each `(i, j)` pair is examined at most once across all iterations, because the cursor only advances). With early-exit on first match, typical cases are much cheaper.

**Why not in `findAnchor`?** `findAnchor` returns a single anchor, but the fallback naturally finds multiple sequential matches once it has paid the n*m cost. Doing the greedy multi-match directly in `diffCore.else` avoids recursion overhead.

**Why `else` branch only?** `findAnchor`'s SA/LCP path is called first. When SA finds a token-level anchor, the algorithm recurses into before/after sub-ranges, and at leaf sub-ranges where SA finds nothing, `diffCore` reaches the `else` branch and the fallback kicks in. So the fallback organically covers all deep recursion leaves, not just top-level no-anchor cases.

**Why asymmetric anchors are allowed now**: `diffCore`'s anchor branch still enforces symmetric SA anchors (`lhsEnd - lhsStart === rhsEnd - rhsStart`). The fallback bypasses the anchor path entirely and writes matches directly to the result buffer, so the symmetric invariant on SA anchors stays intact.

### Past regressions — do not repeat

- **PR #110 (reverted)** removed `consumeCommonEdges` and related helpers, claiming SA/LCP made it redundant. That claim was true for `collapse` mode but **false** for `ignore` mode whenever the two sides tokenize the same normalized text differently. The PR's test suite did not cover whitespace-ignore with differing tokenization, so it merged clean and broke ignore-mode silently. The PR was reverted in `claude/revert-pr-110-GHyGX` and dedicated test blocks were added to `core/tests/run-histogram-diff.test.ts` (`describe('runHistogramDiff whitespace: ignore')` and `describe('runHistogramDiff whitespace: collapse')`) to lock in the behavior. Any future attempt to remove or simplify that code path must first ensure those tests still pass.
- The three original `PROBE FAIL` tests in `run-histogram-diff.test.ts` (`"bc ef h"` vs `"a bce fh j"`, `"X abc Y"` vs `"Z a b c W"`, `"hello abcxyz end"` vs `"bye abc xyz fin"`) were originally failing limitation probes; they now pass thanks to the n*m fallback. They stay as regression tests — any change to the fallback threshold or the anti-diagonal scan order must keep them passing.

### Testing notes

- `makeInputFromHtml(html, opts)` in `core/tests/run-histogram-diff.test.ts` takes an optional `DiffOptions`. **Pass the same options to both `buildDiffInput` and `runHistogramDiff`** — the two must agree or the test setup is inconsistent.
- Use the `diffHtml(lhsHtml, rhsHtml, whitespace)` helper for end-to-end whitespace-mode tests.
- `contentTokenTypes(input)` skips structural tokens (tables, paragraphs) and returns `{text, type}` for each content token, which is the easiest way to assert specific tokens by text.
- Debug logs `Total intervals processed: X, Prune1 count: Y` come from HEAD's in-file debug counters — don't strip them without checking with the author first.
- The test file polyfills `scheduler.yield` in a `beforeAll` hook because large tokenization inputs trigger the browser-only `scheduler.yield()` call in `tokenize.ts`. Any new test with >256 tokens or long content runs will hit this if the polyfill is missing.

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
