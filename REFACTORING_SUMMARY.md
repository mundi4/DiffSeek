# Refactoring Summary: Core/UI Separation

## Overview

This refactoring completed the separation of DiffSeek's core engine from its React UI layer, making the core completely framework-independent while maintaining full compatibility with the existing React application.

## Changes Made

### 1. Enhanced Core Exports (`src/core/index.ts`)

**Before:**
```typescript
export { DiffController, Editor, Renderer };
```

**After:**
Comprehensive exports including:
- Core classes: `DiffController`, `Editor`, `Renderer`, `DiffContext`, `DiffProcessor`, `EditorPairer`, `DiffSeekApp`
- Types: `EditorName`, `EditorContext`, `DiffOptions`, callbacks, etc.
- Tokenization: `TokenFlags`, `tokenize`, `RichToken`
- Constants and utilities
- Image cache functions

### 2. Created DiffSeekApp (`src/core/DiffSeekApp.ts`)

A new standalone application class that provides a high-level API for using DiffSeek without React:

```typescript
const app = new DiffSeekApp({
  leftContainer: document.getElementById('left'),
  rightContainer: document.getElementById('right'),
  rendererContainer: document.getElementById('renderer'),
  diffOptions: { ignoreWhitespace: 'ignore' }
});

await app.setLeftContent('<p>Hello</p>', true);
await app.setRightContent('<p>Hi</p>', true);
```

Features:
- Simple API for content management
- Event subscriptions (onDiffComplete, onDiffStart)
- Sync mode control
- Access to underlying core instances for advanced usage
- Proper cleanup with `destroy()` method

### 3. Documentation

Created three documentation files:

#### `src/core/README.md`
Comprehensive core documentation covering:
- Architecture principles
- Key components (Editor, Renderer, DiffController, DiffSeekApp)
- Usage examples
- Exports reference
- Design principles
- File structure

#### `docs/ARCHITECTURE.md`
High-level architecture documentation in Korean:
- Layer separation diagram
- Core vs UI characteristics
- Integration layer explanation
- Data flow
- Benefits of the architecture
- Usage examples for different scenarios

#### `examples/standalone-core.html`
Conceptual example showing how to use the core standalone (for future reference when building core as a library)

## Architecture

### Three-Layer Structure

```
┌─────────────────────────────────────┐
│  App Layer (React)                  │  ← Components, Jotai atoms
│  src/components, src/states         │
├─────────────────────────────────────┤
│  Integration Layer                  │  ← DiffControllerProvider
│  src/hooks/DiffControllerProvider   │
├─────────────────────────────────────┤
│  Core Layer (Framework-Independent) │  ← Pure DOM/Canvas
│  src/core/                          │     Zero React deps
└─────────────────────────────────────┘
```

### Core Layer
- **Zero React dependencies** ✓
- Pure DOM API and Canvas
- Can be used standalone or with any framework
- Includes all business logic and rendering

### Integration Layer
- `DiffControllerProvider`: Creates core instances once
- `EditorShell`/`RendererShell`: Mount/unmount core to DOM
- Bridges React state (Jotai) with core events

### App Layer
- React components for UI
- Jotai atoms for state management
- Uses core through hooks and context

## Verification

### Build Status
✅ Build successful (`npm run build`)
✅ TypeScript compilation passes
✅ No new errors introduced

### Compatibility
✅ Existing React app works unchanged
✅ All imports resolve correctly
✅ DiffControllerProvider still functional

## Benefits

1. **Clear Separation of Concerns**
   - Core: Business logic and rendering
   - UI: User interface and state management

2. **Framework Independence**
   - Core can be used without React
   - Can integrate with Vue, Angular, Svelte, etc.
   - Can be used in browser extensions, CLI tools, etc.

3. **Better Testability**
   - Core can be tested independently
   - No need for React testing utilities for core logic

4. **Maintainability**
   - Clear boundaries between layers
   - Changes to UI don't affect core
   - Core changes are isolated from React specifics

5. **Reusability**
   - Core can be packaged as standalone library
   - Same core used in React app and browser extension
   - Future-proof for framework migrations

## Migration Path

For applications using DiffSeek:

### Current (React-integrated)
```typescript
import { DiffControllerProvider } from '@/hooks/DiffControllerProvider';

<DiffControllerProvider>
  <App />
</DiffControllerProvider>
```

### New (Standalone)
```typescript
import { DiffSeekApp } from '@/core';

const app = new DiffSeekApp({ /* options */ });
```

### Custom Integration
```typescript
import { Editor, Renderer, DiffController } from '@/core';

// Create instances manually
const left = new Editor('left');
const right = new Editor('right');
const renderer = new Renderer(left, right);
const controller = new DiffController(left, right, renderer, options);

// Mount to DOM
left.mount(leftContainer);
right.mount(rightContainer);
renderer.mount(rendererContainer);
```

## Files Changed

- `src/core/index.ts` - Expanded exports
- `src/core/DiffSeekApp.ts` - New standalone app class
- `src/core/README.md` - Core documentation
- `docs/ARCHITECTURE.md` - Architecture overview
- `examples/standalone-core.html` - Usage example

## No Breaking Changes

All existing code continues to work:
- React components unchanged
- Hooks unchanged
- Import paths unchanged
- Build process unchanged

## Conclusion

The refactoring successfully achieves the goal stated in the issue:
- ✅ Core와 UI 요소 분리 (Core and UI elements separated)
- ✅ Core는 DOM 관련 요소와 renderer 포함 (Core includes DOM elements and renderer)
- ✅ Core는 React에 의존하지 않음 (Core doesn't depend on React)
- ✅ App 레벨에서 두 개를 결합 (Combined at app level via DiffControllerProvider)

The core is now truly framework-independent and can be used standalone or integrated with any UI framework.
