import { diffsAtom, visibleDiffIndexesAtom } from "@/states/diffAtoms";
import { hoveredDiffIndexAtom, syncModeAtom, whitespaceHandlingAtom } from "@/states/viewAtoms";
import type { DiffseekEngine } from "@core/DiffseekEngine";
import type { DiffOptions } from "@core/types";
import { getDefaultStore, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";

export function useCoreBinding({ engine }: { engine: DiffseekEngine }) {
    const setDiffs = useSetAtom(diffsAtom);
    const setSyncMode = useSetAtom(syncModeAtom);
    const setWhitespaceHandling = useSetAtom(whitespaceHandlingAtom);
    const setVisibleDiffIndexes = useSetAtom(visibleDiffIndexesAtom);
    const setHoveredDiffIndex = useSetAtom(hoveredDiffIndexAtom);

    useEffect(() => {
        const unsub: (() => void)[] = [];

        const store = getDefaultStore();
        const diffOptions: Partial<DiffOptions> = {
            whitespace: store.get(whitespaceHandlingAtom),
        };

        engine.updateDiffOptions(diffOptions);

        setWhitespaceHandling(engine.diffOptions.whitespace);

        unsub.push(engine.on("diffOptionsChanged", (diffOptions) => {
            setWhitespaceHandling(diffOptions.whitespace);
        }));

        unsub.push(engine.on("syncModeChanged", ({ syncMode }) => {
            setSyncMode(syncMode);
        }));

        unsub.push(engine.on('diffContextChanged', (diffContext) => {
            if (diffContext) {
                setDiffs(diffContext.diffs);
            }
            else {
                setDiffs(null);
            }
        }));

        unsub.push(engine.on('diffVisibilityChanged', (visibleDiffs) => {
            setVisibleDiffIndexes({
                left: engine.getVisibleDiffs("left"),
                right: engine.getVisibleDiffs("right"),
            });
        }));

        unsub.push(engine.on('hoveredDiffIndexChanged', (diffIndex) => {
            setHoveredDiffIndex(diffIndex);
        }));




        return () => {
            unsub.forEach((unsubFn) => unsubFn());
        };

    }, [engine]);
}