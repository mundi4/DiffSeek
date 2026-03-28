import { diffContextAtom, diffOptionsAtom, diffWorkflowStatusAtom, editableInSyncModeAtom, hoveredDiffIndexAtom, paletteAtom, syncModeAtom, visibleDiffIndexesAtom, whitespaceHandlingAtom } from "@/states/core-atoms";
import type { DiffseekEngine } from "@core";
import type { DiffOptions } from "@core";
import { getDefaultStore, useSetAtom } from "jotai";
import { useEffect } from "react";

export function useCoreBinding({ engine }: { engine: DiffseekEngine }) {
    const setDiffOptions = useSetAtom(diffOptionsAtom);
    const setDiffContext = useSetAtom(diffContextAtom);
    const setSyncMode = useSetAtom(syncModeAtom);
    const setEditableInSyncMode = useSetAtom(editableInSyncModeAtom);
    const setVisibleDiffIndexes = useSetAtom(visibleDiffIndexesAtom);
    const setHoveredDiffIndex = useSetAtom(hoveredDiffIndexAtom);
    const setDiffWorkflowStatus = useSetAtom(diffWorkflowStatusAtom);
    const setPalette = useSetAtom(paletteAtom);

    useEffect(() => {
        const unsub: (() => void)[] = [];

        const store = getDefaultStore();
        const diffOptions: Partial<DiffOptions> = {
            whitespace: store.get(whitespaceHandlingAtom),
        };
        const editableInSyncMode = store.get(editableInSyncModeAtom);

        engine.updateDiffOptions(diffOptions);
        engine.editableInSyncMode = editableInSyncMode;

        setDiffOptions(engine.diffOptions);
        setPalette(engine.palette);
        setEditableInSyncMode(engine.editableInSyncMode);

        unsub.push(engine.on("statusChanged", (status) => {
            setDiffWorkflowStatus(status);
        }));

        unsub.push(engine.on("diffOptionsChanged", (diffOptions) => {
            setDiffOptions(diffOptions);
        }));

        unsub.push(engine.on("paletteChanged", (palette) => {
            setPalette(palette);
        }));

        unsub.push(engine.on("syncModeChanged", ({ syncMode }) => {
            setSyncMode(syncMode);
        }));

        unsub.push(engine.on("editableInSyncModeChanged", ({ editableInSyncMode }) => {
            setEditableInSyncMode(editableInSyncMode);
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