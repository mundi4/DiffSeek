import type { DiffOptions, DiffseekOptions, GetTextForTokenSpanOptions, Span } from "@core";

export type DiffseekActions = {
	setSyncMode(enable: boolean): void;

	setWhitespaceMode(mode: DiffOptions["whitespace"]): void;

	applyOptions(options: DiffseekOptions): void;

	resetOptions(): void;

	scrollToDiff(diffIndex: number, side: "left" | "right" | "both", options?: ScrollIntoViewOptions): void;

	setHoveredDiff(diffIndex: number | null): void;

	getTextForTokenSpan(side: "left" | "right", span: Span, options?: GetTextForTokenSpanOptions): string | null;

	segmentSpanPair(leftSpan: Span, rightSpan: Span): { left: Span | null; right: Span | null }[];
};
