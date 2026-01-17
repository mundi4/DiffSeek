/// <reference lib="webworker" />

import { ABORT_REASON_CANCELLED } from "../constants";
import { TokenFlags } from "../TokenFlags";
import { DiffType, type DiffOptions } from "../types";
import { buildAnchorScoreSystem } from "./buildAnchorScoreSystem";
import { buildIndexTables } from "./buildIndexTables";
import { internTokenTexts } from "./internTokens";

const scheduler = (() => {
    type RunningSlot = {
        controller: AbortController;
        promise: Promise<void>;
    };

    let running: RunningSlot | null = null;
    let pending: WorkItem | null = null;

    function run(item: WorkItem) {
        pending = item;

        if (running) {
            running.controller.abort(ABORT_REASON_CANCELLED);
            return;
        }

        tryStartNext();
    }

    function cancel() {
        if (pending) {
            postAborted(pending.reqId);
            pending = null;
        }
        if (running) running.controller.abort(ABORT_REASON_CANCELLED);
    }

    function tryStartNext() {
        if (running || !pending) return;

        const item = pending;
        pending = null;

        const controller = new AbortController();
        const slot: RunningSlot = { controller, promise: Promise.resolve() };

        running = slot;

        slot.promise = (async () => {
            try {
                let result = await runDiffJob(item, controller.signal);
                handleDiffResult(item.reqId, result);
                result = null!;
            } catch (err) {
                if (err == ABORT_REASON_CANCELLED) {
                    postAborted(item.reqId);
                } else {
                    throw err;
                }
            } finally {
                if (running === slot) {
                    running = null;
                }
                tryStartNext();
            }
        })();
    }

    return { run, cancel };
})();



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
    leftTokenBuffer: Int32Array;
    rightWholeText: string;
    rightTokenBuffer: Int32Array;
    options: DiffOptions;
} | {
    type: "cancel";
};

export type DiffWorkerResponse =
    | { type: "done"; reqId: number; } & DiffWorkerResult
    | { type: "error"; reqId: number; error: string }
    | { type: "aborted"; reqId: number; }
    | { type: "start"; reqId: number; start: number; }
    | { type: "progress"; reqId: number; progress: number; };

export type DiffWorkerResult = {
    //diffs: DiffEntry[];
    leftTokenBuffer: Int32Array;
    rightTokenBuffer: Int32Array;
    elapsedTime: number;
};

type WorkItem = {
    reqId: number;
    leftWholeText: string;
    rightWholeText: string;
    leftTokenBuffer: Int32Array;
    rightTokenBuffer: Int32Array;
    diffOptions: DiffOptions;
};

self.onmessage = (e) => {
    const request = e.data as DiffWorkerRequest;
    if (request.type === "diff") {
        scheduler.run({
            reqId: request.reqId,
            leftWholeText: request.leftWholeText,
            rightWholeText: request.rightWholeText,
            leftTokenBuffer: request.leftTokenBuffer,
            rightTokenBuffer: request.rightTokenBuffer,
            diffOptions: request.options,
        });
    } else if (request.type === "cancel") {
        scheduler.cancel();
    }
}

function handleDiffResult(reqId: number, result: DiffResult) {
    self.postMessage({
        type: "done",
        reqId,
        //diffs: result.diffs,
        leftTokenBuffer: result.leftTokenBuffer,
        rightTokenBuffer: result.rightTokenBuffer,
        elapsedTime: result.elapsedTime,
    } satisfies DiffWorkerResponse, [result.leftTokenBuffer.buffer, result.rightTokenBuffer.buffer]);
}

function postAborted(reqId: number) {
    self.postMessage({
        reqId,
        type: "aborted",
    } satisfies DiffWorkerResponse);
}


const enum Phase {
    INIT,
    BUILD_INDEXES,
    DIFFING,
    DONE,
}

const TOKEN_BUFFER_STRIDE = 5;

function prepareTokenBuffer(wholeText: string, tokenBuffer: Int32Array, options: DiffOptions) {
    const tokenCount = tokenBuffer.length / TOKEN_BUFFER_STRIDE;
    const whitespace = options.whitespace;
    const insertSpace = whitespace === "collapse";
    const flagsArray = new Uint32Array(tokenCount);
    const offsetArray = new Uint32Array(tokenCount + 1);

    let totalBufLen = 0;
    for (let i = 0; i < tokenCount; i++) {
        const textLength = tokenBuffer[i * TOKEN_BUFFER_STRIDE + 1];
        const flags = tokenBuffer[i * TOKEN_BUFFER_STRIDE + 2];

        flagsArray[i] = flags;
        // offsetArray[i] = totalBufLen;
        offsetArray[i] = totalBufLen;
        // lengthArray[i] = t.textLength;

        totalBufLen += textLength;

        if (insertSpace && ((flags & TokenFlags.HAS_FOLLOWING_SPACE) || (flags & TokenFlags.LINE_END))) {
            totalBufLen++;
        }
    }
    offsetArray[tokenCount] = totalBufLen;

    const textBuffer = new Uint16Array(totalBufLen);
    // const hashArray = new Uint32Array(count);

    let currentPos = 0;
    for (let i = 0; i < tokenCount; i++) {
        const ofs = tokenBuffer[i * TOKEN_BUFFER_STRIDE + 0];
        const len = tokenBuffer[i * TOKEN_BUFFER_STRIDE + 1];
        const flags = flagsArray[i];
        for (let j = 0; j < len; j++) {
            textBuffer[currentPos++] = wholeText.charCodeAt(ofs + j);
        }
        if (insertSpace && ((flags & TokenFlags.HAS_FOLLOWING_SPACE) || (flags & TokenFlags.LINE_END))) {
            textBuffer[currentPos++] = 32;
        }
        // hashArray[i] = calculateHash(buffer, offsetArray[i], currentPos - offsetArray[i]);
    }

    tokenBuffer.fill(0);

    return { tokenCount, tokenBuffer, textBuffer, offsetArray, flagsArray };
}

type DiffResult = {
    // diffs: DiffEntry[];
    leftTokenBuffer: Int32Array;
    rightTokenBuffer: Int32Array;
    elapsedTime: number;
}

async function runDiffJob(workItem: WorkItem, abortSignal: AbortSignal): Promise<DiffResult> {
    const _startTime = performance.now();
    let _phase = Phase.INIT;

    self.postMessage({
        reqId: workItem.reqId,
        type: "start",
        start: _startTime!,
    } satisfies DiffWorkerResponse);

    const MIN_YIELD_INTERVAL = 50;
    const ANCHOR_CANDIDATE_POOL_SIZE = 128;

    const _reqId = workItem.reqId;
    const _diffOptions = workItem.diffOptions;

    // MISC
    const _ignoreWhitespaces = _diffOptions.whitespace === "ignore";

    let _finishTime: number | undefined = undefined;
    let _yieldCounter = 0;
    let _lastYieldTime = _startTime;
    let _leftTokenProcessed = 0;
    let _rightTokenProcessed = 0;
    let _lastProgressReport = -1;


    async function yieldIfNeeded(progress?: number) {
        const now = performance.now();
        if (now - _lastYieldTime > MIN_YIELD_INTERVAL) {
            _lastYieldTime = now;
            await new Promise((resolve) => setTimeout(resolve, 0));
            abortSignal.throwIfAborted();
        }

        if (progress !== undefined) {
            postProgress(progress);
        }
    }

    console.time("[DiffWorker] prepareTokenBuffer LHS");
    let {
        tokenCount: _lhsTokenCount,
        tokenBuffer: _lhsTokenBuffer,
        textBuffer: _lhsTextBuffer,
        offsetArray: _lhsOffsets,
        flagsArray: _lhsFlags,

    } = prepareTokenBuffer(workItem.leftWholeText, workItem.leftTokenBuffer, _diffOptions);
    console.timeEnd("[DiffWorker] prepareTokenBuffer LHS");
    await yieldIfNeeded(calculateProgress(1, 2));

    console.time("[DiffWorker] prepareTokenBuffer RHS");

    let {
        tokenCount: _rhsTokenCount,
        tokenBuffer: _rhsTokenBuffer,
        textBuffer: _rhsTextBuffer,
        offsetArray: _rhsOffsets,
        flagsArray: _rhsFlags,
    } = prepareTokenBuffer(workItem.rightWholeText, workItem.rightTokenBuffer, _diffOptions);
    console.timeEnd("[DiffWorker] prepareTokenBuffer RHS");
    await yieldIfNeeded(calculateProgress(2, 2));

    _phase = Phase.BUILD_INDEXES;

    workItem.leftWholeText = undefined!;
    workItem.rightWholeText = undefined!;
    workItem.leftTokenBuffer = undefined!;
    workItem.rightTokenBuffer = undefined!;

    console.time("[DiffWorker] internTokenTexts");
    let { combinedIds: _ids, idLhs: _lhsIds, idRhs: _rhsIds, lMin: _lhsMinId, lMax: _lhsMaxId, rMin: _rhsMinId, rMax: _rhsMaxId, pivot: _pivot } = internTokenTexts(
        { buf: _lhsTextBuffer, off: _lhsOffsets },
        { buf: _rhsTextBuffer, off: _rhsOffsets }
    );
    console.timeEnd("[DiffWorker] internTokenTexts");
    await yieldIfNeeded(calculateProgress(1, 10));

    console.time("[DiffWorker] buildIndexTables");
    const { sa: _sa, rank: _rank, lcp: _lcp, idRanges: _idRanges,
        // lhsPrefixSum: _lhsPrefixSum, rhsPrefixSum: _rhsPrefixSum 
    } = buildIndexTables(_ids, Math.max(_lhsMaxId, _rhsMaxId), _pivot);
    console.timeEnd("[DiffWorker] buildIndexTables");
    await yieldIfNeeded(calculateProgress(10, 10));

    const _hStack = new Int32Array(_sa.length);
    const _sStack = new Int32Array(_sa.length);

    const { scoreCore, scorePolicyBonus, maxPolicyBonus, maxScoreWithoutBonus } = buildAnchorScoreSystem({
        // maxLen: 50,
        // kneeLen: 20,
        // satLen: 40,
        freqRankWeights: [1.00, 0.65, 0.40, 0.20, 0.05],
        headingBonusRatio: 0.07,
        lineStartBonusRatio: 0.04,
        centernessRatio: 0.02,
    });
    const MAX_SCORE_WITH_BONUSES = maxScoreWithoutBonus + maxPolicyBonus;

    function calculateProgress(current: number, max: number): number {
        let progressInPhase = max > 0 ? Math.min(current / max, 1) : 0;

        let overallProgress = progressInPhase;
        if (_phase === Phase.INIT) {
            overallProgress = progressInPhase * 0.02;
        } else if (_phase === Phase.BUILD_INDEXES) {
            overallProgress = 0.02 + progressInPhase * 0.08;
        } else if (_phase === Phase.DIFFING) {
            overallProgress = 0.10 + progressInPhase * 0.90;
        } else if (_phase === Phase.DONE) {
            overallProgress = 1.0;
        }
        return overallProgress;
    }

    function calculateDiffProgress(): number {
        return calculateProgress(_leftTokenProcessed + _rightTokenProcessed, _lhsTokenCount + _rhsTokenCount);
    }

    async function diffCore(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number,
        consumeDirections: 0 | 1 | 2 | 3 = 3
    ) {
        if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
            throw new Error("Invalid diffCore call");
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(calculateDiffProgress());
        }

        [lhsLower, lhsUpper, rhsLower, rhsUpper] = consumeCommonEdges(lhsLower, lhsUpper, rhsLower, rhsUpper, consumeDirections);

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(calculateDiffProgress());
        }

        const anchor = await findBestHistogramAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper);
        if (
            anchor &&
            anchor.lhsIndex >= lhsLower && anchor.lhsIndex < lhsUpper &&
            anchor.rhsIndex >= rhsLower && anchor.rhsIndex < rhsUpper &&
            ((anchor.lhsIndex > lhsLower) || (anchor.rhsIndex > rhsLower))
        ) {
            // above anchor
            await diffCore(lhsLower, anchor.lhsIndex, rhsLower, anchor.rhsIndex, 2);

            // below anchor
            await diffCore(anchor.lhsIndex, lhsUpper, anchor.rhsIndex, rhsUpper, 1);
        } else {
            if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
                let type: DiffType = DiffType.UNCHANGED;
                if (lhsLower < lhsUpper) type |= DiffType.REMOVED;
                if (rhsLower < rhsUpper) type |= DiffType.ADDED;

                for (let i = lhsLower; i < lhsUpper; i++) {
                    _lhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 0] = lhsLower;
                    _lhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 1] = lhsUpper;
                    _lhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 2] = rhsLower;
                    _lhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 3] = rhsUpper;
                    _lhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 4] = type;
                }

                for (let i = rhsLower; i < rhsUpper; i++) {
                    _rhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 0] = rhsLower;
                    _rhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 1] = rhsUpper;
                    _rhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 2] = lhsLower;
                    _rhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 3] = lhsUpper;
                    _rhsTokenBuffer[i * TOKEN_BUFFER_STRIDE + 4] = type;
                }

                _leftTokenProcessed += lhsUpper - lhsLower;
                _rightTokenProcessed += rhsUpper - rhsLower;
            }
        }

        if ((_yieldCounter++ & 0x1ff) === 0) {
            await yieldIfNeeded(calculateDiffProgress());
        }
    }

    type AnchorCandidate = {
        lhsGlobalFreq: number;
        rhsGlobalFreq: number;
        lhsLocalFreq: number;
        rhsLocalFreq: number;
        tokenCount: number;
        textLength: number;
        baseScore: number;
        possibleBestScore: number;
        finalScore: number;
        saStart: number;
        lo: number;
        hi: number;
    }

    const _anchorCandidatePool = Array.from({ length: ANCHOR_CANDIDATE_POOL_SIZE }, () => ({
        lhsGlobalFreq: 0,
        rhsGlobalFreq: 0,
        lhsLocalFreq: 0,
        rhsLocalFreq: 0,
        tokenCount: 0,
        textLength: 0,
        baseScore: 0,
        possibleBestScore: 0,
        finalScore: -1,
        saStart: 0,
        lo: 0,
        hi: 0,
    } satisfies AnchorCandidate)) as AnchorCandidate[];

    let _numAnchorCandidates = 0;
    let _currentBaseScore = 0;
    let _currentPossibleBestScore = 0;

    function finalizeAnchorCandidates(lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number) {
        // console.log("Pruning anchor candidates:", _numAnchorCandidates);
        let bestScore = -1;
        let bestIndex = -1;
        //let best: AnchorCandidate | undefined = undefined;

        OUTER:
        for (let i = _numAnchorCandidates - 1; i >= 0; i--) {
            const candidate = _anchorCandidatePool[i];
            if (candidate.possibleBestScore < bestScore) {
                continue;
            }

            if (candidate.finalScore >= 0) { // 이미 계산됨
                if (candidate.finalScore > bestScore) {
                    bestScore = candidate.finalScore;
                    bestIndex = i;
                } else {
                    // 동점 무시
                    continue;
                }
            } else {
                const baseScore = candidate.baseScore;
                const lo = candidate.lo;
                const hi = candidate.hi;
                const saStart = candidate.saStart;
                const tokenCount = candidate.tokenCount;

                // 이중 하나만 선택하기
                for (let li = lo; li <= hi; li++) {
                    const lPos = _sa[saStart + li];
                    if (lPos < lhsLower || lPos >= lhsUpper) continue;

                    for (let ri = lo; ri <= hi; ri++) {
                        const rPos = _sa[saStart + ri] - _pivot - 1;
                        if (rPos < rhsLower || rPos >= rhsUpper) continue;

                        const policyBonus = scorePolicyBonus(
                            lPos,
                            lhsLower,
                            lhsUpper,
                            _lhsFlags,
                            rPos,
                            rhsLower,
                            rhsUpper,
                            _rhsFlags,
                            tokenCount
                        );
                        const thisFinalScore = baseScore + policyBonus;
                        if (thisFinalScore > bestScore) {
                            candidate.finalScore = bestScore = thisFinalScore;
                            candidate.lo = lPos;
                            candidate.hi = rPos;
                            bestIndex = i;
                            if (thisFinalScore >= MAX_SCORE_WITH_BONUSES) {
                                break OUTER;
                            }
                        } else {
                            continue;
                        }
                    }
                }
            }
        }

        if (bestIndex >= 0) {
            //console.log("BEST SCORE:", bestScore, "MAX:", MAX_SCORE_WITH_BONUSES);

            if (bestIndex !== 0) {
                const temp = _anchorCandidatePool[0];
                _anchorCandidatePool[0] = _anchorCandidatePool[bestIndex];
                _anchorCandidatePool[bestIndex] = temp;
            }

            _numAnchorCandidates = 1;
            _currentBaseScore = _anchorCandidatePool[0].finalScore;
            _currentPossibleBestScore = _anchorCandidatePool[0].finalScore;

            if (bestScore >= MAX_SCORE_WITH_BONUSES) {
                // console.log("Perfect anchor found, early exit");
                numPerfectAnchors++;
                return true;
            }
        } else {
            throw new Error("No valid anchor found in finalizeAnchorCandidates");
        }
        return false;
    }

    // 이 함수이 한계
    // 공백 무시 모드에서 경계가 불일치 하는 ["aa","bbb"], ["aabb", "b"], ["a","a,"bbb"] 이런 토큰을 동일한 것으로 처리하지 못함.
    // 글자를 한땀한땀 비교를 해야하는데... 지금 코드의 구조에 그걸 얹으면 너무 비효율적임(인덱싱 테이블을 거의 사용 불가)
    // 일단 앵커에서는 경계까지 일치하는 토큰들만 앵커로 삼고, 나머지는 consumeCommonEdges에서 처리를 하게 되는데
    // 이게 100% 커버를 할까? 글쎄... 경계가 불일치하는 10글자보다 경계가 일치하는 2-3글자를 우선적으로 앵커로 취급해버릴텐데...
    //
    // 점수가 높은 앵커를 찾지 못할 때, 좌우 범위가 크지 않을 때 한땀한땀slow path를 타게 하는 것도 괜찮겠다만
    // 앵커 점수가 얼마나 높아야 좋은 앵커인지!
    // 범위가 얼마나 작아야 한땀한땀 비교를 해도 될 범위인지!
    // 고려해봐야함.
    // 확실한건 속도는 정말 빨라지긴 했음. 특히 큰 문서+여기저기diff 상황에서 확실히 속도 개선이 눈에 보임.

    let totalK = 0;
    let numKLoops = 0;
    let numSkippedK = 0;
    let numPerfectAnchors = 0;
    async function findBestHistogramAnchor(
        lhsLower: number,
        lhsUpper: number,
        rhsLower: number,
        rhsUpper: number
    ) {
        _currentBaseScore = 0;
        _currentPossibleBestScore = 0;
        _numAnchorCandidates = 0;

        const n = _sa.length;
        let r = 0;

        const hStack = _hStack, sStack = _sStack;
        hStack.fill(0);
        sStack.fill(0);

        OUTER:
        while (r < n) {
            const pos = _sa[r];
            if (pos === _pivot) {
                r++;
                continue;
            }

            const id = _ids[pos];
            if (id <= 0) {
                r++;
                continue;
            }

            const base = id << 1;
            const saStart = _idRanges[base];
            const saEnd = _idRanges[base + 1];
            const m = saEnd - saStart;

            if (!m || m < 2) {
                r = saEnd;
                continue;
            }

            let sp = 0;

            for (let i = 1; i <= m; i++) {
                const curH = (i < m) ? _lcp[saStart + i] : 0;
                let start = i;

                while (sp > 0 && hStack[sp - 1] > curH) {
                    const h = hStack[--sp];
                    const s = sStack[sp];

                    const lo = s - 1;
                    const hi = i - 1;

                    // if (hi - lo + 1 > 100) {
                    //     start = s;
                    //     continue;
                    // }

                    // ===== interval [lo..hi], length h =====

                    // --- 1. 텍스트 길이 (LHS 기준) ---
                    let matchTextLen = 0;
                    for (let k = lo; k <= hi; k++) {
                        const p = _sa[saStart + k];
                        if (p < _pivot) {
                            matchTextLen = _lhsOffsets[p + h] - _lhsOffsets[p];
                            break;
                        }
                    }

                    if (matchTextLen === 0) {
                        start = s;
                        continue;
                    }

                    // const globalHalfSize = (hi - lo + 1) >>> 1;
                    //const baseScore
                    const potentialBase = scoreCore(matchTextLen, 1, 1); //getBestPossibleScore(scoreAnchorBase(globalHalfSize, globalHalfSize, 1, 1, matchTextLen));
                    const potentialBest = potentialBase + maxPolicyBonus;
                    if (potentialBest < _currentBaseScore) {
                        // hopeless
                        numSkippedK++;
                        start = s;
                        continue;
                    }

                    // --- 2. GLOBAL / LOCAL freq ---
                    let lhsGlobal = 0;
                    let rhsGlobal = 0;
                    let lhsLocal = 0;
                    let rhsLocal = 0;
                    let lastLPos = -1, lastRPos = -1;

                    numKLoops++;
                    for (let k = lo; k <= hi; k++) {
                        totalK++;
                        const p = _sa[saStart + k];
                        if (p < _pivot) {
                            lhsGlobal++;
                            if (p >= lhsLower && p < lhsUpper) {
                                lhsLocal++;
                                lastLPos = p;
                            }
                        } else if (p > _pivot) {
                            // console.log("rhs p:", p, "rhsLower:", rhsLower, "rhsUpper:", rhsUpper);
                            rhsGlobal++;
                            const rp = p - _pivot - 1;
                            if (rp >= rhsLower && rp < rhsUpper) {
                                rhsLocal++;
                                lastRPos = rp;
                            }
                        }
                    }

                    if (lhsLocal === 0 || rhsLocal === 0) {
                        start = s;
                        continue;
                    }

                    const baseScore = scoreCore(
                        matchTextLen,
                        lhsLocal,
                        rhsLocal,
                    );

                    let possibleBestScore: number;
                    let isFinal = false;
                    if (lhsLocal === 1 && rhsLocal === 1) {
                        isFinal = true;
                        const bonus = scorePolicyBonus(
                            lastLPos,
                            lhsLower,
                            lhsUpper,
                            _lhsFlags,
                            lastRPos,
                            rhsLower,
                            rhsUpper,
                            _rhsFlags,
                            h
                        );
                        const finalScore = possibleBestScore = baseScore + bonus;
                        if (finalScore >= MAX_SCORE_WITH_BONUSES) {
                            return {
                                lhsIndex: lastLPos,
                                lhsLength: h,
                                rhsIndex: lastRPos,
                                rhsLength: h,
                                score: finalScore,
                            };
                        } else if (finalScore > _currentPossibleBestScore) {
                            _numAnchorCandidates = 0;
                            // _currentBaseScore = finalScore;
                            // _currentPossibleBestScore = finalScore;
                        } else if (finalScore < _currentBaseScore) {
                            start = s;
                            continue;
                        }

                        _currentBaseScore = Math.max(_currentBaseScore, finalScore);
                        _currentPossibleBestScore = Math.max(_currentPossibleBestScore, finalScore);
                    } else {
                        possibleBestScore = baseScore + maxPolicyBonus;
                        if (possibleBestScore < _currentBaseScore) {
                            // hopeless
                            numSkippedK++;
                            start = s;
                            continue;
                        }

                        if (baseScore > _currentPossibleBestScore) {
                            // 새 단독 후보
                            _numAnchorCandidates = 0;
                        }

                        _currentBaseScore = Math.max(_currentBaseScore, baseScore);
                        _currentPossibleBestScore = Math.max(_currentPossibleBestScore, possibleBestScore);
                    }

                    if (_numAnchorCandidates === ANCHOR_CANDIDATE_POOL_SIZE) {
                        if (finalizeAnchorCandidates(lhsLower, lhsUpper, rhsLower, rhsUpper)) {
                            break OUTER;
                        }
                    }

                    const candidate = _anchorCandidatePool[_numAnchorCandidates++];
                    candidate.lhsGlobalFreq = lhsGlobal;
                    candidate.rhsGlobalFreq = rhsGlobal;
                    candidate.lhsLocalFreq = lhsLocal;
                    candidate.rhsLocalFreq = rhsLocal;
                    candidate.tokenCount = h;
                    candidate.textLength = matchTextLen;
                    candidate.baseScore = baseScore;
                    candidate.possibleBestScore = possibleBestScore;
                    candidate.saStart = saStart;
                    if (isFinal) {
                        candidate.finalScore = possibleBestScore;
                        candidate.lo = lastLPos;
                        candidate.hi = lastRPos;
                    } else {
                        candidate.finalScore = -1;
                        candidate.lo = lo;
                        candidate.hi = hi;
                    }

                    start = s;
                }

                if (curH > 0) {
                    if (sp === 0 || hStack[sp - 1] < curH) {
                        hStack[sp] = curH;
                        sStack[sp] = start;
                        sp++;
                    }
                }
            }

            r = saEnd;
        }

        if (_numAnchorCandidates) {
            // 후보가 1개여도 반드시 실행해서 lo,hi를 lhsIndex, rhsIndex로 업데이트 해야함!
            finalizeAnchorCandidates(lhsLower, lhsUpper, rhsLower, rhsUpper);
            const candidate = _anchorCandidatePool[0];
            return {
                lhsIndex: candidate.lo,
                lhsLength: candidate.tokenCount,
                rhsIndex: candidate.hi,
                rhsLength: candidate.tokenCount,
                score: candidate.finalScore,
            };
        }

        return null;
    }

    // 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
    // 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
    // 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
    // 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
    function consumeCommonEdges(
        lhsLower: number, lhsUpper: number,
        rhsLower: number, rhsUpper: number,
        consumeDirections: 0 | 1 | 2 | 3 = 3
    ): [number, number, number, number] {
        // const head: DiffEntry[] = [];
        // const tail: DiffEntry[] = [];

        // ---------- 1. Prefix (전방) ----------
        if (consumeDirections & 1) {
            while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
                if (_lhsIds[lhsLower] === _rhsIds[rhsLower]) {
                    _lhsTokenBuffer[lhsLower * TOKEN_BUFFER_STRIDE + 0] = lhsLower;
                    _lhsTokenBuffer[lhsLower * TOKEN_BUFFER_STRIDE + 1] = lhsLower + 1;
                    _lhsTokenBuffer[lhsLower * TOKEN_BUFFER_STRIDE + 2] = rhsLower;
                    _lhsTokenBuffer[lhsLower * TOKEN_BUFFER_STRIDE + 3] = rhsLower + 1;

                    _rhsTokenBuffer[rhsLower * TOKEN_BUFFER_STRIDE + 0] = rhsLower;
                    _rhsTokenBuffer[rhsLower * TOKEN_BUFFER_STRIDE + 1] = rhsLower + 1;
                    _rhsTokenBuffer[rhsLower * TOKEN_BUFFER_STRIDE + 2] = lhsLower;
                    _rhsTokenBuffer[rhsLower * TOKEN_BUFFER_STRIDE + 3] = lhsLower + 1;

                    _leftTokenProcessed++;
                    _rightTokenProcessed++;

                    // pushMatch(head, lhsLower, 1, rhsLower, 1);
                    lhsLower++;
                    rhsLower++;
                    continue;
                }

                if (_ignoreWhitespaces) {
                    const lhsOffset = _lhsOffsets[lhsLower];
                    const rhsOffset = _rhsOffsets[rhsLower];

                    const lLen = _lhsOffsets[lhsLower + 1] - lhsOffset;
                    const rLen = _rhsOffsets[rhsLower + 1] - rhsOffset;

                    // 길이가 같으면서 공백을 제거한 텍스트가 같을 수는 없음
                    if (lLen === rLen) {
                        break;
                    }

                    // 첫 글자부터 일단 체크
                    if (_lhsTextBuffer[lhsOffset] !== _rhsTextBuffer[rhsOffset]) {
                        break;
                    }

                    // matchPrefixTokens는 이제 [lCount, rCount]를 리턴함
                    const matched = matchPrefixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;

                        for (let i = 0; i < lCount; i++) {
                            _lhsTokenBuffer[(lhsLower + i) * TOKEN_BUFFER_STRIDE + 0] = lhsLower
                            _lhsTokenBuffer[(lhsLower + i) * TOKEN_BUFFER_STRIDE + 1] = lhsLower + lCount;
                            _lhsTokenBuffer[(lhsLower + i) * TOKEN_BUFFER_STRIDE + 2] = rhsLower;
                            _lhsTokenBuffer[(lhsLower + i) * TOKEN_BUFFER_STRIDE + 3] = rhsLower + rCount;
                        }
                        for (let i = 0; i < rCount; i++) {
                            _rhsTokenBuffer[(rhsLower + i) * TOKEN_BUFFER_STRIDE + 0] = rhsLower
                            _rhsTokenBuffer[(rhsLower + i) * TOKEN_BUFFER_STRIDE + 1] = rhsLower + rCount;
                            _rhsTokenBuffer[(rhsLower + i) * TOKEN_BUFFER_STRIDE + 2] = lhsLower;
                            _rhsTokenBuffer[(rhsLower + i) * TOKEN_BUFFER_STRIDE + 3] = lhsLower + lCount;
                        }

                        _leftTokenProcessed += lCount;
                        _rightTokenProcessed += rCount;

                        // pushMatch(head, lhsLower, lCount, rhsLower, rCount);
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

                if (_lhsIds[lIdx] === _rhsIds[rIdx]) {
                    _lhsTokenBuffer[lIdx * TOKEN_BUFFER_STRIDE + 0] = lIdx;
                    _lhsTokenBuffer[lIdx * TOKEN_BUFFER_STRIDE + 1] = lIdx + 1;
                    _lhsTokenBuffer[lIdx * TOKEN_BUFFER_STRIDE + 2] = rIdx;
                    _lhsTokenBuffer[lIdx * TOKEN_BUFFER_STRIDE + 3] = rIdx + 1;

                    _rhsTokenBuffer[rIdx * TOKEN_BUFFER_STRIDE + 0] = rIdx;
                    _rhsTokenBuffer[rIdx * TOKEN_BUFFER_STRIDE + 1] = rIdx + 1;
                    _rhsTokenBuffer[rIdx * TOKEN_BUFFER_STRIDE + 2] = lIdx;
                    _rhsTokenBuffer[rIdx * TOKEN_BUFFER_STRIDE + 3] = lIdx + 1;

                    _leftTokenProcessed++;
                    _rightTokenProcessed++;

                    // pushMatch(tail, lIdx, 1, rIdx, 1);
                    lhsUpper--;
                    rhsUpper--;
                    continue;
                }

                if (_ignoreWhitespaces) {
                    const lLen = _lhsOffsets[lhsUpper] - _lhsOffsets[lIdx];
                    const rLen = _rhsOffsets[rhsUpper] - _rhsOffsets[rIdx];

                    // 길이가 같으면서 공백을 제거한 텍스트가 같을 수는 없음
                    if (lLen === rLen) {
                        break;
                    }

                    // 마지막 글자부터 일단 체크
                    if (_lhsTextBuffer[_lhsOffsets[lhsUpper] - 1] !== _rhsTextBuffer[_rhsOffsets[rhsUpper] - 1]) {
                        break;
                    }

                    const matched = matchSuffixTokens(lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;
                        const lMatchStart = lhsUpper - lCount;
                        const rMatchStart = rhsUpper - rCount;

                        for (let i = 0; i < lCount; i++) {
                            _lhsTokenBuffer[(lMatchStart + i) * TOKEN_BUFFER_STRIDE + 0] = lMatchStart
                            _lhsTokenBuffer[(lMatchStart + i) * TOKEN_BUFFER_STRIDE + 1] = lMatchStart + lCount;
                            _lhsTokenBuffer[(lMatchStart + i) * TOKEN_BUFFER_STRIDE + 2] = rMatchStart;
                            _lhsTokenBuffer[(lMatchStart + i) * TOKEN_BUFFER_STRIDE + 3] = rMatchStart + rCount;
                        }
                        for (let i = 0; i < rCount; i++) {
                            _rhsTokenBuffer[(rMatchStart + i) * TOKEN_BUFFER_STRIDE + 0] = rMatchStart
                            _rhsTokenBuffer[(rMatchStart + i) * TOKEN_BUFFER_STRIDE + 1] = rMatchStart + rCount;
                            _rhsTokenBuffer[(rMatchStart + i) * TOKEN_BUFFER_STRIDE + 2] = lMatchStart;
                            _rhsTokenBuffer[(rMatchStart + i) * TOKEN_BUFFER_STRIDE + 3] = lMatchStart + lCount;
                        }

                        _leftTokenProcessed += lCount;
                        _rightTokenProcessed += rCount;

                        // pushMatch(tail, lMatchStart, lCount, rMatchStart, rCount);
                        lhsUpper -= lCount; // 왼쪽 소모량 적용
                        rhsUpper -= rCount; // 오른쪽 소모량 적용
                        continue;
                    }
                }
                break;
            }
            // tail.reverse();
        }

        return [lhsLower, lhsUpper, rhsLower, rhsUpper];
    }

    function matchPrefixTokens(lIdx: number, lUpper: number, rIdx: number, rUpper: number): [number, number] | null {
        const lhsBuf = _lhsTextBuffer;
        const rhsBuf = _rhsTextBuffer;
        const lhsOffsets = _lhsOffsets;
        const rhsOffsets = _rhsOffsets;
        const lhsFlags = _lhsFlags;
        const rhsFlags = _rhsFlags;

        let i = lIdx, j = rIdx;
        let ci = lhsOffsets[i], cj = rhsOffsets[j];

        let lTarget = lhsOffsets[i + 1];
        let rTarget = rhsOffsets[j + 1];

        // 첫 시작부터 이미지면 바로 아웃
        if ((lhsFlags[i] & TokenFlags.IMAGE) || (rhsFlags[j] & TokenFlags.IMAGE)) return null;

        while (true) {
            // [Scan 구간] Target 중 가까운 곳까지 전력 질주
            while (ci < lTarget && cj < rTarget) {
                if (lhsBuf[ci++] !== rhsBuf[cj++]) return null;
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
                const prevF = lhsFlags[i - 1], nextF = lhsFlags[i];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (nextF & TokenFlags.NO_JOIN_PREV) || (nextF & TokenFlags.IMAGE)) return null;
                //if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(nextF & TokenFlags.LINE_START))) return null;

                lTarget = lhsOffsets[i + 1];
            } else { // isRReached
                if (++j === rUpper) return null;
                const prevF = rhsFlags[j - 1], nextF = rhsFlags[j];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (nextF & TokenFlags.NO_JOIN_PREV) || (nextF & TokenFlags.IMAGE)) return null;
                //if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(nextF & TokenFlags.LINE_START))) return null;

                rTarget = rhsOffsets[j + 1];
            }
        }
    }

    function matchSuffixTokens(lLower: number, lUpper: number, rLower: number, rUpper: number): [number, number] | null {
        const lhsBuf = _lhsTextBuffer;
        const rhsBuf = _rhsTextBuffer;
        const lhsOffsets = _lhsOffsets;
        const rhsOffsets = _rhsOffsets;
        const lhsFlags = _lhsFlags;
        const rhsFlags = _rhsFlags;

        let i = lUpper - 1, j = rUpper - 1;
        let ci = lhsOffsets[i + 1], cj = rhsOffsets[j + 1];

        let lTarget = lhsOffsets[i];
        let rTarget = rhsOffsets[j];

        if ((lhsFlags[i] & TokenFlags.IMAGE) || (rhsFlags[j] & TokenFlags.IMAGE)) return null;

        while (true) {
            while (ci > lTarget && cj > rTarget) {
                if (lhsBuf[--ci] !== rhsBuf[--cj]) return null;
            }

            const isLReached = (ci === lTarget);
            const isRReached = (cj === rTarget);

            if (isLReached && isRReached) {
                return [lUpper - i, rUpper - j];
            }

            if (isLReached) {
                if (--i < lLower) return null;
                const currF = lhsFlags[i + 1], prevF = lhsFlags[i];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (currF & TokenFlags.NO_JOIN_PREV) || (prevF & TokenFlags.IMAGE)) return null;
                // if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || !(currF & TokenFlags.LINE_START))) return null;

                lTarget = lhsOffsets[i];
            } else { // isRReached
                if (--j < rLower) return null;
                const currF = rhsFlags[j + 1], prevF = rhsFlags[j];

                if ((prevF & TokenFlags.NO_JOIN_NEXT) || (currF & TokenFlags.NO_JOIN_PREV) || (prevF & TokenFlags.IMAGE)) return null;
                // if (isIgnoreAtEdge && (!(prevF & TokenFlags.LINE_END) || (!(currF & TokenFlags.LINE_START)))) return null;

                rTarget = rhsOffsets[j];
            }
        }
    }

    // async function mergeEntries(rawEntries: DiffEntry[]): Promise<DiffEntry[]> {
    //     const entries: DiffEntry[] = [];

    //     for (let i = 0; i < rawEntries.length; i++) {
    //         const raw = rawEntries[i];
    //         if (raw.type === 0) {
    //             entries.push(raw);
    //             continue;
    //         }

    //         const last = entries[entries.length - 1];
    //         if (last && last.type === raw.type) {
    //             last.left.end = raw.left.end;
    //             last.right.end = raw.right.end;
    //         } else {
    //             entries.push({
    //                 type: raw.type,
    //                 left: { start: raw.left.start, end: raw.left.end },
    //                 right: { start: raw.right.start, end: raw.right.end }
    //             });
    //         }
    //     }

    //     if ((_yieldCounter++ & 0x1ff) === 0) {
    //         await yieldIfNeeded(calculateDiffProgress());
    //     }
    //     return entries;
    // }

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

    await diffCore(0, _lhsTokenCount, 0, _rhsTokenCount);
    //const mergedEntries = await mergeEntries(entries);

    await yieldIfNeeded(1.0);

    _phase = Phase.DONE;
    _finishTime = performance.now();
    console.log(`DiffWorker: Diff complete in ${(_finishTime - _startTime).toFixed(2)} ms`, "TotalK:", totalK, "NumKLoops:", numKLoops, "avg:" + (totalK / numKLoops).toFixed(2), "SKIPPED K:", numSkippedK, "Perfect Anchors:", numPerfectAnchors);
    // console.log("max text length:", _maxTextLength);
    // console.log("max score seen:", _maxScoreSeen);

    return {
        //        diffs: mergedEntries,
        leftTokenBuffer: _lhsTokenBuffer,
        rightTokenBuffer: _rhsTokenBuffer,
        elapsedTime: _finishTime - _startTime,
    } satisfies DiffResult;
}
