// Core classes - DOM-based, React-independent
export { DiffController } from "./DiffController";
export { Editor } from "./Editor";
export { Renderer } from "./Renderer";
export { DiffContext } from "./DiffContext";
export { DiffProcessor } from "./DiffProcessor";
export { EditorPairer } from "./EditorPairer";
export { DiffSeekApp } from "./DiffSeekApp";
export type { DiffSeekAppOptions } from "./DiffSeekApp";

// Core types
export type { EditorName } from "./types";
export type { EditorContext } from "./EditorContext";
export type { DiffInitEvent, DiffStartEvent, TextSelectionEvent, EditorTextSelection } from "./DiffController";
export type { EditorCallbacks } from "./Editor";
export type { RendererCallbacks, RendererOptions, RenderViewport } from "./Renderer";

// Tokenization exports
export { TokenFlags } from "./tokenization/TokenFlags";
export { tokenize } from "./tokenization/TokenizeContext";
export type { RichToken, TokenizeResult } from "./tokenization/TokenizeContext";

// Constants
export * from "./constants";

// Image cache
export { clearImageCache, createImageLoader, dumpImageCache } from "./imageCache";
export type { ImageLoadResult } from "./imageCache";

// Utilities
export { getDefaultRendererOptions } from "./Renderer";
export { AnchorFlags } from "./EditorPairer";
