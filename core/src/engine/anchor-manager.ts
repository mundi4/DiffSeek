import { ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import type { ContainerInfo } from "../tokenization";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

export class AnchorManager {
    private leftEditor: Editor;
    private rightEditor: Editor;
    private anchorPairs: AnchorPair[] = [];
    private anchorPairMap: Map<HTMLElement, AnchorPair> = new Map();
    private prevAnchorPairMap: Map<HTMLElement, AnchorPair> | null = null;
    //private markerElements: Set<HTMLElement> = new Set();
    //private previouslyUsedMarkers: Set<HTMLElement> | null = null;

    constructor(leftEditor: Editor, rightEditor: Editor) {
        this.leftEditor = leftEditor;
        this.rightEditor = rightEditor;
    }

    beginUpdate() {
        if (this.prevAnchorPairMap !== null) {
            // 이미 beginUpdate가 호출된 상태에서 endUpdate 없이 다시 beginUpdate가 호출됨
            // 즉 내가 영구짓을 하고 있음. 절대적으로 있어서는 안되는 일.
            throw new Error("beginUpdate called while a previous update is still in progress");
        }
        this.anchorPairs.length = 0;
        this.prevAnchorPairMap = this.anchorPairMap;
        this.anchorPairMap = new Map();
    }

    endUpdate() {
        if (this.prevAnchorPairMap === null) {
            // beginUpdate가 호출되지 않은 상태에서 endUpdate가 호출됨!
            throw new Error("endUpdate called without a corresponding beginUpdate");
        }
        this.cleanupUnsuedMarkers();
        this.prevAnchorPairMap = null;
    }

    addAnchorPair(leftMarker: HTMLElement, rightMarker: HTMLElement) {
        let pair = this.prevAnchorPairMap!.get(leftMarker);
        if (pair) {
            if (pair.leftEl !== leftMarker || pair.rightEl !== rightMarker) {
                pair = undefined;
            }
        }

        if (!pair) {
            pair = {
                index: this.anchorPairs.length,
                leftEl: leftMarker,
                rightEl: rightMarker,
                diffIndex: null,
                leftContainerIndex: -1,
                rightContainerIndex: -1,
                isBaseline: false
            }
        }

        this.anchorPairs.push(pair);
        return pair;
    }

    tryAddAnchorPair(leftTokenIndex: number, rightTokenIndex: number, diffIndex: number | null): AnchorPair | null {
        const leftToken = this.leftEditor.tokens[leftTokenIndex];
        const rightToken = this.rightEditor.tokens[rightTokenIndex];
        const lLine = this.leftEditor.lineBoundaries[leftToken.lineNumber];
        const rLine = this.rightEditor.lineBoundaries[rightToken.lineNumber];

        if (lLine && rLine && lLine.startWhich && rLine.startWhich) {
            const leftEl = this.getOrCreateMarkerElement(ANCHOR_TAG_NAME, lLine.startWhich, lLine.startWhere!);
            const rightEl = this.getOrCreateMarkerElement(ANCHOR_TAG_NAME, rLine.startWhich, rLine.startWhere!);

            if (leftEl && rightEl) {
                // 기존에 존재하던 앵커쌍이었는지... 만약 그렇다면 이미 두 앵커는 정렬이 되어있을 가능성이 높기 때문에 최적화의 여지가 있음!
                let pair = this.prevAnchorPairMap?.get(leftEl);
                if (pair) {
                    if (pair.leftEl !== leftEl || pair.rightEl !== rightEl) {
                        pair = undefined;
                    }
                }

                if (!pair) {
                    pair = {
                        index: this.anchorPairs.length,
                        leftEl,
                        rightEl,
                        diffIndex,
                        leftContainerIndex: leftToken.containerIndex,
                        rightContainerIndex: rightToken.containerIndex,
                        isBaseline: false,
                    };
                } else {
                    pair.diffIndex = diffIndex;
                    pair.leftContainerIndex = leftToken.containerIndex;
                    pair.rightContainerIndex = rightToken.containerIndex;
                }

                this.anchorPairMap.set(leftEl, pair);
                this.anchorPairMap.set(rightEl, pair);
                this.anchorPairs.push(pair);
                return pair;

            } else {
                // console.debug("addAnchorPair: failed to create marker elements for tokens", { leftToken, rightToken, lLine, rLine });
            }
        } else {
            // console.debug("addAnchorPair: line boundary missing for tokens", { leftToken, rightToken });
        }

        return null;
    }

    createAnchorPair(
        leftEl: HTMLElement,
        rightEl: HTMLElement,
        diffIndex: number | null,
        leftContainerIndex: number = 0,
        rightContainerIndex: number = 0,
    ) {
        const anchorIndex = this.anchorPairs.length;

        activateAnchorElement(leftEl, anchorIndex, diffIndex);
        activateAnchorElement(rightEl, anchorIndex, diffIndex);

        const pair = {
            index: anchorIndex,
            leftEl,
            rightEl,
            diffIndex: diffIndex,
            leftContainerIndex,
            rightContainerIndex,
            aligned: false,
            delta: 0,
            isBaseline: false,
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
        for (const pair of this.prevAnchorPairMap!.values()) {
            if (!this.anchorPairMap.has(pair.leftEl)) {
                // 그냥 삭제해버리는 것이 낫다. 이미 사용되지 않는데 다음에 재사용 될 가능성은 높지 않을 것 같고 재사용된다고 하더라도 기존 그 수는 많지 않을 것.
                // 필요하면 다시 생성하면 된다.
                if (pair.leftEl.isConnected) {
                    pair.leftEl.remove();
                }
            }
            if (!this.anchorPairMap.has(pair.rightEl)) {
                if (pair.rightEl.isConnected) {
                    pair.rightEl.remove();
                }
            }
        }
    }

    async alignAnchors(signal: AbortSignal) {
        await nextAnimationFrame(signal);

        const BATCH_SIZE = 16;
        const startTime = performance.now();
        let numFrames = 0;

        const anchorPairs = this.anchorPairs;
        const leftEditor = this.leftEditor;
        const rightEditor = this.rightEditor;

        // resize 시 작업이 취소되므로 editorTop은 전체 실행 동안 불변이라고 가정할 수 있지 않을까?
        const leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
        const rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

        let leftScrollTop = leftEditor.rootElement.scrollTop;
        let rightScrollTop = rightEditor.rootElement.scrollTop;

        let lastLeftContainerIndex = -1;
        let lastRightContainerIndex = -1;
        let leftAccum = 0;
        let rightAccum = 0;

        // 앵커 중에서도 일부 앵커들을 기준점으로 잡자
        // 문서의 일부가 변경되었을 때도 기준점 정렬만으로도 해당 기준점을 기준으로 하는 앵커들을 재정렬 할 필요가 없게
        // 아니다. 문서가 변경되면 앵커 배열도 새로 만들어지지 않나?
        // 리사이즈 시에는 어차피 전체 재정렬이 필요하고...

        for (let i = 0; i < anchorPairs.length; i++) {
            const pair = anchorPairs[i];
            const { leftEl, rightEl, leftContainerIndex, rightContainerIndex } = pair;

            if (leftContainerIndex !== lastLeftContainerIndex || rightContainerIndex !== lastRightContainerIndex) {
                pair.isBaseline = true;
            } else {
                pair.isBaseline = false;
            }
        }

        for (let i = 0; i < anchorPairs.length; i++) {
            const pair = anchorPairs[i];
            const { leftEl, rightEl, leftContainerIndex, rightContainerIndex } = pair;

            if (leftContainerIndex !== lastLeftContainerIndex || rightContainerIndex !== lastRightContainerIndex) {
                pair.isBaseline = true;
            } else {
                pair.isBaseline = false;
            }

            if (pair.isBaseline) {
                leftAccum = (leftEditor.containers[leftContainerIndex].el.getBoundingClientRect().y + leftScrollTop - leftEditorTop + 0.5) | 0;
                lastLeftContainerIndex = leftContainerIndex;
                rightAccum = (rightEditor.containers[rightContainerIndex].el.getBoundingClientRect().y + rightScrollTop - rightEditorTop + 0.5) | 0;
                lastRightContainerIndex = rightContainerIndex;
            }

            const leftY = leftAccum + leftEl.offsetTop;
            const rightY = rightAccum + rightEl.offsetTop;
            const delta = leftY - rightY;
            if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                // 여기부터 처리 필요
            }
        }


        // 이전 정렬 스타일 제거
        for (const pair of anchorPairs) {
            pair.leftEl.classList.remove("padded", "striped");
            pair.leftEl.style.removeProperty("--anchor-adjust");
            pair.rightEl.classList.remove("padded", "striped");
            pair.rightEl.style.removeProperty("--anchor-adjust");
        }

        await nextAnimationFrame(signal);
        numFrames++;



        // 배치 루프: BCR batch-read → arithmetic correction → 시간 초과 시에만 yield
        // yield 없이 다음 배치로 넘어갈 때는 다음 배치의 BCR read가 synchronous reflow를 유발
        // (pair당 1회 → 배치당 1회로 개선)
        const IDLE_THRESHOLD = 10;
        let t = performance.now();

        const leftYs = new Array<number>(BATCH_SIZE);
        const rightYs = new Array<number>(BATCH_SIZE);

        for (let i = 0; i < anchorPairs.length; i++) {
            // yield 해야할 지.
            // 한 AF 내에서 너무 많은 작업을 하지 않기 위해. 그리고 처음에는 무조건 한번 yield 하기
            if ((i & (BATCH_SIZE - 1)) === 0) {


            }
        }

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

            // 시간이 충분히 남아있으면 yield 없이 다음 배치로 진행
            // (다음 배치의 BCR read가 필요 시 synchronous reflow를 유발)
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

    private applyDeltaToPair(pair: AnchorPair, delta: number): HTMLElement | null {
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
