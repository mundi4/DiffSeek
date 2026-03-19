import { ABORT_REASON_CANCELLED, ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import { Scheduler } from "../scheduler";
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

    async alignAnchors(abortSignal: AbortSignal) {
        return new Promise<void>((resolve, reject) => {
            requestAnimationFrame(async () => {
                try {
                    if (abortSignal.aborted) {
                        reject(ABORT_REASON_CANCELLED);
                        return;
                    }

                    const scheduler = new Scheduler({ signal: abortSignal, yieldInterval: 0 });
                    const anchorPairs = this.anchorPairs;

                    const leftEditor = this.leftEditor;
                    const rightEditor = this.rightEditor;

                    for (const pair of anchorPairs) {
                        pair.delta = 0;
                        if (pair.leftEl) {
                            pair.leftEl.classList.remove("aligned");
                            pair.leftEl.classList.remove("padded");
                            pair.leftEl.style.removeProperty("--anchor-adjust");
                        }
                        if (pair.rightEl) {
                            pair.rightEl.classList.remove("aligned");
                            pair.rightEl.classList.remove("padded");
                            pair.rightEl.style.removeProperty("--anchor-adjust");
                        }
                    }

                    leftEditor.forceReflow();
                    rightEditor.forceReflow();

                    let leftScrollTop = leftEditor.rootElement.scrollTop;
                    let rightScrollTop = rightEditor.rootElement.scrollTop;
                    let leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
                    let rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

                    for (let i = 0; i < anchorPairs.length; i++) {
                        if ((i & 0x1f) === 0) {
                            await scheduler.yield();
                        }

                        const pair = anchorPairs[i];
                        const { leftEl, rightEl } = pair;
                        // 낙관적으로 --anchor-adjust 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기

                        let leftY;
                        let rightY;
                        leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
                        rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;

                        let delta = Math.round(leftY - rightY);
                        if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                            if (pair.delta > 0) {
                                rightEl.classList.remove("aligned");
                                rightEl.classList.remove("padded");
                                rightEl.style.removeProperty("--anchor-adjust");
                                void rightEl.offsetHeight; // force reflow
                                rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;
                                rightScrollTop = rightEditor.rootElement.scrollTop;
                            } else if (pair.delta < 0) {
                                leftEl.classList.remove("aligned");
                                leftEl.classList.remove("padded");
                                leftEl.style.removeProperty("--anchor-adjust");
                                void leftEl.offsetHeight; // force reflow
                                leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
                                leftScrollTop = leftEditor.rootElement.scrollTop;
                            }

                            leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
                            rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
                            delta = Math.round(leftY - rightY);

                            if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                                if (this.applyDeltaToPair(pair, delta, true)) {
                                    leftScrollTop = leftEditor.rootElement.scrollTop;
                                    rightScrollTop = rightEditor.rootElement.scrollTop;
                                }
                            }
                        }
                    }

                    await scheduler.yield();
                    leftEditor.forceReflow();
                    rightEditor.forceReflow();

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

                    resolve();
                } catch (e) {
                    if (e === ABORT_REASON_CANCELLED) {
                        return;
                    }
                    reject(e);
                }
            });
        });
    }

    private applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean) {
        let changed = false;
        if (delta < -MIN_DELTA || delta > MIN_DELTA) {
            if (pair.delta !== delta) {
                pair.delta = delta;
                changed = true;
            }
            let theEl: HTMLElement;
            if (delta > 0) {
                theEl = pair.rightEl;
            } else {
                delta = -delta;
                theEl = pair.leftEl;
            }
            theEl.style.setProperty("--anchor-adjust", `${delta}px`);
            theEl.classList.add("aligned");
            theEl.classList.add("padded");
            if (theEl.nodeName !== DIFF_TAG_NAME) {
                theEl.classList.toggle("striped", delta >= MIN_STRIPED_DELTA);
            }
            if (reflow) {
                void theEl.offsetHeight; // force reflow
            }
        }
        return changed;
    }
}

function activateAnchorElement(el: HTMLElement, anchorIndex: number, diffIndex: number | null) {
    el.dataset.anchorIndex = anchorIndex.toString();
    if (diffIndex !== null) {
        el.dataset.diffIndex = diffIndex.toString();
    } else {
        delete el.dataset.diffIndex;
    }
}
