import { ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair, MarkerElementsMap } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

type ScrollRef = { el: HTMLElement; targetTop: number; rootEl: HTMLElement };

function captureScrollRef(editor: Editor): ScrollRef | null {
    const root = editor.rootElement;
    const content = editor.contentElement;
    const rootRect = root.getBoundingClientRect();
    const probeY = rootRect.top + 20;
    const steps = Math.max(4, Math.floor(rootRect.width / 80));

    for (let i = 0; i <= steps; i++) {
        const x = rootRect.left + (rootRect.width * i) / steps;
        const stack = document.elementsFromPoint(x, probeY);
        const hit = stack.find(e => e !== content && content.contains(e)) as HTMLElement | undefined;
        if (hit) {
            const refRect = hit.getBoundingClientRect();
            return { el: hit, targetTop: refRect.top - rootRect.top, rootEl: root };
        }
    }
    return null;
}

function restoreFromRef(ref: ScrollRef): void {
    if (!ref.el.isConnected) return;
    const rootRect = ref.rootEl.getBoundingClientRect();
    const refRect = ref.el.getBoundingClientRect();
    const currentTop = refRect.top - rootRect.top;
    const delta = currentTop - ref.targetTop;
    ref.rootEl.scrollTop += delta;
}

function refreshRef(ref: ScrollRef): void {
    const rootRect = ref.rootEl.getBoundingClientRect();
    const refRect = ref.el.getBoundingClientRect();
    ref.targetTop = refRect.top - rootRect.top;
}

export async function alignAnchors({
    anchorPairs,
    leftEditor,
    rightEditor,
    markerElements,
    signal,
}: {
    anchorPairs: readonly AnchorPair[];
    leftEditor: Editor;
    rightEditor: Editor;
    markerElements: MarkerElementsMap;
    signal: AbortSignal;
}) {
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

    const leftRef = captureScrollRef(leftEditor);
    const rightRef = captureScrollRef(rightEditor);

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
            let leftY = pair.leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
            let rightY = pair.rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
            if (pair.delta < 0 && pair.leftEl.nodeName === ANCHOR_TAG_NAME) {
                // DS-ANCHOR는 콘텐츠 앞에 삽입된 별도 요소이므로
                // ::before 패딩이 후속 콘텐츠를 밀어냄 → 보정 필요
                // 블록 요소 borrow는 콘텐츠 컨테이너 자체이므로 보정 불필요
                leftY += pair.delta;
            } else if (pair.delta > 0 && pair.rightEl.nodeName === ANCHOR_TAG_NAME) {
                rightY -= pair.delta;
            }
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
            if (adjustedAboveViewportBottom) {
                if (leftRef) { restoreFromRef(leftRef); refreshRef(leftRef); }
                if (rightRef) { restoreFromRef(rightRef); refreshRef(rightRef); }
                adjustedAboveViewportBottom = false;
            }
            t = performance.now();
            leftScrollTop = leftEditor.rootElement.scrollTop;
            rightScrollTop = rightEditor.rootElement.scrollTop;
        }
    }

    console.debug(`Adjusted ${numAdjusted} anchor pairs, skipped ${numSkipped} pairs that were within the delta threshold of ${MIN_DELTA}px`);

    // 최종 RAF: 래퍼(diffseek-engine.ts)의 restoreScrollPosition()을 위해
    // savedScroll을 채움 (elementsFromPoint 재호출 없이 캐싱된 ref 사용)
    if (adjustedAboveViewportBottom) {
        if (leftRef) {
            refreshRef(leftRef);
            leftEditor.setSavedScroll(leftRef);
        }
        if (rightRef) {
            refreshRef(rightRef);
            rightEditor.setSavedScroll(rightRef);
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
