import { DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import type { SavedScrollRef } from "../editor/types";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair, MarkerElementsMap } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

export async function alignAnchors({
    anchorPairs,
    leftEditor,
    rightEditor,
    markerElements,
    signal,
    scrollRestore: initialScrollRestore,
}: {
    anchorPairs: readonly AnchorPair[];
    leftEditor: Editor;
    rightEditor: Editor;
    markerElements: MarkerElementsMap;
    signal: AbortSignal;
    scrollRestore?: { saved: SavedScrollRef; editor: Editor; otherEditor: Editor };
}) {
    let scrollRestore = initialScrollRestore;
    await nextAnimationFrame(signal);

    const BATCH_SIZE = 16;
    const startTime = performance.now();
    let numFrames = 0;

    const leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
    const rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

    let leftScrollTop = leftEditor.rootElement.scrollTop;
    let rightScrollTop = rightEditor.rootElement.scrollTop;

    await nextAnimationFrame(signal);
    numFrames++;

    const IDLE_THRESHOLD = 10;
    let t = performance.now();

    let numAdjusted = 0;
    let numSkipped = 0;
    let adjustedAboveViewportBottom = false;

    for (let batchStart = 0; batchStart < anchorPairs.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, anchorPairs.length);
        const batchSize = batchEnd - batchStart;

        for (let j = 0; j < batchSize; j++) {
            const pair = anchorPairs[batchStart + j];
            const leftY = pair.leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
            const rightY = pair.rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
            // delta = 패딩 적용 전 두 앵커의 Y 위치 차이.
            // gBCR.y는 ::before 패딩에 영향받지 않는 요소 top을 반환하므로
            // 별도 보정 없이 leftY - rightY가 패딩 전 위치 차이가 됨.
            const delta = Math.round(leftY - rightY);
            const deltadelta = delta - pair.delta;
            if (deltadelta < -MIN_DELTA || deltadelta > MIN_DELTA) {
                applyDeltaToPair(pair, delta, markerElements);
                // scroll anchoring 보정: 뷰포트 위 요소에 padding 적용 시
                // 브라우저가 scrollTop을 자동 조정하므로 즉시 다시 읽어야 함
                leftScrollTop = leftEditor.rootElement.scrollTop;
                rightScrollTop = rightEditor.rootElement.scrollTop;
                numAdjusted++;

                // 뷰포트 내/위 요소가 조정된 경우에만 restore 필요
                if (!adjustedAboveViewportBottom) {
                    const adjustedY = delta > 0 ? rightY : leftY;
                    const scrollTop = delta > 0 ? rightScrollTop : leftScrollTop;
                    const viewportHeight = delta > 0
                        ? rightEditor.rootElement.clientHeight
                        : leftEditor.rootElement.clientHeight;
                    if (adjustedY < scrollTop + viewportHeight) {
                        adjustedAboveViewportBottom = true;
                    }
                }
            } else {
                numSkipped++;
            }
        }

        const now = performance.now();
        if (now - t > IDLE_THRESHOLD) {
            await nextAnimationFrame(signal);
            numFrames++;

            // yield 전후 scrollTop 비교로 사용자 스크롤 감지
            if (scrollRestore) {
                const newLeft = leftEditor.rootElement.scrollTop;
                const newRight = rightEditor.rootElement.scrollTop;
                const leftChanged = newLeft !== leftScrollTop;
                const rightChanged = newRight !== rightScrollTop;
                if (leftChanged || rightChanged) {
                    // 사용자가 스크롤함 → restore 포기
                    scrollRestore = undefined;
                    adjustedAboveViewportBottom = false;
                }
            }

            if (adjustedAboveViewportBottom && scrollRestore) {
                scrollRestore.editor.restoreScrollPosition(scrollRestore.saved);
                scrollRestore.otherEditor.rootElement.scrollTop = scrollRestore.editor.rootElement.scrollTop;
                adjustedAboveViewportBottom = false;
            }
            t = performance.now();
            leftScrollTop = leftEditor.rootElement.scrollTop;
            rightScrollTop = rightEditor.rootElement.scrollTop;
        }
    }

    console.debug(`Adjusted ${numAdjusted} anchor pairs, skipped ${numSkipped} pairs that were within the delta threshold of ${MIN_DELTA}px`);

    if (adjustedAboveViewportBottom && scrollRestore) {
        scrollRestore.editor.restoreScrollPosition(scrollRestore.saved);
        scrollRestore.otherEditor.rootElement.scrollTop = scrollRestore.editor.rootElement.scrollTop;
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

function applyDeltaToPair(pair: AnchorPair, delta: number, markerElements: MarkerElementsMap) {
    let theEl: HTMLElement;
    let otherEl: HTMLElement;
    pair.delta = delta;
    if (delta > 0) {
        theEl = pair.rightEl;
        otherEl = pair.leftEl;
    } else {
        delta = -delta;
        theEl = pair.leftEl;
        otherEl = pair.rightEl;
    }
    // 반대쪽 이전 패딩 제거
    otherEl.classList.remove("ds-padded", "ds-striped");
    otherEl.style.removeProperty("--ds-adjust");
    const otherInfo = markerElements.get(otherEl);
    if (otherInfo) otherInfo.adjust = 0;

    // 적용
    theEl.style.setProperty("--ds-adjust", `${delta}px`);
    theEl.classList.add("ds-padded");
    if (theEl.nodeName !== DIFF_TAG_NAME && delta >= MIN_STRIPED_DELTA) {
        theEl.classList.add("ds-striped");
    }
    const theInfo = markerElements.get(theEl);
    if (theInfo) theInfo.adjust = delta;
}
