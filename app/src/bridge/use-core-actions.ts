import { useMemo } from "react";
import type { DiffseekActions } from "./types";
import type { DiffOptions, DiffseekEngine, DiffseekOptions, GetTextForTokenSpanOptions, Span } from "@core";

export function useCoreActions({ engine }: { engine: DiffseekEngine }) {
	return useMemo(() => {
		return {
			setSyncMode(enable: boolean) {
				engine.syncMode = enable;
			},

			setWhitespaceMode(mode: DiffOptions["whitespace"]) {
				engine.updateDiffOptions({ whitespace: mode });
			},

			applyOptions(options: DiffseekOptions) {
				engine.updateDiffOptions(options.diff);
				engine.editableInSyncMode = options.editableInSyncMode;
			},

			resetOptions() {
				engine.replaceDiffOptions(null);
				engine.editableInSyncMode = false;
			},

			scrollToDiff(diffIndex: number, side: "left" | "right" | "both", options?: ScrollIntoViewOptions) {
				engine.scrollToDiff(diffIndex, side !== "both" ? side : undefined, options);
			},

			setHoveredDiff(diffIndex: number | null) {
				engine.setHoveredDiff(diffIndex);
			},

			getTextForTokenSpan(side: "left" | "right", span: Span, options?: GetTextForTokenSpanOptions) {
				return engine.getTextForTokenSpan(side, span, options);
			},

			segmentSpanPair(leftSpan: Span, rightSpan: Span) {
				return engine.segmentSpanPair(leftSpan, rightSpan);
			},
		} satisfies DiffseekActions;
	}, [engine]);
}
