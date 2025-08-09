import type { RichToken } from "./tokenization/TokenizeContext";

export interface EditorContext {
	tokens: readonly RichToken[];
	getTokenRange(index: number, end?: number): Range;
	findTokenOverlapIndices(range: Range): Span | null;
}
