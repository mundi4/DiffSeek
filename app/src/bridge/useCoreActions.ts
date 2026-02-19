import { useMemo } from "react";
import type { DiffseekActions } from "./types";
import type { DiffOptions, DiffseekEngine } from "@core";

export function useCoreActions({ engine }: { engine: DiffseekEngine }) {
    return useMemo(() => {
        return {
            setSyncMode(enable: boolean) {
                engine.syncMode = enable;
            },

            setWhitespaceMode(mode: DiffOptions["whitespace"]) {
                engine.updateDiffOptions({ whitespace: mode });
            },

            scrollToDiff(diffIndex: number, side: "left" | "right" | "both", options?: ScrollIntoViewOptions) {
                engine.scrollToDiff(diffIndex, side !== "both" ? side : undefined, options);
            },

            setHoveredDiff(diffIndex: number | null) {
                engine.setHoveredDiff(diffIndex);
            }

        } satisfies DiffseekActions;

    }, [engine])
}