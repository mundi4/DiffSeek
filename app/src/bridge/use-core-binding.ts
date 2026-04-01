import { diffContextAtom, diffseekOptionsAtom, diffWorkflowStatusAtom, hoveredDiffIndexAtom, paletteAtom, syncModeAtom, visibleDiffIndexesAtom } from "@/states/core-atoms";
import type { DiffseekEngine } from "@core";
import { getDefaultStore, useSetAtom } from "jotai";
import { useEffect } from "react";

export function useCoreBinding({ engine }: { engine: DiffseekEngine }) {
    const setDiffseekOptions = useSetAtom(diffseekOptionsAtom);
    const setDiffContext = useSetAtom(diffContextAtom);
    const setSyncMode = useSetAtom(syncModeAtom);
    const setVisibleDiffIndexes = useSetAtom(visibleDiffIndexesAtom);
    const setHoveredDiffIndex = useSetAtom(hoveredDiffIndexAtom);
    const setDiffWorkflowStatus = useSetAtom(diffWorkflowStatusAtom);
    const setPalette = useSetAtom(paletteAtom);

    useEffect(() => {
        const unsub: (() => void)[] = [];

        // LS에서 복원된 옵션을 engine에 적용
        const store = getDefaultStore();
        const options = store.get(diffseekOptionsAtom);
        engine.applyOptions(options);

        setPalette(engine.palette);

        unsub.push(engine.on("statusChanged", (status) => {
            setDiffWorkflowStatus(status);
        }));

        unsub.push(engine.on("diffOptionsChanged", (diffOptions) => {
            setDiffseekOptions((prev) => ({ ...prev, diff: diffOptions }));
        }));

        unsub.push(engine.on("paletteChanged", (palette) => {
            setPalette(palette);
        }));

        unsub.push(engine.on("syncModeChanged", ({ syncMode }) => {
            setSyncMode(syncMode);
        }));

        unsub.push(engine.on("editableInSyncModeChanged", ({ editableInSyncMode }) => {
            setDiffseekOptions((prev) => ({ ...prev, editableInSyncMode }));
        }));

        unsub.push(engine.on('diffContextChanged', (diffContext) => {
            if (diffContext) {
                setDiffContext({
                    diffs: diffContext.diffs.slice(),
                    commonOutline: diffContext.commonOutline.slice(),
                    leftTokenCount: diffContext.leftTokens.length,
                    rightTokenCount: diffContext.rightTokens.length,
                    timingTokenizingMs: diffContext.timing.tokenizingMs,
                    timingDiffingMs: diffContext.timing.diffingMs,
                    timingProcessingMs: diffContext.timing.processingMs,
                    timingTotalMs: diffContext.timing.totalMs,
                });
            }
            else {
                setDiffContext(null);
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
