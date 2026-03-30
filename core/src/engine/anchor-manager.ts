import { DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

export class AnchorManager {
    private leftEditor: Editor;
    private rightEditor: Editor;

    constructor(leftEditor: Editor, rightEditor: Editor) {
        this.leftEditor = leftEditor;
        this.rightEditor = rightEditor;
    }

    async alignAnchors(anchorPairs: readonly AnchorPair[], signal: AbortSignal) {
        await nextAnimationFrame(signal);

        const BATCH_SIZE = 16;
        const startTime = performance.now();
        let numFrames = 0;

        const leftEditor = this.leftEditor;
        const rightEditor = this.rightEditor;

        const leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
        const rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

        let leftScrollTop = leftEditor.rootElement.scrollTop;
        let rightScrollTop = rightEditor.rootElement.scrollTop;

        // 이전 정렬 스타일 제거
        for (const pair of anchorPairs) {
            pair.leftEl.classList.remove("padded", "striped");
            pair.leftEl.style.removeProperty("--anchor-adjust");
            pair.rightEl.classList.remove("padded", "striped");
            pair.rightEl.style.removeProperty("--anchor-adjust");
        }

        await nextAnimationFrame(signal);
        numFrames++;

        const IDLE_THRESHOLD = 10;
        let t = performance.now();

        const leftYs = new Array<number>(BATCH_SIZE);
        const rightYs = new Array<number>(BATCH_SIZE);

        for (let batchStart = 0; batchStart < anchorPairs.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, anchorPairs.length);
            const batchSize = batchEnd - batchStart;

            // Phase 1: 배치 내 모든 BCR 읽기 (쓰기 없음 → reflow 1회)
            for (let j = 0; j < batchSize; j++) {
                const { leftEl, rightEl } = anchorPairs[batchStart + j];
                leftYs[j] = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
                rightYs[j] = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
            }

            // Phase 2: arithmetic correction으로 delta 계산 및 적용
            let leftAccum = 0;
            let rightAccum = 0;
            let prevLeftContainerIndex = -1;
            let prevRightContainerIndex = -1;

            for (let j = 0; j < batchSize; j++) {
                const pair = anchorPairs[batchStart + j];

                if (pair.leftContainerIndex !== prevLeftContainerIndex) {
                    leftAccum = 0;
                    prevLeftContainerIndex = pair.leftContainerIndex;
                }
                if (pair.rightContainerIndex !== prevRightContainerIndex) {
                    rightAccum = 0;
                    prevRightContainerIndex = pair.rightContainerIndex;
                }

                const delta = Math.round((leftYs[j] + leftAccum) - (rightYs[j] + rightAccum));
                if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                    this.applyDeltaToPair(pair, delta);
                    if (delta > 0) {
                        rightAccum += delta;
                    } else {
                        leftAccum += -delta;
                    }
                }
            }

            const now = performance.now();
            if (now - t > IDLE_THRESHOLD) {
                await nextAnimationFrame(signal);
                numFrames++;
                t = performance.now();
                leftScrollTop = leftEditor.rootElement.scrollTop;
                rightScrollTop = rightEditor.rootElement.scrollTop;
            }
        }

        await nextAnimationFrame(signal);
        numFrames++;

        const leftContentHeight = leftEditor.contentElement.offsetHeight;
        const rightContentHeight = rightEditor.contentElement.offsetHeight;
        if (leftContentHeight > rightContentHeight) {
            leftEditor.heightBoostElement.style.height = `0px`;
            rightEditor.heightBoostElement.style.height = `${leftContentHeight - rightContentHeight}px`;
        } else if (rightContentHeight > leftContentHeight) {
            leftEditor.heightBoostElement.style.height = `${rightContentHeight - leftContentHeight}px`;
            rightEditor.heightBoostElement.style.height = `0px`;
        } else {
            leftEditor.heightBoostElement.style.height = `0px`;
            rightEditor.heightBoostElement.style.height = `0px`;
        }

        if (import.meta.env.DEV) {
            console.debug(`Aligned ${anchorPairs.length} anchor pairs in ${performance.now() - startTime}ms (${numFrames} frames)`);
        }
    }

    private applyDeltaToPair(pair: AnchorPair, delta: number) {
        let theEl: HTMLElement;
        if (delta > 0) {
            theEl = pair.rightEl;
        } else {
            delta = -delta;
            theEl = pair.leftEl;
        }
        theEl.style.setProperty("--anchor-adjust", `${delta}px`);
        theEl.classList.add("padded");
        if (theEl.nodeName !== DIFF_TAG_NAME && delta >= MIN_STRIPED_DELTA) {
            theEl.classList.add("striped");
        }
    }
}
