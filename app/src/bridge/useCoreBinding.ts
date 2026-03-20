import { diffOptionsAtom, diffsAtom, diffWorkflowStatusAtom, hoveredDiffIndexAtom, syncModeAtom, visibleDiffIndexesAtom, whitespaceHandlingAtom } from "@/states/coreAtoms";
import type { DiffseekEngine } from "@core";
import type { DiffOptions } from "@core";
import { getDefaultStore, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";

export function useCoreBinding({ engine }: { engine: DiffseekEngine }) {
    const setDiffOptions = useSetAtom(diffOptionsAtom);
    const setDiffs = useSetAtom(diffsAtom);
    const setSyncMode = useSetAtom(syncModeAtom);
    const setVisibleDiffIndexes = useSetAtom(visibleDiffIndexesAtom);
    const setHoveredDiffIndex = useSetAtom(hoveredDiffIndexAtom);
    const setDiffWorkflowStatus = useSetAtom(diffWorkflowStatusAtom);

    useEffect(() => {
        const unsub: (() => void)[] = [];

        const store = getDefaultStore();
        const diffOptions: Partial<DiffOptions> = {
            whitespace: store.get(whitespaceHandlingAtom),
        };

        engine.updateDiffOptions(diffOptions);

        setDiffOptions(engine.diffOptions);

        unsub.push(engine.on("statusChanged", (status) => {
            setDiffWorkflowStatus(status);
        }));

        unsub.push(engine.on("diffOptionsChanged", (diffOptions) => {
            setDiffOptions(diffOptions);
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
            setVisibleDiffIndexes((prev) => {
                if (!visibleDiffs.left.length && !visibleDiffs.right.length) {
                    return prev;
                }

                const left = new Set(prev.left);
                const right = new Set(prev.right);

                for (const change of visibleDiffs.left) {
                    if (change.isVisible) {
                        left.add(change.item);
                    } else {
                        left.delete(change.item);
                    }
                }

                for (const change of visibleDiffs.right) {
                    if (change.isVisible) {
                        right.add(change.item);
                    } else {
                        right.delete(change.item);
                    }
                }

                return {
                    left: Array.from(left),
                    right: Array.from(right),
                };
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