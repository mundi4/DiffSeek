import type { DiffEntry } from "..";
import { ABORT_REASON_CANCELLED, ANCHOR_TAG_NAME, DIFF_TAG_NAME, STRUCTURAL_CLOSE_TEXT, STRUCTURAL_OPEN_TEXT, TOKEN_BUFFER_STRIDE } from "../constants";
import { DIFF_TYPE_ADDED, DIFF_TYPE_UNCHANGED, type DiffOptions } from "../diff";
import type { initializeDiffWorker } from "../diff-worker/initialize-diff-worker";
import type { DiffWorkerResult } from "../diff-worker/types";
import type { Editor, TokenSnapshot } from "../editor/editor";
import type { Token } from "../tokenization";
import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_HAS_PRECEDING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_STRUCTURAL_CLOSE, TOKEN_FLAGS_STRUCTURAL_OPEN } from "../tokenization";
import { createYieldIfNeeded } from "../utils/create-yield-if-needed";
import type { AnchorManager } from "./anchor-manager";
import { buildCommonOutline } from "./build-common-outline";
import type { AnchorPair, DiffContext, DiffWorkflowStatus } from "./types";

export class DiffPipeline {
    private abortController: AbortController | null = null;
    private markerElements: Map<HTMLElement, AnchorPair | null> = new Map();
    private prevMarkerElements: Map<HTMLElement, AnchorPair | null> | null = null;

    private emitStatusForRun(controller: AbortController, status: DiffWorkflowStatus) {
        if (this.abortController === controller) {
            this.onStatus(status);
        }
    }

    constructor(
        private diffWorker: ReturnType<typeof initializeDiffWorker>,
        private leftEditor: Editor,
        private rightEditor: Editor,
        //        private anchorManager: AnchorManager,
        private onStatus: (status: DiffWorkflowStatus) => void
    ) { }

    cancel() {
        if (this.abortController) {
            this.abortController.abort(ABORT_REASON_CANCELLED);
            this.abortController = null;
        }
    }

    beginUpdate() {
        if (this.prevMarkerElements !== null) {
            // 이미 beginUpdate가 호출된 상태에서 endUpdate 없이 다시 beginUpdate가 호출됨
            // 즉 내가 영구짓을 하고 있음. 절대적으로 있어서는 안되는 일.
            throw new Error("beginUpdate called while a previous update is still in progress");
        }
        this.prevMarkerElements = this.markerElements;
        this.markerElements = new Map();
    }

    endUpdate() {
        if (this.prevMarkerElements === null) {
            // beginUpdate가 호출되지 않은 상태에서 endUpdate가 호출됨!
            throw new Error("endUpdate called without a corresponding beginUpdate");
        }
        this.cleanupUnsuedMarkers();
        this.prevMarkerElements = null;
    }

    cleanupUnsuedMarkers() {
        for (const [el, pair] of this.prevMarkerElements!.entries()) {
            if (this.markerElements.has(el)) {
                // 여전히 사용 중
                continue;
            }
            if (el.isConnected) {
                el.remove();
            }
        }
    }

    async run(params: {
        diffOptions: DiffOptions;
        // signal: AbortSignal;
    }): Promise<DiffContext> {
        if (this.abortController) {
            this.cancel();
            await scheduler.yield();
        }

        if (this.prevMarkerElements) {
            // 이전 실행이 완전히 끝나거나 취소 후 뒷정리가 아직 안됨
            throw new Error("DiffPipeline: previous diff elements have not been cleaned up. This should not happen.");
        }

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
            this.beginUpdate();

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
                this.endUpdate();
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
        // const anchorManager = this.anchorManager;
        const diffs: DiffEntry[] = [];
        const anchorPairs: AnchorPair[] = [];
        const leftTokenCount = leftTokens.length;


        let chunkLeftStart = -1;
        let chunkLeftEnd = -1;
        let chunkRightStart = -1;
        let chunkRightEnd = -1;
        let chunkType: number = DIFF_TYPE_UNCHANGED;

        const addAnchorPair = (leftMarker: HTMLElement, rightMarker: HTMLElement) => {
            let pair = this.prevMarkerElements!.get(leftMarker);
            if (pair) {
                if (pair.leftEl !== leftMarker || pair.rightEl !== rightMarker) {
                    pair = undefined;
                }
            }

            if (!pair) {
                pair = {
                    index: anchorPairs.length,
                    leftEl: leftMarker,
                    rightEl: rightMarker,
                    diffIndex: null,
                    leftContainerIndex: -1,
                    rightContainerIndex: -1,
                    isBaseline: false
                }
            }

            anchorPairs.push(pair);
            return pair;
        }

        const getDiffMarkerEl = (
            filledSnapshot: TokenSnapshot, filledStart: number, filledEnd: number,
            emptySnapshot: TokenSnapshot, emptyStart: number, emptyEnd: number
        ) => {

            let which: Node | null = null;
            let where: InsertPosition | null = null;
            let containerIndex = -1;

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
                    // filled쪽은 줄의 시작부분이므로 empty쪽도 줄의 시작 위치에 삽입해줘야 자연스럽다.

                    let emptyPrevLineNum = emptyPrevToken ? emptyPrevToken.lineNumber : 0;
                    let emptyNextLineNum = emptyNextToken ? emptyNextToken.lineNumber : emptyPrevLineNum + 1;

                    if (emptyNextLineNum > emptyPrevLineNum) {
                        // empty쪽 전/후 토큰의 줄번호가 다르므로 줄의 경계에 있음.
                        // 이전 토큰의 바로 다음 줄의 시작위치를 삽입 위치로 정함. 만약 이 위치에 줄맞춤 앵커가 존재한다면 그 앵커보다 앞이어야 함.
                        const line = emptyLineBoundaries[emptyPrevLineNum + 1];
                        if (line) {
                            which = line.startWhich;
                            where = line.startWhere;
                            containerIndex = line.containerIndex;
                        }
                    }
                }

                if (!which) {
                    if (emptyPrevToken) {
                        if (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN) {
                            which = emptyPrevToken.endNode;
                            where = "afterbegin";
                            containerIndex = emptyPrevToken.containerIndex;
                        } else {
                            which = emptyPrevToken.endNode;
                            where = "afterend";
                            containerIndex = emptyPrevToken.containerIndex;
                        }
                    }
                    if (!which) {
                        if (emptyNextToken!.flags & TOKEN_FLAGS_STRUCTURAL_CLOSE) {
                            which = emptyNextToken!.startNode;
                            where = "beforeend";
                            containerIndex = emptyNextToken!.containerIndex;
                        } else {
                            which = emptyNextToken!.startNode;
                            where = "beforebegin";
                            containerIndex = emptyNextToken!.containerIndex;
                        }
                    }
                }
            }

            const el = which && where && this.getOrCreateEmptyDiffMarker(which, where);

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

        const handleCommon = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) => {
            const leftToken = leftTokens[leftStart];
            const rightToken = rightTokens[rightStart];
            if (leftToken.flags & rightToken.flags & TOKEN_FLAGS_LINE_START) {
                //addAnchorPair(leftToken, rightToken);
            }
        };

        const handleDiff = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number, type: number) => {
            const leftCount = leftEnd - leftStart;
            const rightCount = rightEnd - rightStart;
            // const leftToken = leftStart < leftTokens.length ? leftTokens[leftStart] : null;
            // const rightToken = rightStart < rightTokens.length ? rightTokens[rightStart] : null;

            const diffIndex = diffs.length;

            let leftRange: Range | null = null;
            let rightRange: Range | null = null;
            let leftDiffEl: HTMLElement | null = null;
            let rightDiffEl: HTMLElement | null = null;
            let leftAnchorEl: HTMLElement | null = null;
            let rightAnchorEl: HTMLElement | null = null;
            let leftAnchorContainerIndex = 0;
            let rightAnchorContainerIndex = 0;
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

                const emptyEl = getDiffMarkerEl(
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

                // empty 마커가 삽입된 위치의 컨테이너 = 인접 토큰의 컨테이너
                const emptyTokens = emptySnapshot.tokens;
                const emptyPrevToken = emptyStart > 0 ? emptyTokens[emptyStart - 1] : null;
                const emptyNextToken = emptyStart < emptyTokens.length ? emptyTokens[emptyStart] : null;
                const emptyContainerIndex = emptyPrevToken?.containerIndex ?? emptyNextToken?.containerIndex ?? 0;
                anchorEligible = !!((filledSnapshot.tokens[filledStart].flags & TOKEN_FLAGS_LINE_START) && emptyEl);

                // const anchorEligible = !!(filledSnapshot.tokens[filledStart].flags & TOKEN_FLAGS_LINE_START);
                if (leftCount === 0) {
                    leftDiffEl = emptyEl;
                    leftRange = emptyRange;
                    rightRange = rightEditor.getTokenRange(rightStart, rightEnd);
                    // if (anchorEligible) {
                    //     leftAnchorEl = leftDiffEl;
                    //     rightAnchorEl = getAnchorEl(rightToken!, false);
                    //     leftAnchorContainerIndex = emptyContainerIndex;
                    //     rightAnchorContainerIndex = rightToken!.containerIndex;
                    // }
                } else {
                    rightDiffEl = emptyEl;
                    rightRange = emptyRange;
                    leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                    // if (anchorEligible) {
                    //     rightAnchorEl = rightDiffEl;
                    //     leftAnchorEl = getAnchorEl(leftToken!, true);
                    //     leftAnchorContainerIndex = leftToken!.containerIndex;
                    //     rightAnchorContainerIndex = emptyContainerIndex;
                    // }
                }
            }
            else {
                leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                rightRange = rightEditor.getTokenRange(rightStart, rightEnd);
                // if (leftToken!.flags & rightToken!.flags & TOKEN_FLAGS_LINE_START) {
                //     leftAnchorEl = getAnchorEl(leftToken!, true);
                //     rightAnchorEl = leftAnchorEl && getAnchorEl(rightToken!, false);
                //     leftAnchorContainerIndex = leftToken!.containerIndex;
                //     rightAnchorContainerIndex = rightToken!.containerIndex;
                // }
            }

            const diff = {
                diffIndex,
                leftRange,
                rightRange,
                leftSpan: { start: leftStart, end: leftEnd },
                rightSpan: { start: rightStart, end: rightEnd },
                leftMarkerEl: leftDiffEl,
                rightMarkerEl: rightDiffEl,
            } satisfies DiffEntry;

            diffs.push(diff);

            if (leftAnchorEl && rightAnchorEl) {
                const anchorPair = anchorManager.createAnchorPair(
                    leftAnchorEl,
                    rightAnchorEl,
                    diffIndex,
                    leftAnchorContainerIndex,
                    rightAnchorContainerIndex,
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

    // getOrCreateMarkerElement(tagName: typeof ANCHOR_TAG_NAME | typeof DIFF_TAG_NAME, which: Node, where: InsertPosition): HTMLElement | null {
    //     if (!which || !where) {
    //         return null;
    //     }

    //     let foundEl: HTMLElement | null = null;
    //     if (where === "afterend") {
    //         foundEl = which.nextSibling as HTMLElement;
    //     } else if (where === "afterbegin") {
    //         foundEl = which.firstChild as HTMLElement;
    //     } else if (where === "beforeend") {
    //         foundEl = which.lastChild as HTMLElement;
    //     } else if (where === "beforebegin") {
    //         foundEl = which.previousSibling as HTMLElement;
    //     }

    //     let parent: ParentNode | null = null;
    //     if (foundEl && this.markerElements.has(foundEl)) {
    //         parent = foundEl.parentNode;
    //         do {
    //             // console.warn("getOrCreateMarkerElement: the element at the target position is already being used as a marker, looking for an existing marker element with the correct tag name",
    //             //     { tagName, which, where, foundEl, parent });
    //             foundEl = foundEl.nextSibling as HTMLElement;
    //         } while (foundEl && this.markerElements.has(foundEl));
    //     }

    //     let el: HTMLElement;

    //     if (!foundEl || foundEl.nodeName !== tagName) {
    //         const beforeMe = foundEl;
    //         el = document.createElement(tagName);
    //         el.contentEditable = "false";
    //         if (tagName === DIFF_TAG_NAME) {
    //             el.innerText = "\u200B"; // zero-width space
    //         } else {

    //         }
    //         if (parent) {
    //             parent.insertBefore(el, beforeMe);
    //         } else if (where === "afterend") {
    //             which.parentNode!.insertBefore(el, which.nextSibling);
    //         } else {
    //             (which as HTMLElement).insertAdjacentElement(where, el);
    //         }
    //     } else {
    //         el = foundEl;
    //     }

    //     this.markerElements.add(el);

    //     return el;
    // }
    private getOrCreateEmptyDiffMarker(which: Node, where: InsertPosition): HTMLElement | null {
        let foundEl: HTMLElement | null = null;
        if (where === "afterend") {
            foundEl = which.nextSibling as HTMLElement;
        } else if (where === "afterbegin") {
            foundEl = which.firstChild as HTMLElement;
        } else if (where === "beforeend") {
            foundEl = which.lastChild as HTMLElement;
        } else if (where === "beforebegin") {
            foundEl = which.previousSibling as HTMLElement;
        }

        if (foundEl) {
            if (foundEl.nodeName === ANCHOR_TAG_NAME) {
                if (this.markerElements.has(foundEl)) {
                    // 이미 사용 중인 앵커 요소가 그 자리에 있음. 이미 다른 토큰이 줄맞춤 용도로 사용 중이므로 diff marker를 추가하면 안됨
                    return null;
                }

                const next = foundEl.nextSibling as HTMLElement;
                if (next && next.nodeName === DIFF_TAG_NAME) {
                    foundEl = next;
                }
            }

            if (foundEl.nodeName !== DIFF_TAG_NAME) {
                foundEl = null;
            }
        }

        if (foundEl && this.markerElements.has(foundEl)) {
            // 이미 사용 중인 요소임. 이 위치에 두개의 diff 요소가 생기는 건 논리적으로나 시각적으로 문제가 될 수 있음.
            return null;
        }

        let el: HTMLElement;
        if (!foundEl) {
            el = document.createElement(DIFF_TAG_NAME);
            el.contentEditable = "false";
            el.innerText = "\u200B"; // zero-width space

            if (where === "afterend") {
                which.parentNode!.insertBefore(el, which.nextSibling);
            } else if (where === "beforebegin") {
                which.parentNode!.insertBefore(el, which);
            } else {
                (which as HTMLElement).insertAdjacentElement(where, el);
            }
        } else {
            el = foundEl;
        }

        this.markerElements.set(el, null);
        return el;
    }
}
