# DiffSeek Core

This directory contains the **core engine** of DiffSeek - a React-independent, DOM-based diff visualization library.

## Architecture

The core is built on three main pillars:

### 1. **DOM-based** (Not React-dependent)
- Uses native DOM APIs and Canvas for rendering
- No React, Vue, or other framework dependencies
- Can be integrated with any UI framework or used standalone

### 2. **Real-time Diff Processing**
- Tokenization of HTML/text content
- Web Worker-based diff computation
- Incremental rendering without blocking the UI

### 3. **Visual Rendering**
- Canvas-based diff highlighting
- Precise pixel-perfect positioning
- Smooth scrolling synchronization

## Key Components

### Editor (`Editor.ts`)
- Wraps a `contenteditable` div
- Tokenizes content changes
- Manages DOM mutations efficiently
- Provides callbacks for content changes, scrolling, focus, etc.

### Renderer (`Renderer.ts`)
- Canvas-based rendering of diff highlights
- Two-layer rendering (diffs + highlights)
- Viewport-aware rendering for performance
- Customizable styling options

### DiffController (`DiffController.ts`)
- Orchestrates the diff workflow
- Coordinates Editor and Renderer
- Manages diff computation via Web Worker
- Handles editor synchronization and pairing

### DiffSeekApp (`DiffSeekApp.ts`)
- High-level standalone application class
- Provides simple API for using core without React
- Manages lifecycle of all components
- Example usage:

```typescript
import { DiffSeekApp } from '@/core';

const app = new DiffSeekApp({
  leftContainer: document.getElementById('left'),
  rightContainer: document.getElementById('right'),
  rendererContainer: document.getElementById('renderer')
});

await app.setLeftContent('<p>Hello world</p>', true);
await app.setRightContent('<p>Hello world!</p>', true);
```

## Exports

The core exports all necessary classes, types, and utilities:

```typescript
// Main classes
export { DiffSeekApp, DiffController, Editor, Renderer }

// Supporting classes
export { DiffContext, DiffProcessor, EditorPairer }

// Types
export type { EditorName, EditorContext, DiffOptions, ... }

// Tokenization
export { TokenFlags, tokenize }

// Constants and utilities
export * from './constants'
```

## Integration

### Standalone Usage
Use `DiffSeekApp` for a complete, batteries-included solution.

### Custom Integration
1. Create `Editor` instances for left and right
2. Create a `Renderer` instance with the editors
3. Create a `DiffController` with editors, renderer, and options
4. Mount editors and renderer to your DOM
5. Set content and start diff workflow

### React Integration
The React layer (in `src/hooks` and `src/components`) wraps the core:
- `DiffControllerProvider` creates and manages core instances
- React components mount/unmount core instances via refs
- Jotai atoms provide state synchronization with React

## Design Principles

1. **Separation of Concerns**: Core logic is separate from UI framework
2. **Performance**: Web Worker for heavy computation, Canvas for rendering
3. **Flexibility**: Customizable options, styling, and callbacks
4. **Browser Native**: Leverages browser's built-in features (contenteditable, canvas, etc.)

## Files Structure

```
core/
├── index.ts                    # Main exports
├── DiffSeekApp.ts             # Standalone application class
├── DiffController.ts          # Main orchestrator
├── Editor.ts                  # Content editor
├── Renderer.ts                # Canvas renderer
├── DiffProcessor.ts           # Diff computation logic
├── DiffContext.ts             # Diff result container
├── EditorPairer.ts            # Editor synchronization
├── EditorContext.ts           # Editor interface
├── types.ts                   # Core types
├── constants/                 # Constants
├── tokenization/              # Text tokenization
├── worker/                    # Web Worker for diff
└── utils/                     # Core utilities
```

## No React Dependencies

This core directory has **zero React dependencies**. It uses only:
- Native DOM APIs
- Canvas API
- Web Workers
- TypeScript

This design allows:
- Using DiffSeek in non-React applications
- Testing core logic independently
- Future framework migrations without rewriting core logic
- Clear separation between business logic and UI
