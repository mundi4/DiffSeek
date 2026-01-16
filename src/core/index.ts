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
export {
	DEBUG,
	MAX_TOKEN_COUNT,
	COMPUTE_DIFF_TIMEOUT,
	DIFF_COLOR_HUES,
	NUM_DIFF_COLORS,
	BASE_FONT_SIZE,
	EDITOR_PADDING,
	LINE_HEIGHT,
	TOPBAR_HEIGHT,
	EDITOR_SCROLL_MARGIN,
	HANGUL_ORDER,
	VOID_ELEMENTS,
	TEXTLESS_ELEMENTS,
	TEXT_FLOW_CONTAINERS,
	BLOCK_ELEMENTS,
	FRAME_BUDGET_MS,
	ANCHOR_TAG_NAME,
	ANCHOR_CLASS_NAME,
	LINE_TAG,
	MANUAL_ANCHOR_ELEMENT_NAME,
	DIFF_TAG_NAME,
	DIFF_CLASS_NAME,
	MANUAL_ANCHOR_CLASS_NAME,
	ABORT_REASON_CANCELLED,
} from "./constants";

// Image cache
export { clearImageCache, createImageLoader, dumpImageCache } from "./imageCache";
export type { ImageLoadResult } from "./imageCache";

// Utilities
export { getDefaultRendererOptions } from "./Renderer";
export { AnchorFlags } from "./EditorPairer";
export { getDefaultDiffOptions } from "./defaultDiffOptions";
