import type { DiffEntry } from "..";
import { ABORT_REASON_CANCELLED, ANCHOR_TAG_NAME, DIFF_TAG_NAME, TOKEN_BUFFER_STRIDE } from "../constants";
import { DIFF_TYPE_ADDED, DIFF_TYPE_UNCHANGED, type DiffOptions } from "../diff";
import type { initializeDiffWorker } from "../diff-worker/initialize-diff-worker";
import type { DiffWorkerResult } from "../diff-worker/types";
import type { Editor, TokenSnapshot } from "../editor/editor";
import type { Token } from "../tokenization";
import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_HAS_PRECEDING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_TYPE_STRUCTURAL } from "../tokenization";
import { createYieldIfNeeded } from "../utils/create-yield-if-needed";
import { buildCommonOutline } from "./build-common-outline";
import { findEmptyDiffMarkerPosition } from "./find-empty-diff-marker-position";
import type { AnchorPair, DiffContext, DiffWorkflowStatus } from "./types";

export class DiffPipeline {
    private abortController: AbortController | null = null;
    private markerElements: Set<HTMLElement> = new Set();
    private prevMarkerElements: Set<HTMLElement> | null = null;

    private emitStatusForRun(controller: AbortController, status: DiffWorkflowStatus) {
        if (this.abortController === controller) {
            this.onStatus(status);
        }
    }

    constructor(
        private diffWorker: ReturnType<typeof initializeDiffWorker>,
        private leftEditor: Editor,
        private rightEditor: Editor,
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
        this.markerElements = new Set();
    }

    endUpdate() {
        if (this.prevMarkerElements === null) {
            // beginUpdate가 호출되지 않은 상태에서 endUpdate가 호출됨!
            throw new Error("endUpdate called without a corresponding beginUpdate");
        }
        this.cleanupUnusedMarkers();
        this.prevMarkerElements = null;
    }

    cleanupUnusedMarkers() {
        for (const el of this.prevMarkerElements!) {
            if (this.markerElements.has(el)) {
                continue;
            }
            if (!el.isConnected) continue;
            const nodeName = el.nodeName;
            if (nodeName === ANCHOR_TAG_NAME || nodeName === DIFF_TAG_NAME) {
                el.remove();
            } else {
                // 블록 요소를 앵커로 빌려 쓴 경우 — 속성만 정리
                el.classList.remove("ds-padded", "ds-striped");
                el.style.removeProperty("--ds-adjust");
                delete el.dataset.adjust;
                delete el.dataset.anchorIndex;
                delete el.dataset.diffIndex;
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
        const diffs: DiffEntry[] = [];
        const anchorPairs: AnchorPair[] = [];
        const leftTokenCount = leftTokens.length;


        let chunkLeftStart = -1;
        let chunkLeftEnd = -1;
        let chunkRightStart = -1;
        let chunkRightEnd = -1;
        let chunkType: number = DIFF_TYPE_UNCHANGED;

        const isAllStructural = (tokens: readonly Token[], start: number, end: number) => {
            for (let i = start; i < end; i++) {
                if (!(tokens[i].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) return false;
            }
            return true;
        };

        const getDiffMarkerEl = (
            filledSnapshot: TokenSnapshot, filledStart: number, filledEnd: number,
            emptySnapshot: TokenSnapshot, emptyStart: number, emptyEnd: number
        ) => {
            let pos = findEmptyDiffMarkerPosition(
                filledSnapshot.tokens, filledStart,
                emptySnapshot.tokens, emptySnapshot.lineBoundaries, emptyStart,
            );

            // 최후의 fallback: emptyStart === 0이면 editor root의 afterbegin
            if (!pos && emptyStart === 0) {
                const emptyEditor = emptySnapshot === leftTokenSnapshot ? leftEditor : rightEditor;
                pos = { which: emptyEditor.contentElement, where: "afterbegin" };
            }

            const el = pos && this.getOrCreateEmptyDiffMarker(pos.which, pos.where, diffOptions.stackEmptyDiffMarkers);

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

        const peekElementAt = (which: Node, where: InsertPosition): HTMLElement | null => {
            if (where === "afterend") return which.nextSibling as HTMLElement;
            if (where === "afterbegin") return which.firstChild as HTMLElement;
            if (where === "beforeend") return which.lastChild as HTMLElement;
            if (where === "beforebegin") return which.previousSibling as HTMLElement;
            return null;
        };

        const getAnchorElForLine = (token: Token, isLeft: boolean): HTMLElement | null => {
            const snapshot = isLeft ? leftTokenSnapshot : rightTokenSnapshot;
            const lb = snapshot.lineBoundaries[token.lineNumber];
            if (!lb?.startWhich) return null;

            let which: Node = lb.startWhich;
            let where: InsertPosition = lb.startWhere;

            // line boundary 위치에 diff marker chain이 있으면 그 뒤로 이동
            let peek = peekElementAt(which, where);
            while (peek?.nodeName === DIFF_TAG_NAME) {
                which = peek;
                where = "afterend";
                peek = peek.nextSibling as HTMLElement;
            }

            return this.getOrCreateAnchor(which, where);
        };

        const activateAnchorEl = (el: HTMLElement, anchorIndex: number, diffIndex: number | null) => {
            el.dataset.anchorIndex = String(anchorIndex);
            if (diffIndex !== null) {
                el.dataset.diffIndex = String(diffIndex);
            } else {
                delete el.dataset.diffIndex;
            }
        };

        const addAnchorPair = (
            leftEl: HTMLElement, rightEl: HTMLElement,
            diffIndex: number | null,
            leftContainerIndex: number, rightContainerIndex: number,
        ) => {
            const index = anchorPairs.length;

            const leftAdjustStr = leftEl.dataset.adjust;
            const rightAdjustStr = rightEl.dataset.adjust;
            let delta = 0;
            if (leftAdjustStr && rightAdjustStr) {
                // 양쪽에 adjust가 있다면 이 둘은 반드시 다른 pair로부터 온 것임
                delta = 0;
                delete leftEl.dataset.adjust;
                leftEl.classList.remove("ds-padded", "ds-striped");
                leftEl.style.removeProperty("--ds-adjust");
                delete rightEl.dataset.adjust;
                rightEl.classList.remove("ds-padded", "ds-striped");
                rightEl.style.removeProperty("--ds-adjust");
            } else if (leftAdjustStr) {
                delta = -parseInt(leftAdjustStr);
            } else if (rightAdjustStr) {
                delta = parseInt(rightAdjustStr);
            }

            // 이 delta를 pair에 넣어야 함.


            activateAnchorEl(leftEl, index, diffIndex);
            activateAnchorEl(rightEl, index, diffIndex);
            anchorPairs.push({
                index,
                leftEl,
                rightEl,
                diffIndex,
                leftContainerIndex,
                rightContainerIndex,
                delta,
            });
        };

        const handleCommon = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) => {
            const leftToken = leftTokens[leftStart];
            const rightToken = rightTokens[rightStart];
            if (leftToken.flags & rightToken.flags & TOKEN_FLAGS_LINE_START) {
                const leftEl = getAnchorElForLine(leftToken, true);
                const rightEl = leftEl && getAnchorElForLine(rightToken, false);
                if (leftEl && rightEl) {
                    addAnchorPair(leftEl, rightEl, null,
                        leftToken.containerIndex, rightToken.containerIndex);
                }
            }
        };

        const handleDiff = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number, type: number) => {
            const leftCount = leftEnd - leftStart;
            const rightCount = rightEnd - rightStart;
            const diffIndex = diffs.length;

            let leftRange: Range | null = null;
            let rightRange: Range | null = null;
            let leftDiffEl: HTMLElement | null = null;
            let rightDiffEl: HTMLElement | null = null;

            // --- 한쪽이 비어있거나 structural만인 경우 marker 처리 ---
            const leftStructuralOnly = leftCount > 0 && rightCount > 0 && isAllStructural(leftTokens, leftStart, leftEnd);
            const rightStructuralOnly = leftCount > 0 && rightCount > 0 && isAllStructural(rightTokens, rightStart, rightEnd);

            if (leftCount === 0 || rightCount === 0 || leftStructuralOnly || rightStructuralOnly) {
                let filledSnapshot: TokenSnapshot, emptySnapshot: TokenSnapshot;
                let filledStart: number, filledEnd: number, emptyStart: number, emptyEnd: number;
                if (leftCount === 0 || leftStructuralOnly) {
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

                if (emptyEl) {
                    emptyEl.dataset.diffIndex = String(diffIndex);

                    // anchor pair 생성: filled 쪽은 line boundary, empty 쪽은 ds-diff 자체를 borrow
                    const filledStartToken = filledSnapshot.tokens[filledStart];
                    if (filledStartToken.flags & TOKEN_FLAGS_LINE_START) {
                        const isLeftEmpty = (leftCount === 0 || leftStructuralOnly);
                        const filledToken = isLeftEmpty ? rightTokens[rightStart] : leftTokens[leftStart];
                        const filledAnchorEl = getAnchorElForLine(filledToken, !isLeftEmpty);
                        if (filledAnchorEl) {
                            this.markerElements.add(emptyEl);
                            addAnchorPair(
                                isLeftEmpty ? emptyEl : filledAnchorEl,
                                isLeftEmpty ? filledAnchorEl : emptyEl,
                                diffIndex,
                                isLeftEmpty ? -1 : filledToken.containerIndex,
                                isLeftEmpty ? filledToken.containerIndex : -1,
                            );
                        }
                    }
                }

                // marker를 못 만들었을 때: 이전 diff에 합치기 (merge) 또는 건너뛰기
                if (!emptyEl && !diffOptions.stackEmptyDiffMarkers && diffs.length > 0) {
                    const isLeftEmpty = leftCount === 0;
                    const prevDiff = diffs[diffs.length - 1];
                    const prevMarkerEl = isLeftEmpty ? prevDiff.leftMarkerEl : prevDiff.rightMarkerEl;

                    if (prevMarkerEl) {
                        // 이전 diff의 filled side를 확장
                        if (isLeftEmpty) {
                            prevDiff.rightSpan.end = rightEnd;
                            prevDiff.rightRange = rightEditor.getTokenRange(prevDiff.rightSpan.start, rightEnd);
                        } else {
                            prevDiff.leftSpan.end = leftEnd;
                            prevDiff.leftRange = leftEditor.getTokenRange(prevDiff.leftSpan.start, leftEnd);
                        }
                        return;
                    }
                }

                const emptyRange = document.createRange();
                if (emptyEl) {
                    emptyRange.selectNode(emptyEl);
                } else {
                    emptyRange.setStart(emptySnapshot.tokens[emptyStart - 1].endNode, emptySnapshot.tokens[emptyStart - 1].endOffset);
                    emptyRange.collapse(true);
                }

                if (leftCount === 0) {
                    leftDiffEl = emptyEl;
                    leftRange = emptyRange;
                    rightRange = rightEditor.getTokenRange(rightStart, rightEnd);
                } else {
                    rightDiffEl = emptyEl;
                    rightRange = emptyRange;
                    leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                }
            }
            else {
                leftRange = leftEditor.getTokenRange(leftStart, leftEnd);
                rightRange = rightEditor.getTokenRange(rightStart, rightEnd);

                const leftToken = leftTokens[leftStart];
                const rightToken = rightTokens[rightStart];
                if (leftToken.flags & rightToken.flags & TOKEN_FLAGS_LINE_START) {
                    const leftAnchorEl = getAnchorElForLine(leftToken, true);
                    const rightAnchorEl = leftAnchorEl && getAnchorElForLine(rightToken, false);
                    if (leftAnchorEl && rightAnchorEl) {
                        addAnchorPair(leftAnchorEl, rightAnchorEl, diffIndex,
                            leftToken.containerIndex, rightToken.containerIndex);
                    }
                }
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

    private getOrCreateAnchor(which: Node, where: InsertPosition): HTMLElement | null {
        let foundEl: HTMLElement | null = null;
        if (where === "afterend") foundEl = which.nextSibling as HTMLElement;
        else if (where === "afterbegin") foundEl = which.firstChild as HTMLElement;
        else if (where === "beforeend") foundEl = which.lastChild as HTMLElement;
        else if (where === "beforebegin") foundEl = which.previousSibling as HTMLElement;

        if (foundEl?.nodeName === ANCHOR_TAG_NAME) {
            if (this.markerElements.has(foundEl)) return null; // 이미 사용 중 → 실패
            this.markerElements.add(foundEl); // 이전 run 잔여 → 재사용
            return foundEl;
        }

        // 블록 요소 borrow: afterbegin이면 which 자체가 블록 컨테이너이므로 DOM 삽입 없이 재사용
        if (where === "afterbegin" && !this.markerElements.has(which as HTMLElement)) {
            this.markerElements.add(which as HTMLElement);
            return which as HTMLElement;
        }

        const el = document.createElement(ANCHOR_TAG_NAME);
        el.contentEditable = "false";
        if (where === "afterend") {
            which.parentNode!.insertBefore(el, which.nextSibling);
        } else if (where === "beforebegin") {
            which.parentNode!.insertBefore(el, which);
        } else {
            (which as HTMLElement).insertAdjacentElement(where, el);
        }
        this.markerElements.add(el);
        return el;
    }

    private getOrCreateEmptyDiffMarker(which: Node, where: InsertPosition, allowStacking: boolean = false): HTMLElement | null {
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
            if (!allowStacking) {
                return null;
            }
            // 이미 사용 중인 marker. 체인 끝으로 이동하여 그 뒤에 새 marker를 쌓는다.
            // (empty side에 셀이 부족해 여러 diff가 같은 위치를 가리킬 때)
            let last = foundEl;
            while (last.nextSibling &&
                (last.nextSibling as HTMLElement).nodeName === DIFF_TAG_NAME &&
                this.markerElements.has(last.nextSibling as HTMLElement)) {
                last = last.nextSibling as HTMLElement;
            }

            // 체인 끝에 이전 run에서 남은 미사용 DS-DIFF가 있으면 재활용
            const afterLast = last.nextSibling as HTMLElement | null;
            if (afterLast?.nodeName === DIFF_TAG_NAME && !this.markerElements.has(afterLast)) {
                this.markerElements.add(afterLast);
                return afterLast;
            }

            // 새 marker 생성
            const el = document.createElement(DIFF_TAG_NAME);
            el.contentEditable = "false";
            el.innerText = "\u200B";
            last.parentNode!.insertBefore(el, last.nextSibling);
            this.markerElements.add(el);
            return el;
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

        this.markerElements.add(el);
        return el;
    }
}
