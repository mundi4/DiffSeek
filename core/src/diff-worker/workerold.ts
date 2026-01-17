// import { ABORT_REASON_CANCELLED } from "../constants";
// import { TokenFlags } from "../TokenFlags";
// import type { DiffEntry, DiffOptions, DiffType, SerializedToken as Token } from "../types";

// export type DiffWorkerRequest = {
//     type: "diff";
//     reqId: number;
//     leftTokens: Token[];
//     rightTokens: Token[];
//     options: DiffOptions;
// } | {
//     type: "cancel";
//     reqId?: number;
// };

// export type DiffWorkerResponse =
//     | { type: "done"; reqId: number; } & DiffWorkerResult
//     | { type: "error"; reqId: number; error: string }
//     | { type: "cancelled"; reqId: number; }
//     | { type: "start"; reqId: number; start: number; }
//     | { type: "progress"; reqId: number; progress: number; };

// export type DiffWorkerResult = {
//     diffs: DiffEntry[];
//     // options: DiffOptions;
//     elapsedTime: number;
// };

// type WorkContext = {
//     reqId: number;
//     leftTokens: Token[];
//     rightTokens: Token[];
//     start: number;
//     finish: number;
//     lastYield: number;
//     options: DiffOptions;
//     entries: DiffEntry[];
//     abortSignal: AbortSignal;
//     //states: Record<string, any>;
// };

// let _reqId: number = undefined!;
// let _leftTokens: Token[] = undefined!;
// let _rightTokens: Token[] = undefined!;
// let _diffOptions: DiffOptions = undefined!;
// let _entries: DiffEntry[] = undefined!;

// let _startTime: number | undefined = undefined;
// let _finishTime: number | undefined = undefined;
// let _abortController: AbortController | undefined = undefined;
// let _yieldCounter = 0;
// let _lastYieldTime = 0;
// let _leftTokenProcessed = 0;
// let _rightTokenProcessed = 0;
// let _lastProgressReport = 0;


// // async function throwIfAborted(ctx: WorkContext, skipYield = false) {
// //     if (!skipYield) {
// //         const now = performance.now();
// //         if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
// //             _lastYieldTime = now;
// //             await new Promise((resolve) => setTimeout(resolve, 0));
// //         }
// //     }
// //     ctx.abortSignal.throwIfAborted();
// // }

// function calculateProgress(): number {
//     const left = _leftTokens.length ? _leftTokenProcessed / _leftTokens.length : 1;
//     const right = _rightTokens.length ? _rightTokenProcessed / _rightTokens.length : 1;
//     return Math.floor((left + right) / 2 * 100);
// }

// // setTimeout은 0을 주더라도 브라우저에서 4ms정도의 강제 딜레이를 발생시킨다.
// // 하지만 이 방법을 안쓰면 취소 자체가 불가능하다. 열심히 작업을 하는 동안에는 onmessage가 처리되지 않기 때문.
// const MIN_YIELD_INTERVAL = 50;
// async function yieldIfNeeded(reportProgress = false) {
//     _yieldCounter++;
//     if ((_yieldCounter & 0xf) === 0) {
//         const now = performance.now();
//         if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
//             _lastYieldTime = now;
//             await new Promise((resolve) => setTimeout(resolve, 0));
//             _abortController?.signal.throwIfAborted();
//             return;
//         }
//     }

//     if (reportProgress) {
//         const progress = calculateProgress();
//         if (progress !== _lastProgressReport) {
//             self.postMessage({
//                 reqId: _reqId!,
//                 type: "progress",
//                 progress: progress,
//             } satisfies DiffWorkerResponse);
//             _lastProgressReport = progress;
//         }
//     }
// }

// function postAborted(reqId: number) {
//     self.postMessage({
//         reqId,
//         type: "cancelled",
//     } satisfies DiffWorkerResponse);
// }

// self.onmessage = (e) => {
//     console.log("diff worker: message received", e.data, performance.now());
//     const request = e.data as DiffWorkerRequest;
//     if (request.type === "diff") {
//         _abortController?.abort(ABORT_REASON_CANCELLED);

//         _reqId = request.reqId;
//         _leftTokens = request.leftTokens;
//         _rightTokens = request.rightTokens;
//         _diffOptions = request.options;
//         _startTime = performance.now();
//         _finishTime = undefined;
//         _entries = [];
//         _abortController = new AbortController();
//         _yieldCounter = 0;
//         _lastYieldTime = _startTime;
//         _leftTokenProcessed = 0;
//         _rightTokenProcessed = 0;
//         _lastProgressReport = 0;

//         const reqId = _reqId;

//         // yield와 yield 사이에 여러 요청이 들어와 있을 수 있다.
//         // 이걸 모두 순서대로 실행/취소할 게 아니라 마지막 요청만 실행하고 나머지는 무시해야 함.
//         setTimeout(() => {
//             if (reqId === _reqId) {
//                 runDiff();
//             } else {
//                 console.warn("diff worker: stale request, ignoring", reqId, _reqId);
//                 postAborted(reqId);
//             }
//         }, 0);

//     } else if (request.type === "cancel") {
//         if (!request.reqId || request.reqId === _reqId) {
//             _abortController?.abort(ABORT_REASON_CANCELLED);
//         }
//     }
// };


// // async function runDiff({ reqId, leftTokens, rightTokens, options }: Extract<DiffWorkerRequest, { type: "diff" }>) {
// async function runDiff() {
//     const reqId = _reqId;
//     try {
//         self.postMessage({
//             reqId,
//             type: "start",
//             start: _startTime!,
//         } satisfies DiffWorkerResponse);

//         const result = await runHistogramDiff();
//         _finishTime = performance.now();

//         self.postMessage({
//             reqId,
//             type: "done",
//             elapsedTime: _finishTime - _startTime!,
//             diffs: result,
//         } satisfies DiffWorkerResponse);

//     } catch (e) {
//         if (e === ABORT_REASON_CANCELLED) {
//             console.debug("diff worker: cancelled", reqId);
//             postAborted(reqId);
//         } else {
//             console.error(e);
//             self.postMessage({
//                 reqId,
//                 type: "error",
//                 error: e instanceof Error ? e.message : String(e),
//             } satisfies DiffWorkerResponse);
//         }
//     } finally {
//         _abortController = undefined;
//     }
// }



// // ============================================================
// // Histogram Algorithm
// // 일단 지금은 이놈이 디폴트
// // ============================================================

// async function runHistogramDiff(): Promise<DiffEntry[]> {
//     const lhsTokens = _leftTokens;
//     const rhsTokens = _rightTokens;

//     const leftAnchors: number[] = [];
//     const rightAnchors: number[] = [];

//     for (let i = 0; i < lhsTokens.length; i++) {
//         const token = lhsTokens[i];
//         if (token.flags & TokenFlags.MANUAL_ANCHOR) {
//             leftAnchors.push(i);
//         }
//     }

//     if (leftAnchors.length > 0) {
//         for (let i = 0; i < rhsTokens.length; i++) {
//             const token = rhsTokens[i];
//             if (token.flags & TokenFlags.MANUAL_ANCHOR) {
//                 rightAnchors.push(i);
//             }
//         }
//     }

//     // 앵커 강제 매칭
//     const matches: { lhsIndex: number; rhsIndex: number }[] = [];
//     if (rightAnchors.length > 0) {
//         let rightPos = 0;
//         for (let l = 0; l < leftAnchors.length; l++) {
//             const leftTokenIndex = leftAnchors[l];
//             for (let r = rightPos; r < rightAnchors.length; r++) {
//                 const rightTokenIndex = rightAnchors[r];
//                 if (lhsTokens[leftTokenIndex].text === rhsTokens[rightTokenIndex].text) {
//                     matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });
//                     rightPos = r + 1;
//                     break;
//                 }
//             }
//         }
//     }

//     let prevLhs = 0;
//     let prevRhs = 0;
//     for (const match of matches) {
//         const lhsAnchor = match.lhsIndex;
//         const rhsAnchor = match.rhsIndex;
//         if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {
//             await diffCore(prevLhs, lhsAnchor, prevRhs, rhsAnchor);
//         }
//         _entries.push({
//             type: 0,
//             left: {
//                 start: lhsAnchor,
//                 end: lhsAnchor + 1,
//             },
//             right: {
//                 start: rhsAnchor,
//                 end: rhsAnchor + 1,
//             },
//         });
//         prevLhs = lhsAnchor + 1;
//         prevRhs = rhsAnchor + 1;

//         _leftTokenProcessed++;
//         _rightTokenProcessed++;
//     }

//     if (prevLhs < lhsTokens.length || prevRhs < rhsTokens.length) {
//         // console.log("diffCore", {
//         // 	lhsTokens,
//         // 	lhsLower: prevLhs,
//         // 	lhsUpper: lhsTokens.length,
//         // 	rhsTokens,
//         // 	rhsLower: prevRhs,
//         // 	rhsUpper: rhsTokens.length,
//         // });
//         await diffCore(prevLhs, lhsTokens.length, prevRhs, rhsTokens.length);
//     }

//     // const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rhsTokens, 0, rhsTokens.length, findBestHistogramAnchor);
//     // return postProcess(ctx, rawEntries, lhsTokens, rhsTokens);
//     return _entries;
// }


// // ============================================================
// // Helper functions
// // ============================================================

// // Divide and conquer!
// // myers, histogram, patience 알고리즘에 공통으로 사용되는 재귀함수
// // 1. 양 텍스트를 공통되는 부분(앵커)으로 분할
// // 2. 분할된 영역에 대해서 재귀호출
// async function diffCore(
//     lhsLower: number,
//     lhsUpper: number,
//     rhsLower: number,
//     rhsUpper: number,
//     consumeDirections: 0 | 1 | 2 | 3 = 3
// ): Promise<DiffEntry[]> {
//     if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
//         throw new Error("Invalid diffCore call");
//     }

//     await yieldIfNeeded(true);

//     // 사실 이걸 쓰면 리턴값이 필요 없는데...
//     // 함수 시그니처를 고치기 귀찮아서 일단 내비둠.
//     const entries = _entries;

//     // TODO
//     // 공통 부분을 스킵하는건데 문제는 여기에서 HEAD, TAIL을 스킵하고
//     // 이후에 diffCore를 재귀적으로 호출할 때 앞쪽 절반에 대해서 HEAD부분, 뒤쪽 절반에 대해서 TAIL부분을 다시 한번 스킵을 시도하게 된다.
//     // 더 이상 스킵할 게 없으니 결과에는 차이가 없겠지만 불필요한 시도를 안하는 쪽으로 개선해 볼 필요가 있음!
//     // 생각해볼 것: 공통 prefix,suffix를 스킵하지 않았을 경우 스킵되지 않은 부분에서 더 나은 앵커가 나올 확률이 있다.
//     // 그렇지만 스킵하지 않으면 성능 상 아주 큰 문제가 생김!
//     let skippedHead: DiffEntry[];
//     let skippedTail: DiffEntry[];
//     [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(
//         lhsLower,
//         lhsUpper,
//         rhsLower,
//         rhsUpper,
//         consumeDirections
//     );

//     // 	entries.push(...skippedHead); 이렇게 넣으면 폭발함.
//     for (const item of skippedHead) {
//         entries.push(item);
//         _leftTokenProcessed += item.left.end - item.left.start;
//         _rightTokenProcessed += item.right.end - item.right.start;
//     }

//     await yieldIfNeeded(true);

//     // 양쪽 모두 남아있는 영역이 있는 경우 공통 앵커를 찾아본다!
//     let anchor: null | { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number } = null;
//     if (
//         lhsLower < lhsUpper &&
//         rhsLower < rhsUpper &&
//         (anchor = findBestHistogramAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper)) &&
//         (anchor.lhsLength > 0 || anchor.rhsLength > 0) && // for safety! 적어도 한쪽이라도 영역을 줄여야 무한루프 안 생길 듯?
//         anchor.lhsIndex >= lhsLower &&
//         anchor.lhsIndex + anchor.lhsLength <= lhsUpper &&
//         anchor.rhsIndex >= rhsLower &&
//         anchor.rhsIndex + anchor.rhsLength <= rhsUpper
//     ) {
//         // console.debug("anchor:", anchor, lhsLower, lhsUpper, rhsLower, rhsUpper);
//         await diffCore(lhsLower, anchor.lhsIndex, rhsLower, anchor.rhsIndex, 2);

//         // 의도적으로 앵커 영역까지 포함해서 호출함
//         await diffCore(anchor.lhsIndex, lhsUpper, anchor.rhsIndex, rhsUpper, 1);
//         // await diffCore(ctx, leftTokens, anchor.lhsIndex + anchor.lhsLength, lhsUpper, rightTokens, anchor.rhsIndex + anchor.rhsLength, rhsUpper, findAnchor, 1);
//     } else {
//         // 유효한 앵커는 못찾았지만 남아있는 토큰들이 있다면 diff로 처리
//         if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
//             let type: DiffType = 0;
//             if (lhsLower < lhsUpper) type |= 1;
//             if (rhsLower < rhsUpper) type |= 2;

//             entries.push({
//                 type: type as DiffType,
//                 left: {
//                     start: lhsLower,
//                     end: lhsUpper,
//                 },
//                 right: {
//                     start: rhsLower,
//                     end: rhsUpper,
//                 },
//             });

//             _leftTokenProcessed += lhsUpper - lhsLower;
//             _rightTokenProcessed += rhsUpper - rhsLower;

//             await yieldIfNeeded(true);
//         }
//     }

//     for (const item of skippedTail) {
//         entries.push(item);
//         _leftTokenProcessed += item.left.end - item.left.start;
//         _rightTokenProcessed += item.right.end - item.right.start;
//     }

//     await yieldIfNeeded(true);

//     return entries;
// }

// // histogram diff에서 가장 중요한 함수
// // 얼마나 값어치 있는 공통 앵커를 찾느냐가 매우 중요하고 고로 그 값어치를 매기는 기준과 방법이 또 매우 중요함
// // 여러가지 생각해볼 것들이 많지만...
// function findBestHistogramAnchor(
//     lhsLower: number,
//     lhsUpper: number,
//     rhsLower: number,
//     rhsUpper: number
// ): { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number } | null {

//     const lhsTokens = _leftTokens, rhsTokens = _rightTokens;

//     const LENGTH_BIAS_FACTOR = _diffOptions.lengthBiasFactor || 0.7; // 길이가 너무 크게 영향을 주는 경향이 있어서 이걸로 조절
//     const UNIQUE_BONUS = 1 / (_diffOptions.uniqueMultiplier || 1 / 0.5);
//     const LINE_START_BONUS = 1 / (_diffOptions.lineStartMultiplier || 1 / 0.85);
//     //const FULL_LINE_BONUS = 0.85; n그램을 사용시 여러단어가 매치되는 경우 오히려 마지막 단어가 다음 줄로 넘어가서 보너스를 못 받을 수가 있다

//     const useLengthBias = !!_diffOptions.useLengthBias;
//     const maxGram = _diffOptions.maxGram || 1;
//     const useMatchPrefix = _diffOptions.whitespace !== "normalize";
//     const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram; //1=>1, 2=>3, 3=>4, 4=>6, 5=>7, 6=>9, 7=>10, 8=>12, 9=>13, 10=>15,...
//     const delimiter = useMatchPrefix ? "" : "\u0000";

//     const freq: Record<string, number> = {};
//     for (let n = 1; n <= maxLen; n++) {

//         //OUTER:
//         for (let i = lhsLower; i <= lhsUpper - n; i++) {
//             let key = lhsTokens[i].text;
//             // if (lhsTokens[i].flags & TokenFlags.IMAGE) {
//             // 	continue;
//             // }
//             // if (!(lhsTokens[i].flags & NO_JOIN)) {
//             for (let k = 1; k < n; k++) {
//                 // if (lhsTokens[i + k].flags & NO_JOIN) {
//                 // 	failed = true;
//                 // 	break;
//                 // }
//                 // if ((lhsTokens[i + k - 1].flags & TokenFlags.HTML_SUPSUB) !== (lhsTokens[i + k].flags & TokenFlags.HTML_SUPSUB)) {
//                 // 	continue OUTER; // SUP/SUB가 중간에 바뀌면 N-그램으로 묶지 않음
//                 // }
//                 // if (lhsTokens[i + k].flags & TokenFlags.IMAGE) {
//                 // 	continue OUTER;
//                 // }
//                 key += delimiter + lhsTokens[i + k].text;
//                 yieldIfNeeded(false);
//             }
//             // } else {
//             // 	failed = n > 1;
//             // }
//             // if (!failed) {
//             freq[key] = (freq[key] || 0) + 1;
//             // }
//         }

//         // OUTER:
//         for (let i = rhsLower; i <= rhsUpper - n; i++) {


//             let key = rhsTokens[i].text;
//             // if (rhsTokens[i].flags & TokenFlags.IMAGE) {
//             // 	continue;
//             // }
//             // if (!(rhsTokens[i].flags & NO_JOIN)) {
//             for (let k = 1; k < n; k++) {
//                 // if (rhsTokens[i + k].flags & NO_JOIN) {
//                 // 	failed = true;
//                 // 	break;
//                 // }
//                 // if ((rhsTokens[i + k - 1].flags & TokenFlags.HTML_SUPSUB) !== (rhsTokens[i + k].flags & TokenFlags.HTML_SUPSUB)) {
//                 // 	continue OUTER; // SUP/SUB가 중간에 바뀌면 N-그램으로 묶지 않음
//                 // }
//                 // if (rhsTokens[i + k].flags & TokenFlags.IMAGE) {
//                 // 	continue OUTER;
//                 // }
//                 key += delimiter + rhsTokens[i + k].text;
//                 yieldIfNeeded(false);
//             }
//             // } else {
//             // 	failed = n > 1;
//             // }
//             // if (!failed) {
//             freq[key] = (freq[key] || 0) + 1;
//             // }
//         }
//     }

//     let best: null | {
//         lhsIndex: number;
//         lhsLength: number;
//         rhsIndex: number;
//         rhsLength: number;
//         score: number;
//         // anchorText: string
//     } = null;

//     yieldIfNeeded(true);

//     for (let i = lhsLower; i < lhsUpper; i++) {
//         const ltext1 = lhsTokens[i].text;
//         for (let j = rhsLower; j < rhsUpper; j++) {

//             let li = i,
//                 ri = j;
//             let lhsLen = 0,
//                 rhsLen = 0;
//             let nGrams = 0;

//             while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen && nGrams < maxGram) {
//                 yieldIfNeeded(false);
//                 const ltext = lhsTokens[li].text;
//                 const rtext = rhsTokens[ri].text;

//                 let equal: boolean | null = null;
//                 if ((lhsTokens[li].flags & rhsTokens[ri].flags & TokenFlags.IMAGE)) {
//                     if (compareImageTokens(lhsTokens[li], rhsTokens[ri])) {
//                         equal = true;
//                     } else {
//                         break;
//                     }
//                 } else {
//                     if ((lhsTokens[li].flags | rhsTokens[ri].flags) & TokenFlags.IMAGE) {
//                         break;
//                     } else if (ltext === rtext) {
//                         equal = true;
//                     }
//                 }

//                 if (equal) {
//                     li++;
//                     ri++;
//                     lhsLen++;
//                     rhsLen++;
//                     nGrams++;
//                     continue;
//                 }

//                 if (useMatchPrefix &&
//                     ltext.length !== rtext.length && ltext[0] === rtext[0]
//                 ) {
//                     const match = matchPrefixTokens(li, lhsUpper, ri, rhsUpper);
//                     if (match) {
//                         const matchedGrams = Math.min(match[0], match[1]);
//                         if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen && nGrams + matchedGrams <= maxGram) {
//                             li += match[0];
//                             ri += match[1];
//                             lhsLen += match[0];
//                             rhsLen += match[1];
//                             nGrams += matchedGrams;
//                             continue;
//                         }
//                     }
//                 }

//                 break;
//             }

//             const IMAGE_TOKEN_LENGTH = 3;
//             if (lhsLen > 0 && rhsLen > 0) {
//                 let frequency: number;
//                 let len: number;
//                 if (lhsLen === 1) {
//                     frequency = freq[ltext1] || 1;
//                     len = (lhsTokens[i].flags & TokenFlags.IMAGE) ? IMAGE_TOKEN_LENGTH : ltext1.length;
//                 } else {
//                     let key = lhsTokens[i].text;
//                     len = (lhsTokens[i].flags & TokenFlags.IMAGE) ? IMAGE_TOKEN_LENGTH : key.length;
//                     for (let k = 1; k < lhsLen; k++) {
//                         const text = lhsTokens[i + k].text;
//                         key += delimiter + text;
//                         len += (lhsTokens[i + k].flags & TokenFlags.IMAGE) ? IMAGE_TOKEN_LENGTH : text.length;
//                     }
//                     frequency = freq[key] || 1;
//                 }

//                 let score = frequency;
//                 if (useLengthBias) {
//                     score = frequency / (1 + Math.log(len + 1) * LENGTH_BIAS_FACTOR);
//                 }
//                 if (frequency === 1) {
//                     score *= UNIQUE_BONUS;
//                 }

//                 let boundaryBonus = 1;
//                 // if (boundaryBonus > CONTAINER_START_BONUS && lhsTokens[i].flags & rhsTokens[j].flags & CONTAINER_START) {
//                 // 	boundaryBonus = CONTAINER_START_BONUS;
//                 // }
//                 // if (boundaryBonus > CONTAINER_END_BONUS && lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & CONTAINER_END) {
//                 // 	boundaryBonus = CONTAINER_END_BONUS;
//                 // }
//                 if (boundaryBonus > LINE_START_BONUS && lhsTokens[i].flags & rhsTokens[j].flags & TokenFlags.LINE_START) {
//                     boundaryBonus = LINE_START_BONUS;
//                 }
//                 // if (boundaryBonus > LINE_END_BONUS && lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LINE_END) {
//                 // 	boundaryBonus = LINE_END_BONUS;
//                 // }
//                 score *= boundaryBonus;

//                 // 사용 안하는 것이 낫다
//                 // 항번호만 바뀌는 경우(중간에 항 추가/삭제)에도 항 번호가 우선적으로 매치되어 버리기 때문.
//                 // if (nGrams > 2 // 항 번호 이후에 최소 2개 이상의 토큰이 더 매치되면 그래도 해볼만 하지 않을까...?
//                 // 	 && lhsTokens[i].flags & rhsTokens[j].flags & (TokenFlags.SECTION_HEADING_MASK & ~TokenFlags.SECTION_HEADING_TYPE1)) {
//                 // 	// SECTION_HEADING_TYPE1 1., 2., 3., ...은 무시. 문서 구조가 영구일 때가 많음.
//                 // 	score *= SECTION_HEADING_BONUS;
//                 // }

//                 if (!best || score < best.score) {
//                     best = {
//                         lhsIndex: i,
//                         lhsLength: lhsLen,
//                         rhsIndex: j,
//                         rhsLength: rhsLen,
//                         score,
//                         // anchorText,
//                     };
//                 }
//             }
//         }
//     }

//     return best ?? null;
// };


// // 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
// // 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
// // 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
// // 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
// function consumeCommonEdges(
//     lhsLower: number,
//     lhsUpper: number,
//     rhsLower: number,
//     rhsUpper: number,
//     consumeDirections: 0 | 1 | 2 | 3 = 3
// ): [lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number, head: DiffEntry[], tail: DiffEntry[]] {
//     const lhsTokens = _leftTokens, rhsTokens = _rightTokens;
//     const whitespace = _diffOptions.whitespace;
//     const head: DiffEntry[] = [];
//     const tail: DiffEntry[] = [];
//     let matchedCount;
//     // Prefix
//     if (consumeDirections & 1) {
//         while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
//             if (lhsTokens[lhsLower].flags & TokenFlags.IMAGE || rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
//                 if (lhsTokens[lhsLower].flags & rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
//                     if (compareImageTokens(lhsTokens[lhsLower], rhsTokens[rhsLower])) {
//                         head.push({
//                             type: 0,
//                             left: { start: lhsLower, end: lhsLower + 1 },
//                             right: { start: rhsLower, end: rhsLower + 1 },
//                         });
//                         lhsLower++;
//                         rhsLower++;
//                         continue;
//                     }
//                 }
//                 // 그림vs그림 비교결과가 false이거나 그림vs텍스트인 경우.
//                 break;
//             }

//             if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
//                 head.push({
//                     type: 0,
//                     left: { start: lhsLower, end: lhsLower + 1 },
//                     right: { start: rhsLower, end: rhsLower + 1 },
//                 });
//                 lhsLower++;
//                 rhsLower++;
//                 continue;
//             }

//             if (
//                 whitespace !== "normalize" &&
//                 lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
//                 lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
//                 (matchedCount = matchPrefixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper))
//             ) {
//                 head.push({
//                     type: 0,
//                     left: {
//                         start: lhsLower,
//                         end: lhsLower + matchedCount[0],
//                     },
//                     right: {
//                         start: rhsLower,
//                         end: rhsLower + matchedCount[1],
//                     },
//                 });
//                 lhsLower += matchedCount[0];
//                 rhsLower += matchedCount[1];
//                 continue;
//             }

//             break;
//         }
//     }

//     // Suffix
//     if (consumeDirections & 2) {
//         while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
//             if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
//                 tail.push({
//                     type: 0,
//                     left: { start: lhsUpper - 1, end: lhsUpper },
//                     right: { start: rhsUpper - 1, end: rhsUpper },
//                 });
//                 lhsUpper--;
//                 rhsUpper--;
//             } else if (
//                 whitespace !== "normalize" &&
//                 lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
//                 lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
//                 (matchedCount = matchSuffixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper))
//             ) {
//                 tail.push({
//                     type: 0,
//                     left: {
//                         start: lhsUpper - matchedCount[0],
//                         end: lhsUpper,
//                     },
//                     right: {
//                         start: rhsUpper - matchedCount[1],
//                         end: rhsUpper,
//                     },
//                 });
//                 lhsUpper -= matchedCount[0];
//                 rhsUpper -= matchedCount[1];
//             } else {
//                 break;
//             }
//         }
//         tail.reverse();
//     }
//     return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
// }

// function matchPrefixTokens(
//     lhsLower: number,
//     lhsUpper: number,
//     rhsLower: number,
//     rhsUpper: number
//     //allowJoinOnlyAtLineBoundary: boolean
// ): false | [leftMatched: number, rightMatched: number] {
//     if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

//     const leftTokens = _leftTokens, rightTokens = _rightTokens;
//     const allowJoinOnlyAtLineBoundary = _diffOptions.whitespace === "onlyAtEdge";

//     let i = lhsLower,
//         j = rhsLower;
//     let ci = 0,
//         cj = 0;

//     let lhsToken = leftTokens[i++],
//         ltext = lhsToken.text,
//         lhsLen = ltext.length;
//     let rhsToken = rightTokens[j++],
//         rtext = rhsToken.text,
//         rhsLen = rtext.length;

//     // if (lhsToken.flags & NO_JOIN_NEXT || rhsToken.flags & NO_JOIN_NEXT) {
//     // 	// return false;
//     // }

//     if (lhsToken.flags & TokenFlags.IMAGE || rhsToken.flags & TokenFlags.IMAGE) {
//         return false;
//     }

//     while (true) {
//         while (ci < lhsLen && cj < rhsLen) {
//             if (ltext[ci++] !== rtext[cj++]) {
//                 return false;
//             }
//         }

//         // 문자 불일치 없이 양쪽 토큰이 동시에 끝난 경우
//         if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];

//         if (ci === lhsLen) {
//             if (i === lhsUpper) return false;
//             if (
//                 lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                 (allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             lhsToken = leftTokens[i++];
//             if (!lhsToken) return false;
//             if (lhsToken.flags & TokenFlags.IMAGE) {
//                 // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                 return false;
//             }
//             if (
//                 lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                 (allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             ltext = lhsToken.text;
//             lhsLen = ltext.length;
//             ci = 0;
//         }
//         if (cj === rhsLen) {
//             if (j === rhsUpper) return false;
//             if (
//                 rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                 (allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             rhsToken = rightTokens[j++];
//             if (!rhsToken) return false;
//             if (rhsToken.flags & TokenFlags.IMAGE) {
//                 // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                 return false;
//             }
//             if (
//                 rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                 (allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             rtext = rhsToken.text;
//             rhsLen = rtext.length;
//             cj = 0;
//         }
//     }
// }

// function matchSuffixTokens(
//     lhsLower: number,
//     lhsUpper: number,
//     rhsLower: number,
//     rhsUpper: number,
// ): false | [leftMatched: number, rightMatched: number] {
//     if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

//     const leftTokens = _leftTokens, rightTokens = _rightTokens;
//     const allowJoinOnlyAtLineBoundary = _diffOptions.whitespace === "onlyAtEdge";

//     let i = lhsUpper - 1,
//         j = rhsUpper - 1;

//     let lhsToken = leftTokens[i--],
//         ltext = lhsToken.text,
//         rhsToken = rightTokens[j--],
//         rtext = rhsToken.text;
//     let ci = ltext.length - 1,
//         cj = rtext.length - 1;

//     // if (lhsToken.flags & NO_JOIN_PREV || rhsToken.flags & NO_JOIN_PREV) {
//     // 	return false;
//     // }

//     if (lhsToken.flags & TokenFlags.IMAGE || rhsToken.flags & TokenFlags.IMAGE) {
//         return false;
//     }

//     while (true) {
//         while (ci >= 0 && cj >= 0) {
//             if (ltext[ci--] !== rtext[cj--]) {
//                 return false;
//             }
//         }
//         if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];

//         if (ci < 0) {
//             if (i < lhsLower) return false;
//             if (
//                 lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                 (allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             lhsToken = leftTokens[i--];
//             if (!lhsToken) return false;
//             if (lhsToken.flags & TokenFlags.IMAGE) {
//                 // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                 return false;
//             }
//             if (
//                 lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                 (allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             ltext = lhsToken.text;
//             ci = lhsToken.text.length - 1;
//         }
//         if (cj < 0) {
//             if (j < rhsLower) return false;
//             if (
//                 rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                 (allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             rhsToken = rightTokens[j--];
//             if (!rhsToken) return false;
//             if (rhsToken.flags & TokenFlags.IMAGE) {
//                 // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                 return false;
//             }
//             if (
//                 rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                 (allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//             ) {
//                 return false;
//             }

//             rtext = rhsToken.text;
//             cj = rhsToken.text.length - 1;
//         }
//     }
// }

// // @ts-ignore
// function compareImageTokens(leftToken: Token, rightToken: Token): boolean {
//     return false;

//     // if (!(leftToken.flags & rightToken.flags & TokenFlags.IMAGE)) {
//     //     return false;
//     // }

//     // const { compareImage, compareImageTolerance } = ctx.options;
//     // //console.log("compareImage, compareImageTolerance:", compareImage, compareImageTolerance)
//     // if (!compareImage) {
//     //     return leftToken.text === rightToken.text;
//     // }

//     // const cacheKey = makeImageKey(leftToken.text, rightToken.text);
//     // const cache = ctx.imageComparisons;
//     // let result: { similarity: number | undefined } | undefined = cache[cacheKey] ?? undefined;
//     // if (result) {
//     //     return (result.similarity ?? 0) * 100 >= compareImageTolerance;
//     // }

//     // result = imageCompareCache.get(leftToken.text)?.get(rightToken.text) ?? undefined;
//     // if (result) {
//     //     cache[cacheKey] = result;
//     //     return (result.similarity ?? 0) * 100 >= compareImageTolerance;
//     // }

//     // // console.log("compare", leftToken, rightToken, cacheKey, result);
//     // if (leftToken.text === rightToken.text) {
//     //     result = { similarity: 1 };
//     // } else if (!leftToken.data || !rightToken.data) {
//     //     //console.log("no data");
//     //     result = { similarity: undefined };
//     // } else {
//     //     const { width, height } = leftToken;
//     //     const leftArr = new Uint8ClampedArray(leftToken.data!);
//     //     const rightArr = new Uint8ClampedArray(rightToken.data!);
//     //     const diffCount = pixelmatch(leftArr, rightArr, void 0, width!, height!, { threshold: 0.1 });
//     //     result = { similarity: (width! * height! - diffCount) / (width! * height!) };
//     // }

//     // cache[cacheKey] = result;

//     // if (!imageCompareCache.has(leftToken.text)) {
//     //     imageCompareCache.set(leftToken.text, new Map());
//     // }
//     // if (!imageCompareCache.get(rightToken.text)) {
//     //     imageCompareCache.set(rightToken.text, new Map());
//     // }
//     // imageCompareCache.get(leftToken.text)!.set(rightToken.text, result);
//     // imageCompareCache.get(rightToken.text)!.set(leftToken.text, result);
//     // return (result.similarity ?? 0) * 100 >= compareImageTolerance;
// }