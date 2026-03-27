import { useMemo } from "react";
import type { DiffseekActions } from "./types";
import type { DiffOptions, DiffseekEngine } from "@core";

export function useCoreActions({ engine }: { engine: DiffseekEngine }) {
    return useMemo(() => {
        return {
            setSyncMode(enable: boolean) {
                engine.syncMode = enable;
            },

            setEditableInSyncMode(enable: boolean) {
                engine.editableInSyncMode = enable;
            },

            setWhitespaceMode(mode: DiffOptions["whitespace"]) {
                engine.updateDiffOptions({ whitespace: mode });
            },

            updateDiffOptions(options: Partial<DiffOptions>) {
                engine.updateDiffOptions(options);
            },

            resetDiffOptions() {
                engine.replaceDiffOptions(null);
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