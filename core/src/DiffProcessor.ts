import type { DiffEntry, RenderedDiff, Token, DiffOptions, AnchorPair, DiffContext } from "./types";
import { Scheduler } from "./scheduler";
import { Editor } from "./editor/Editor";
import { TokenFlags } from "./TokenFlags";
import { ANCHOR_CLASS_NAME, DIFF_TAG_NAME } from "./constants";

// const DIFF_COLOR_HUES = [

// ];
// const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;

export class DiffProcessor {
    private leftEditor: Editor;
    private rightEditor: Editor;
    private markerElements: Set<HTMLElement> = new Set();

    constructor(leftEditor: Editor, rightEditor: Editor) {
        this.leftEditor = leftEditor;
        this.rightEditor = rightEditor;
    }

    /**
     * 원본 diff 결과를 최종 DiffItem으로 변환
     * - type=0 (unchanged)은 skip
     * - 인접한 같은 type의 entry를 병합
     * - DiffItem으로 변환
     */
    async process({ entries, diffOptions, scheduler, diffPalette }:
        { entries: DiffEntry[]; diffOptions: DiffOptions; scheduler: Scheduler, diffPalette: number[] },
    ): Promise<DiffContext> {
        await scheduler.yield();

        const previouslyUsedMarkers = this.markerElements;
        this.markerElements = new Set();

        const leftTokens = this.leftEditor.tokens;
        const rightTokens = this.rightEditor.tokens;
        const diffs: RenderedDiff[] = [];
        const anchorPairs: AnchorPair[] = [];
        const leftEntries: DiffEntry[] = new Array(leftTokens.length);
        const rightEntries: DiffEntry[] = new Array(rightTokens.length);

        if (entries.length > 0) {
            const numDiffColors = diffPalette.length;
            for (const entry of entries) {
                const leftSpan = entry.left, rightSpan = entry.right;
                const leftToken = leftTokens[leftSpan.start], rightToken = rightTokens[rightSpan.start];

                for (let i = leftSpan.start; i < leftSpan.end; i++) {
                    leftEntries[i] = entry;
                }
                for (let j = rightSpan.start; j < rightSpan.end; j++) {
                    rightEntries[j] = entry;
                }

                if (entry.type === 0) {
                    if (leftToken.flags & rightToken.flags & TokenFlags.LINE_START) {
                        this.addAnchorPair(anchorPairs, leftToken, null, rightToken, null, null);
                        await scheduler.yield();
                    }
                } else {
                    let leftAnchorEl: HTMLElement | null = null;
                    let rightAnchorEl: HTMLElement | null = null;
                    const diffIndex = diffs.length;
                    const hue = diffPalette[diffIndex % numDiffColors];
                    const leftTokenCount = entry.left.end - entry.left.start;
                    const rightTokenCount = entry.right.end - entry.right.start;

                    let leftDiffEl: HTMLElement | null = null;
                    let rightDiffEl: HTMLElement | null = null;

                    if (leftTokenCount > 0 && rightTokenCount > 0) {
                        if (leftToken.flags & TokenFlags.LINE_START) {
                            leftAnchorEl = null;
                            rightAnchorEl = null;
                        }
                    } else {
                        let filledTokens, emptyTokens;
                        let filledSpan, emptySpan;
                        let filledToken, emptyToken;
                        let emptyRoot: HTMLElement;

                        if (leftTokenCount > 0) {
                            filledTokens = leftTokens;
                            emptyTokens = rightTokens;
                            filledSpan = leftSpan;
                            emptySpan = rightSpan;
                            filledToken = leftToken;
                            emptyToken = rightToken;
                            emptyRoot = this.rightEditor.contentElement;
                        } else {
                            filledTokens = rightTokens;
                            emptyTokens = leftTokens;
                            filledSpan = rightSpan;
                            emptySpan = leftSpan;
                            filledToken = rightToken;
                            emptyToken = leftToken;
                            emptyRoot = this.leftEditor.contentElement;
                        }

                        let markerPositionWhere: InsertPosition | null = null;
                        let markerPositionNode: Node | null = null;

                        if (filledToken.flags & TokenFlags.LINE_START) {
                            // filled쪽이 줄의 시작부분에 위치함.
                            // "가능한 경우" empty쪽도 줄의 시작부분에 위치할 수 있게 marker 삽입
                            let diffEl: HTMLElement | null = null;
                            const emptyPrevToken = emptyTokens[emptySpan.start - 1];

                            if (emptySpan.start === 0) {
                                // 두가지 선택
                                // 1. content의 맨 앞(첫 자식) = afterbegin
                                // 2. 첫번째 토큰의 앞 = beforebegin
                                markerPositionWhere = "afterbegin";
                                markerPositionNode = emptyRoot;
                            } else if (emptySpan.start === emptyTokens.length) {
                                // 두가지 선택
                                // 1. content의 맨 뒤(마지막 자식) = beforeend
                                // 2. 마지막 토큰의 뒤 = afterend
                                markerPositionWhere = "beforeend";
                                markerPositionNode = emptyRoot;
                            } else if (emptyPrevToken.endNode !== emptyToken.startNode) {  // 두 토큰이 하나의 노드를 공유하면 요소 삽입 불가능
                                if (emptyToken.flags & TokenFlags.LINE_START) {
                                    // 두 요소 사이에 넣을많은 point들이 많을 수도 있지만
                                    // 무시하고 단순하게 두가지만 생각.
                                    // 1. emptyPrevToken의 뒤 = afterend
                                    // 2. emptyToken의 앞 = beforebegin
                                    markerPositionWhere = "afterend";
                                    markerPositionNode = emptyPrevToken.endNode;
                                }
                            }

                            if (markerPositionWhere && markerPositionNode) {
                                diffEl = this.getOrCreateDiffElement(markerPositionWhere, markerPositionNode);

                                if (diffEl) {
                                    if (leftTokenCount > 0) {
                                        rightDiffEl = diffEl;
                                        rightAnchorEl = diffEl;
                                    } else {
                                        leftDiffEl = diffEl;
                                        leftAnchorEl = diffEl;
                                    }
                                }
                            }
                        }
                    }

                    let leftRange = getRangeFromElement(leftDiffEl) ?? this.leftEditor.getTokenRange(entry.left.start, entry.left.end);
                    let rightRange = getRangeFromElement(rightDiffEl) ?? this.rightEditor.getTokenRange(entry.right.start, entry.right.end);

                    diffs.push({
                        diffIndex,
                        hue: hue,//`hsl(${hue} 100% 80% / 1)`,
                        leftRange,
                        rightRange,
                        leftSpan: { start: entry.left.start, end: entry.left.end },
                        rightSpan: { start: entry.right.start, end: entry.right.end },
                        leftMarkerEl: leftDiffEl,
                        rightMarkerEl: rightDiffEl,
                    });

                    if (leftAnchorEl && rightAnchorEl) {
                        this.addAnchorPair(anchorPairs, leftToken, leftAnchorEl, rightToken, rightAnchorEl, diffIndex);
                        await scheduler.yield();
                    }
                }
            }
        }

        this.cleanupUnsuedMarkers(previouslyUsedMarkers);

        return {
            leftTokens,
            rightTokens,
            diffOptions,
            entries,
            leftEntries,
            rightEntries,
            diffs,
            anchorPairs,
        } as DiffContext;
    }

    private cleanupUnsuedMarkers(previouslyUsedMarkers: Set<HTMLElement>) {
        for (const el of previouslyUsedMarkers) {
            if (!this.markerElements.has(el)) {
                if (el.nodeName === DIFF_TAG_NAME) {
                    if (el.isConnected) {
                        el.remove();
                    }
                } else {
                    deactivateAnchorElement(el);
                }
            }
        }
    }

    private addAnchorPair(
        anchorPairs: AnchorPair[],
        leftToken: Token,
        leftEl: HTMLElement | null,
        rightToken: Token,
        rightEl: HTMLElement | null,
        diffIndex: number | null
    ) {
        // leftEl ??= leftToken.anchorEl;
        // rightEl ??= rightToken.anchorEl;

        // if (!leftEl || !rightEl) {
        //     return null;
        // }

        if (!leftEl) {
            leftEl = this.leftEditor.getOrInsertAnchorElement(leftToken.index);
            if (!leftEl) {
                console.debug("createAnchorPair: failed to create left anchor element");
                return null;
            }
        }
        if (!rightEl) {
            rightEl = this.rightEditor.getOrInsertAnchorElement(rightToken.index);
            if (!rightEl) {
                console.debug("createAnchorPair: failed to create right anchor element");
                return null;
            }
        }

        if (this.markerElements.has(leftEl) || this.markerElements.has(rightEl)) {
            console.debug("createAnchorPair: one of the anchor elements is already being used");
            return null;
        }

        const anchorIndex = anchorPairs.length;
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

        anchorPairs.push(pair);
        this.markerElements.add(leftEl);
        this.markerElements.add(rightEl);
        return pair;
    }

    private getOrCreateDiffElement(where: InsertPosition, node: Node): HTMLElement | null {
        if (!where || !node) {
            return null;
        }

        let diffEl: HTMLElement | null = null;

        if (where === "afterend") {
            diffEl = node.nextSibling as HTMLElement;
        } else if (where === "afterbegin") {
            diffEl = node.firstChild as HTMLElement;
        } else if (where === "beforeend") {
            diffEl = node.lastChild as HTMLElement;
        } else {
            throw new Error(`Unsupported InsertPosition: ${where}`);
        }

        if (diffEl && diffEl.nodeName === DIFF_TAG_NAME && this.markerElements.has(diffEl)) {
            // 이미 사용 중임.
            // 같은 자리에 새로 만들려는 시도는 안하는 것이...
            return null;
        }

        if (!diffEl || diffEl.nodeName !== DIFF_TAG_NAME) {
            diffEl = document.createElement(DIFF_TAG_NAME);
            diffEl.contentEditable = "false";
            diffEl.innerText = "\u200B"; // zero-width space

            if (where === "afterend") {
                node.parentNode!.insertBefore(diffEl, node.nextSibling);
            } else {
                (node as HTMLElement).insertAdjacentElement(where, diffEl);
            }
        }
        this.markerElements.add(diffEl);

        return diffEl;
    }
}

function getRangeFromElement(el: HTMLElement | null): Range | null {
    if (!el) return null;
    const range = document.createRange();
    range.selectNode(el);
    return range;
}


function activateAnchorElement(el: HTMLElement, anchorIndex: number, diffIndex: number | null) {
    el.classList.add(ANCHOR_CLASS_NAME);
    el.dataset.anchorIndex = anchorIndex.toString();
    if (diffIndex !== null) {
        el.dataset.diffIndex = diffIndex.toString();
    } else {
        delete el.dataset.diffIndex;
    }
}
function deactivateAnchorElement(el: HTMLElement) {
    el.classList.remove(ANCHOR_CLASS_NAME);
    el.classList.remove("padded", "striped");
    el.style.removeProperty("--anchor-adjust");
    delete el.dataset.anchorIndex;
    el.dataset.diffIndex && delete el.dataset.diffIndex;
}
