import { RESULT_BUFFER_STRIDE } from "./constants";
import { calculateHash, isTokenRangeTextEqual, matchPrefixTokens, matchSuffixTokens, tokenRangeToString, writeToResultBuffer } from "./helpers";
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffAnchor, type DiffInput, type DiffJobContext } from "./types";
import { HEADING_MASK, TOKEN_FLAGS_LINE_START } from "../tokenization";
import { SECTION_HEADING_TYPE_NONE, SECTION_HEADING_TYPE_NUMERIC_DOT, SECTION_HEADING_TYPE_HANGUL_DOT, SECTION_HEADING_TYPE_PAREN_NUMERIC, SECTION_HEADING_TYPE_PAREN_HANGUL, SECTION_HEADING_TYPE_NUMERIC_PAREN, SECTION_HEADING_TYPE_HANGUL_PAREN, SECTION_HEADING_TYPE_LAW_ARTICLE, headingFlagsToType } from "../constants/section-heading";

const HASH_SIZE = 0xfffff + 1;
const HEAD = new Int32Array(HASH_SIZE);
const YIELD_INTERVAL = 0xff as const;
const IndexArray = Uint32Array;
const CENTER_RANGE_RATIO = 0.2 as const; // 중앙의 20% 영역
const BAND_RANGE_RATIO = 0.5 as const; // 중앙의 50% 영역
const DEFAULT_LOCAL_SA_HYBRID_RATIO = 0.6;

// const HEADING_MIN_H: Record<SectionHeadingType, number> = {
//     [SECTION_HEADING_TYPE_NONE]: 0,
//     [SECTION_HEADING_TYPE_NUMERIC_DOT]: 2,
//     [SECTION_HEADING_TYPE_HANGUL_DOT]: 2,
//     [SECTION_HEADING_TYPE_PAREN_NUMERIC]: 3,
//     [SECTION_HEADING_TYPE_PAREN_HANGUL]: 3,
//     [SECTION_HEADING_TYPE_NUMERIC_PAREN]: 2,
//     [SECTION_HEADING_TYPE_HANGUL_PAREN]: 2,
//     [SECTION_HEADING_TYPE_LAW_ARTICLE]: 1,
// };
const HEADING_MIN_H = new Uint8Array(8);
HEADING_MIN_H[SECTION_HEADING_TYPE_NONE] = 0;
HEADING_MIN_H[SECTION_HEADING_TYPE_NUMERIC_DOT] = 2; // "1." > "1" + "."
HEADING_MIN_H[SECTION_HEADING_TYPE_HANGUL_DOT] = 2; // "가." > "가" + "."
HEADING_MIN_H[SECTION_HEADING_TYPE_PAREN_NUMERIC] = 3; // "(1)" > "(" + "1" + ")"
HEADING_MIN_H[SECTION_HEADING_TYPE_PAREN_HANGUL] = 3; // "(가)" > "(" + "가" + ")"
HEADING_MIN_H[SECTION_HEADING_TYPE_NUMERIC_PAREN] = 2; // "1)" > "1" + ")"
HEADING_MIN_H[SECTION_HEADING_TYPE_HANGUL_PAREN] = 2; // "가)" > "가" + ")"
HEADING_MIN_H[SECTION_HEADING_TYPE_LAW_ARTICLE] = 1; // "제1조" > "제1조" (single merged token) - mergeLetterNumberBoundary 옵션에 따라 1 또는 3

export async function runHistogramDiff(
    ctx: DiffJobContext,
    lhsInput: DiffInput,
    rhsInput: DiffInput,
    lhsResultOffset = 0,
    rhsResultOffset = 0,
) {
    const _ignoreWhitespaces = ctx.diffOptions.whitespace === "ignore";
    const localSAHybridRatio = ctx.diffOptions.localSAHybridRatio ?? DEFAULT_LOCAL_SA_HYBRID_RATIO;
    if (ctx.diffOptions.mergeLetterNumberBoundary) {
        HEADING_MIN_H[SECTION_HEADING_TYPE_LAW_ARTICLE] = 1; // "제1조" > "제1조" (single merged token)
    } else {
        HEADING_MIN_H[SECTION_HEADING_TYPE_LAW_ARTICLE] = 3; // "제" "1" "조" > "제1조" (3 tokens)
    }

    const { tokenCount: _lhsTokenCount, buffer: _lhsTextBuffer, offsets: _lhsOffsets, flags: _lhsFlags, resultBuffer: _lhsResultBuffer } = lhsInput;
    const { tokenCount: _rhsTokenCount, buffer: _rhsTextBuffer, offsets: _rhsOffsets, flags: _rhsFlags, resultBuffer: _rhsResultBuffer } = rhsInput;

    const MIN_YIELD_INTERVAL_MS = 50;

    const abortSignal = ctx.signal;
    let _yieldCounter = 0;
    let _lastYieldTime = Date.now();

    async function yieldIfNeeded(forceYield = false) {
        const now = performance.now();
        if (forceYield || (now - _lastYieldTime > MIN_YIELD_INTERVAL_MS)) {
            _yieldCounter = 0;
            _lastYieldTime = now;
            await scheduler.yield();
            abortSignal.throwIfAborted();
        }
    }

    const { pivot: _pivot, lhsIds: _lhsIds, rhsIds: _rhsIds, numCommonIds, maxId } = buildIdTables(lhsInput, rhsInput);

    const { sa: _sa, rank: _rank, lcp: _lcp } = buildIndexTables(lhsInput, rhsInput, _lhsIds, _rhsIds, _pivot);
    const { lcpLogTable: _lcpLogTable, lcpSparseTable: _lcpSparseTable } = buildLcpRmqTables(_lcp);

    function queryLcpMin(left: number, right: number) {
        if (left > right) {
            return 0;
        }
        if (left === right) {
            return _lcp[left];
        }

        const len = right - left + 1;
        const level = _lcpLogTable[len];
        const span = 1 << level;
        const tableRow = _lcpSparseTable[level];
        const a = tableRow[left];
        const b = tableRow[right - span + 1];

        return a < b ? a : b;
    }

    async function diffCore(lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number): Promise<void> {
        if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
            throw new Error(`Invalid range: lhs[${lhsLower}, ${lhsUpper}), rhs[${rhsLower}, ${rhsUpper})`);
        }

        const lhsCount = lhsUpper - lhsLower;
        const rhsCount = rhsUpper - rhsLower;

        if (lhsCount === 0 && rhsCount === 0) {
            return;
        }

        if (lhsCount === 0 || rhsCount === 0) {
            let type = lhsCount === 0 ? DIFF_TYPE_ADDED : DIFF_TYPE_REMOVED;
            writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsUpper, rhsLower, rhsUpper, type, lhsResultOffset, rhsResultOffset);
            return;
        }

        if (lhsCount === 1 && rhsCount === 1) {
            const diffType = _lhsIds[lhsLower] === _rhsIds[rhsLower] ? DIFF_TYPE_UNCHANGED : DIFF_TYPE_MODIFIED;
            writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsUpper, rhsLower, rhsUpper, diffType, lhsResultOffset, rhsResultOffset);
            return;
        }


        if ((++_yieldCounter & YIELD_INTERVAL) === 0) {
            await yieldIfNeeded();
        }

        const anchor = await findAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper);
        if (anchor
        ) {
            const ltext = tokenRangeToString(_lhsTextBuffer, _lhsOffsets, anchor.lhsStart, anchor.lhsEnd);
            const rtext = tokenRangeToString(_rhsTextBuffer, _rhsOffsets, anchor.rhsStart, anchor.rhsEnd);
            console.log("anchor found:", ltext, rtext, anchor);

            if (anchor.lhsStart === anchor.lhsEnd || anchor.rhsStart === anchor.rhsEnd) {
                console.warn(`Anchor with zero length found: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Ignoring this anchor.`);
            }
            if (anchor.lhsEnd - anchor.lhsStart !== anchor.rhsEnd - anchor.rhsStart) {
                console.warn(`Anchor length mismatch: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Adjusting to minimum of the two.`);
            }

            let [tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(lhsLower, anchor.lhsStart, rhsLower, anchor.rhsStart, 2);
            console.log("consume backward common edges:", { ll: lhsLower, le: anchor.lhsStart, rl: rhsLower, re: anchor.rhsStart }, "=>", { tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper });
            if (tmpLhsLower < tmpLhsUpper || tmpRhsLower < tmpRhsUpper) {
                await diffCore(tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper);
            }

            // 지금 구현에서는 앵커는 반드시 토큰 대 토큰이 정확히 매치되어야 한다.
            if (anchor.lhsEnd - anchor.lhsStart === anchor.rhsEnd - anchor.rhsStart) {
                for (let i = anchor.lhsStart, j = anchor.rhsStart; i < anchor.lhsEnd && j < anchor.rhsEnd; i++, j++) {
                    writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, i, i + 1, j, j + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);
                }
                ([tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(anchor.lhsEnd, lhsUpper, anchor.rhsEnd, rhsUpper, 1));
            } else {
                // should not happen, but just in case, we will consume edges to avoid leaving unchanged tokens around the anchor
                ([tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(anchor.lhsStart, lhsUpper, anchor.rhsStart, rhsUpper, 1));
            }

            if (tmpLhsLower < tmpLhsUpper || tmpRhsLower < tmpRhsUpper) {
                await diffCore(tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper);
            }

        } else {
            if (_ignoreWhitespaces) {
                // 앵커를 찾지 못한 경우에도 consume 시도
                ([lhsLower, lhsUpper, rhsLower, rhsUpper] = consumeCommonEdges(lhsLower, lhsUpper, rhsLower, rhsUpper, 3));
            }

            if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
                let type = DIFF_TYPE_UNCHANGED;
                if (lhsLower < lhsUpper) type |= DIFF_TYPE_REMOVED;
                if (rhsLower < rhsUpper) type |= DIFF_TYPE_ADDED;

                writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsUpper, rhsLower, rhsUpper, type, lhsResultOffset, rhsResultOffset);
            }
        }
    }

    const {
        freqPairGradeLUT: freqLUT,
        lenToGrade: lenLUT,
        coreScoreTable: core,
        freqRowBase: fRow,
        policyTable: policyTable,
        positionalTable: positionalTable,
        freqMax: fMax,
        freqStride: fStride,
        lenMax: lMax,
        maxBonus
    } = ctx.score;


    let stack = new IndexArray(1024 * 2);
    type AnchorCandidate = {
        h: number,
        lo: number,
        hi: number,
        baseScore: number,
        bestPossibleScore: number
    };

    const MAX_NUM_ANCHOR_CANDIDATES = 20;
    const anchorCandidates: AnchorCandidate[] = new Array(MAX_NUM_ANCHOR_CANDIDATES);
    for (let i = 0; i < MAX_NUM_ANCHOR_CANDIDATES; i++) {
        anchorCandidates[i] = { h: 0, lo: 0, hi: 0, baseScore: 0, bestPossibleScore: 0 };
    }

    let localSaPosScratch = new IndexArray(0);
    let localLcpScratch = new IndexArray(0);

    function ensureLocalScratchCapacity(requiredSize: number) {
        if (localSaPosScratch.length < requiredSize) {
            localSaPosScratch = new IndexArray(requiredSize);
        }
        if (localLcpScratch.length < requiredSize) {
            localLcpScratch = new IndexArray(requiredSize);
        }
    }


    async function findAnchor(lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number): Promise<DiffAnchor | null> {
        const MAX_BONUS_SCORE = maxBonus;

        const lhsRange = lhsUpper - lhsLower;
        const rhsRange = rhsUpper - rhsLower;

        const lhsCenter2 = lhsLower + lhsUpper;
        const rhsCenter2 = rhsLower + rhsUpper;

        const lhsHalf2 = lhsRange * CENTER_RANGE_RATIO * 2;
        const rhsHalf2 = rhsRange * CENTER_RANGE_RATIO * 2;

        const lhsBand2 = lhsRange * BAND_RANGE_RATIO * 2;
        const rhsBand2 = rhsRange * BAND_RANGE_RATIO * 2;

        let bestScore = -1, bestAnchorPosL = -1, bestAnchorPosR = -1, bestAnchorLen = 0;

        const sa = _sa;
        const rhsLoG = _pivot + rhsLower;
        const rhsHiG = _pivot + rhsUpper;
        const totalSuffixCount = sa.length;

        const localCapacity = lhsRange + rhsRange;
        const useLocalSaPath = localCapacity >= 2 && localCapacity < (totalSuffixCount * localSAHybridRatio);
        let localCount = 0;
        let localSaPos: InstanceType<typeof IndexArray> | null = null;
        let localLcp: InstanceType<typeof IndexArray> | null = null;
        if (useLocalSaPath) {
            ensureLocalScratchCapacity(localCapacity);
            const localSaPosRaw = localSaPosScratch;
            for (let j = lhsLower; j < lhsUpper; j++) {
                localSaPosRaw[localCount++] = _rank[j] - 1;
            }
            for (let j = rhsLoG; j < rhsHiG; j++) {
                localSaPosRaw[localCount++] = _rank[j] - 1;
            }

            if (localCount < 2) {
                return null;
            }

            localSaPos = localSaPosRaw.subarray(0, localCount);
            localSaPos.sort();

            localLcp = localLcpScratch.subarray(0, localCount);
            for (let i = 1; i < localCount; i++) {
                const prev = localSaPos[i - 1];
                const curr = localSaPos[i];
                const lo = prev < curr ? prev + 1 : curr + 1;
                const hi = prev < curr ? curr : prev;
                localLcp[i] = queryLcpMin(lo, hi);
            }
        }

        const intervalCount = useLocalSaPath ? localCount : totalSuffixCount;
        if (intervalCount < 2) {
            return null;
        }

        let lPosBuf = _lhsResultBuffer.subarray(lhsLower * RESULT_BUFFER_STRIDE, lhsUpper * RESULT_BUFFER_STRIDE),
            rPosBuf = _rhsResultBuffer.subarray(rhsLower * RESULT_BUFFER_STRIDE, rhsUpper * RESULT_BUFFER_STRIDE);

        let numCandidates = 0;
        function tryUpdateBestAnchor(l: number, r: number, h: number, baseScore: number) {
            const lf = _lhsFlags[l];
            const rf = _rhsFlags[r];

            let policyGrade = 0;
            if ((lf & HEADING_MASK) && (rf & HEADING_MASK)) {
                policyGrade = 2;
            } else if ((lf & TOKEN_FLAGS_LINE_START) && (rf & TOKEN_FLAGS_LINE_START)) {
                policyGrade = 1;
            }

            let posGrade = 0;

            const lCenterDist2 = (l << 1) + h - lhsCenter2;
            const rCenterDist2 = (r << 1) + h - rhsCenter2;

            const absL = lCenterDist2 < 0 ? -lCenterDist2 : lCenterDist2;
            const absR = rCenterDist2 < 0 ? -rCenterDist2 : rCenterDist2;

            if (absL <= lhsHalf2 && absR <= rhsHalf2) {
                posGrade = 2;
            } else if (absL <= lhsBand2 && absR <= rhsBand2) {
                posGrade = 1;
            }

            const bonusScore = policyTable[policyGrade] + positionalTable[posGrade];
            const finalScore = baseScore + bonusScore;
            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestAnchorPosL = l;
                bestAnchorPosR = r;
                bestAnchorLen = h;
            }
        }

        function squashAnchorCandidates() {
            for (let i = 0; i < numCandidates; i++) {
                let numL = 0, numR = 0;
                const { h, lo, hi, baseScore, bestPossibleScore } = anchorCandidates[i];
                if (bestPossibleScore <= bestScore) {
                    continue;
                }

                for (let k = lo; k <= hi; k++) {
                    const saIdx = useLocalSaPath ? localSaPos![k] : k;
                    const j = sa[saIdx];
                    const jEnd = j + h;
                    if (j >= lhsLower && j < lhsUpper && jEnd <= lhsUpper) {
                        lPosBuf[numL++] = j;
                    } else if (j >= rhsLoG && j < rhsHiG && jEnd <= rhsHiG) {
                        rPosBuf[numR++] = j - _pivot;
                    }
                }

                if (numL > 1) {
                    lPosBuf.subarray(0, numL).sort();
                }
                if (numR > 1) {
                    rPosBuf.subarray(0, numR).sort();
                }

                if (numL === numR) {
                    for (let x = 0; x < numL; x++) {
                        tryUpdateBestAnchor(lPosBuf[x]!, rPosBuf[x]!, h, baseScore);
                    }
                    continue;
                }

                for (let x = 0; x < numL; x++) {
                    const l = lPosBuf[x]!;
                    for (let y = 0; y < numR; y++) {
                        tryUpdateBestAnchor(l, rPosBuf[y]!, h, baseScore);
                    }
                }
            }
            numCandidates = 0;
        }

        // 1. LCP Stack 기반의 Interval 순회 (중복 제거)

        //const stack = [{ lo: 0, h: 0 }];
        let stackSize = 0;

        stack[0] = 0;
        stack[1] = 0;
        stackSize = 1;

        for (let i = 1; i <= intervalCount; i++) {
            let lastLo = i - 1;
            const currentLCP = (i === intervalCount)
                ? 0
                : (useLocalSaPath ? localLcp![i] : _lcp[i]);
            while (stackSize > 0 && stack[(stackSize - 1) * 2 + 1] > currentLCP) {
                stackSize--;
                const lo = stack[stackSize * 2];
                const h = stack[stackSize * 2 + 1];

                if (h === 0) {
                    lastLo = lo;
                    continue;
                }

                const hi = i - 1;

                // 이 구간(lo~hi)이 우리 박스 안에서 유효한지 확인
                let freqL = 0, freqR = 0;
                // let minPosL = lhsUpper, minPosR = rhsUpper;
                let lengthGrade = 0;
                let textLen = -1;
                let freqGrade: number;
                let baseScore = 0;
                for (let k = lo; k <= hi; k++) {
                    const saIdx = useLocalSaPath ? localSaPos![k] : k;
                    const j = sa[saIdx];
                    const jEnd = j + h;
                    // 클로저 내의 박스 경계 조건 체크
                    if (j >= lhsLower && j < lhsUpper && jEnd <= lhsUpper && freqL < fMax) {
                        // lPosBuf[freqL] = j;
                        freqL++;
                        // 왼쪽에서만 계산해도 됨. 어차피 왼쪽에서 한번도 등장하지 않는다면 이후로는 무시할 거니까!
                        if (textLen === -1) {
                            textLen = _lhsOffsets[jEnd] - _lhsOffsets[j];
                            lengthGrade = lenLUT[textLen > lMax ? lMax : textLen];
                        }
                        if (freqR > 0) {
                            freqGrade = freqLUT[freqL * fStride + freqR];
                            baseScore = core[fRow[freqGrade] + lengthGrade];
                            if (baseScore + MAX_BONUS_SCORE < bestScore) {
                                // 쓰레기
                                baseScore = 0;
                                break;
                            }
                        }
                        if (freqL === fMax && freqR === fMax) break;
                    } else if (j >= rhsLoG && j < rhsHiG && jEnd <= rhsHiG && freqR < fMax) {
                        // rPosBuf[freqR] = j - _pivot;
                        freqR++;
                        if (freqL > 0) {
                            freqGrade = freqLUT[freqL * fStride + freqR];
                            baseScore = core[fRow[freqGrade] + lengthGrade];
                            if (baseScore + MAX_BONUS_SCORE < bestScore) {
                                // 쓰레기
                                baseScore = 0;
                                break;
                            }
                        }
                        if (freqL === fMax && freqR === fMax) break;
                    }
                }

                if (baseScore > 0) {
                    anchorCandidates[numCandidates].h = h;
                    anchorCandidates[numCandidates].lo = lo;
                    anchorCandidates[numCandidates].hi = hi;
                    anchorCandidates[numCandidates].baseScore = baseScore;
                    anchorCandidates[numCandidates].bestPossibleScore = baseScore + MAX_BONUS_SCORE;
                    numCandidates++;
                    if (numCandidates === MAX_NUM_ANCHOR_CANDIDATES) {
                        squashAnchorCandidates();
                    }
                }
                // --------------------------------------------------------
                lastLo = lo;
            }

            if (stackSize === 0 || stack[(stackSize - 1) * 2 + 1] < currentLCP) {
                if (stackSize >= stack.length / 2) {
                    // double the stack size
                    const newStack = new IndexArray(stack.length * 2);
                    newStack.set(stack);
                    stack = newStack;
                }
                stack[stackSize * 2] = lastLo;
                stack[stackSize * 2 + 1] = currentLCP;
                stackSize++;
            }

            if ((++_yieldCounter & YIELD_INTERVAL) === 0) {
                await yieldIfNeeded();
            }
        }

        if (numCandidates > 0) {
            squashAnchorCandidates();
        }

        if (bestAnchorPosL !== -1) {
            return {
                lhsStart: bestAnchorPosL,
                lhsEnd: bestAnchorPosL + bestAnchorLen,
                rhsStart: bestAnchorPosR,
                rhsEnd: bestAnchorPosR + bestAnchorLen,
            } satisfies DiffAnchor;
        }

        return null;
    }

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

                    writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsLower + 1, rhsLower, rhsLower + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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
                    const matched = matchPrefixTokens(lhsInput, rhsInput, lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;

                        writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsLower + lCount, rhsLower, rhsLower + rCount, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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
                    writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lIdx, lIdx + 1, rIdx, rIdx + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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

                    const matched = matchSuffixTokens(lhsInput, rhsInput, lhsLower, lhsUpper, rhsLower, rhsUpper);
                    if (matched) {
                        const [lCount, rCount] = matched;
                        const lMatchStart = lhsUpper - lCount;
                        const rMatchStart = rhsUpper - rCount;

                        writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lMatchStart, lhsUpper, rMatchStart, rhsUpper, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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

    await diffCore(0, _lhsTokenCount, 0, _rhsTokenCount);
}

function buildIdTables(lhsInput: DiffInput, rhsInput: DiffInput) {
    const lhsCnt = lhsInput.tokenCount, rhsCnt = rhsInput.tokenCount;
    const pivot = lhsCnt;
    const n = lhsCnt + rhsCnt;

    // 1. ID INTERN
    HEAD.fill(-1);
    const LINKS = new Int32Array(n);
    LINKS.fill(-1);

    const lhsIds = new IndexArray(lhsCnt);
    const rhsIds = new IndexArray(rhsCnt);
    let nextId = 1;

    const lhsBuffer = lhsInput.buffer;
    const rhsBuffer = rhsInput.buffer;
    const lhsOffsets = lhsInput.offsets;
    const rhsOffsets = rhsInput.offsets;

    for (let i = 0; i < lhsCnt; i++) {
        const offset = lhsOffsets[i];
        const len = lhsOffsets[i + 1] - offset;
        const h = calculateHash(lhsBuffer, offset, len) & 0xfffff;
        let matchPos = -1;

        for (let curr = HEAD[h]; curr !== -1; curr = LINKS[curr]) {
            const isMatch = curr < pivot
                ? isTokenRangeTextEqual(lhsBuffer, lhsOffsets, curr, curr + 1, lhsBuffer, lhsOffsets, i, i + 1)
                : isTokenRangeTextEqual(rhsBuffer, rhsOffsets, curr - pivot, curr - pivot + 1, lhsBuffer, lhsOffsets, i, i + 1);

            if (isMatch) {
                matchPos = curr;
                break;
            }
        }

        if (matchPos === -1) {
            lhsIds[i] = nextId++;
            LINKS[i] = HEAD[h];
            HEAD[h] = i;
        } else {
            lhsIds[i] = matchPos < pivot ? lhsIds[matchPos] : rhsIds[matchPos - pivot];
        }
    }

    const isCounted = new Uint8Array(nextId + 1);
    let numCommonIds = 0;

    for (let i = 0; i < rhsCnt; i++) {
        const pos = pivot + i;
        const offset = rhsOffsets[i];
        const len = rhsOffsets[i + 1] - offset;
        const h = calculateHash(rhsBuffer, offset, len) & 0xfffff;
        let foundId = 0;

        let isLhs = false;
        for (let curr = HEAD[h]; curr !== -1; curr = LINKS[curr]) {
            isLhs = curr < pivot;
            const prevIdx = isLhs ? curr : curr - pivot;

            if (isTokenRangeTextEqual(
                isLhs ? lhsBuffer : rhsBuffer,
                isLhs ? lhsOffsets : rhsOffsets,
                prevIdx, prevIdx + 1,
                rhsBuffer, rhsOffsets,
                i, i + 1
            )) {
                if (isLhs) {
                    foundId = lhsIds[prevIdx];
                    if (isCounted[foundId] === 0) {
                        isCounted[foundId] = 1;
                        numCommonIds++;
                    }
                } else {
                    foundId = rhsIds[prevIdx];
                }
                break;
            }
        }

        if (foundId === 0) {
            foundId = nextId++;
            LINKS[pos] = HEAD[h];
            HEAD[h] = pos;
        }
        rhsIds[i] = foundId;
    }

    const maxId = nextId - 1;

    return {
        lhsIds,
        rhsIds,
        numCommonIds,
        maxId,
        pivot
    };
}

function buildLcpRmqTables(lcp: InstanceType<typeof IndexArray>) {
    const lcpLen = lcp.length;
    const lcpLogTable = new Int32Array(lcpLen + 1);
    for (let i = 2; i <= lcpLen; i++) {
        lcpLogTable[i] = lcpLogTable[i >> 1] + 1;
    }

    const levels = lcpLogTable[lcpLen] + 1;
    const lcpSparseTable: Array<InstanceType<typeof IndexArray>> = new Array(levels);

    const level0 = new IndexArray(lcpLen);
    level0.set(lcp);
    lcpSparseTable[0] = level0;

    for (let level = 1; level < levels; level++) {
        const span = 1 << level;
        const half = span >> 1;
        const prevRow = lcpSparseTable[level - 1];
        const row = new IndexArray(lcpLen);
        const limit = lcpLen - span + 1;

        for (let i = 0; i < limit; i++) {
            const left = prevRow[i];
            const right = prevRow[i + half];
            row[i] = left < right ? left : right;
        }

        lcpSparseTable[level] = row;
    }

    return {
        lcpLogTable,
        lcpSparseTable,
    };
}

function buildIndexTables(
    lhsInput: DiffInput,
    rhsInput: DiffInput,
    lhsIds: InstanceType<typeof IndexArray>,
    rhsIds: InstanceType<typeof IndexArray>,
    pivot: number
) {
    const lhsCnt = lhsInput.tokenCount;
    const rhsCnt = rhsInput.tokenCount;
    const n = lhsCnt + rhsCnt;

    const sa = new IndexArray(n);
    const rank = new IndexArray(n);
    const tmpRank = new IndexArray(n);
    const tmpSa = new IndexArray(n);
    const cnt = new IndexArray(n + 1);

    // --------------------
    // 0) 초기 rank 설정
    // 이미 1..maxId dense 상태라고 가정
    // --------------------
    for (let i = 0; i < n; i++) {
        sa[i] = i;
        rank[i] = i < pivot ? lhsIds[i] : rhsIds[i - pivot];
    }

    // --------------------
    // 1) Doubling + Counting Sort
    // --------------------
    for (let k = 1; k < n; k <<= 1) {

        // 최대 rank 찾기 (dense이므로 마지막 doubling에서만 증가)
        let maxRank = 0;
        for (let i = 0; i < n; i++) {
            if (rank[i] > maxRank) maxRank = rank[i];
        }

        // ---------- (A) second key ----------
        //const sentinel = 0; //(끝난 suffix는 가장 작게)
        const sentinel = maxRank + 1; //(끝난 suffix는 가장 크게)
        cnt.fill(0, 0, maxRank + 2);

        for (let i = 0; i < n; i++) {
            const idx = sa[i];
            const key2 = (idx + k < n) ? rank[idx + k] : sentinel;
            cnt[key2]++;
        }

        for (let i = 1; i <= maxRank + 1; i++) {
            cnt[i] += cnt[i - 1];
        }

        for (let i = n - 1; i >= 0; i--) {
            const idx = sa[i];
            const key2 = (idx + k < n) ? rank[idx + k] : sentinel;
            tmpSa[--cnt[key2]] = idx;
        }

        // ---------- (B) first key ----------
        cnt.fill(0, 0, maxRank + 1);

        for (let i = 0; i < n; i++) {
            cnt[rank[tmpSa[i]]]++;
        }

        for (let i = 1; i <= maxRank; i++) {
            cnt[i] += cnt[i - 1];
        }

        for (let i = n - 1; i >= 0; i--) {
            const idx = tmpSa[i];
            const key1 = rank[idx];
            sa[--cnt[key1]] = idx;
        }

        // ---------- (C) 새 rank 계산 ----------
        let r = 1; // 0은 sentinel용

        tmpRank[sa[0]] = r;

        for (let i = 1; i < n; i++) {
            const a = sa[i - 1];
            const b = sa[i];

            const a1 = rank[a];
            const b1 = rank[b];

            const a2 = (a + k < n) ? rank[a + k] : sentinel;
            const b2 = (b + k < n) ? rank[b + k] : sentinel;

            if (a1 !== b1 || a2 !== b2) r++;
            tmpRank[b] = r;
        }

        rank.set(tmpRank);

        if (r === n) break; // 모든 rank 유니크
    }

    // --------------------
    // 2) Kasai LCP
    // --------------------
    const lcp = new IndexArray(n);
    let h = 0;

    for (let i = 0; i < n; i++) {
        const r = rank[i];
        if (r <= 1) continue;

        const j = sa[r - 2];

        if (h > 0) h--;

        while (i + h < n && j + h < n) {
            const p1 = i + h;
            const p2 = j + h;

            const v1 = (p1 < pivot) ? lhsIds[p1] : rhsIds[p1 - pivot];
            const v2 = (p2 < pivot) ? lhsIds[p2] : rhsIds[p2 - pivot];

            if (v1 !== v2) break;
            h++;
        }

        lcp[r - 1] = h;
    }

    return { sa, rank, lcp };
}
