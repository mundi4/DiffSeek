import { RESULT_BUFFER_STRIDE } from "./constants";
import { calculateHash, isTokenRangeTextEqual, matchPrefixTokens, matchSuffixTokens, sliceDiffInput, writeToResultBuffer } from "./helpers";
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffAnchor, type DiffInput, type DiffJobContext } from "./types";
import { HEADING_MASK, TOKEN_FLAGS_LINE_START } from "../tokenization";

export const runHistogramDiff16 = createRunHistogramDiff(16);

export const runHistogramDiff32 = createRunHistogramDiff(32);

export function runHistogramDiff(ctx: DiffJobContext, lhsInput: DiffInput, rhsInput: DiffInput, lhsResultOffset = 0, rhsResultOffset = 0) {
    const totalN = lhsInput.tokenCount + rhsInput.tokenCount;
    if (totalN < 0xffff) {
        return runHistogramDiff16(ctx, lhsInput, rhsInput, lhsResultOffset, rhsResultOffset);
    } else {
        return runHistogramDiff32(ctx, lhsInput, rhsInput, lhsResultOffset, rhsResultOffset);
    }
}

const HASH_SIZE = 0xfffff + 1;
const HEAD = new Int32Array(HASH_SIZE);
const YIELD_INTERVAL = 0xff as const;

function createRunHistogramDiff(bitWidth: 16 | 32) {
    const IndexArray = bitWidth === 16 ? Uint16Array : Uint32Array;
    const CENTER_RANGE_RATIO = 0.2 as const; // 중앙의 20% 영역
    const BAND_RANGE_RATIO = 0.5 as const; // 중앙의 50% 영역

    return async function runHistogramDiff(
        ctx: DiffJobContext,
        lhsInput: DiffInput,
        rhsInput: DiffInput,
        lhsResultOffset = 0,
        rhsResultOffset = 0,
    ) {
        if (bitWidth === 16) {
            const totalN = lhsInput.tokenCount + rhsInput.tokenCount;
            if (totalN >= 0xffff) {
                throw new Error(`Input too large for 16-bit histogram diff: total tokens ${totalN} exceeds limit of 65535. Consider using 32-bit histogram diff or another diff algorithm.`);
            }
        }

        // if (import.meta.env.DEV) {
        //     console.debug(`%cRunning ${bitWidth}-bit histogram diff for lhs tokens [${lhsResultOffset}, ${lhsResultOffset + lhsInput.tokenCount}), rhs tokens [${rhsResultOffset}, ${rhsResultOffset + rhsInput.tokenCount})`, "color:purple");
        // }

        const allowHistogramBitWidthSwitching = bitWidth === 32 && ctx.diffOptions.allowHistogramBitWidthSwitching && ctx.diffOptions.histogramBitWidth === "auto";
        const _ignoreWhitespaces = ctx.diffOptions.whitespace === "ignore";

        const { tokenCount: _lhsTokenCount, buffer: _lhsTextBuffer, offsets: _lhsOffsets, flags: _lhsFlags, resultBuffer: _lhsResultBuffer } = lhsInput;
        const { tokenCount: _rhsTokenCount, buffer: _rhsTextBuffer, offsets: _rhsOffsets, flags: _rhsFlags, resultBuffer: _rhsResultBuffer } = rhsInput;

        const MIN_YIELD_INTERVAL = 50;

        const abortSignal = ctx.signal;
        let _leftTokenProcessed = 0, _rightTokenProcessed = 0;
        let _yieldCounter = 0;
        let _lastYieldTime = Date.now();

        async function yieldIfNeeded(bypass = false) {
            const now = performance.now();
            if (bypass || (now - _lastYieldTime > MIN_YIELD_INTERVAL)) {
                _yieldCounter = 0;
                _lastYieldTime = now;
                await new Promise((resolve) => setTimeout(resolve, 0));
                abortSignal.throwIfAborted();
            }
        }

        const { pivot: _pivot, lhsIds: _lhsIds, rhsIds: _rhsIds, numCommonIds, maxId } = buildIdTables(lhsInput, rhsInput);

        const { sa: _sa, lcp: _lcp } = buildIndexTables(lhsInput, rhsInput, _lhsIds, _rhsIds, _pivot);

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


            if (allowHistogramBitWidthSwitching && (lhsCount + rhsCount) < 0xffff) {
                // 현재 구간이 16-bit 히스토그램으로 처리 가능한 크기라면, 비트 폭을 낮춰서 시도함.
                // 이게 얼마나 이득이 될 지는 모르겠음.
                await yieldIfNeeded(true);
                if (import.meta.env.DEV) {
                    console.debug(`%cSwitching to 16-bit histogram diff for lhs[${lhsLower}, ${lhsUpper}), rhs[${rhsLower}, ${rhsUpper})`, "color:pink");
                }
                const newLhsInput = sliceDiffInput(lhsInput, lhsLower, lhsUpper);
                const newRhsInput = sliceDiffInput(rhsInput, rhsLower, rhsUpper);
                await runHistogramDiff16(ctx, newLhsInput, newRhsInput, lhsResultOffset + lhsLower, rhsResultOffset + rhsLower);
                return;
            } else {
                if ((++_yieldCounter & YIELD_INTERVAL) === 0) {
                    await yieldIfNeeded();
                }
            }

            const anchor = await findAnchor(lhsLower, lhsUpper, rhsLower, rhsUpper);
            if (anchor
            ) {
                if (anchor.lhsStart === anchor.lhsEnd || anchor.rhsStart === anchor.rhsEnd) {
                    console.warn(`Anchor with zero length found: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Ignoring this anchor.`);
                }
                if (anchor.lhsEnd - anchor.lhsStart !== anchor.rhsEnd - anchor.rhsStart) {
                    console.warn(`Anchor length mismatch: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Adjusting to minimum of the two.`);
                }

                let [tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(lhsLower, anchor.lhsStart, rhsLower, anchor.rhsStart, 2);
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

                    _leftTokenProcessed += lhsUpper - lhsLower;
                    _rightTokenProcessed += rhsUpper - rhsLower;
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

            let lPosBuf = _lhsResultBuffer.subarray(lhsLower * RESULT_BUFFER_STRIDE, lhsUpper * RESULT_BUFFER_STRIDE),
                rPosBuf = _rhsResultBuffer.subarray(rhsLower * RESULT_BUFFER_STRIDE, rhsUpper * RESULT_BUFFER_STRIDE);

            let numCandidates = 0;
            function squashAnchorCandidates() {
                for (let i = 0; i < numCandidates; i++) {
                    let numL = 0, numR = 0;
                    const { h, lo, hi, baseScore, bestPossibleScore } = anchorCandidates[i];
                    if (bestPossibleScore <= bestScore) {
                        continue;
                    }

                    for (let k = lo; k <= hi; k++) {
                        const j = _sa[k];
                        const jEnd = j + h;
                        if (j >= lhsLower && j < lhsUpper && jEnd <= lhsUpper) {
                            lPosBuf[numL++] = j;
                        } else if (j >= rhsLoG && j < rhsHiG && jEnd <= rhsHiG) {
                            rPosBuf[numR++] = j - _pivot;
                        }
                    }

                    for (let x = 0; x < numL; x++) {
                        const l = lPosBuf[x];
                        const lf = _lhsFlags[l];
                        for (let y = 0; y < numR; y++) {
                            const r = rPosBuf[y];
                            let policyGrade = 0;
                            const rf = _rhsFlags[r];
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

            const sa = _sa;
            const lcp = _lcp;
            const n = sa.length;
            const rhsLoG = _pivot + rhsLower;
            const rhsHiG = _pivot + rhsUpper;

            for (let i = 1; i <= n; i++) {
                let lastLo = i - 1;
                const currentLCP = (i === n) ? 0 : lcp[i];
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
                        const j = sa[k];
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
                        const matched = matchPrefixTokens(lhsInput, rhsInput, lhsLower, lhsUpper, rhsLower, rhsUpper, _ignoreWhitespaces);
                        if (matched) {
                            const [lCount, rCount] = matched;

                            writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lhsLower, lhsLower + lCount, rhsLower, rhsLower + rCount, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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
                        writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lIdx, lIdx + 1, rIdx, rIdx + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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

                        const matched = matchSuffixTokens(lhsInput, rhsInput, lhsLower, lhsUpper, rhsLower, rhsUpper, _ignoreWhitespaces);
                        if (matched) {
                            const [lCount, rCount] = matched;
                            const lMatchStart = lhsUpper - lCount;
                            const rMatchStart = rhsUpper - rCount;

                            writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, lMatchStart, lhsUpper, rMatchStart, rhsUpper, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);

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

        await diffCore(0, _lhsTokenCount, 0, _rhsTokenCount);
    };

    function buildIdTables(lhsInput: DiffInput, rhsInput: DiffInput) {
        const lhsCnt = lhsInput.tokenCount, rhsCnt = rhsInput.tokenCount;
        const pivot = lhsCnt;
        const n = lhsCnt + rhsCnt;

        if (bitWidth === 16 && n >= 0xffff) {
            throw new Error("Uint16 overflow");
        }

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

    // function computeLongestCommonSubstring(
    //     sa: InstanceType<typeof IndexArray>,
    //     lcp: InstanceType<typeof IndexArray>,
    //     pivot: number
    // ): number {
    //     const n = sa.length;
    //     let maxLen = 0;

    //     for (let i = 1; i < n; i++) {
    //         const prevIsLhs = sa[i - 1] < pivot;
    //         const currIsLhs = sa[i] < pivot;
    //         // 서로 다른 문서에서 온 suffix인지 확인
    //         if (prevIsLhs !== currIsLhs) {
    //             const len = lcp[i];
    //             if (len > maxLen) {
    //                 maxLen = len;
    //             }
    //         }
    //     }

    //     return maxLen;
    // }
}
