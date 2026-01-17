import { ABORT_REASON_CANCELLED } from "../constants";
import { TokenFlags } from "../TokenFlags";
import type { DiffEntry, DiffOptions, DiffType, SerializedToken as Token, WhitespaceHandling } from "../types";

/*
생각해 볼 것:
몇 십 페이지까지 워드 문서에서는 큰 문제가 되지 않지만
200페이지 이상의 워드 문서에서 군데군데 diff가 있는 경우 성능이 급격히 저하됨.
이 성능 저하를 줄이기 위해서 
- coase split (대충 구현됨)
- 섹션헤딩 매칭(넘버링으로 우선 매칭) - 생각 중

또 하나 고려해 볼 것
텍스트를 한글자 한글자 떼어서 비교할 것이 아니라
모든 토큰의 텍스트를 uint16array로 합쳐서 각 토큰은 charStart, charEnd를 가지게 하는 방법
글자 비교는 text[i]가 아니라 textBuf[charStart + i]로 해야겠지!
n그램 등 토큰을 이어붙여서 비교할 경우는 텍스트를 이어붙일 것이 아니라 글자 하나씩 rolling hash로...?
*/
export type DiffWorkerRequest = {
    type: "diff";
    reqId: number;
    leftWholeText: string;
    leftTokens: Token[];
    rightWholeText: string;
    rightTokens: Token[];
    options: DiffOptions;
} | {
    type: "cancel";
    reqId?: number;
};

export type DiffWorkerResponse =
    | { type: "done"; reqId: number; } & DiffWorkerResult
    | { type: "error"; reqId: number; error: string }
    | { type: "cancelled"; reqId: number; }
    | { type: "start"; reqId: number; start: number; }
    | { type: "progress"; reqId: number; progress: number; };

export type DiffWorkerResult = {
    diffs: DiffEntry[];
    options: DiffOptions;
    elapsedTime: number;
};

type WorkItem = {
    reqId: number;
    leftWholeText: string;
    rightWholeText: string;
    leftTokens: Token[];
    rightTokens: Token[];
    diffOptions: DiffOptions;
};

type DiffJob = {
    reqId: number;
    abort: () => void;
    promise: Promise<void>;
}

let _scheduled = false;
let _nextWorkItem: WorkItem | null = null;
let _runningJob: DiffJob | null = null;

self.onmessage = (e) => {
    const request = e.data as DiffWorkerRequest;
    if (request.type === "diff") {
        _nextWorkItem = {
            reqId: request.reqId,
            leftWholeText: request.leftWholeText,
            rightWholeText: request.rightWholeText,
            leftTokens: request.leftTokens,
            rightTokens: request.rightTokens,
            diffOptions: request.options,
        };
        schedule();
    } else if (request.type === "cancel") {
        if (_runningJob && (!request.reqId || _runningJob.reqId <= request.reqId)) {
            _runningJob.abort();
        }
        if (_nextWorkItem && (!request.reqId || _nextWorkItem.reqId <= request.reqId)) {
            postAborted(_nextWorkItem.reqId);
            _nextWorkItem = null;
        }
    }
}

function schedule() {
    _runningJob?.abort();
    if (!_scheduled) {
        _scheduled = true;
        setTimeout(runLatest, 0);
    }
}

function runLatest() {
    _scheduled = false;

    const running = _runningJob;
    _runningJob = null;

    const startNext = () => {
        // _nextWorkItem = null;
        if (_nextWorkItem) {
            const reqId = _nextWorkItem.reqId;
            const diffOptions = _nextWorkItem.diffOptions;
            const leftData = prepareData(_nextWorkItem.leftWholeText, _nextWorkItem.leftTokens, _nextWorkItem.diffOptions);
            const rightData = prepareData(_nextWorkItem.rightWholeText, _nextWorkItem.rightTokens, _nextWorkItem.diffOptions);
            _nextWorkItem = null;
            _runningJob = runDiffJob({
                reqId,
                left: leftData,
                right: rightData,
                diffOptions,
            });
        }
    };

    if (running) {
        running.promise.finally(startNext);
    } else {
        startNext();
    }
}

const WS_TABLE = new Uint8Array(65536);
WS_TABLE[32] = 1;   // space
WS_TABLE[9] = 1;    // \t
WS_TABLE[10] = 1;   // \n
WS_TABLE[13] = 1;   // \r
WS_TABLE[12] = 1;   // \f
WS_TABLE[11] = 1;   // \v
WS_TABLE[160] = 1;  // nbsp

const _coarseUniqStamp = new Uint32Array(65536);
let _coarseUniqEpoch = 1;
function prepareData(wholeText: string, tokens: Token[], options: DiffOptions) {
    const count = tokens.length;
    const whitespace = options.whitespace;

    // 1차 패스: 정확한 Buffer 크기 계산
    let totalBufLen = 0;
    if (whitespace === "collapse") totalBufLen++; // leading space

    for (let i = 0; i < count; i++) {
        const t = tokens[i];
        const flags = t.flags;

        // 공백 처리 로직에 따른 길이 가산
        if (!(flags & TokenFlags.LINE_START) && (flags & TokenFlags.HAS_PRECEDING_SPACE)) {
            if (whitespace === "collapse" || whitespace === "ignoreAtEdge") totalBufLen++;
        }

        totalBufLen += t.textLength;

        if ((flags & TokenFlags.LINE_END) && whitespace === "collapse") totalBufLen++;
    }

    const buffer = new Uint16Array(totalBufLen);
    const offsetArray = new Uint32Array(count);
    const lengthArray = new Uint32Array(count);
    const unitOffsetArray = new Uint32Array(count + 1); // +1 중요
    const flagsArray = new Uint32Array(count);
    const hashArray = new Uint32Array(count);

    let currentPos = 0;
    if (whitespace === "collapse") buffer[currentPos++] = 32;

    for (let i = 0; i < count; i++) {
        const t = tokens[i];
        const flags = t.flags;

        unitOffsetArray[i] = currentPos; // 토큰 유닛(공백포함) 시작점

        // 1. 선행 공백
        if (!(flags & TokenFlags.LINE_START) && (flags & TokenFlags.HAS_PRECEDING_SPACE)) {
            if (whitespace === "collapse" || whitespace === "ignoreAtEdge") {
                buffer[currentPos++] = 32;
            }
        }

        // 2. 본체
        offsetArray[i] = currentPos;
        lengthArray[i] = t.textLength;
        flagsArray[i] = flags;

        for (let j = 0; j < t.textLength; j++) {
            buffer[currentPos++] = wholeText.charCodeAt(t.textOffset + j);
        }

        // 3. 후행 공백
        if ((flags & TokenFlags.LINE_END) && whitespace === "collapse") {
            buffer[currentPos++] = 32;
        }

        // 4. 해시 (유닛 전체 기준)
        hashArray[i] = calculateHash(buffer, unitOffsetArray[i], currentPos - unitOffsetArray[i]);
    }
    unitOffsetArray[count] = currentPos; // 마지막 경계

    return { textBuffer: buffer, offsetArray, lengthArray, unitOffsetArray, flagsArray, hashArray };
}

function runDiffJob({ reqId, left: leftData, right: rightData, diffOptions }: {
    reqId: number,
    left: ReturnType<typeof prepareData>, right: ReturnType<typeof prepareData>, diffOptions: DiffOptions
}): DiffJob {
    // const {
    //     reqId: _reqId,
    //     leftWholeText: _leftWholeText,
    //     leftTokens: _leftTokens,
    //     rightWholeText: _rightWholeText,
    //     rightTokens: _rightTokens,
    //     diffOptions: _diffOptions
    // } = workItem;

    const _reqId = reqId;
    const _diffOptions = diffOptions;
    const I_DONT_BELIEVE_HASH_COLLISIONS = true;
    const { textBuffer: _leftTextBuffer, offsetArray: _leftOffsetArray, lengthArray: _leftLengthArray, unitOffsetArray: _leftUnitOffsetArray, flagsArray: _leftFlagsArray, hashArray: _leftHashArray } = leftData;
    const { textBuffer: _rightTextBuffer, offsetArray: _rightOffsetArray, lengthArray: _rightLengthArray, unitOffsetArray: _rightUnitOffsetArray, flagsArray: _rightFlagsArray, hashArray: _rightHashArray } = rightData;

    const _leftTokenCount = _leftFlagsArray.length;
    const _rightTokenCount = _rightFlagsArray.length;

    // [기본값] 각 보너스의 기본 강도
    const BASE_LENGTH_BONUS_STRENGTH = 0.7;
    const BASE_LINE_START_BONUS_STRENGTH = 0.85; // 라인 시작 보너스 (낮을수록 강함)
    const BASE_UNIQUE_BONUS_STRENGTH = 0.5;

    // 그램 설정
    const _MAX_GRAM = _diffOptions.useGrams ? _diffOptions.maxGram : 1;

    // 길이 보너스
    const _USE_LENGTH_BONUS = _diffOptions.useLengthBonus;
    const _MAX_LENGTH_PER_GRAM_FOR_BONUS = _diffOptions.maxLengthPerGramForBonus;
    const _LENGTH_BONUS_STRENGTH = _USE_LENGTH_BONUS ? BASE_LENGTH_BONUS_STRENGTH * _diffOptions.lengthBonusMultiplier : 1;

    // 줄 시작 보너스 설정
    const _USE_LINE_START_BONUS = _diffOptions.useLineStartBonus;
    const _LINE_START_BONUS_STRENGTH = _USE_LINE_START_BONUS ? BASE_LINE_START_BONUS_STRENGTH * _diffOptions.lineStartBonusMultiplier : 1;

    // 고유성 보너스 설정
    const _USE_UNIQUE_BONUS = _diffOptions.useUniqueBonus;
    const _UNIQUE_BONUS_STRENGTH = _USE_UNIQUE_BONUS ? BASE_UNIQUE_BONUS_STRENGTH * _diffOptions.uniqueBonusMultiplier : 1;

    // CCOARSE SPLITTING
    const USE_COARSE_SPLIT = _diffOptions.useCoarseSplit;
    const COARSE_ANCHOR_MODE = _diffOptions.coarseAnchorMode;
    const COARSE_ANCHOR_MIN_TOKENS = _diffOptions.coarseAnchorMinTokens;
    const COARSE_ANCHOR_TOKEN_WINDOW = _diffOptions.coarseAnchorTokenWindow;
    const COARSE_ANCHOR_MIN_EFFECTIVE_CHARS = _diffOptions.coarseAnchorMinEffectiveChars;
    const COARSE_ANCHOR_MIN_UNIQUE_CHARS = _diffOptions.coarseAnchorMode === "line" ? 3 : 2;
    const COARSE_ANCHOR_MIN_WORD_LIKE_TOKENS = _diffOptions.coarseAnchorMinWordLikeTokens;
    const COARSE_SPLIT_MIN_TOKENS = _diffOptions.coarseSplitMinTokens;
    const COARSE_SPLIT_MIN_SIDE_TOKENS = _diffOptions.coarseSplitMinSideTokens;
    const COARSE_SPLIT_MIN_GAIN_RATIO = _diffOptions.coarseSplitMinGainRatio;
    const COARSE_SPLIT_MAX_UNIQUE_ANCHORS = _diffOptions.coarseSplitMaxUniqueAnchors;

    // MISC
    const WHITESPACE_HANDLING: WhitespaceHandling = _diffOptions.whitespace;
    const MIN_YIELD_INTERVAL = 50;


    const _abortController = new AbortController();
    const _signal = _abortController.signal;
    const _entries: DiffEntry[] = [];
    const _coaseAnchorUniqChars = new Set<number>();

    const _startTime = performance.now();
    let _finishTime: number | undefined = undefined;
    let _yieldCounter = 0;
    let _lastYieldTime = _startTime;
    let _leftTokenProcessed = 0;
    let _rightTokenProcessed = 0;
    let _lastProgressReport = -1;

    async function yieldIfNeeded(reportProgress = false) {
        const now = performance.now();
        if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
            _lastYieldTime = now;
            await new Promise((resolve) => setTimeout(resolve, 0));
            _signal.throwIfAborted();
        }

        if (reportProgress) {
            const progress = calculateProgress();
            postProgress(progress);
        }
    }

    // [최적화] runHistogramDiff에서 미리 계산한 설정값들



    // async function throwIfAborted(ctx: WorkContext, skipYield = false) {
    //     if (!skipYield) {
    //         const now = performance.now();
    //         if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
    //             _lastYieldTime = now;
    //             await new Promise((resolve) => setTimeout(resolve, 0));
    //         }
    //     }
    //     ctx.abortSignal.throwIfAborted();
    // }

    function calculateProgress(): number {
        const left = _leftTokenCount ? _leftTokenProcessed / _leftTokenCount : 1;
        const right = _rightTokenCount ? _rightTokenProcessed / _rightTokenCount : 1;
        return Math.floor((left + right) / 2 * 100);
    }


    async function runHistogramDiff(): Promise<DiffEntry[]> {
        // const lhsTokens = _leftTokens;
        // const rhsTokens = _rightTokens;

        // [최적화] 옵션에 따른 모든 설정값 미리 계산 (전역변수에 캐싱)

        // 그램 설정
        // _MAX_GRAM = _diffOptions.useGrams ? _diffOptions.maxGram : 1;

        // // 길이 보너스 설정
        // _USE_LENGTH_BONUS = _diffOptions.useLengthBonus;
        // _MAX_LENGTH_PER_GRAM_FOR_BONUS = _diffOptions.maxLengthPerGramForBonus;
        // if (_USE_LENGTH_BONUS) {
        //     _LENGTH_BONUS_STRENGTH = BASE_LENGTH_BONUS_STRENGTH * _diffOptions.lengthBonusMultiplier;
        // }

        // // 줄 시작 보너스 설정
        // _USE_LINE_START_BONUS = _diffOptions.useLineStartBonus;
        // if (_USE_LINE_START_BONUS) {
        //     _LINE_START_BONUS_STRENGTH = BASE_LINE_START_BONUS_STRENGTH * _diffOptions.lineStartBonusMultiplier;
        // }

        // // 고유성 보너스 설정
        // _USE_UNIQUE_BONUS = _diffOptions.useUniqueBonus;
        // if (_USE_UNIQUE_BONUS) {
        //     _UNIQUE_BONUS_STRENGTH = BASE_UNIQUE_BONUS_STRENGTH * _diffOptions.uniqueBonusMultiplier;
        // }

        const leftAnchors: number[] = [];
        const rightAnchors: number[] = [];

        // for (let i = 0; i < lhsTokens.length; i++) {
        //     const token = lhsTokens[i];
        //     if (token.flags & TokenFlags.MANUAL_ANCHOR) {
        //         leftAnchors.push(i);
        //     }
        // }

        // if (leftAnchors.length > 0) {
        //     for (let i = 0; i < rhsTokens.length; i++) {
        //         const token = rhsTokens[i];
        //         if (token.flags & TokenFlags.MANUAL_ANCHOR) {
        //             rightAnchors.push(i);
        //         }
        //     }
        // }

        // 앵커 강제 매칭
        const matches: { lhsIndex: number; rhsIndex: number }[] = [];
        if (rightAnchors.length > 0) {
            let rightPos = 0;
            for (let l = 0; l < leftAnchors.length; l++) {
                const leftTokenIndex = leftAnchors[l];
                for (let r = rightPos; r < rightAnchors.length; r++) {
                    const rightTokenIndex = rightAnchors[r];

                    if (compareBuffers(_leftTextBuffer, _leftOffsetArray[leftTokenIndex], _leftLengthArray[leftTokenIndex], _rightTextBuffer, _rightOffsetArray[rightTokenIndex], _rightLengthArray[rightTokenIndex])) {
                        matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });
                        rightPos = r + 1;
                        break;
                    }
                }
            }
        }

        let prevLhs = 0;
        let prevRhs = 0;
        for (const match of matches) {
            const lhsAnchor = match.lhsIndex;
            const rhsAnchor = match.rhsIndex;
            if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {
                await diffCore(prevLhs, lhsAnchor, prevRhs, rhsAnchor);
            }
            _entries.push({
                type: 0,
                left: {
                    start: lhsAnchor,
                    end: lhsAnchor + 1,
                },
                right: {
                    start: rhsAnchor,
                    end: rhsAnchor + 1,
                },
            });
            prevLhs = lhsAnchor + 1;
            prevRhs = rhsAnchor + 1;

            _leftTokenProcessed++;
            _rightTokenProcessed++;
        }

        if (prevLhs < _leftTokenCount || prevRhs < _rightTokenCount) {
            // console.log("diffCore", {
            // 	lhsTokens,
            // 	lhsLower: prevLhs,
            // 	lhsUpper: lhsTokens.length,
            // 	rhsTokens,
            // 	rhsLower: prevRhs,
            // 	rhsUpper: rhsTokens.length,
            // });
            await diffCore(prevLhs, _leftTokenCount, prevRhs, _rightTokenCount);
        }

        // const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rhsTokens, 0, rhsTokens.length, findBestHistogramAnchor);
        // return postProcess(ctx, rawEntries, lhsTokens, rhsTokens);
        return _entries;
    }

    async function diffCore(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number,
        consumeDirections: 0 | 1 | 2 | 3 = 3
    ): Promise<DiffEntry[]> {
        console.log("diffCore", lhsLower, lhsUpper, rhsLower, rhsUpper);

        if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
            throw new Error("Invalid diffCore call");
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(true);
        }

        const entries = _entries;

        let skippedHead: DiffEntry[];
        let skippedTail: DiffEntry[];

        [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(lhsLower, lhsUpper, rhsLower, rhsUpper, consumeDirections);

        for (const item of skippedHead) {
            entries.push(item);
            _leftTokenProcessed += item.left.end - item.left.start;
            _rightTokenProcessed += item.right.end - item.right.start;
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(true);
        }

        let didSplit = false;

        if (
            USE_COARSE_SPLIT &&
            lhsLower < lhsUpper &&
            rhsLower < rhsUpper &&
            (lhsUpper - lhsLower) >= COARSE_SPLIT_MIN_TOKENS &&
            (rhsUpper - rhsLower) >= COARSE_SPLIT_MIN_TOKENS
        ) {
            console.log("Attempting coarse split...");

            const coarse = findBestCoarseLineAnchorPoint(lhsLower, lhsUpper, rhsLower, rhsUpper);
            if (coarse && isCoarseSplitWorthIt(lhsLower, lhsUpper, rhsLower, rhsUpper, coarse)) {
                console.log("Coarse split succeeded at", coarse);
                didSplit = true;
                await diffCore(lhsLower, coarse.lhsIndex, rhsLower, coarse.rhsIndex, 2);
                await diffCore(coarse.lhsIndex, lhsUpper, coarse.rhsIndex, rhsUpper, 1);
            } else {
                console.log("Coarse split not worth it or no anchor found.");
            }
        }

        if (!didSplit) {
            const anchor = await findBestHistogramAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper);
            if (
                anchor &&
                (anchor.lhsLength > 0 || anchor.rhsLength > 0) &&
                anchor.lhsIndex >= lhsLower &&
                anchor.lhsIndex + anchor.lhsLength <= lhsUpper &&
                anchor.rhsIndex >= rhsLower &&
                anchor.rhsIndex + anchor.rhsLength <= rhsUpper
            ) {
                didSplit = true;
                await diffCore(lhsLower, anchor.lhsIndex, rhsLower, anchor.rhsIndex, 2);
                await diffCore(anchor.lhsIndex, lhsUpper, anchor.rhsIndex, rhsUpper, 1);
            }
        }

        if (!didSplit) {
            if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
                let type: DiffType = 0;
                if (lhsLower < lhsUpper) type |= 1;
                if (rhsLower < rhsUpper) type |= 2;

                entries.push({
                    type: type as DiffType,
                    left: { start: lhsLower, end: lhsUpper },
                    right: { start: rhsLower, end: rhsUpper },
                });

                _leftTokenProcessed += lhsUpper - lhsLower;
                _rightTokenProcessed += rhsUpper - rhsLower;
            }
        }

        // ✅ tail은 split 여부와 무관하게 항상 붙인다
        for (const item of skippedTail) {
            entries.push(item);
            _leftTokenProcessed += item.left.end - item.left.start;
            _rightTokenProcessed += item.right.end - item.right.start;
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(true);
        }
        return entries;
    }

    type Anchor = { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number; score: number };
    async function findBestHistogramAnchor(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number
    ): Promise<{
        lhsIndex: number;
        lhsLength: number;
        rhsIndex: number;
        rhsLength: number;
        score: number;
    } | null> {

        const maxGram = _MAX_GRAM;
        const freq = new Map<number, number>();

        // --------------------------------------------------
        // 1. N-gram frequency (좌/우 합산)
        // --------------------------------------------------
        for (const isLeft of [true, false]) {
            const lower = isLeft ? lhsLower : rhsLower;
            const upper = isLeft ? lhsUpper : rhsUpper;
            const hashArr = isLeft ? _leftHashArray : _rightHashArray;

            for (let i = lower; i < upper; i++) {
                let h = 2166136261 >>> 0;
                for (let n = 1; n <= maxGram && i + n <= upper; n++) {
                    h ^= hashArr[i + n - 1];
                    h = Math.imul(h, 16777619);
                    const key = h >>> 0;
                    freq.set(key, (freq.get(key) || 0) + 1);
                }
            }

            if ((_yieldCounter++ & 0x1ff) === 0) {
                await yieldIfNeeded(false);
            }
        }

        // --------------------------------------------------
        // 2. RHS index (첫 토큰 해시 기준)
        // --------------------------------------------------
        const rhsIndexByHash = new Map<number, number[]>();
        for (let j = rhsLower; j < rhsUpper; j++) {
            const h = _rightHashArray[j];
            let arr = rhsIndexByHash.get(h);
            if (!arr) {
                arr = [];
                rhsIndexByHash.set(h, arr);
            }
            arr.push(j);
        }

        let best: {
            lhsIndex: number;
            lhsLength: number;
            rhsIndex: number;
            rhsLength: number;
            score: number;
        } | null = null;

        const skipTable = new Int32Array(lhsUpper - lhsLower);

        // --------------------------------------------------
        // 3. 후보 스캔
        // --------------------------------------------------
        for (let i = lhsLower; i < lhsUpper; i++) {
            const rhsCandidates = rhsIndexByHash.get(_leftHashArray[i]);
            if (!rhsCandidates) continue;

            const skip = skipTable[i - lhsLower];
            if (skip >= maxGram) continue;

            for (const j of rhsCandidates) {
                let h = 2166136261 >>> 0;
                let li = i;
                let ri = j;
                let nGrams = 0;
                let totalUnitLen = 0;

                while (li < lhsUpper && ri < rhsUpper && nGrams < maxGram) {
                    const lStart = _leftUnitOffsetArray[li];
                    const lEnd = _leftUnitOffsetArray[li + 1];
                    const rStart = _rightUnitOffsetArray[ri];
                    const rEnd = _rightUnitOffsetArray[ri + 1];

                    const lLen = lEnd - lStart;
                    const rLen = rEnd - rStart;

                    let mL = 0;
                    let mR = 0;

                    // ---------- Case 1: 대칭 ----------
                    if (_leftHashArray[li] === _rightHashArray[ri] && lLen === rLen) {
                        mL = 1;
                        mR = 1;
                    }
                    // ---------- Case 2: 비대칭 ----------
                    else if (
                        WHITESPACE_HANDLING === "ignore" ||
                        WHITESPACE_HANDLING === "ignoreAtEdge"
                    ) {
                        // unitOffset 기준 raw edge-char 비교 (공백이면 공백 그대로)
                        if (_leftTextBuffer[lStart] !== _rightTextBuffer[rStart]) break;
                        if (_leftTextBuffer[lEnd - 1] !== _rightTextBuffer[rEnd - 1]) break;

                        const match = matchPrefixTokens(li, lhsUpper, ri, rhsUpper);
                        if (!match) break;

                        mL = match[0];
                        mR = match[1];
                    }

                    // ---------- 매칭 실패 처리 ----------
                    if (mL === 0) break;

                    // ---------- consume ----------
                    for (let k = 0; k < mL; k++) {
                        h ^= _leftHashArray[li + k];
                        h = Math.imul(h, 16777619);
                        totalUnitLen +=
                            _leftUnitOffsetArray[li + k + 1] -
                            _leftUnitOffsetArray[li + k];
                    }

                    li += mL;
                    ri += mR;
                    nGrams += Math.min(mL, mR);

                    const composite = h >>> 0;
                    const f = freq.get(composite) || 1;

                    let score = (f === 1) ? -nGrams : Math.log(f);

                    if (_USE_LENGTH_BONUS) {
                        const capped = Math.min(
                            totalUnitLen,
                            nGrams * _MAX_LENGTH_PER_GRAM_FOR_BONUS
                        );
                        score /= (1 + Math.log(capped + 1) * _LENGTH_BONUS_STRENGTH);
                    }

                    if (
                        _USE_LINE_START_BONUS &&
                        (_leftFlagsArray[i] & _rightFlagsArray[j] & TokenFlags.LINE_START)
                    ) {
                        score *= _LINE_START_BONUS_STRENGTH;
                    }

                    if (!best || score < best.score) {
                        best = {
                            lhsIndex: i,
                            lhsLength: li - i,
                            rhsIndex: j,
                            rhsLength: ri - j,
                            score,
                        };
                    }

                    if (score <= -maxGram) {
                        return best;
                    }

                    const sIdx = i - lhsLower;
                    if (skipTable[sIdx] < nGrams) {
                        skipTable[sIdx] = nGrams;
                    }
                }
            }

            if ((_yieldCounter++ & 0x1ff) === 0) {
                await yieldIfNeeded(false);
            }
        }

        return best;
    }


    // async function findBestHistogramAnchor(
    //     lhsLower: number,
    //     lhsUpper: number,
    //     rhsLower: number,
    //     rhsUpper: number
    // ): Promise<{ lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number; score: number } | null> {

    //     const maxGram = _MAX_GRAM;

    //     // ---------- 1. N-gram 빈도 계산 (Rolling Hash 기반 최적화) ----------
    //     // getCompositeHash를 매번 호출하지 않고 한 번의 스캔으로 n-gram 해시를 모두 구합니다.
    //     const freq = new Map<number, number>();

    //     for (const isLeft of [true, false]) {
    //         const lower = isLeft ? lhsLower : rhsLower;
    //         const upper = isLeft ? lhsUpper : rhsUpper;
    //         const hashArr = isLeft ? _leftHashArray : _rightHashArray;

    //         for (let i = lower; i < upper; i++) {
    //             let h = 2166136261 >>> 0; // FNV-1a offset basis
    //             // i번째 토큰부터 시작해서 최대 maxGram까지의 조합 해시를 생성
    //             for (let n = 1; n <= maxGram && i + n <= upper; n++) {
    //                 h ^= hashArr[i + n - 1];
    //                 h = Math.imul(h, 16777619);
    //                 const composite = h >>> 0;
    //                 freq.set(composite, (freq.get(composite) || 0) + 1);
    //             }
    //         }
    //         if ((_yieldCounter++ & 0x1ff) === 0) await yieldIfNeeded(false);
    //     }

    //     // ---------- 2. RHS Indexing (첫 번째 토큰 기준 빠른 검색용) ----------
    //     const rhsIndexByHash = new Map<number, number[]>();
    //     for (let j = rhsLower; j < rhsUpper; j++) {
    //         const h = _rightHashArray[j];
    //         let arr = rhsIndexByHash.get(h);
    //         if (!arr) {
    //             arr = [];
    //             rhsIndexByHash.set(h, arr);
    //         }
    //         arr.push(j);
    //     }

    //     let best: { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number; score: number } | null = null;

    //     // n-gram 확장이 이미 처리된 시작점인지 추적하기 위한 테이블 (중복 계산 방지)
    //     const skipTable = new Int32Array(lhsUpper - lhsLower).fill(0);

    //     // ---------- 3. 후보지 스캔 및 정밀 비교 ----------
    //     for (let i = lhsLower; i < lhsUpper; i++) {
    //         const lHash1 = _leftHashArray[i];
    //         const rhsCandidates = rhsIndexByHash.get(lHash1);
    //         if (!rhsCandidates) continue;

    //         // 이미 더 긴 n-gram으로 검토된 시작점이면 패스
    //         if (skipTable[i - lhsLower] >= maxGram) continue;

    //         for (const j of rhsCandidates) {
    //             let h = 2166136261 >>> 0;
    //             let currentTotalUnitLen = 0;

    //             for (let n = 1; n <= maxGram && i + n <= lhsUpper && j + n <= rhsUpper; n++) {
    //                 // [검증 1] 개별 토큰의 해시가 같은지 확인
    //                 if (_leftHashArray[i + n - 1] !== _rightHashArray[j + n - 1]) break;

    //                 // n-gram 복합 해시 업데이트
    //                 h ^= _leftHashArray[i + n - 1];
    //                 h = Math.imul(h, 16777619);
    //                 const compositeHash = h >>> 0;

    //                 // [검증 2] 물리적 데이터 대조 (해시 충돌 방지)
    //                 // unitOffsetArray를 사용하여 정확한 버퍼 범위를 계산합니다.
    //                 const lStart = _leftUnitOffsetArray[i + n - 1];
    //                 const lEnd = _leftUnitOffsetArray[i + n]; // prepareData에서 +1 크기로 만들었어야 함
    //                 const rStart = _rightUnitOffsetArray[j + n - 1];
    //                 const rEnd = _rightUnitOffsetArray[j + n];

    //                 const lLen = lEnd - lStart;
    //                 const rLen = rEnd - rStart;

    //                 // 1. 길이 비교
    //                 if (lLen !== rLen) break;

    //                 // 2. 공백을 제외한 첫 글자 & 마지막 글자 비교 (고속 검증)
    //                 if (lLen > 0) {
    //                     // 첫 글자: 공백이면 +1, 아니면 그대로
    //                     const lFirst = _leftTextBuffer[lStart] <= 32 ? _leftTextBuffer[lStart + 1] : _leftTextBuffer[lStart];
    //                     const rFirst = _rightTextBuffer[rStart] <= 32 ? _rightTextBuffer[rStart + 1] : _rightTextBuffer[rStart];

    //                     // 마지막 글자: 공백이면 -1, 아니면 그대로
    //                     const lLast = _leftTextBuffer[lEnd - 1] <= 32 ? _leftTextBuffer[lEnd - 2] : _leftTextBuffer[lEnd - 1];
    //                     const rLast = _rightTextBuffer[rEnd - 1] <= 32 ? _rightTextBuffer[rEnd - 2] : _rightTextBuffer[rEnd - 1];

    //                     if (lFirst !== rFirst || lLast !== rLast) break;
    //                 }

    //                 // 실제 버퍼의 내용을 직접 비교 (I_DONT_BELIEVE... 설정을 무시하고 안전하게 비교)
    //                 // if (lLen !== rLen || !compareBuffers(_leftTextBuffer, lStart, lLen, _rightTextBuffer, rStart, rLen)) {
    //                 //     break;
    //                 // }

    //                 // 매칭 성공 시 길이 누적
    //                 currentTotalUnitLen += lLen;

    //                 // skipTable 업데이트
    //                 const skipIdx = i - lhsLower;
    //                 skipTable[skipIdx] = Math.max(skipTable[skipIdx], n);

    //                 // 빈도 기반 점수 계산
    //                 const frequency = freq.get(compositeHash) || 1;
    //                 let score = (frequency === 1) ? -n : Math.log(frequency);

    //                 // 길이 보너스 (본체 텍스트가 아닌 유닛 전체 길이 기준)
    //                 if (_USE_LENGTH_BONUS) {
    //                     const cappedLen = Math.min(currentTotalUnitLen, n * _MAX_LENGTH_PER_GRAM_FOR_BONUS);
    //                     score /= (1 + Math.log(cappedLen + 1) * _LENGTH_BONUS_STRENGTH);
    //                 }

    //                 // 라인 시작 보너스
    //                 if (_USE_LINE_START_BONUS && (_leftFlagsArray[i] & _rightFlagsArray[j] & TokenFlags.LINE_START)) {
    //                     score *= _LINE_START_BONUS_STRENGTH;
    //                 }

    //                 // 최적의 앵커 갱신
    //                 if (!best || score < best.score) {
    //                     best = { lhsIndex: i, lhsLength: n, rhsIndex: j, rhsLength: n, score };
    //                 }

    //                 // 조기 종료: 충분히 길고 유니크한 앵커 발견 시
    //                 if (score <= -maxGram) return best;
    //             }
    //         }
    //         if ((_yieldCounter++ & 0x1ff) === 0) await yieldIfNeeded(false);
    //     }

    //     return best;
    // }

    // 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
    // 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
    // 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
    // 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
    function consumeCommonEdges(
        lhsLower: number, lhsUpper: number,
        rhsLower: number, rhsUpper: number,
        consumeDirections: 0 | 1 | 2 | 3 = 3
    ): [number, number, number, number, DiffEntry[], DiffEntry[]] {
        const head: DiffEntry[] = [];
        const tail: DiffEntry[] = [];

        const mode = _diffOptions.whitespace;
        const isIgnore = mode === "ignore";
        const isIgnoreAtEdge = mode === "ignoreAtEdge";

        // ---------- 1. Prefix (전방) ----------
        if (consumeDirections & 1) {
            while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
                const lLen = _leftUnitOffsetArray[lhsLower + 1] - _leftUnitOffsetArray[lhsLower];
                const rLen = _rightUnitOffsetArray[rhsLower + 1] - _rightUnitOffsetArray[rhsLower];

                // [Case 1] 1:1 완전 일치 (해시/길이 모두 일치)
                if (_leftHashArray[lhsLower] === _rightHashArray[rhsLower] && lLen === rLen) {
                    pushMatch(head, lhsLower, 1, rhsLower, 1);
                    lhsLower++; rhsLower++;
                    continue;
                }

                // [Case 2] 조기 탈출: 길이가 같은데 해시가 다르면 절대로 같을 수 없음
                if (lLen === rLen) break;

                // [Case 3] 비대칭 매칭 시도 (Ignore 또는 IgnoreAtEdge)
                if (isIgnore || isIgnoreAtEdge) {
                    // matchPrefixTokens는 이제 [lCount, rCount]를 리턴함
                    const matched = matchPrefixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;
                        pushMatch(head, lhsLower, lCount, rhsLower, rCount);
                        lhsLower += lCount; // 왼쪽 소모량 적용
                        rhsLower += rCount; // 오른쪽 소모량 적용
                        continue;
                    }
                }
                break;
            }
        }

        // ---------- 2. Suffix (후방) ----------
        if (consumeDirections & 2) {
            while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
                const lIdx = lhsUpper - 1;
                const rIdx = rhsUpper - 1;
                const lLen = _leftUnitOffsetArray[lhsUpper] - _leftUnitOffsetArray[lIdx];
                const rLen = _rightUnitOffsetArray[rhsUpper] - _rightUnitOffsetArray[rIdx];

                // [Case 1] 1:1 완전 일치
                if (_leftHashArray[lIdx] === _rightHashArray[rIdx] && lLen === rLen) {
                    pushMatch(tail, lIdx, 1, rIdx, 1);
                    lhsUpper--; rhsUpper--;
                    continue;
                }

                if (lLen === rLen) break;

                // [Case 3] 비대칭 매칭 시도
                if (isIgnore || isIgnoreAtEdge) {
                    const matched = matchSuffixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;
                        const lMatchStart = lhsUpper - lCount;
                        const rMatchStart = rhsUpper - rCount;
                        pushMatch(tail, lMatchStart, lCount, rMatchStart, rCount);
                        lhsUpper -= lCount; // 왼쪽 소모량 적용
                        rhsUpper -= rCount; // 오른쪽 소모량 적용
                        continue;
                    }
                }
                break;
            }
            tail.reverse();
        }

        return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
    }

    function pushMatch(arr: DiffEntry[], lStart: number, lLen: number, rStart: number, rLen: number) {
        arr.push({
            type: 0,
            left: { start: lStart, end: lStart + lLen },
            right: { start: rStart, end: rStart + rLen },
        });
    }

    /**
  * matchPrefixTokens: 어긋난 전방 토큰 경계를 resync
  */
    function matchPrefixTokens(lIdx: number, lUpper: number, rIdx: number, rUpper: number): [number, number] | null {
        const isIgnoreAtEdge = _diffOptions.whitespace === "ignoreAtEdge";
        let i = lIdx, j = rIdx;
        let ci = _leftUnitOffsetArray[i], cj = _rightUnitOffsetArray[j];

        let lTarget = _leftUnitOffsetArray[i + 1];
        let rTarget = _rightUnitOffsetArray[j + 1];

        // 첫 시작부터 이미지면 바로 아웃
        if ((_leftFlagsArray[i] & TokenFlags.IMAGE) || (_rightFlagsArray[j] & TokenFlags.IMAGE)) return null;

        while (true) {
            // [Scan 구간] Target 중 가까운 곳까지 전력 질주
            while (ci < lTarget && cj < rTarget) {
                if (_leftTextBuffer[ci++] !== _rightTextBuffer[cj++]) return null;
            }

            const isLReached = (ci === lTarget);
            const isRReached = (cj === rTarget);

            // [동기화 지점] 둘 다 토큰 끝에 도달했는가? (드디어 정렬됨)
            if (isLReached && isRReached) {
                return [(i + 1) - lIdx, (j + 1) - rIdx];
            }

            // [전이 구간] 한쪽만 끝났다면 다음 토큰으로 목표 갱신 (Flag 검사)
            if (isLReached) {
                if (++i === lUpper) return null; // 더 갈 곳 없으면 동기화 실패
                const prevF = _leftFlagsArray[i - 1], nextF = _leftFlagsArray[i];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (nextF & TokenFlags.NO_JOIN_PREV) || (nextF & TokenFlags.IMAGE)) return null;
                if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(nextF & TokenFlags.LINE_START))) return null;

                lTarget = _leftUnitOffsetArray[i + 1];
            } else { // isRReached
                if (++j === rUpper) return null;
                const prevF = _rightFlagsArray[j - 1], nextF = _rightFlagsArray[j];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (nextF & TokenFlags.NO_JOIN_PREV) || (nextF & TokenFlags.IMAGE)) return null;
                if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(nextF & TokenFlags.LINE_START))) return null;

                rTarget = _rightUnitOffsetArray[j + 1];
            }
        }
    }

    /**
     * matchSuffixTokens: 어긋난 후방 토큰 경계를 resync
     */
    function matchSuffixTokens(lLower: number, lUpper: number, rLower: number, rUpper: number): [number, number] | null {
        const isIgnoreAtEdge = _diffOptions.whitespace === "ignoreAtEdge";
        let i = lUpper - 1, j = rUpper - 1;
        let ci = _leftUnitOffsetArray[i + 1], cj = _rightUnitOffsetArray[j + 1];

        let lTarget = _leftUnitOffsetArray[i];
        let rTarget = _rightUnitOffsetArray[j];

        if ((_leftFlagsArray[i] & TokenFlags.IMAGE) || (_rightFlagsArray[j] & TokenFlags.IMAGE)) return null;

        while (true) {
            while (ci > lTarget && cj > rTarget) {
                if (_leftTextBuffer[--ci] !== _rightTextBuffer[--cj]) return null;
            }

            const isLReached = (ci === lTarget);
            const isRReached = (cj === rTarget);

            if (isLReached && isRReached) {
                return [lUpper - i, rUpper - j];
            }

            if (isLReached) {
                if (--i < lLower) return null;
                const currF = _leftFlagsArray[i + 1], prevF = _leftFlagsArray[i];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (currF & TokenFlags.NO_JOIN_PREV) || (prevF & TokenFlags.IMAGE)) return null;
                if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(currF & TokenFlags.LINE_START))) return null;

                lTarget = _leftUnitOffsetArray[i];
            } else { // isRReached
                if (--j < rLower) return null;
                const currF = _rightFlagsArray[j + 1], prevF = _rightFlagsArray[j];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (currF & TokenFlags.NO_JOIN_PREV) || (prevF & TokenFlags.IMAGE)) return null;
                if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || (!(currF & TokenFlags.LINE_START)))) return null;

                rTarget = _rightUnitOffsetArray[j];
            }
        }
    }

    // function matchPrefixTokens(
    //     lhsLower: number,
    //     lhsUpper: number,
    //     rhsLower: number,
    //     rhsUpper: number
    //     //allowJoinOnlyAtLineBoundary: boolean
    // ): false | [leftMatched: number, rightMatched: number] {
    //     if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

    //     const leftTokens = _leftTokens, rightTokens = _rightTokens;
    //     const onlyAllowJoinOnlyAtLineBoundary = WHITESPACE_HANDLING === "ignoreAtEdge";

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
    //             if (ltext.charCodeAt(ci++) !== rtext.charCodeAt(cj++)) {
    //                 return false;
    //             }
    //             // if (ltext[ci++] !== rtext[cj++]) {
    //             //     return false;
    //             // }
    //         }

    //         // 문자 불일치 없이 양쪽 토큰이 동시에 끝난 경우
    //         if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];

    //         if (ci === lhsLen) {
    //             if (i === lhsUpper) return false;
    //             if (
    //                 lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //     const onlyAllowJoinOnlyAtLineBoundary = WHITESPACE_HANDLING === "ignoreAtEdge";

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
    //             if (ltext.charCodeAt(ci--) !== rtext.charCodeAt(cj--)) {
    //                 return false;
    //             }
    //             // if (ltext[ci--] !== rtext[cj--]) {
    //             //     return false;
    //             // }
    //         }
    //         if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];

    //         if (ci < 0) {
    //             if (i < lhsLower) return false;
    //             if (
    //                 lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
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
    //                 (onlyAllowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
    //             ) {
    //                 return false;
    //             }

    //             rtext = rhsToken.text;
    //             cj = rhsToken.text.length - 1;
    //         }
    //     }
    // }

    async function mergeEntries(rawEntries: DiffEntry[]): Promise<DiffEntry[]> {
        const entries: DiffEntry[] = [];

        for (let i = 0; i < rawEntries.length; i++) {
            const raw = rawEntries[i];
            if (raw.type === 0) {
                entries.push(raw);
                continue;
            }

            const last = entries[entries.length - 1];
            if (last && last.type === raw.type) {
                last.left.end = raw.left.end;
                last.right.end = raw.right.end;
            } else {
                entries.push({
                    type: raw.type,
                    left: { start: raw.left.start, end: raw.left.end },
                    right: { start: raw.right.start, end: raw.right.end }
                });
            }
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(false);
        }
        return entries;
    }



    function compareImageTokens(lhrIndex: number, rhsIndex: number): boolean {
        if (true) {
            return false;
        }
        const lLen = _leftLengthArray[lhrIndex];
        const rLen = _rightLengthArray[rhsIndex];
        if (lLen !== rLen) return false;
        if (_leftHashArray[lhrIndex] !== _rightHashArray[rhsIndex]) return false;

        return I_DONT_BELIEVE_HASH_COLLISIONS || compareBuffers(_leftTextBuffer, _leftOffsetArray[lhrIndex], lLen, _rightTextBuffer, _rightOffsetArray[rhsIndex], rLen);
    }



    function postProgress(progress: number) {
        if (progress !== _lastProgressReport) {
            self.postMessage({
                reqId: _reqId!,
                type: "progress",
                progress: progress,
            } satisfies DiffWorkerResponse);
            _lastProgressReport = progress;
        }
    }

    type CoarseAnchorPoint = { lhsIndex: number; rhsIndex: number };
    type CoarseAnchorSig = { start: number; end: number; sig: number };

    // --------------------------------------------------
    // fast tables
    // --------------------------------------------------

    const FNV1A_PRIME = 0x01000193;
    const FNV1A_OFFSET_BASIS = 0x811c9dc5 | 0;


    // --------------------------------------------------
    // split usefulness (kept)
    // --------------------------------------------------

    function isCoarseSplitWorthIt(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number,
        a: CoarseAnchorPoint
    ): boolean {
        const lSize = lhsUpper - lhsLower;
        const rSize = rhsUpper - rhsLower;

        const lLeft = a.lhsIndex - lhsLower;
        const lRight = lhsUpper - a.lhsIndex;
        const rLeft = a.rhsIndex - rhsLower;
        const rRight = rhsUpper - a.rhsIndex;

        if (lLeft < COARSE_SPLIT_MIN_SIDE_TOKENS || lRight < COARSE_SPLIT_MIN_SIDE_TOKENS) return false;
        if (rLeft < COARSE_SPLIT_MIN_SIDE_TOKENS || rRight < COARSE_SPLIT_MIN_SIDE_TOKENS) return false;

        const before = Math.max(lSize, rSize);
        const after = Math.max(Math.max(lLeft, lRight), Math.max(rLeft, rRight));

        const gain = before - after;
        return gain >= before * COARSE_SPLIT_MIN_GAIN_RATIO;
    }

    // --------------------------------------------------
    // single-pass range scan + hash (validity included)
    // --------------------------------------------------

    // function hashTokensRange(
    //     tokens: Token[],
    //     start: number,
    //     end: number,
    //     wsMode: WhitespaceHandling
    // ): number | null {
    //     const tokenCount = end - start;
    //     if (tokenCount < COARSE_ANCHOR_MIN_TOKENS) return null;

    //     let h = FNV1A_OFFSET_BASIS;

    //     let wordLikeCount = 0;
    //     let effectiveChars = 0;
    //     let nonWsChars = 0;
    //     let uniq = 0;

    //     let prevWasWs = false;

    //     const epoch = (_coarseUniqEpoch = (_coarseUniqEpoch + 1) >>> 0);
    //     if (epoch === 0) {
    //         _coarseUniqStamp.fill(0);
    //         _coarseUniqEpoch = 1;
    //     }
    //     const curEpoch = _coarseUniqEpoch;

    //     for (let i = start; i < end; i++) {
    //         const t = tokens[i];

    //         if (t.flags & TokenFlags.WORD_LIKE) {
    //             wordLikeCount++;
    //             effectiveChars += t.text.length;
    //         }

    //         if (t.flags & TokenFlags.IMAGE) {
    //             nonWsChars += 3;

    //             const imgCh = 0xfffd;
    //             if (_coarseUniqStamp[imgCh] !== curEpoch) {
    //                 _coarseUniqStamp[imgCh] = curEpoch;
    //                 uniq++;
    //             }

    //             h ^= 0x2f;
    //             h = Math.imul(h, FNV1A_PRIME) | 0;

    //             const s = t.text;
    //             for (let k = 0, n = s.length; k < n; k++) {
    //                 h ^= s.charCodeAt(k);
    //                 h = Math.imul(h, FNV1A_PRIME) | 0;
    //             }

    //             prevWasWs = false;
    //             h ^= 0;
    //             h = Math.imul(h, FNV1A_PRIME) | 0;
    //             continue;
    //         }

    //         const s = t.text;
    //         for (let k = 0, n = s.length; k < n; k++) {
    //             const c = s.charCodeAt(k);

    //             if (WS_TABLE[c]) {
    //                 if (wsMode !== "ignore") {
    //                     if (!prevWasWs) {
    //                         prevWasWs = true;
    //                         h ^= 32;
    //                         h = Math.imul(h, FNV1A_PRIME) | 0;
    //                     }
    //                 }
    //                 continue;
    //             }

    //             prevWasWs = false;
    //             nonWsChars++;

    //             if (_coarseUniqStamp[c] !== curEpoch) {
    //                 _coarseUniqStamp[c] = curEpoch;
    //                 uniq++;
    //             }

    //             h ^= c;
    //             h = Math.imul(h, FNV1A_PRIME) | 0;
    //         }

    //         prevWasWs = false;
    //         h ^= 0;
    //         h = Math.imul(h, FNV1A_PRIME) | 0;
    //     }

    //     if (wordLikeCount < COARSE_ANCHOR_MIN_WORD_LIKE_TOKENS) return null;
    //     if (effectiveChars < COARSE_ANCHOR_MIN_EFFECTIVE_CHARS) return null;
    //     if (nonWsChars < COARSE_ANCHOR_MIN_EFFECTIVE_CHARS) return null;
    //     if (uniq <= COARSE_ANCHOR_MIN_UNIQUE_CHARS) return null;

    //     return h | 0;
    // }

    // --------------------------------------------------
    // anchor builders (no extra validation pass)
    // --------------------------------------------------

    function buildLineAnchors(isLeft: boolean, lower: number, upper: number): CoarseAnchorSig[] {
        const result: CoarseAnchorSig[] = [];
        const flagsArray = isLeft ? _leftFlagsArray : _rightFlagsArray;
        let lineStart = lower;

        for (let i = lower + 1; i < upper; i++) {
            if (flagsArray[i] & TokenFlags.LINE_START) {
                // 사용자님의 getCompositeHash 호출
                // n (개수) = i - lineStart
                const sig = getCompositeHash(lineStart, i - lineStart, isLeft);
                result.push({ start: lineStart, end: i, sig });
                lineStart = i;
            }
        }
        if (lineStart < upper) {
            const sig = getCompositeHash(lineStart, upper - lineStart, isLeft);
            result.push({ start: lineStart, end: upper, sig });
        }
        return result;
    }

    function buildFixedWindowAnchors(isLeft: boolean, lower: number, upper: number, window: number): CoarseAnchorSig[] {
        const result: CoarseAnchorSig[] = [];
        for (let i = lower; i + window <= upper; i += window) {
            // 고정 윈도우 크기(window)만큼 해싱
            const sig = getCompositeHash(i, window, isLeft);
            result.push({ start: i, end: i + window, sig });
        }
        return result;
    }

    function buildLinePrefixAnchors(
        isLeft: boolean,
        lower: number,
        upper: number,
        window: number
    ): CoarseAnchorSig[] {
        const result: CoarseAnchorSig[] = [];

        // 1. 사용할 데이터셋 결정 (객체 대신 TypedArray 참조)
        const flagsArray = isLeft ? _leftFlagsArray : _rightFlagsArray;

        for (let i = lower; i < upper; i++) {
            // 2. 비트 연산으로 LINE_START 여부 즉시 확인
            if (!(flagsArray[i] & TokenFlags.LINE_START)) continue;

            // 3. 윈도우 경계 체크
            const end = i + window;
            if (end > upper) break;

            // 4. 문자열 결합 없이 해시 배열의 숫자들로만 복합 해시 생성
            // hashTokensRange(tokens, i, end, ...) -> getCompositeHash(i, window, isLeft)
            const sig = getCompositeHash(i, window, isLeft);

            // FNV-1a 결과가 0일 수도 있으나, 보통 유효한 값으로 처리
            if (sig !== null) {
                result.push({ start: i, end, sig });
            }
        }

        return result;
    }

    function buildCoarseAnchors(isLeft: boolean, lower: number, upper: number): CoarseAnchorSig[] {
        // _diffOptions나 전역 설정값에 따라 모드 결정
        switch (COARSE_ANCHOR_MODE) {
            case "line":
                // 줄 단위 (Line-by-line) 해싱
                return buildLineAnchors(isLeft, lower, upper);

            case "linePrefix":
                // 각 줄의 시작부터 N개 토큰만 해싱 (문맥 파악에 유리)
                return buildLinePrefixAnchors(isLeft, lower, upper, _diffOptions.coarseAnchorTokenWindow);

            case "fixedWindow":
                // 줄 구분 없이 고정된 토큰 개수(window)만큼 해싱
                return buildFixedWindowAnchors(isLeft, lower, upper, _diffOptions.coarseAnchorTokenWindow);

            default:
                return [];
        }
    }
    // --------------------------------------------------
    // best anchor selection (unique + LIS + worth check)
    // --------------------------------------------------
    function findBestCoarseLineAnchorPoint(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number
    ): CoarseAnchorPoint | null {
        // 1. 앵커 후보 생성 (isLeft 플래그 추가)
        const leftLines = buildCoarseAnchors(true, lhsLower, lhsUpper);
        const rightLines = buildCoarseAnchors(false, rhsLower, rhsUpper);

        if (!leftLines.length || !rightLines.length) return null;

        // 2. State 관리 (Map<number, number> - 숫자 키 사용으로 GC 최적화)
        const state = new Map<number, number>();
        const COUNT_MASK = 0x3;
        const LI_SHIFT = 2;
        const LI_BITS = 20;
        const RJ_SHIFT = LI_SHIFT + LI_BITS;
        const IDX_MASK = (1 << LI_BITS) - 1;

        // LHS 스캔
        for (let i = 0; i < leftLines.length; i++) {
            const sig = leftLines[i].sig;
            const prev = state.get(sig) ?? 0;
            const count = ((prev & COUNT_MASK) + 1) & COUNT_MASK;
            const li = ((prev >>> LI_SHIFT) & IDX_MASK) || (i + 1);
            state.set(sig, (count | (li << LI_SHIFT) | (prev & (IDX_MASK << RJ_SHIFT))) | 0);
        }

        // RHS 스캔
        for (let j = 0; j < rightLines.length; j++) {
            const sig = rightLines[j].sig;
            const prev = state.get(sig) ?? 0;
            if (prev === 0) continue; // LHS에 없는 시그니처는 무시

            const count = ((prev & COUNT_MASK) + 1) & COUNT_MASK;
            const rj = ((prev >>> RJ_SHIFT) & IDX_MASK) || (j + 1);
            state.set(sig, (count | (prev & (IDX_MASK << LI_SHIFT)) | (rj << RJ_SHIFT)) | 0);
        }

        // 3. 유니크 쌍(Pair) 추출
        const pairs: { li: number; rj: number }[] = [];
        for (const v of state.values()) {
            if ((v & COUNT_MASK) === 2) { // LHS(1) + RHS(1) = 2
                const li1 = (v >>> LI_SHIFT) & IDX_MASK;
                const rj1 = (v >>> RJ_SHIFT) & IDX_MASK;
                if (li1 && rj1) pairs.push({ li: li1 - 1, rj: rj1 - 1 });
            }
        }

        if (pairs.length === 0) return null;
        if (pairs.length > COARSE_SPLIT_MAX_UNIQUE_ANCHORS) return null;

        // 4. LIS를 이용한 최적 경로 추출
        pairs.sort((a, b) => a.li - b.li);
        const lisIdx = lisIndicesBySecond(pairs);
        if (!lisIdx.length) return null;

        // 중앙값 선택 (문서를 가장 균등하게 쪼갤 확률이 높은 지점)
        const chosen = pairs[lisIdx[(lisIdx.length / 2) | 0]];
        const lLine = leftLines[chosen.li];
        const rLine = rightLines[chosen.rj];

        const anchor: CoarseAnchorPoint = { lhsIndex: lLine.start, rhsIndex: rLine.start };

        // 가치 판단 (Worth It Check)
        if (!isCoarseSplitWorthIt(lhsLower, lhsUpper, rhsLower, rhsUpper, anchor)) return null;

        return anchor;
    }

    // --------------------------------------------------
    // LIS helper (kept)
    // --------------------------------------------------

    function lisIndicesBySecond(pairs: { li: number; rj: number }[]): number[] {
        const n = pairs.length;
        const tails: number[] = [];
        const tailsIdx: number[] = [];
        const prev: number[] = new Array(n).fill(-1);

        for (let i = 0; i < n; i++) {
            const x = pairs[i].rj;

            let lo = 0, hi = tails.length;
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (tails[mid] < x) lo = mid + 1;
                else hi = mid;
            }

            if (lo > 0) prev[i] = tailsIdx[lo - 1];

            if (lo === tails.length) {
                tails.push(x);
                tailsIdx.push(i);
            } else {
                tails[lo] = x;
                tailsIdx[lo] = i;
            }
        }

        const result: number[] = [];
        let idx = tailsIdx[tailsIdx.length - 1];
        while (idx !== -1) {
            result.push(idx);
            idx = prev[idx];
        }
        result.reverse();
        return result;
    }



    //
    // RUN RUN RUN
    //

    self.postMessage({
        reqId: _reqId!,
        type: "start",
        start: _startTime!,
    } satisfies DiffWorkerResponse);

    const promise = (async function () {
        try {
            const entries = await runHistogramDiff();
            const mergedEntries = await mergeEntries(entries);
            _finishTime = performance.now();
            self.postMessage({
                reqId: _reqId!,
                type: "done",
                elapsedTime: _finishTime - _startTime!,
                diffs: mergedEntries,
                options: _diffOptions,
            } satisfies DiffWorkerResponse);
        } catch (err) {
            if (err !== ABORT_REASON_CANCELLED) {
                console.error("diff worker error:", err)
                self.postMessage({
                    reqId: _reqId!,
                    type: "error",
                    error: err instanceof Error ? err.message : String(err),
                } satisfies DiffWorkerResponse);
            }
        }
    })();

    return {
        reqId: _reqId!,
        promise,
        abort: () => {
            if (_signal.aborted) return;
            _abortController.abort(ABORT_REASON_CANCELLED);
        },
    }

    function compareTokens(lhrIndex: number, lhrCount: number, rhrIndex: number, rhrCount: number): boolean {
        // 시작점: 이전 토큰이 끝난 지점부터
        const leftStart = lhrIndex === 0 ? 0 : _leftOffsetArray[lhrIndex - 1] + _leftLengthArray[lhrIndex - 1];

        // 끝점: 현재 묶음의 '마지막 토큰'이 끝나는 지점까지
        const lLastIdx = lhrIndex + lhrCount - 1;
        const leftEnd = (lLastIdx === _leftTokenCount - 1)
            ? _leftTextBuffer.length
            : _leftOffsetArray[lLastIdx] + _leftLengthArray[lLastIdx];

        // 오른쪽도 동일하게 적용
        const rightStart = rhrIndex === 0 ? 0 : _rightOffsetArray[rhrIndex - 1] + _rightLengthArray[rhrIndex - 1];
        const rLastIdx = rhrIndex + rhrCount - 1;
        const rightEnd = (rLastIdx === _rightTokenCount - 1)
            ? _rightTextBuffer.length
            : _rightOffsetArray[rLastIdx] + _rightLengthArray[rLastIdx];

        return compareBuffers(
            _leftTextBuffer, leftStart, leftEnd - leftStart,
            _rightTextBuffer, rightStart, rightEnd - rightStart
        );
    }


    function getCompositeHash(startIdx: number, n: number, isLeft: boolean): number {
        const hashArray = isLeft ? _leftHashArray : _rightHashArray;
        let h = 2166136261 >>> 0;
        for (let k = 0; k < n; k++) {
            h ^= hashArray[startIdx + k];
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
}


function postAborted(reqId: number) {
    self.postMessage({
        reqId,
        type: "cancelled",
    } satisfies DiffWorkerResponse);
}


function compareBuffers(
    leftBuf: Uint16Array, leftStart: number, leftLen: number,
    rightBuf: Uint16Array, rightStart: number, rightLen: number
): boolean {
    // 1. 길이부터 다르면 바로 탈락 (가장 빠른 체크)
    if (leftLen !== rightLen) return false;

    // 2. 루프를 돌며 내용 비교
    for (let i = 0; i < leftLen; i++) {
        if (leftBuf[leftStart + i] !== rightBuf[rightStart + i]) {
            return false;
        }
    }
    return true;
}

// 고성능 32비트 FNV-1a 해시
function calculateHash(buffer: Uint16Array, start: number, len: number): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < len; i++) {
        h ^= buffer[start + i];
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

