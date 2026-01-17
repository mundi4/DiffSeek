// import { ABORT_REASON_CANCELLED } from "../constants";
// import { TokenFlags } from "../TokenFlags";
// import type { DiffEntry, DiffOptions, DiffType, SerializedToken as Token, WhitespaceHandling } from "../types";

// /*
// 생각해 볼 것:
// 몇 십 페이지까지 워드 문서에서는 큰 문제가 되지 않지만
// 200페이지 이상의 워드 문서에서 군데군데 diff가 있는 경우 성능이 급격히 저하됨.
// 이 성능 저하를 줄이기 위해서
// - coase split (대충 구현됨)
// - 섹션헤딩 매칭(넘버링으로 우선 매칭) - 생각 중

// 또 하나 고려해 볼 것
// 텍스트를 한글자 한글자 떼어서 비교할 것이 아니라
// 모든 토큰의 텍스트를 uint16array로 합쳐서 각 토큰은 charStart, charEnd를 가지게 하는 방법
// 글자 비교는 text[i]가 아니라 textBuf[charStart + i]로 해야겠지!
// n그램 등 토큰을 이어붙여서 비교할 경우는 텍스트를 이어붙일 것이 아니라 글자 하나씩 rolling hash로...?
// */
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
//     options: DiffOptions;
//     elapsedTime: number;
// };

// type WorkItem = {
//     reqId: number;
//     leftTokens: Token[];
//     rightTokens: Token[];
//     diffOptions: DiffOptions;
// };

// type DiffJob = {
//     reqId: number;
//     abort: () => void;
//     promise: Promise<void>;
// }

// let _scheduled = false;
// let _nextWorkItem: WorkItem | null = null;
// let _runningJob: DiffJob | null = null;

// self.onmessage = (e) => {
//     const request = e.data as DiffWorkerRequest;
//     if (request.type === "diff") {
//         _nextWorkItem = {
//             reqId: request.reqId,
//             leftTokens: request.leftTokens,
//             rightTokens: request.rightTokens,
//             diffOptions: request.options,
//         };
//         schedule();
//     } else if (request.type === "cancel") {
//         if (_runningJob && (!request.reqId || _runningJob.reqId <= request.reqId)) {
//             _runningJob.abort();
//         }
//         if (_nextWorkItem && (!request.reqId || _nextWorkItem.reqId <= request.reqId)) {
//             postAborted(_nextWorkItem.reqId);
//             _nextWorkItem = null;
//         }
//     }
// }

// function schedule() {
//     _runningJob?.abort();
//     if (!_scheduled) {
//         _scheduled = true;
//         setTimeout(runLatest, 0);
//     }
// }

// function runLatest() {
//     _scheduled = false;

//     const running = _runningJob;
//     _runningJob = null;

//     const startNext = () => {
//         const workItem = _nextWorkItem;
//         _nextWorkItem = null;
//         if (workItem) {
//             _runningJob = runDiffJob(workItem);
//         }
//     };

//     if (running) {
//         running.promise.finally(startNext);
//     } else {
//         startNext();
//     }
// }

// const WS_TABLE = new Uint8Array(65536);
// WS_TABLE[32] = 1;   // space
// WS_TABLE[9] = 1;    // \t
// WS_TABLE[10] = 1;   // \n
// WS_TABLE[13] = 1;   // \r
// WS_TABLE[12] = 1;   // \f
// WS_TABLE[11] = 1;   // \v
// WS_TABLE[160] = 1;  // nbsp

// const _coarseUniqStamp = new Uint32Array(65536);
// let _coarseUniqEpoch = 1;

// function runDiffJob(workItem: WorkItem): DiffJob {
//     const {
//         reqId: _reqId,
//         leftTokens: _leftTokens,
//         rightTokens: _rightTokens,
//         diffOptions: _diffOptions
//     } = workItem;


//     // [기본값] 각 보너스의 기본 강도
//     const BASE_LENGTH_BONUS_STRENGTH = 0.7;
//     const BASE_LINE_START_BONUS_STRENGTH = 0.85; // 라인 시작 보너스 (낮을수록 강함)
//     const BASE_UNIQUE_BONUS_STRENGTH = 0.5;

//     // 그램 설정
//     const _MAX_GRAM = _diffOptions.useGrams ? _diffOptions.maxGram : 1;

//     // 길이 보너스
//     const _USE_LENGTH_BONUS = _diffOptions.useLengthBonus;
//     const _MAX_LENGTH_PER_GRAM_FOR_BONUS = _diffOptions.maxLengthPerGramForBonus;
//     const _LENGTH_BONUS_STRENGTH = _USE_LENGTH_BONUS ? BASE_LENGTH_BONUS_STRENGTH * _diffOptions.lengthBonusMultiplier : 1;

//     // 줄 시작 보너스 설정
//     const _USE_LINE_START_BONUS = _diffOptions.useLineStartBonus;
//     const _LINE_START_BONUS_STRENGTH = _USE_LINE_START_BONUS ? BASE_LINE_START_BONUS_STRENGTH * _diffOptions.lineStartBonusMultiplier : 1;

//     // 고유성 보너스 설정
//     const _USE_UNIQUE_BONUS = _diffOptions.useUniqueBonus;
//     const _UNIQUE_BONUS_STRENGTH = _USE_UNIQUE_BONUS ? BASE_UNIQUE_BONUS_STRENGTH * _diffOptions.uniqueBonusMultiplier : 1;

//     // CCOARSE SPLITTING
//     const USE_COARSE_SPLIT = _diffOptions.useCoarseSplit;
//     const COARSE_ANCHOR_MODE = _diffOptions.coarseAnchorMode;
//     const COARSE_ANCHOR_MIN_TOKENS = _diffOptions.coarseAnchorMinTokens;
//     const COARSE_ANCHOR_TOKEN_WINDOW = _diffOptions.coarseAnchorTokenWindow;
//     const COARSE_ANCHOR_MIN_EFFECTIVE_CHARS = _diffOptions.coarseAnchorMinEffectiveChars;
//     const COARSE_ANCHOR_MIN_UNIQUE_CHARS = _diffOptions.coarseAnchorMode === "line" ? 3 : 2;
//     const COARSE_ANCHOR_MIN_WORD_LIKE_TOKENS = _diffOptions.coarseAnchorMinWordLikeTokens;
//     const COARSE_SPLIT_MIN_TOKENS = _diffOptions.coarseSplitMinTokens;
//     const COARSE_SPLIT_MIN_SIDE_TOKENS = _diffOptions.coarseSplitMinSideTokens;
//     const COARSE_SPLIT_MIN_GAIN_RATIO = _diffOptions.coarseSplitMinGainRatio;
//     const COARSE_SPLIT_MAX_UNIQUE_ANCHORS = _diffOptions.coarseSplitMaxUniqueAnchors;

//     // MISC
//     const WHITESPACE_HANDLING: WhitespaceHandling = _diffOptions.whitespace;
//     const MIN_YIELD_INTERVAL = 50;


//     const _abortController = new AbortController();
//     const _signal = _abortController.signal;
//     const _entries: DiffEntry[] = [];
//     const _coaseAnchorUniqChars = new Set<number>();

//     const _startTime = performance.now();
//     let _finishTime: number | undefined = undefined;
//     let _yieldCounter = 0;
//     let _lastYieldTime = _startTime;
//     let _leftTokenProcessed = 0;
//     let _rightTokenProcessed = 0;
//     let _lastProgressReport = -1;

//     async function yieldIfNeeded(reportProgress = false) {
//         const now = performance.now();
//         if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
//             _lastYieldTime = now;
//             await new Promise((resolve) => setTimeout(resolve, 0));
//             _signal.throwIfAborted();
//         }

//         if (reportProgress) {
//             const progress = calculateProgress();
//             postProgress(progress);
//         }
//     }

//     // [최적화] runHistogramDiff에서 미리 계산한 설정값들



//     // async function throwIfAborted(ctx: WorkContext, skipYield = false) {
//     //     if (!skipYield) {
//     //         const now = performance.now();
//     //         if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
//     //             _lastYieldTime = now;
//     //             await new Promise((resolve) => setTimeout(resolve, 0));
//     //         }
//     //     }
//     //     ctx.abortSignal.throwIfAborted();
//     // }

//     function calculateProgress(): number {
//         const left = _leftTokens.length ? _leftTokenProcessed / _leftTokens.length : 1;
//         const right = _rightTokens.length ? _rightTokenProcessed / _rightTokens.length : 1;
//         return Math.floor((left + right) / 2 * 100);
//     }


//     async function runHistogramDiff(): Promise<DiffEntry[]> {
//         const lhsTokens = _leftTokens;
//         const rhsTokens = _rightTokens;

//         // [최적화] 옵션에 따른 모든 설정값 미리 계산 (전역변수에 캐싱)

//         // 그램 설정
//         // _MAX_GRAM = _diffOptions.useGrams ? _diffOptions.maxGram : 1;

//         // // 길이 보너스 설정
//         // _USE_LENGTH_BONUS = _diffOptions.useLengthBonus;
//         // _MAX_LENGTH_PER_GRAM_FOR_BONUS = _diffOptions.maxLengthPerGramForBonus;
//         // if (_USE_LENGTH_BONUS) {
//         //     _LENGTH_BONUS_STRENGTH = BASE_LENGTH_BONUS_STRENGTH * _diffOptions.lengthBonusMultiplier;
//         // }

//         // // 줄 시작 보너스 설정
//         // _USE_LINE_START_BONUS = _diffOptions.useLineStartBonus;
//         // if (_USE_LINE_START_BONUS) {
//         //     _LINE_START_BONUS_STRENGTH = BASE_LINE_START_BONUS_STRENGTH * _diffOptions.lineStartBonusMultiplier;
//         // }

//         // // 고유성 보너스 설정
//         // _USE_UNIQUE_BONUS = _diffOptions.useUniqueBonus;
//         // if (_USE_UNIQUE_BONUS) {
//         //     _UNIQUE_BONUS_STRENGTH = BASE_UNIQUE_BONUS_STRENGTH * _diffOptions.uniqueBonusMultiplier;
//         // }

//         const leftAnchors: number[] = [];
//         const rightAnchors: number[] = [];

//         for (let i = 0; i < lhsTokens.length; i++) {
//             const token = lhsTokens[i];
//             if (token.flags & TokenFlags.MANUAL_ANCHOR) {
//                 leftAnchors.push(i);
//             }
//         }

//         if (leftAnchors.length > 0) {
//             for (let i = 0; i < rhsTokens.length; i++) {
//                 const token = rhsTokens[i];
//                 if (token.flags & TokenFlags.MANUAL_ANCHOR) {
//                     rightAnchors.push(i);
//                 }
//             }
//         }

//         // 앵커 강제 매칭
//         const matches: { lhsIndex: number; rhsIndex: number }[] = [];
//         if (rightAnchors.length > 0) {
//             let rightPos = 0;
//             for (let l = 0; l < leftAnchors.length; l++) {
//                 const leftTokenIndex = leftAnchors[l];
//                 for (let r = rightPos; r < rightAnchors.length; r++) {
//                     const rightTokenIndex = rightAnchors[r];
//                     if (lhsTokens[leftTokenIndex].text === rhsTokens[rightTokenIndex].text) {
//                         matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });
//                         rightPos = r + 1;
//                         break;
//                     }
//                 }
//             }
//         }

//         let prevLhs = 0;
//         let prevRhs = 0;
//         for (const match of matches) {
//             const lhsAnchor = match.lhsIndex;
//             const rhsAnchor = match.rhsIndex;
//             if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {
//                 await diffCore(prevLhs, lhsAnchor, prevRhs, rhsAnchor);
//             }
//             _entries.push({
//                 type: 0,
//                 left: {
//                     start: lhsAnchor,
//                     end: lhsAnchor + 1,
//                 },
//                 right: {
//                     start: rhsAnchor,
//                     end: rhsAnchor + 1,
//                 },
//             });
//             prevLhs = lhsAnchor + 1;
//             prevRhs = rhsAnchor + 1;

//             _leftTokenProcessed++;
//             _rightTokenProcessed++;
//         }

//         if (prevLhs < lhsTokens.length || prevRhs < rhsTokens.length) {
//             // console.log("diffCore", {
//             // 	lhsTokens,
//             // 	lhsLower: prevLhs,
//             // 	lhsUpper: lhsTokens.length,
//             // 	rhsTokens,
//             // 	rhsLower: prevRhs,
//             // 	rhsUpper: rhsTokens.length,
//             // });
//             await diffCore(prevLhs, lhsTokens.length, prevRhs, rhsTokens.length);
//         }

//         // const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rhsTokens, 0, rhsTokens.length, findBestHistogramAnchor);
//         // return postProcess(ctx, rawEntries, lhsTokens, rhsTokens);
//         return _entries;
//     }

//     async function diffCore(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number,
//         consumeDirections: 0 | 1 | 2 | 3 = 3
//     ): Promise<DiffEntry[]> {
//         console.log("diffCore", lhsLower, lhsUpper, rhsLower, rhsUpper);

//         if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
//             throw new Error("Invalid diffCore call");
//         }

//         if ((_yieldCounter++ & 0x1ff) === 0) {
//             await yieldIfNeeded(true);
//         }

//         const entries = _entries;

//         let skippedHead: DiffEntry[];
//         let skippedTail: DiffEntry[];

//         [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(lhsLower, lhsUpper, rhsLower, rhsUpper, consumeDirections);

//         for (const item of skippedHead) {
//             entries.push(item);
//             _leftTokenProcessed += item.left.end - item.left.start;
//             _rightTokenProcessed += item.right.end - item.right.start;
//         }

//         if ((_yieldCounter++ & 0x1ff) === 0) {
//             await yieldIfNeeded(true);
//         }

//         let didSplit = false;

//         if (
//             USE_COARSE_SPLIT &&
//             lhsLower < lhsUpper &&
//             rhsLower < rhsUpper &&
//             (lhsUpper - lhsLower) >= COARSE_SPLIT_MIN_TOKENS &&
//             (rhsUpper - rhsLower) >= COARSE_SPLIT_MIN_TOKENS
//         ) {
//             console.log("Attempting coarse split...");

//             const coarse = findBestCoarseLineAnchorPoint(lhsLower, lhsUpper, rhsLower, rhsUpper);
//             if (coarse && isCoarseSplitWorthIt(lhsLower, lhsUpper, rhsLower, rhsUpper, coarse)) {
//                 console.log("Coarse split succeeded at", coarse);
//                 didSplit = true;
//                 await diffCore(lhsLower, coarse.lhsIndex, rhsLower, coarse.rhsIndex, 2);
//                 await diffCore(coarse.lhsIndex, lhsUpper, coarse.rhsIndex, rhsUpper, 1);
//             } else {
//                 console.log("Coarse split not worth it or no anchor found.");
//             }
//         }

//         if (!didSplit) {
//             const anchor = await findBestHistogramAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper);
//             if (
//                 anchor &&
//                 (anchor.lhsLength > 0 || anchor.rhsLength > 0) &&
//                 anchor.lhsIndex >= lhsLower &&
//                 anchor.lhsIndex + anchor.lhsLength <= lhsUpper &&
//                 anchor.rhsIndex >= rhsLower &&
//                 anchor.rhsIndex + anchor.rhsLength <= rhsUpper
//             ) {
//                 didSplit = true;
//                 await diffCore(lhsLower, anchor.lhsIndex, rhsLower, anchor.rhsIndex, 2);
//                 await diffCore(anchor.lhsIndex, lhsUpper, anchor.rhsIndex, rhsUpper, 1);
//             }
//         }

//         if (!didSplit) {
//             if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
//                 let type: DiffType = 0;
//                 if (lhsLower < lhsUpper) type |= 1;
//                 if (rhsLower < rhsUpper) type |= 2;

//                 entries.push({
//                     type: type as DiffType,
//                     left: { start: lhsLower, end: lhsUpper },
//                     right: { start: rhsLower, end: rhsUpper },
//                 });

//                 _leftTokenProcessed += lhsUpper - lhsLower;
//                 _rightTokenProcessed += rhsUpper - rhsLower;
//             }
//         }

//         // ✅ tail은 split 여부와 무관하게 항상 붙인다
//         for (const item of skippedTail) {
//             entries.push(item);
//             _leftTokenProcessed += item.left.end - item.left.start;
//             _rightTokenProcessed += item.right.end - item.right.start;
//         }

//         if ((_yieldCounter++ & 0x1ff) === 0) {
//             await yieldIfNeeded(true);
//         }
//         return entries;
//     }

//     async function findBestHistogramAnchor(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number
//     ): Promise<{ lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number; score: number } | null> {

//         const lhsTokens = _leftTokens;
//         const rhsTokens = _rightTokens;
//         const maxGram = _MAX_GRAM;
//         const useMatchPrefix = WHITESPACE_HANDLING !== "collapse";
//         const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram;
//         const delimiter = useMatchPrefix ? "" : "\u0000";

//         // ---------- 1. N-gram 빈도 사전 계산 (전수 조사) ----------
//         const freq: Record<string, number> = {};
//         for (let n = 1; n <= maxLen; n++) {
//             for (let i = lhsLower; i <= lhsUpper - n; i++) {
//                 let key = lhsTokens[i].text;
//                 for (let k = 1; k < n; k++) key += delimiter + lhsTokens[i + k].text;
//                 freq[key] = (freq[key] || 0) + 1;
//             }
//             if ((_yieldCounter++ & 0x1ff) === 0) {
//                 await yieldIfNeeded(false);
//             }
//             for (let i = rhsLower; i <= rhsUpper - n; i++) {
//                 let key = rhsTokens[i].text;
//                 for (let k = 1; k < n; k++) key += delimiter + rhsTokens[i + k].text;
//                 freq[key] = (freq[key] || 0) + 1;
//             }
//             if ((_yieldCounter++ & 0x1ff) === 0) {
//                 await yieldIfNeeded(false);
//             }
//         }

//         // ---------- 2. RHS Indexing ----------
//         const rhsIndexByText = new Map<string, number[]>();
//         for (let j = rhsLower; j < rhsUpper; j++) {
//             const t = rhsTokens[j].text;
//             let arr = rhsIndexByText.get(t);
//             if (!arr) {
//                 arr = [];
//                 rhsIndexByText.set(t, arr);
//             }
//             arr.push(j);
//         }

//         let best: {
//             lhsIndex: number;
//             lhsLength: number;
//             rhsIndex: number;
//             rhsLength: number;
//             score: number
//         } | null = null;

//         const IMAGE_TOKEN_LENGTH = 3;
//         // 중복 계산 방지: 각 lhs 위치에서 이미 확인된 최대 매칭 길이를 추적
//         const skipTable = new Int32Array(lhsUpper - lhsLower).fill(0);

//         // ---------- 3. Candidate Scan ----------
//         for (let i = lhsLower; i < lhsUpper; i++) {
//             const ltext1 = lhsTokens[i].text;
//             const rhsCandidates = rhsIndexByText.get(ltext1);
//             if (!rhsCandidates) continue;

//             for (const j of rhsCandidates) {
//                 // 현재 i 위치가 이미 이전 탐색(i-n)에서 충분히 긴 매치에 포함되었다면 스킵
//                 if (skipTable[i - lhsLower] >= maxLen) break;

//                 let li = i, ri = j;
//                 let lhsLen = 0, rhsLen = 0, nGrams = 0;
//                 let currentKey = "";
//                 let currentTotalCharLen = 0;

//                 while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && nGrams < maxGram) {
//                     const ltok = lhsTokens[li];
//                     const rtok = rhsTokens[ri];
//                     let stepL = 0, stepR = 0, stepG = 0, stepKey = "", stepChar = 0;

//                     // A. 이미지 토큰 매칭
//                     if ((ltok.flags | rtok.flags) & TokenFlags.IMAGE) {
//                         if ((ltok.flags & rtok.flags & TokenFlags.IMAGE) && compareImageTokens(ltok, rtok)) {
//                             stepL = 1; stepR = 1; stepG = 1;
//                             stepKey = ltok.text; stepChar = IMAGE_TOKEN_LENGTH;
//                         } else break;
//                     }
//                     // B. 일반 텍스트 매칭
//                     else if (ltok.text === rtok.text) {
//                         stepL = 1; stepR = 1; stepG = 1;
//                         stepKey = ltok.text; stepChar = ltok.text.length;
//                     }
//                     // C. Prefix 매칭 (공백/들여쓰기 등)
//                     else if (useMatchPrefix && ltok.text[0] === rtok.text[0]) {
//                         const match = matchPrefixTokens(li, lhsUpper, ri, rhsUpper);
//                         if (match) {
//                             stepL = match[0]; stepR = match[1]; stepG = Math.min(stepL, stepR);
//                             for (let k = 0; k < stepL; k++) {
//                                 const t = lhsTokens[li + k];
//                                 stepKey += (k === 0 ? "" : delimiter) + t.text;
//                                 stepChar += (t.flags & TokenFlags.IMAGE) ? IMAGE_TOKEN_LENGTH : t.text.length;
//                             }
//                         } else break;
//                     } else break;

//                     // Key 및 길이 누적
//                     currentKey += (currentKey === "" ? "" : delimiter) + stepKey;
//                     currentTotalCharLen += stepChar;

//                     // [중복 방지] 현재 경로에 포함된 모든 토큰 위치에 도달 가능한 최대 길이 마킹
//                     for (let k = 0; k < stepL; k++) {
//                         const skipIdx = (li + k) - lhsLower;
//                         if (skipIdx >= 0 && skipIdx < skipTable.length) {
//                             skipTable[skipIdx] = Math.max(skipTable[skipIdx], lhsLen + k + 1);
//                         }
//                     }

//                     li += stepL; ri += stepR;
//                     lhsLen += stepL; rhsLen += stepR; nGrams += stepG;

//                     // ---------- 4. 점수 판별 (유니크 맹신 방지) ----------
//                     const frequency = freq[currentKey] || 1;
//                     let score: number;

//                     if (frequency === 1) {
//                         // 유니크(1)인 경우: nGrams가 많을수록(문맥이 길수록) 더 좋은 점수(낮은 점수)
//                         // 단순 1-gram 유니크보다 2, 3-gram 유니크가 우선됨
//                         score = -nGrams;
//                     } else {
//                         // 비유니크인 경우: 빈도가 낮을수록 좋음 (항상 0보다 큼)
//                         score = Math.log(frequency);
//                     }

//                     // 길이 보너스 적용
//                     if (_USE_LENGTH_BONUS) {
//                         const cappedLen = Math.min(currentTotalCharLen, nGrams * _MAX_LENGTH_PER_GRAM_FOR_BONUS);
//                         score /= (1 + Math.log(cappedLen + 1) * _LENGTH_BONUS_STRENGTH);
//                     }

//                     // 라인 시작 보너스 (문맥적 중요도 가중치)
//                     if (_USE_LINE_START_BONUS && (lhsTokens[i].flags & rhsTokens[j].flags & TokenFlags.LINE_START)) {
//                         score *= _LINE_START_BONUS_STRENGTH;
//                     }

//                     // 최적의 앵커 갱신
//                     if (!best || score < best.score) {
//                         best = { lhsIndex: i, lhsLength: lhsLen, rhsIndex: j, rhsLength: rhsLen, score };
//                     }

//                     // [조기 종료 조건] 충분한 문맥(maxGram)을 가진 유니크를 찾았다면 즉시 반환
//                     if (score <= -maxGram) return best;
//                 }
//                 // Candidate 마다 UI 응답성 확보
//                 if ((_yieldCounter++ & 0x1ff) === 0) {
//                     await yieldIfNeeded(false);
//                 }
//             }
//         }

//         return best ?? null;
//     }

//     // 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
//     // 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
//     // 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
//     // 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
//     function consumeCommonEdges(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number,
//         consumeDirections: 0 | 1 | 2 | 3 = 3
//     ): [lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number, head: DiffEntry[], tail: DiffEntry[]] {
//         const lhsTokens = _leftTokens, rhsTokens = _rightTokens;
//         const head: DiffEntry[] = [];
//         const tail: DiffEntry[] = [];
//         let matchedCount;
//         // Prefix
//         if (consumeDirections & 1) {
//             while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
//                 if (lhsTokens[lhsLower].flags & TokenFlags.IMAGE || rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
//                     if (lhsTokens[lhsLower].flags & rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
//                         if (compareImageTokens(lhsTokens[lhsLower], rhsTokens[rhsLower])) {
//                             head.push({
//                                 type: 0,
//                                 left: { start: lhsLower, end: lhsLower + 1 },
//                                 right: { start: rhsLower, end: rhsLower + 1 },
//                             });
//                             lhsLower++;
//                             rhsLower++;
//                             continue;
//                         }
//                     }
//                     // 그림vs그림 비교결과가 false이거나 그림vs텍스트인 경우.
//                     break;
//                 }

//                 if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
//                     head.push({
//                         type: 0,
//                         left: { start: lhsLower, end: lhsLower + 1 },
//                         right: { start: rhsLower, end: rhsLower + 1 },
//                     });
//                     lhsLower++;
//                     rhsLower++;
//                     continue;
//                 }

//                 if (
//                     WHITESPACE_HANDLING !== "collapse" &&
//                     lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
//                     lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
//                     (matchedCount = matchPrefixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper))
//                 ) {
//                     head.push({
//                         type: 0,
//                         left: {
//                             start: lhsLower,
//                             end: lhsLower + matchedCount[0],
//                         },
//                         right: {
//                             start: rhsLower,
//                             end: rhsLower + matchedCount[1],
//                         },
//                     });
//                     lhsLower += matchedCount[0];
//                     rhsLower += matchedCount[1];
//                     continue;
//                 }

//                 break;
//             }
//         }

//         // Suffix
//         if (consumeDirections & 2) {
//             while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
//                 if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
//                     tail.push({
//                         type: 0,
//                         left: { start: lhsUpper - 1, end: lhsUpper },
//                         right: { start: rhsUpper - 1, end: rhsUpper },
//                     });
//                     lhsUpper--;
//                     rhsUpper--;
//                 } else if (
//                     WHITESPACE_HANDLING !== "collapse" &&
//                     lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
//                     lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
//                     (matchedCount = matchSuffixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper))
//                 ) {
//                     tail.push({
//                         type: 0,
//                         left: {
//                             start: lhsUpper - matchedCount[0],
//                             end: lhsUpper,
//                         },
//                         right: {
//                             start: rhsUpper - matchedCount[1],
//                             end: rhsUpper,
//                         },
//                     });
//                     lhsUpper -= matchedCount[0];
//                     rhsUpper -= matchedCount[1];
//                 } else {
//                     break;
//                 }
//             }
//             tail.reverse();
//         }
//         return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
//     }

//     function matchPrefixTokens(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number
//         //allowJoinOnlyAtLineBoundary: boolean
//     ): false | [leftMatched: number, rightMatched: number] {
//         if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

//         const leftTokens = _leftTokens, rightTokens = _rightTokens;
//         const onlyAllowJoinOnlyAtLineBoundary = WHITESPACE_HANDLING === "ignoreAtEdge";

//         let i = lhsLower,
//             j = rhsLower;
//         let ci = 0,
//             cj = 0;

//         let lhsToken = leftTokens[i++],
//             ltext = lhsToken.text,
//             lhsLen = ltext.length;
//         let rhsToken = rightTokens[j++],
//             rtext = rhsToken.text,
//             rhsLen = rtext.length;

//         // if (lhsToken.flags & NO_JOIN_NEXT || rhsToken.flags & NO_JOIN_NEXT) {
//         // 	// return false;
//         // }

//         if (lhsToken.flags & TokenFlags.IMAGE || rhsToken.flags & TokenFlags.IMAGE) {
//             return false;
//         }

//         while (true) {
//             while (ci < lhsLen && cj < rhsLen) {
//                 if (ltext.charCodeAt(ci++) !== rtext.charCodeAt(cj++)) {
//                     return false;
//                 }
//                 // if (ltext[ci++] !== rtext[cj++]) {
//                 //     return false;
//                 // }
//             }

//             // 문자 불일치 없이 양쪽 토큰이 동시에 끝난 경우
//             if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];

//             if (ci === lhsLen) {
//                 if (i === lhsUpper) return false;
//                 if (
//                     lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 lhsToken = leftTokens[i++];
//                 if (!lhsToken) return false;
//                 if (lhsToken.flags & TokenFlags.IMAGE) {
//                     // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                     return false;
//                 }
//                 if (
//                     lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 ltext = lhsToken.text;
//                 lhsLen = ltext.length;
//                 ci = 0;
//             }
//             if (cj === rhsLen) {
//                 if (j === rhsUpper) return false;
//                 if (
//                     rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 rhsToken = rightTokens[j++];
//                 if (!rhsToken) return false;
//                 if (rhsToken.flags & TokenFlags.IMAGE) {
//                     // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                     return false;
//                 }
//                 if (
//                     rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 rtext = rhsToken.text;
//                 rhsLen = rtext.length;
//                 cj = 0;
//             }
//         }
//     }

//     function matchSuffixTokens(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number,
//     ): false | [leftMatched: number, rightMatched: number] {
//         if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

//         const leftTokens = _leftTokens, rightTokens = _rightTokens;
//         const onlyAllowJoinOnlyAtLineBoundary = WHITESPACE_HANDLING === "ignoreAtEdge";

//         let i = lhsUpper - 1,
//             j = rhsUpper - 1;

//         let lhsToken = leftTokens[i--],
//             ltext = lhsToken.text,
//             rhsToken = rightTokens[j--],
//             rtext = rhsToken.text;
//         let ci = ltext.length - 1,
//             cj = rtext.length - 1;

//         // if (lhsToken.flags & NO_JOIN_PREV || rhsToken.flags & NO_JOIN_PREV) {
//         // 	return false;
//         // }

//         if (lhsToken.flags & TokenFlags.IMAGE || rhsToken.flags & TokenFlags.IMAGE) {
//             return false;
//         }

//         while (true) {
//             while (ci >= 0 && cj >= 0) {
//                 if (ltext.charCodeAt(ci--) !== rtext.charCodeAt(cj--)) {
//                     return false;
//                 }
//                 // if (ltext[ci--] !== rtext[cj--]) {
//                 //     return false;
//                 // }
//             }
//             if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];

//             if (ci < 0) {
//                 if (i < lhsLower) return false;
//                 if (
//                     lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 lhsToken = leftTokens[i--];
//                 if (!lhsToken) return false;
//                 if (lhsToken.flags & TokenFlags.IMAGE) {
//                     // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                     return false;
//                 }
//                 if (
//                     lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 ltext = lhsToken.text;
//                 ci = lhsToken.text.length - 1;
//             }
//             if (cj < 0) {
//                 if (j < rhsLower) return false;
//                 if (
//                     rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 rhsToken = rightTokens[j--];
//                 if (!rhsToken) return false;
//                 if (rhsToken.flags & TokenFlags.IMAGE) {
//                     // 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
//                     return false;
//                 }
//                 if (
//                     rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
//                     (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
//                 ) {
//                     return false;
//                 }

//                 rtext = rhsToken.text;
//                 cj = rhsToken.text.length - 1;
//             }
//         }
//     }

//     async function mergeEntries(rawEntries: DiffEntry[]): Promise<DiffEntry[]> {
//         const entries: DiffEntry[] = [];

//         for (let i = 0; i < rawEntries.length; i++) {
//             const raw = rawEntries[i];
//             if (raw.type === 0) {
//                 entries.push(raw);
//                 continue;
//             }

//             const last = entries[entries.length - 1];
//             if (last && last.type === raw.type) {
//                 last.left.end = raw.left.end;
//                 last.right.end = raw.right.end;
//             } else {
//                 entries.push({
//                     type: raw.type,
//                     left: { start: raw.left.start, end: raw.left.end },
//                     right: { start: raw.right.start, end: raw.right.end }
//                 });
//             }
//         }

//         if ((_yieldCounter++ & 0x1ff) === 0) {
//             await yieldIfNeeded(false);
//         }
//         return entries;
//     }


//     // @ts-ignore
//     function compareImageTokens(leftToken: Token, rightToken: Token): boolean {
//         if (leftToken.text === rightToken.text) return true;
//         return false;

//         // if (!(leftToken.flags & rightToken.flags & TokenFlags.IMAGE)) {
//         //     return false;
//         // }

//         // const { compareImage, compareImageTolerance } = ctx.options;
//         // //console.log("compareImage, compareImageTolerance:", compareImage, compareImageTolerance)
//         // if (!compareImage) {
//         //     return leftToken.text === rightToken.text;
//         // }

//         // const cacheKey = makeImageKey(leftToken.text, rightToken.text);
//         // const cache = ctx.imageComparisons;
//         // let result: { similarity: number | undefined } | undefined = cache[cacheKey] ?? undefined;
//         // if (result) {
//         //     return (result.similarity ?? 0) * 100 >= compareImageTolerance;
//         // }

//         // result = imageCompareCache.get(leftToken.text)?.get(rightToken.text) ?? undefined;
//         // if (result) {
//         //     cache[cacheKey] = result;
//         //     return (result.similarity ?? 0) * 100 >= compareImageTolerance;
//         // }

//         // // console.log("compare", leftToken, rightToken, cacheKey, result);
//         // if (leftToken.text === rightToken.text) {
//         //     result = { similarity: 1 };
//         // } else if (!leftToken.data || !rightToken.data) {
//         //     //console.log("no data");
//         //     result = { similarity: undefined };
//         // } else {
//         //     const { width, height } = leftToken;
//         //     const leftArr = new Uint8ClampedArray(leftToken.data!);
//         //     const rightArr = new Uint8ClampedArray(rightToken.data!);
//         //     const diffCount = pixelmatch(leftArr, rightArr, void 0, width!, height!, { threshold: 0.1 });
//         //     result = { similarity: (width! * height! - diffCount) / (width! * height!) };
//         // }

//         // cache[cacheKey] = result;

//         // if (!imageCompareCache.has(leftToken.text)) {
//         //     imageCompareCache.set(leftToken.text, new Map());
//         // }
//         // if (!imageCompareCache.get(rightToken.text)) {
//         //     imageCompareCache.set(rightToken.text, new Map());
//         // }
//         // imageCompareCache.get(leftToken.text)!.set(rightToken.text, result);
//         // imageCompareCache.get(rightToken.text)!.set(leftToken.text, result);
//         // return (result.similarity ?? 0) * 100 >= compareImageTolerance;
//     }



//     function postProgress(progress: number) {
//         if (progress !== _lastProgressReport) {
//             self.postMessage({
//                 reqId: _reqId!,
//                 type: "progress",
//                 progress: progress,
//             } satisfies DiffWorkerResponse);
//             _lastProgressReport = progress;
//         }
//     }

//     type CoarseAnchorPoint = { lhsIndex: number; rhsIndex: number };
//     type CoarseAnchorSig = { start: number; end: number; sig: number };

//     // --------------------------------------------------
//     // fast tables
//     // --------------------------------------------------

//     const FNV1A_PRIME = 0x01000193;
//     const FNV1A_OFFSET_BASIS = 0x811c9dc5 | 0;


//     // --------------------------------------------------
//     // split usefulness (kept)
//     // --------------------------------------------------

//     function isCoarseSplitWorthIt(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number,
//         a: CoarseAnchorPoint
//     ): boolean {
//         const lSize = lhsUpper - lhsLower;
//         const rSize = rhsUpper - rhsLower;

//         const lLeft = a.lhsIndex - lhsLower;
//         const lRight = lhsUpper - a.lhsIndex;
//         const rLeft = a.rhsIndex - rhsLower;
//         const rRight = rhsUpper - a.rhsIndex;

//         if (lLeft < COARSE_SPLIT_MIN_SIDE_TOKENS || lRight < COARSE_SPLIT_MIN_SIDE_TOKENS) return false;
//         if (rLeft < COARSE_SPLIT_MIN_SIDE_TOKENS || rRight < COARSE_SPLIT_MIN_SIDE_TOKENS) return false;

//         const before = Math.max(lSize, rSize);
//         const after = Math.max(Math.max(lLeft, lRight), Math.max(rLeft, rRight));

//         const gain = before - after;
//         return gain >= before * COARSE_SPLIT_MIN_GAIN_RATIO;
//     }

//     // --------------------------------------------------
//     // single-pass range scan + hash (validity included)
//     // --------------------------------------------------

//     function hashTokensRange(
//         tokens: Token[],
//         start: number,
//         end: number,
//         wsMode: WhitespaceHandling
//     ): number | null {
//         const tokenCount = end - start;
//         if (tokenCount < COARSE_ANCHOR_MIN_TOKENS) return null;

//         let h = FNV1A_OFFSET_BASIS;

//         let wordLikeCount = 0;
//         let effectiveChars = 0;
//         let nonWsChars = 0;
//         let uniq = 0;

//         let prevWasWs = false;

//         const epoch = (_coarseUniqEpoch = (_coarseUniqEpoch + 1) >>> 0);
//         if (epoch === 0) {
//             _coarseUniqStamp.fill(0);
//             _coarseUniqEpoch = 1;
//         }
//         const curEpoch = _coarseUniqEpoch;

//         for (let i = start; i < end; i++) {
//             const t = tokens[i];

//             if (t.flags & TokenFlags.WORD_LIKE) {
//                 wordLikeCount++;
//                 effectiveChars += t.text.length;
//             }

//             if (t.flags & TokenFlags.IMAGE) {
//                 nonWsChars += 3;

//                 const imgCh = 0xfffd;
//                 if (_coarseUniqStamp[imgCh] !== curEpoch) {
//                     _coarseUniqStamp[imgCh] = curEpoch;
//                     uniq++;
//                 }

//                 h ^= 0x2f;
//                 h = Math.imul(h, FNV1A_PRIME) | 0;

//                 const s = t.text;
//                 for (let k = 0, n = s.length; k < n; k++) {
//                     h ^= s.charCodeAt(k);
//                     h = Math.imul(h, FNV1A_PRIME) | 0;
//                 }

//                 prevWasWs = false;
//                 h ^= 0;
//                 h = Math.imul(h, FNV1A_PRIME) | 0;
//                 continue;
//             }

//             const s = t.text;
//             for (let k = 0, n = s.length; k < n; k++) {
//                 const c = s.charCodeAt(k);

//                 if (WS_TABLE[c]) {
//                     if (wsMode !== "ignore") {
//                         if (!prevWasWs) {
//                             prevWasWs = true;
//                             h ^= 32;
//                             h = Math.imul(h, FNV1A_PRIME) | 0;
//                         }
//                     }
//                     continue;
//                 }

//                 prevWasWs = false;
//                 nonWsChars++;

//                 if (_coarseUniqStamp[c] !== curEpoch) {
//                     _coarseUniqStamp[c] = curEpoch;
//                     uniq++;
//                 }

//                 h ^= c;
//                 h = Math.imul(h, FNV1A_PRIME) | 0;
//             }

//             prevWasWs = false;
//             h ^= 0;
//             h = Math.imul(h, FNV1A_PRIME) | 0;
//         }

//         if (wordLikeCount < COARSE_ANCHOR_MIN_WORD_LIKE_TOKENS) return null;
//         if (effectiveChars < COARSE_ANCHOR_MIN_EFFECTIVE_CHARS) return null;
//         if (nonWsChars < COARSE_ANCHOR_MIN_EFFECTIVE_CHARS) return null;
//         if (uniq <= COARSE_ANCHOR_MIN_UNIQUE_CHARS) return null;

//         return h | 0;
//     }

//     // --------------------------------------------------
//     // anchor builders (no extra validation pass)
//     // --------------------------------------------------

//     function buildLineAnchors(tokens: Token[], lower: number, upper: number): CoarseAnchorSig[] {
//         const lines: CoarseAnchorSig[] = [];
//         let lineStart = lower;

//         for (let i = lower + 1; i < upper; i++) {
//             if (tokens[i].flags & TokenFlags.LINE_START) {
//                 const sig = hashTokensRange(tokens, lineStart, i, WHITESPACE_HANDLING);
//                 if (sig != null) lines.push({ start: lineStart, end: i, sig });
//                 lineStart = i;
//             }
//         }

//         if (lineStart < upper) {
//             const sig = hashTokensRange(tokens, lineStart, upper, WHITESPACE_HANDLING);
//             if (sig != null) lines.push({ start: lineStart, end: upper, sig });
//         }

//         return lines;
//     }

//     function buildLinePrefixAnchors(
//         tokens: Token[],
//         lower: number,
//         upper: number,
//         window: number
//     ): CoarseAnchorSig[] {
//         const result: CoarseAnchorSig[] = [];

//         for (let i = lower; i < upper; i++) {
//             if (!(tokens[i].flags & TokenFlags.LINE_START)) continue;

//             const end = i + window;
//             if (end > upper) break;

//             const sig = hashTokensRange(tokens, i, end, WHITESPACE_HANDLING);
//             if (sig != null) result.push({ start: i, end, sig });
//         }

//         return result;
//     }

//     function buildFixedWindowAnchors(
//         tokens: Token[],
//         lower: number,
//         upper: number,
//         window: number
//     ): CoarseAnchorSig[] {
//         const result: CoarseAnchorSig[] = [];

//         for (let i = lower; i + window <= upper; i += window) {
//             const sig = hashTokensRange(tokens, i, i + window, WHITESPACE_HANDLING);
//             if (sig != null) result.push({ start: i, end: i + window, sig });
//         }

//         return result;
//     }

//     function buildCoarseAnchors(tokens: Token[], lower: number, upper: number): CoarseAnchorSig[] {
//         switch (COARSE_ANCHOR_MODE) {
//             case "line":
//                 return buildLineAnchors(tokens, lower, upper);
//             case "linePrefix":
//                 return buildLinePrefixAnchors(tokens, lower, upper, _diffOptions.coarseAnchorTokenWindow);
//             case "fixedWindow":
//                 return buildFixedWindowAnchors(tokens, lower, upper, _diffOptions.coarseAnchorTokenWindow);
//         }
//     }

//     // --------------------------------------------------
//     // best anchor selection (unique + LIS + worth check)
//     // --------------------------------------------------

//     function findBestCoarseLineAnchorPoint(
//         lhsLower: number,
//         lhsUpper: number,
//         rhsLower: number,
//         rhsUpper: number
//     ): CoarseAnchorPoint | null {
//         const leftLines = buildCoarseAnchors(_leftTokens, lhsLower, lhsUpper);
//         const rightLines = buildCoarseAnchors(_rightTokens, rhsLower, rhsUpper);

//         if (!leftLines.length || !rightLines.length) return null;

//         // state: sig -> packed info
//         // bits:
//         // 0..1   count (0..3)
//         // 2..21  leftIndex+1 (20 bits)
//         // 22..41 rightIndex+1 (20 bits)
//         const COUNT_MASK = 0x3;
//         const LI_SHIFT = 2;
//         const LI_BITS = 20;
//         const RJ_SHIFT = LI_SHIFT + LI_BITS;
//         const IDX_MASK = (1 << LI_BITS) - 1;

//         const state = new Map<number, number>();

//         for (let i = 0; i < leftLines.length; i++) {
//             const sig = leftLines[i].sig;
//             const prev = state.get(sig) ?? 0;

//             const count = ((prev & COUNT_MASK) + 1) & COUNT_MASK;
//             const li = ((prev >>> LI_SHIFT) & IDX_MASK) || (i + 1);
//             const rj = (prev >>> RJ_SHIFT) & IDX_MASK;

//             state.set(sig, (count | (li << LI_SHIFT) | (rj << RJ_SHIFT)) | 0);
//         }

//         for (let j = 0; j < rightLines.length; j++) {
//             const sig = rightLines[j].sig;
//             const prev = state.get(sig) ?? 0;

//             const count = ((prev & COUNT_MASK) + 1) & COUNT_MASK;
//             const li = (prev >>> LI_SHIFT) & IDX_MASK;
//             const rj = ((prev >>> RJ_SHIFT) & IDX_MASK) || (j + 1);

//             state.set(sig, (count | (li << LI_SHIFT) | (rj << RJ_SHIFT)) | 0);
//         }

//         const pairs: { li: number; rj: number }[] = [];
//         for (const v of state.values()) {
//             if ((v & COUNT_MASK) !== 2) continue;

//             const li1 = (v >>> LI_SHIFT) & IDX_MASK;
//             const rj1 = (v >>> RJ_SHIFT) & IDX_MASK;
//             if (!li1 || !rj1) continue;

//             pairs.push({ li: li1 - 1, rj: rj1 - 1 });

//             if (pairs.length > COARSE_SPLIT_MAX_UNIQUE_ANCHORS) {
//                 if (import.meta.env.DEV) {
//                     console.log("Too many coarse unique anchors, giving up:", pairs.length);
//                 }
//                 return null;
//             }
//         }

//         if (pairs.length === 0) return null;

//         pairs.sort((a, b) => a.li - b.li);

//         const lisIdx = lisIndicesBySecond(pairs);
//         if (!lisIdx.length) return null;

//         const chosen = pairs[lisIdx[(lisIdx.length / 2) | 0]];
//         const lLine = leftLines[chosen.li];
//         const rLine = rightLines[chosen.rj];

//         const anchor: CoarseAnchorPoint = { lhsIndex: lLine.start, rhsIndex: rLine.start };

//         if (!isCoarseSplitWorthIt(lhsLower, lhsUpper, rhsLower, rhsUpper, anchor)) return null;

//         return anchor;
//     }

//     // --------------------------------------------------
//     // LIS helper (kept)
//     // --------------------------------------------------

//     function lisIndicesBySecond(pairs: { li: number; rj: number }[]): number[] {
//         const n = pairs.length;
//         const tails: number[] = [];
//         const tailsIdx: number[] = [];
//         const prev: number[] = new Array(n).fill(-1);

//         for (let i = 0; i < n; i++) {
//             const x = pairs[i].rj;

//             let lo = 0, hi = tails.length;
//             while (lo < hi) {
//                 const mid = (lo + hi) >>> 1;
//                 if (tails[mid] < x) lo = mid + 1;
//                 else hi = mid;
//             }

//             if (lo > 0) prev[i] = tailsIdx[lo - 1];

//             if (lo === tails.length) {
//                 tails.push(x);
//                 tailsIdx.push(i);
//             } else {
//                 tails[lo] = x;
//                 tailsIdx[lo] = i;
//             }
//         }

//         const result: number[] = [];
//         let idx = tailsIdx[tailsIdx.length - 1];
//         while (idx !== -1) {
//             result.push(idx);
//             idx = prev[idx];
//         }
//         result.reverse();
//         return result;
//     }



//     //
//     // RUN RUN RUN
//     //

//     self.postMessage({
//         reqId: _reqId!,
//         type: "start",
//         start: _startTime!,
//     } satisfies DiffWorkerResponse);

//     const promise = (async function () {
//         try {
//             const entries = await runHistogramDiff();
//             const mergedEntries = await mergeEntries(entries);
//             _finishTime = performance.now();
//             self.postMessage({
//                 reqId: _reqId!,
//                 type: "done",
//                 elapsedTime: _finishTime - _startTime!,
//                 diffs: mergedEntries,
//                 options: _diffOptions,
//             } satisfies DiffWorkerResponse);
//         } catch (err) {
//             if (err !== ABORT_REASON_CANCELLED) {
//                 console.error("diff worker error:", err)
//                 self.postMessage({
//                     reqId: _reqId!,
//                     type: "error",
//                     error: err instanceof Error ? err.message : String(err),
//                 } satisfies DiffWorkerResponse);
//             }
//         }
//     })();

//     return {
//         reqId: _reqId!,
//         promise,
//         abort: () => {
//             if (_signal.aborted) return;
//             _abortController.abort(ABORT_REASON_CANCELLED);
//         },
//     }
// }


// function postAborted(reqId: number) {
//     self.postMessage({
//         reqId,
//         type: "cancelled",
//     } satisfies DiffWorkerResponse);
// }

