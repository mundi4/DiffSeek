import { DIFF_TYPE_ADDED, DIFF_TYPE_UNCHANGED, type DiffOptions } from "../diff";
import type { initializeDiffWorker } from "../diff-worker/initialize-diff-worker";
import type { DiffWorkerResult } from "../diff-worker/types";
import type { Editor, TokenSnapshot } from "../editor/editor";
import { ABORT_REASON_CANCELLED, ANCHOR_TAG_NAME, DIFF_TAG_NAME, STRUCTURAL_CLOSE_TEXT, STRUCTURAL_OPEN_TEXT, TOKEN_BUFFER_STRIDE } from "../constants";
import type { Token } from "../tokenization";
import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_HAS_PRECEDING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_STRUCTURAL_CLOSE, TOKEN_FLAGS_STRUCTURAL_OPEN } from "../tokenization";
import type { AnchorManager } from "./anchor-manager";
import { buildCommonOutline } from "./build-common-outline";
import type { AnchorPair, DiffContext, DiffWorkflowStatus } from "./types";
import type { DiffEntry } from "..";
import { createYieldIfNeeded } from "../utils/create-yield-if-needed";

export class DiffPipeline {
    private abortController: AbortController | null = null;

    private emitStatusForRun(controller: AbortController, status: DiffWorkflowStatus) {
        if (this.abortController === controller) {
            this.onStatus(status);
        }
    }

    constructor(
        private diffWorker: ReturnType<typeof initializeDiffWorker>,
        private leftEditor: Editor,
        private rightEditor: Editor,
        private anchorManager: AnchorManager,
        private onStatus: (status: DiffWorkflowStatus) => void
    ) { }

    cancel() {
        if (this.abortController) {
            this.abortController.abort(ABORT_REASON_CANCELLED);
            this.abortController = null;
        }
    }

    async run(params: {
        diffOptions: DiffOptions;
        // signal: AbortSignal;
    }): Promise<DiffContext> {
        this.cancel();

        const controller = new AbortController();
        this.abortController = controller;

        const signal = controller.signal;
        const yieldIfNeeded = createYieldIfNeeded(signal);

        try {
            // 1. tokenize & serialize
            const t0 = performance.now();
            this.emitStatusForRun(controller, { phase: "tokenizing", startedAtMs: t0 });

            const leftTokenSnapshot = await this.leftEditor.waitForTokens(signal);
            signal.throwIfAborted();

            const rightTokenSnapshot = await this.rightEditor.waitForTokens(signal);
            signal.throwIfAborted();

            const leftTokensData = this.serializeTokens(leftTokenSnapshot.tokens);
            const rightTokensData = this.serializeTokens(rightTokenSnapshot.tokens);
            await yieldIfNeeded();

            const t1 = performance.now();

            // 2. run diff worker
            this.emitStatusForRun(controller, { phase: "diffing", startedAtMs: t1, tokenizingMs: t1 - t0 });

            const workerResult = await this.diffWorker.run({
                leftWholeText: leftTokenSnapshot.wholeText,
                rightWholeText: rightTokenSnapshot.wholeText,
                leftTokenBuffer: leftTokensData,
                rightTokenBuffer: rightTokensData,
                leftTokenCount: leftTokenSnapshot.tokens.length,
                rightTokenCount: rightTokenSnapshot.tokens.length,
                options: params.diffOptions,
                abortSignal: signal,
            });

            signal.throwIfAborted();

            const t2 = performance.now();

            // 3. post process
            this.emitStatusForRun(controller, { phase: "processing", startedAtMs: t2, tokenizingMs: t1 - t0, diffingMs: t2 - t1 });

            this.anchorManager.beginUpdate();

            try {
                const diffContext = await this.process({
                    result: workerResult,
                    diffOptions: params.diffOptions,
                    leftTokenSnapshot,
                    rightTokenSnapshot,
                });
                signal.throwIfAborted();

                const t3 = performance.now();

                if (import.meta.env.DEV) {
                    console.debug(
                        `[pipeline] tokenizing=${(t1 - t0).toFixed(1)}ms  diffing=${(t2 - t1).toFixed(1)}ms (worker=${workerResult.elapsedTime.toFixed(1)}ms)  processing=${(t3 - t2).toFixed(1)}ms  total=${(t3 - t0).toFixed(1)}ms`
                    );
                }

                return {
                    ...diffContext,
                    timing: {
                        tokenizingMs: t1 - t0,
                        diffingMs: t2 - t1,
                        processingMs: t3 - t2,
                        totalMs: t3 - t0,
                    },
                };
            } finally {
                this.anchorManager.endUpdate();
            }

        } finally {
            // if (externalSignal) {
            //     externalSignal.removeEventListener("abort", onExternalAbort);
            // }
            if (this.abortController === controller) {
                this.onStatus({ phase: "idle" });
                this.abortController = null;
            }
        }
    }

    private serializeTokens(tokens: readonly Token[]): Int32Array {
        const STRIDE = TOKEN_BUFFER_STRIDE;
        const arr = new Int32Array(tokens.length * STRIDE);
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            arr[i * STRIDE + 0] = t.textOffset;
            arr[i * STRIDE + 1] = t.textLength;
            arr[i * STRIDE + 2] = t.flags;
        }
        return arr;
    }

    private async process({
        leftTokenSnapshot,
        rightTokenSnapshot,
        diffOptions,
        result,
    }:
        {
            leftTokenSnapshot: TokenSnapshot,
            rightTokenSnapshot: TokenSnapshot,
            diffOptions: DiffOptions,
            result: DiffWorkerResult
        }) {

        const yieldIfNeeded = createYieldIfNeeded(this.abortController?.signal);

        const leftEditor = this.leftEditor;
        const rightEditor = this.rightEditor;
        const leftTokens = leftTokenSnapshot.tokens;
        const rightTokens = rightTokenSnapshot.tokens;
        const anchorManager = this.anchorManager;
        const diffs: DiffEntry[] = [];
        const anchorPairs: AnchorPair[] = [];
        const leftTokenCount = leftTokens.length;

        let chunkLeftStart = -1;
        let chunkLeftEnd = -1;
        let chunkRightStart = -1;
        let chunkRightEnd = -1;
        let chunkType: number = DIFF_TYPE_UNCHANGED;

        const getAnchorEl = (token: Token, isLeft: boolean) => {
            const lineBoundary = (isLeft ? leftTokenSnapshot : rightTokenSnapshot).lineBoundaries[token.lineNumber];
            if (lineBoundary && lineBoundary.startWhich) {
                const markerEl = anchorManager.getOrCreateMarkerElement(ANCHOR_TAG_NAME, lineBoundary.startWhich, lineBoundary.startWhere!);
                return markerEl;
            }
            return null;
        }

        const addAnchorPair = (leftToken: Token, rightToken: Token) => {
            const lLine = leftTokenSnapshot.lineBoundaries[leftToken.lineNumber];
            const rLine = rightTokenSnapshot.lineBoundaries[rightToken.lineNumber];
            if (lLine && rLine && lLine.startWhich && rLine.startWhich) {
                const leftMarker = getAnchorEl(leftToken, true);
                const rightMarker = leftMarker && getAnchorEl(rightToken, false);
                if (leftMarker && rightMarker) {
                    const anchorPair = anchorManager.createAnchorPair(
                        leftMarker,
                        rightMarker,
                        null
                    );
                    if (anchorPair) {
                        anchorPairs.push(anchorPair);
                        // console.log("%cCreated anchor pair for tokens", "color: green;", { leftToken, rightToken, lLine, rLine });
                        return;
                    } else {
                        // console.debug("addAnchorPair: failed to create anchor pair for tokens", { leftToken, rightToken, lLine, rLine });
                    }
                } else {
                    // console.debug("addAnchorPair: failed to create marker elements for tokens", { leftToken, rightToken, lLine, rLine });
                }
            } else {
                // console.debug("addAnchorPair: line boundary missing for tokens", { leftToken, rightToken });
            }
            // console.warn("Failed to create anchor pair for tokens", { leftToken, rightToken });
        }

        const handleCommon = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) => {
            const leftToken = leftTokens[leftStart];
            const rightToken = rightTokens[rightStart];
            if (leftToken.flags & rightToken.flags & TOKEN_FLAGS_LINE_START) {
                addAnchorPair(leftToken, rightToken);
            }
        };


        const createRangeForEmptyDiff = (startContainer: Node, startOffset: number, endContainer: Node, endOffset: number): Range => {
            const result = document.createRange();

            if (import.meta.env.DEV) {
                if (startContainer.nodeType !== 3 || startContainer !== endContainer) {
                    throw new Error("Expected same text node for empty diff range.");
                }
                if (startOffset > endOffset) {
                    throw new Error("Expected startOffset to be less than or equal to endOffset for empty diff range.");
                }
            }
            result.setStart(startContainer, startOffset);
            result.collapse(true);
            return result;
        }

        const createMarkerForEmptyDiff = (
            filledSnapshot: TokenSnapshot, filledStart: number, filledEnd: number,
            emptySnapshot: TokenSnapshot, emptyStart: number, emptyEnd: number) => {

            let which: Node | null = null;
            let where: InsertPosition | null = null;

            if (emptySnapshot.tokens.length === 0) {
                ({ startWhich: which, startWhere: where } = emptySnapshot.lineBoundaries[1] || emptySnapshot.lineBoundaries[0]);

            } else {
                const { tokens: filledTokens } = filledSnapshot;
                const { tokens: emptyTokens, lineBoundaries: emptyLineBoundaries } = emptySnapshot;

                const emptyPrevToken = emptyStart > 0 ? emptyTokens[emptyStart - 1] : null;
                const emptyNextToken = emptyStart < emptyTokens.length ? emptyTokens[emptyStart] : null;

                if (emptyPrevToken && emptyNextToken && emptyPrevToken.endNode === emptyNextToken.startNode && emptyPrevToken.endNode.nodeType === 3) {
                    return null;
                }

                const filledStartToken = filledTokens[filledStart];

                if (filledStartToken.flags & TOKEN_FLAGS_LINE_START) {
                    let emptyPrevLineNum = emptyPrevToken ? emptyPrevToken.lineNumber : 0;
                    let emptyNextLineNum = emptyNextToken ? emptyNextToken.lineNumber : emptyPrevLineNum + 1;
                    if (emptyNextLineNum > emptyPrevLineNum) {
                        const line = emptyLineBoundaries[emptyPrevLineNum + 1];
                        if (line) {
                            which = line.startWhich;
                            where = line.startWhere;
                        }
                    }
                }

                if (!which) {
                    if (emptyPrevToken) {
                        if (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN) {
                            which = emptyPrevToken.endNode;
                            where = "afterbegin";
                        } else {
                            which = emptyPrevToken.endNode;
                            where = "afterend";
                        }
                    }
                    if (!which) {
                        if (emptyNextToken!.flags & TOKEN_FLAGS_STRUCTURAL_CLOSE) {
                            which = emptyNextToken!.startNode;
                            where = "beforeend";
                        } else {
                            which = emptyNextToken!.startNode;
                            where = "beforebegin";
                        }
                    }
                }
            }

            // console.log("INSERTION POINT for empty diff:", { which, where, emptyStart, emptyEnd, emptyLineBoundaries: emptySnapshot.lineBoundaries });
            const el = anchorManager.getOrCreateMarkerElement(DIFF_TAG_NAME, which, where!);

            if (el) {
                const filledStartToken = filledSnapshot.tokens[filledStart];
                const filledEndToken = filledSnapshot.tokens[filledEnd - 1];
                el.classList.toggle("has-preceding-space", !!(filledStartToken.flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE));
                el.classList.toggle("has-following-space", !!(filledEndToken.flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE));
                el.classList.toggle("line-start", !!(filledStartToken.flags & TOKEN_FLAGS_LINE_START));
                el.classList.toggle("line-end", !!(filledEndToken.flags & TOKEN_FLAGS_LINE_END));
            }

            return el;
        }

        const handleDiff = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number, type: number) => {
            const leftCount = leftEnd - leftStart;
            const rightCount = rightEnd - rightStart;
            const leftToken = leftStart < leftTokens.length ? leftTokens[leftStart] : null;
            const rightToken = rightStart < rightTokens.length ? rightTokens[rightStart] : null;

            const diffIndex = diffs.length;

            let leftRange: Range | null = null;
            let rightRange: Range | null = null;
            let leftDiffEl: HTMLElement | null = null;
            let rightDiffEl: HTMLElement | null = null;
            let leftAnchorEl: HTMLElement | null = null;
            let rightAnchorEl: HTMLElement | null = null;
            let anchorEligible = false;

            // --- 한쪽이 비어있는 경우 marker 처리 ---
            if (leftCount === 0 || rightCount === 0) {
                let filledSnapshot: TokenSnapshot, emptySnapshot: TokenSnapshot;
                let filledStart: number, filledEnd: number, emptyStart: number, emptyEnd: number;
                if (leftCount === 0) {
                    filledSnapshot = rightTokenSnapshot;
                    filledStart = rightStart;
                    filledEnd = rightEnd;
                    emptySnapshot = leftTokenSnapshot;
                    emptyStart = leftStart;
                    emptyEnd = leftEnd;
                } else {
                    filledSnapshot = leftTokenSnapshot;
                    filledStart = leftStart;
                    filledEnd = leftEnd;
                    emptySnapshot = rightTokenSnapshot;
                    emptyStart = rightStart;
                    emptyEnd = rightEnd;
                }

                const emptyEl = createMarkerForEmptyDiff(
                    filledSnapshot, filledStart, filledEnd,
                    emptySnapshot, emptyStart, emptyEnd
                );

                const emptyRange = document.createRange();
                if (emptyEl) {
                    emptyRange.selectNode(emptyEl);
                } else {
                    emptyRange.setStart(emptySnapshot.tokens[emptyStart - 1].endNode, emptySnapshot.tokens[emptyStart - 1].endOffset);
                    emptyRange.collapse(true);
                }

                const anchorEligible = !!(filledSnapshot.tokens[filledStart].flags & TOKEN_FLAGS_LINE_START);
                if (leftCount === 0) {
                    leftDiffEl = emptyEl;
                    leftRange = emptyRange;
                    rightRange = rightEditor.getTokenRange(rightStart, rightEnd);
                    if (anchorEligible) {
                        leftAnchorEl = leftDiffEl;
                        rightAnchorEl = getAnchorEl(rightToken!, false);
                    }
                } else {
                    rightDiffEl = emptyEl;
                    rightRange = emptyRange;
                    leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                    if (anchorEligible) {
                        rightAnchorEl = rightDiffEl;
                        leftAnchorEl = getAnchorEl(leftToken!, true);
                    }
                }
            }
            else {
                leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                rightRange = rightEditor.getTokenRange(rightStart, rightEnd);
                if (leftToken!.flags & rightToken!.flags & TOKEN_FLAGS_LINE_START) {
                    leftAnchorEl = getAnchorEl(leftToken!, true);
                    rightAnchorEl = leftAnchorEl && getAnchorEl(rightToken!, false);
                }
            }

            diffs.push({
                diffIndex,
                leftRange,
                rightRange,
                leftSpan: { start: leftStart, end: leftEnd },
                rightSpan: { start: rightStart, end: rightEnd },
                leftMarkerEl: leftDiffEl,
                rightMarkerEl: rightDiffEl,
            });

            if (leftAnchorEl && rightAnchorEl) {
                const anchorPair = anchorManager.createAnchorPair(
                    leftAnchorEl,
                    rightAnchorEl,
                    diffIndex
                );
                if (anchorPair) {
                    anchorPairs.push(anchorPair);
                }
            }
        }



        const extendOrFlush = (
            leftStart: number,
            leftEnd: number,
            rightStart: number,
            rightEnd: number,
            type: number
        ) => {
            if (chunkLeftStart === -1) {
                chunkLeftStart = leftStart;
                chunkLeftEnd = leftEnd;
                chunkRightStart = rightStart;
                chunkRightEnd = rightEnd;
                chunkType = type;
                return;
            }

            if (!!chunkType !== !!type) {
                flushChunk();

                chunkLeftStart = leftStart;
                chunkLeftEnd = leftEnd;
                chunkRightStart = rightStart;
                chunkRightEnd = rightEnd;
                chunkType = type;
                return;
            }

            chunkLeftEnd = leftEnd;
            chunkRightEnd = rightEnd;
            chunkType |= type;
        };

        const flushChunk = () => {
            if (chunkLeftStart === -1) return;

            const leftStart = chunkLeftStart;
            const leftEnd = chunkLeftEnd;
            const rightStart = chunkRightStart;
            const rightEnd = chunkRightEnd;
            const type = chunkType;

            // 청크 초기화
            chunkLeftStart = chunkLeftEnd = chunkRightStart = chunkRightEnd = -1;
            chunkType = DIFF_TYPE_UNCHANGED;

            // UNCHANGED는 anchor만 처리하고 종료
            if (type === DIFF_TYPE_UNCHANGED) {
                handleCommon(leftStart, leftEnd, rightStart, rightEnd);
            } else {
                handleDiff(leftStart, leftEnd, rightStart, rightEnd, type);
            }
        };

        const leftResultBuffer = result.leftResultBuffer;
        const rightResultBuffer = result.rightResultBuffer;

        let lastLeftEnd = 0;
        let lastRightEnd = 0;

        for (let i = 0; i < leftTokenCount; i++) {
            const base = i * TOKEN_BUFFER_STRIDE;

            const leftStart = leftResultBuffer[base];
            const leftEnd = leftResultBuffer[base + 1];
            const rightStart = leftResultBuffer[base + 2];
            const rightEnd = leftResultBuffer[base + 3];
            const type = leftResultBuffer[base + 4] as number;

            // 0:N ADDED
            if (lastRightEnd < rightStart) {
                extendOrFlush(
                    lastLeftEnd,
                    lastLeftEnd,
                    lastRightEnd,
                    rightStart,
                    DIFF_TYPE_ADDED
                );
            }

            if (type === DIFF_TYPE_UNCHANGED) {
                flushChunk();
                handleCommon(leftStart, leftEnd, rightStart, rightEnd);
            } else {
                extendOrFlush(leftStart, leftEnd, rightStart, rightEnd, type);
            }

            lastLeftEnd = leftEnd;
            lastRightEnd = rightEnd;

            if ((i & 0x1ff) === 0) {
                await yieldIfNeeded();
            }
        }

        if (lastRightEnd < rightTokens.length) {
            extendOrFlush(
                lastLeftEnd,
                lastLeftEnd,
                lastRightEnd,
                rightTokens.length,
                DIFF_TYPE_ADDED
            );
        }

        flushChunk();

        const commonOutline = buildCommonOutline({
            leftWholeText: leftTokenSnapshot.wholeText,
            rightWholeText: rightTokenSnapshot.wholeText,
            leftTokens,
            rightTokens,
            leftResultBuffer,
        });

        return {
            isValid: true,
            leftTokens,
            rightTokens,
            commonOutline,
            leftTokenBuffer: leftResultBuffer,
            rightTokenBuffer: rightResultBuffer,
            diffOptions,
            // entries,
            // leftEntries,
            // rightEntries,
            diffs,
            anchorPairs,
        } satisfies Omit<DiffContext, "timing">;

    }
}
