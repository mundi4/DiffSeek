// import { ANCHOR_CLASS_NAME, ANCHOR_TAG_NAME, BLOCK_ELEMENTS, DIFF_TAG_NAME } from "./constants";
// import { TokenFlags } from "./TokenFlags";
// import type { DiffEntry, EditorContext, RenderedDiff } from "./types";
// import { Scheduler } from "./scheduler";
// import { Editor } from "./Editor";

// type AnchorPair = {
//     index: number;
//     leftEl: HTMLElement;
//     rightEl: HTMLElement;
//     diffIndex: number | null;
//     aligned: boolean;
//     delta: number;
// }

// const MIN_DELTA = 1;
// const MIN_STRIPED_DELTA = 1;

// function deactivateAnchorElement(el: HTMLElement) {
//     el.classList.remove(ANCHOR_CLASS_NAME);
//     el.classList.remove("padded", "striped");
//     el.style.removeProperty("--anchor-adjust");
//     delete el.dataset.anchorIndex;
//     el.dataset.diffIndex && delete el.dataset.diffIndex;
// }

// function activateAnchorElement(el: HTMLElement, anchorIndex: number, diffIndex: number | null) {
//     el.classList.add(ANCHOR_CLASS_NAME);
//     el.dataset.anchorIndex = anchorIndex.toString();
//     if (diffIndex !== null) {
//         el.dataset.diffIndex = diffIndex.toString();
//     } else {
//         delete el.dataset.diffIndex;
//     }
// }

// export class DiffPresentation {
//     #leftEditor: Editor;
//     #rightEditor: Editor;
//     #anchorMap: WeakMap<HTMLElement, AnchorPair> = new WeakMap();
//     #anchorPairs: AnchorPair[] = [];
//     #anchorElementsBeingUsed: Set<HTMLElement> = new Set();

//     constructor(leftEditor: Editor, rightEditor: Editor) {
//         this.#leftEditor = leftEditor;
//         this.#rightEditor = rightEditor;
//     }

//     /**
//      * DiffItem 적용 - 초기 마킹 및 앵커/마커 삽입
//      * diff 계산 완료 후 정확히 한 번 호출됨
//      */
//     async apply(entries: DiffEntry[], diffs: RenderedDiff[], signal?: AbortSignal): Promise<void> {
//         const scheduler = new Scheduler({ signal });

//         for (const pair of this.#anchorPairs) {
//             deactivateAnchorElement(pair.leftEl);
//             deactivateAnchorElement(pair.rightEl);
//         }
//         this.#anchorPairs.length = 0;

//         for (const anchor of this.#anchorElementsBeingUsed) {
//             deactivateAnchorElement(anchor);
//         }

//         this.#anchorElementsBeingUsed.clear();

//         const leftTokens = this.#leftEditor.tokens;
//         const rightTokens = this.#rightEditor.tokens;
//         let diffIndex = 0;
//         for (let i = 0; i < entries.length; i++) {
//             const entry = entries[i];

//             const leftTokenIndex = entry.left.start,
//                 rightTokenIndex = entry.right.start;

//             const leftToken = leftTokens[leftTokenIndex],
//                 rightToken = rightTokens[rightTokenIndex];

//             if (!leftToken || !rightToken) {
//                 continue;
//             }

//             // if (leftToken.anchorEl && rightToken.anchorEl) {
//             //     this.#anchorPairs[anchorCount++] = {
//             //         index: anchorCount,
//             //         leftEl: leftToken.anchorEl,
//             //         rightEl: rightToken.anchorEl,
//             //         diffIndex: null,
//             //         aligned: false,
//             //         delta: 0,
//             //     };
//             // }

//             if (entry.type === 0) {
//                 if (leftToken.flags & rightToken.flags & TokenFlags.LINE_START) {
//                     this.createAnchorPair(leftTokenIndex, leftToken.anchorEl, rightTokenIndex, rightToken.anchorEl, i);
//                 }
//             } else {
//                 const leftLen = entry.left.end - entry.left.start,
//                     rightLen = entry.right.end - entry.right.start;

//                 const diff = diffs[diffIndex++];
//                 if (leftLen > 0 && rightLen > 0) {
//                     if (leftToken.flags & rightToken.flags & TokenFlags.LINE_START) {
//                         this.createAnchorPair(leftTokenIndex, leftToken.anchorEl, rightTokenIndex, rightToken.anchorEl, diffIndex - 1);
//                     }
//                 } else if (diff.leftMarkerEl || diff.rightMarkerEl) {
//                     const leftEl = diff.leftMarkerEl ?? leftToken.anchorEl;
//                     const rightEl = diff.rightMarkerEl ?? rightToken.anchorEl;
//                     this.createAnchorPair(leftTokenIndex, leftEl, rightTokenIndex, rightEl, diffIndex - 1);
//                 }
//             }
//         }

//         // cleanup unused anchors
//         // for (let i = anchorCount; i < this.#anchorPairs.length; i++) {
//         //     const pair = this.#anchorPairs[i];
//         //     const leftEl = pair.leftEl,
//         //         rightEl = pair.rightEl;
//         //     if (!this.#anchorElementsBeingUsed.has(leftEl)) {
//         //         leftEl.classList.remove(ANCHOR_CLASS_NAME);
//         //         delete leftEl.dataset.anchorIndex;
//         //         delete leftEl.dataset.diffIndex;
//         //         leftEl.classList.remove("padded");
//         //         leftEl.style.removeProperty("--anchor-adjust");
//         //     }
//         //     if (!this.#anchorElementsBeingUsed.has(rightEl)) {
//         //         rightEl.classList.remove(ANCHOR_CLASS_NAME);
//         //         delete rightEl.dataset.anchorIndex;
//         //         delete rightEl.dataset.diffIndex;
//         //         rightEl.classList.remove("padded");
//         //         rightEl.style.removeProperty("--anchor-adjust");
//         //     }
//         // }
//     }

//     /**
//      * 앵커 정렬 시작 - align 모드 토글, 창 크기 변경 시 호출
//      */
//     async alignAnchors(scheduler: Scheduler): Promise<void> {
//         const startTime = performance.now();
//         const leftEditor = this.#leftEditor;
//         const rightEditor = this.#rightEditor;

//         for (const pair of this.#anchorPairs) {
//             pair.delta = 0;
//             pair.leftEl.classList.remove("padded");
//             pair.leftEl.style.removeProperty("--anchor-adjust");
//             pair.rightEl.classList.remove("padded");
//             pair.rightEl.style.removeProperty("--anchor-adjust");
//         }


//         leftEditor.forceReflow();
//         rightEditor.forceReflow();

//         let leftScrollTop = leftEditor.scrollTop;
//         let rightScrollTop = rightEditor.scrollTop;
//         let leftEditorTop = leftEditor.getBoundingClientRect().y;
//         let rightEditorTop = rightEditor.getBoundingClientRect().y;


//         for (let i = 0; i < this.#anchorPairs.length; i++) {
//             const pair = this.#anchorPairs[i];
//             const { leftEl, rightEl } = pair;
//             // 낙관적으로 --anchor-adjust 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기

//             let leftY;
//             let rightY;
//             leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
//             rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;

//             let delta = Math.round(leftY - rightY);
//             if (delta < -MIN_DELTA || delta > MIN_DELTA) {
//                 if (pair.delta > 0) {
//                     rightEl.classList.remove("padded");
//                     rightEl.style.removeProperty("--anchor-adjust");
//                     void rightEl.offsetHeight; // force reflow
//                     rightEditorTop = rightEditor.getBoundingClientRect().y;
//                     rightScrollTop = rightEditor.scrollTop;
//                 } else if (pair.delta < 0) {
//                     leftEl.classList.remove("padded");
//                     leftEl.style.removeProperty("--anchor-adjust");
//                     void leftEl.offsetHeight; // force reflow
//                     leftEditorTop = leftEditor.getBoundingClientRect().y;
//                     leftScrollTop = leftEditor.scrollTop;
//                 }

//                 leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
//                 rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
//                 delta = Math.round(leftY - rightY);

//                 if (delta < -MIN_DELTA || delta > MIN_DELTA) {
//                     if (this.#applyDeltaToPair(pair, delta, true)) {
//                         leftScrollTop = leftEditor.scrollTop;
//                         rightScrollTop = rightEditor.scrollTop;
//                     }
//                 }
//             }


//         }

//         leftEditor.forceReflow();
//         rightEditor.forceReflow();

//         let editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
//         leftEditor.height = editorHeight;
//         rightEditor.height = editorHeight;

//         const elpased = performance.now() - startTime;
//     }

//     #applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean) {
//         let changed = false;
//         if (delta < -MIN_DELTA || delta > MIN_DELTA) {
//             if (pair.delta !== delta) {
//                 pair.delta = delta;
//                 changed = true;
//             }
//             let theEl: HTMLElement;
//             if (delta > 0) {
//                 theEl = pair.rightEl;
//             } else {
//                 delta = -delta;
//                 theEl = pair.leftEl;
//             }
//             theEl.style.setProperty("--anchor-adjust", `${delta}px`);
//             theEl.classList.add("padded");
//             if (theEl.nodeName !== DIFF_TAG_NAME) {
//                 theEl.classList.toggle("striped", delta >= MIN_STRIPED_DELTA);
//             }
//             if (reflow) {
//                 void theEl.offsetHeight; // force reflow
//             }
//         }
//         return changed;
//     }

//     /**
//      * 정렬 취소
//      */
//     cancelAlignment(): void {
//         // TODO: 진행 중인 정렬 작업 취소
//     }

//     /**
//      * 정렬 상태 초기화
//      */
//     reset(): void {
//         // TODO: 모든 패딩 제거, 상태 초기화
//     }

//     /**
//      * 앵커 쌍 생성 및 저장
//      * 토큰 인덱스로 적절한 앵커 위치를 찾고 쌍을 생성
//      */
//     createAnchorPair(
//         leftTokenIndex: number,
//         leftEl: HTMLElement | null,
//         rightTokenIndex: number,
//         rightEl: HTMLElement | null,
//         diffIndex: number | null
//     ) {
//         const leftToken = this.#leftEditor.tokens[leftTokenIndex];
//         const rightToken = this.#rightEditor.tokens[rightTokenIndex];
//         if (leftEl && rightEl && !this.#anchorElementsBeingUsed.has(leftEl) && !this.#anchorElementsBeingUsed.has(rightEl)) {
//             const anchorIndex = this.#anchorPairs.length;
//             activateAnchorElement(leftEl, anchorIndex, diffIndex);
//             activateAnchorElement(rightEl, anchorIndex, diffIndex);
//             const pair = {
//                 index: anchorIndex,
//                 leftEl,
//                 rightEl,
//                 diffIndex: diffIndex,
//                 aligned: false,
//                 delta: 0,
//                 // flags: AnchorFlags.None,
//                 // leftFlags: AnchorFlags.None,
//                 // rightFlags: AnchorFlags.None,
//             };

//             this.#anchorPairs.push(pair);
//             this.#anchorElementsBeingUsed.add(leftEl);
//             this.#anchorElementsBeingUsed.add(rightEl);
//             return pair;
//         } else {
//             console.warn("EditorPairer: addAnchorPair2 failed to create anchors");
//         }

//         return null;
//     }


// }
