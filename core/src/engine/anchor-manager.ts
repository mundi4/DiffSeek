import { ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

export class AnchorManager {

    private leftEditor: Editor;
    private rightEditor: Editor;
    private markerElements: Set<HTMLElement> = new Set();
    private previouslyUsedMarkers: Set<HTMLElement> | null = null;
    private anchorPairs: AnchorPair[] = [];

    constructor(leftEditor: Editor, rightEditor: Editor) {
        this.leftEditor = leftEditor;
        this.rightEditor = rightEditor;
    }

    beginUpdate() {
        if (this.previouslyUsedMarkers !== null) {
            // 이거 제대로 안하면 메모리 leak
            throw new Error("beginUpdate called while a previous update is still in progress");
        }
        this.previouslyUsedMarkers = this.markerElements;
        this.markerElements = new Set();
        this.anchorPairs.length = 0;
    }

    endUpdate() {
        if (this.previouslyUsedMarkers === null) {
            // 이거 제대로 안하면 메모리 leak
            throw new Error("endUpdate called without a corresponding beginUpdate");
        }
        this.cleanupUnsuedMarkers();
        this.previouslyUsedMarkers = null;
    }

    createAnchorPair(
        leftEl: HTMLElement,
        rightEl: HTMLElement,
        diffIndex: number | null
    ) {
        const anchorIndex = this.anchorPairs.length;

        activateAnchorElement(leftEl, anchorIndex, diffIndex);
        activateAnchorElement(rightEl, anchorIndex, diffIndex);

        const pair = {
            index: anchorIndex,
            leftEl,
            rightEl,
            diffIndex: diffIndex,
            aligned: false,
            delta: 0,
        };

        this.markerElements.add(leftEl);
        this.markerElements.add(rightEl);
        this.anchorPairs.push(pair);

        return pair;
    }

    getOrCreateMarkerElement(tagName: typeof ANCHOR_TAG_NAME | typeof DIFF_TAG_NAME, which: Node, where: InsertPosition): HTMLElement | null {
        if (!which || !where) {
            return null;
        }

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

        let parent: ParentNode | null = null;
        if (foundEl && this.markerElements.has(foundEl)) {
            parent = foundEl.parentNode;
            do {
                // console.warn("getOrCreateMarkerElement: the element at the target position is already being used as a marker, looking for an existing marker element with the correct tag name",
                //     { tagName, which, where, foundEl, parent });
                foundEl = foundEl.nextSibling as HTMLElement;
            } while (foundEl && this.markerElements.has(foundEl));
        }

        let el: HTMLElement;

        if (!foundEl || foundEl.nodeName !== tagName) {
            const beforeMe = foundEl;
            el = document.createElement(tagName);
            el.contentEditable = "false";
            if (tagName === DIFF_TAG_NAME) {
                el.innerText = "\u200B"; // zero-width space
            } else {

            }
            if (parent) {
                parent.insertBefore(el, beforeMe);
            } else if (where === "afterend") {
                which.parentNode!.insertBefore(el, which.nextSibling);
            } else {
                (which as HTMLElement).insertAdjacentElement(where, el);
            }
        } else {
            el = foundEl;
        }

        this.markerElements.add(el);

        return el;
    }

    cleanupUnsuedMarkers() {
        if (this.previouslyUsedMarkers === null) {
            return;
        }

        for (const el of this.previouslyUsedMarkers) {
            if (!this.markerElements.has(el)) {
                if (el.isConnected) {
                    el.remove();
                }
            }
        }
    }

    async alignAnchors(signal: AbortSignal) {
        // 다음 AF에서 시작
        await nextAnimationFrame(signal);

        const IDLE_THRESHOLD = 10;

        const startTime = performance.now();
        let numFrames = 0;

        let t = startTime;
        const anchorPairs = this.anchorPairs;
        const leftEditor = this.leftEditor;
        const rightEditor = this.rightEditor;

        let leftScrollTop = leftEditor.rootElement.scrollTop;
        let rightScrollTop = rightEditor.rootElement.scrollTop;
        let leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
        let rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

        async function yieldIfNeeded(force = false) {
            const now = performance.now();
            if (force || now - t > IDLE_THRESHOLD) {
                await nextAnimationFrame(signal);
                numFrames++;
                t = now;
                // 찰라의 시간 동안 스크롤 위치가 바뀌었을 수 있다! resize시에는 현재 작업이 취소되니 rect는 바뀌지 않는다고 생각하자.
                leftScrollTop = leftEditor.rootElement.scrollTop;
                rightScrollTop = rightEditor.rootElement.scrollTop;
                return true;
            }
            return false;
        }

        for (const pair of anchorPairs) {
            // pair.delta = 0;
            pair.leftEl.classList.remove("padded", "striped");
            pair.leftEl.style.removeProperty("--anchor-adjust");
            pair.rightEl.classList.remove("padded", "striped");
            pair.rightEl.style.removeProperty("--anchor-adjust");
        }

        await nextAnimationFrame(signal);
        numFrames++;

        // 다음 AF로 넘어갔으니까 reflow는 필요 없지 않을까?
        // leftEditor.forceReflow();
        // rightEditor.forceReflow();

        for (let i = 0; i < anchorPairs.length; i++) {
            // if ((i & 0xf) === 0) {
            //     await yieldIfNeeded();
            // }

            const pair = anchorPairs[i];
            const { leftEl, rightEl } = pair;
            let leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
            let rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
            let delta = Math.round(leftY - rightY);
            if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                const affectedEl = this.applyDeltaToPair(pair, delta, false);
                if ((i & 0xf) === 0) {
                    await yieldIfNeeded();
                } else {
                    if (affectedEl) {
                        affectedEl.offsetHeight; // force reflow
                        leftScrollTop = leftEditor.rootElement.scrollTop;
                        rightScrollTop = rightEditor.rootElement.scrollTop;
                    }
                }
            } else {
                if ((i & 0xf) === 0) {
                    await yieldIfNeeded();
                }
            }
        }

        await nextAnimationFrame(signal);
        numFrames++;

        // leftEditor.forceReflow();
        // rightEditor.forceReflow();

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

    private applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean): HTMLElement | null {
        if (delta < -MIN_DELTA || delta > MIN_DELTA) {
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
            return theEl;
        }
        return null;
    }
}

// 기존에 앵커를 비활성화/재사용 할 때 쓰던 코드인데...
function activateAnchorElement(el: HTMLElement, anchorIndex: number, diffIndex: number | null) {
    el.dataset.anchorIndex = anchorIndex.toString();
    if (diffIndex !== null) {
        el.dataset.diffIndex = diffIndex.toString();
    } else {
        delete el.dataset.diffIndex;
    }
}
