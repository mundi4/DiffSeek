import { calculateHash, isTokenRangeTextEqual, matchPrefixTokens, matchSuffixTokens, writeToResultBuffer } from "./helpers";
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffAnchor, type DiffInput, type DiffJobContext } from "./types";
import { TOKEN_FLAGS_TYPE_STRUCTURAL, TOKEN_TYPE_MASK } from "../tokenization";
import { getStructuralElementType } from "../tokenization/token-flags";
import { TOKEN_BUFFER_STRIDE } from "../constants";

const HASH_SIZE = 0xfffff + 1;
const HEAD = new Int32Array(HASH_SIZE);
const YIELD_INTERVAL = 0xff as const;
const CENTER_RANGE_RATIO = 0.3 as const; // 중앙의 30% 영역
const BAND_RANGE_RATIO = 0.7 as const; // 중앙의 70% 영역

// n*m 안티 대각선 폴백이 동작할 수 있는 최대 토큰 쌍 수.
// consumeCommonEdges 외곽 워커가 양쪽 다 막혀서 내부 substring 매치를 못 찾는
// 상황을 커버하기 위한 greedy multi-match 경로의 비용 상한.
// n*m ≤ 128이면 예: 8×16, 11×11 정도까지 허용.
const FALLBACK_NM_THRESHOLD = 128 as const;

export async function runHistogramDiff(
    ctx: DiffJobContext,
    lhsInput: DiffInput,
    rhsInput: DiffInput,
    lhsResultOffset = 0,
    rhsResultOffset = 0,
) {
    let total = 0;
    let prune1Count = 0;
    const _ignoreWhitespaces = ctx.diffOptions.whitespace === "ignore";

    const _structuralOnlyMultipliers = ctx.diffOptions.structuralOnlyMultipliers;
    const _structuralLevelBonuses = ctx.diffOptions.structuralLevelBonuses;

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

    async function diffCore(
        lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number
    ): Promise<void> {
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

        const anchor = await findAnchor(
            lhsLower, lhsUpper, rhsLower, rhsUpper
        );

        if (anchor) {
            if (anchor.lhsStart === anchor.lhsEnd || anchor.rhsStart === anchor.rhsEnd) {
                //console.warn(`Anchor with zero length found: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Ignoring this anchor.`);
                //throw new Error(`Anchor with zero length found: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}`);
            }
            if (anchor.lhsEnd - anchor.lhsStart !== anchor.rhsEnd - anchor.rhsStart) {
                //console.warn(`Anchor length mismatch: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Adjusting to minimum of the two.`);
                throw new Error(`Anchor length mismatch: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}`);
            }

            let [tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(lhsLower, anchor.lhsStart, rhsLower, anchor.rhsStart, 2);
            // console.log("consume backward common edges:", { ll: lhsLower, le: anchor.lhsStart, rl: rhsLower, re: anchor.rhsStart }, "=>", { tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper });
            if (tmpLhsLower < tmpLhsUpper || tmpRhsLower < tmpRhsUpper) {
                await diffCore(tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper);
            }

            // 지금 구현에서는 앵커는 반드시 토큰 대 토큰이 정확히 매치되어야 한다.
            for (let i = anchor.lhsStart, j = anchor.rhsStart; i < anchor.lhsEnd && j < anchor.rhsEnd; i++, j++) {
                writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, i, i + 1, j, j + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);
            }
            ([tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper] = consumeCommonEdges(anchor.lhsEnd, lhsUpper, anchor.rhsEnd, rhsUpper, 1));

            if (tmpLhsLower < tmpLhsUpper || tmpRhsLower < tmpRhsUpper) {
                await diffCore(tmpLhsLower, tmpLhsUpper, tmpRhsLower, tmpRhsUpper);
            }

        } else {
            if (_ignoreWhitespaces) {
                const n = lhsUpper - lhsLower;
                const m = rhsUpper - rhsLower;
                // Small-range greedy n*m fallback (anti-diagonal BFS + multi-match).
                // Only when neither SA nor edge-consume can find anything, and range is small.
                if (n >= 1 && m >= 1 && n * m <= FALLBACK_NM_THRESHOLD) {
                    fallbackGreedyConsume(lhsLower, lhsUpper, rhsLower, rhsUpper);
                    return;
                }
                // Larger range: original edge consume only
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

    // Greedy multi-match fallback used when SA finds no anchor and the range is small.
    // Scans for cross-boundary matches via matchPrefixTokens starting at every (i, j)
    // in anti-diagonal order, emits each found match as UNCHANGED, and emits the gaps
    // between matches (and the final leftover) as REMOVED/ADDED/MODIFIED.
    function fallbackGreedyConsume(
        lhsLo: number, lhsHi: number,
        rhsLo: number, rhsHi: number,
    ) {
        let lCur = lhsLo;
        let rCur = rhsLo;

        while (lCur < lhsHi && rCur < rhsHi) {
            const match = findFirstCrossMatch(lCur, lhsHi, rCur, rhsHi);
            if (match === null) break;

            const { lhsStart, lhsEnd, rhsStart, rhsEnd } = match;

            // Emit unmatched region between cursor and the match as REMOVED/ADDED/MODIFIED
            if (lhsStart > lCur || rhsStart > rCur) {
                let type = DIFF_TYPE_UNCHANGED;
                if (lhsStart > lCur) type |= DIFF_TYPE_REMOVED;
                if (rhsStart > rCur) type |= DIFF_TYPE_ADDED;
                writeToResultBuffer(
                    _lhsResultBuffer, _rhsResultBuffer,
                    lCur, lhsStart, rCur, rhsStart,
                    type, lhsResultOffset, rhsResultOffset,
                );
            }

            // Emit the match itself (symmetric or asymmetric) as UNCHANGED
            writeToResultBuffer(
                _lhsResultBuffer, _rhsResultBuffer,
                lhsStart, lhsEnd, rhsStart, rhsEnd,
                DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset,
            );

            lCur = lhsEnd;
            rCur = rhsEnd;
        }

        // Emit final leftover after the last match (or the entire range if no match found)
        if (lCur < lhsHi || rCur < rhsHi) {
            let type = DIFF_TYPE_UNCHANGED;
            if (lCur < lhsHi) type |= DIFF_TYPE_REMOVED;
            if (rCur < rhsHi) type |= DIFF_TYPE_ADDED;
            writeToResultBuffer(
                _lhsResultBuffer, _rhsResultBuffer,
                lCur, lhsHi, rCur, rhsHi,
                type, lhsResultOffset, rhsResultOffset,
            );
        }
    }

    // Anti-diagonal BFS over (i, j) starting positions in [lhsLo..lhsHi) × [rhsLo..rhsHi).
    // Returns the first cross-boundary match found, or null.
    // Search order: d = (i - lhsLo) + (j - rhsLo) increasing, so the earliest "from the front"
    // match wins.
    function findFirstCrossMatch(
        lhsLo: number, lhsHi: number,
        rhsLo: number, rhsHi: number,
    ): { lhsStart: number, lhsEnd: number, rhsStart: number, rhsEnd: number } | null {
        const n = lhsHi - lhsLo;
        const m = rhsHi - rhsLo;
        const maxD = (n - 1) + (m - 1);
        for (let d = 0; d <= maxD; d++) {
            const iStart = d < m ? 0 : d - m + 1;
            const iEnd = d < n ? d : n - 1;
            for (let i = iStart; i <= iEnd; i++) {
                const j = d - i;
                const r = matchPrefixTokens(
                    lhsInput, rhsInput,
                    lhsLo + i, lhsHi,
                    rhsLo + j, rhsHi,
                );
                if (r !== null) {
                    const [lCount, rCount] = r;
                    return {
                        lhsStart: lhsLo + i,
                        lhsEnd: lhsLo + i + lCount,
                        rhsStart: rhsLo + j,
                        rhsEnd: rhsLo + j + rCount,
                    };
                }
            }
        }
        return null;
    }

    const {
        freqPairGradeLUT: freqLUT,
        lenToGrade: lenLUT,
        coreScoreTable: core,
        freqRowBase: fRow,
        policyTable: policyTable,
        positionalMultipliers,
        freqMax: fMax,
        freqStride: fStride,
        lenMax: lMax,
        maxBonusMultiplier
    } = ctx.score;


    let stack = new Uint32Array(1024 * 2);
    type AnchorCandidate = {
        h: number,
        lo: number,
        hi: number,
        baseScore: number,
        bestPossibleScore: number,
        lengthGrade: number,
    };

    const MAX_NUM_ANCHOR_CANDIDATES = 20;
    const anchorCandidates: AnchorCandidate[] = new Array(MAX_NUM_ANCHOR_CANDIDATES);
    for (let i = 0; i < MAX_NUM_ANCHOR_CANDIDATES; i++) {
        anchorCandidates[i] = { h: 0, lo: 0, hi: 0, baseScore: 0, bestPossibleScore: 0, lengthGrade: 0 };
    }

    // Local SA scratch buffers — 서브영역 SA를 스크래치 빌드할 때 재사용
    let localSaScratch = new Uint32Array(0);
    let localRankScratch = new Uint32Array(0);
    let localTmpRankScratch = new Uint32Array(0);
    let localTmpSaScratch = new Uint32Array(0);
    let localCntScratch = new Uint32Array(0);
    let localLcpScratch = new Uint32Array(0);
    let localIdsScratch = new Uint32Array(0);

    function ensureLocalScratchCapacity(requiredSize: number) {
        if (localSaScratch.length < requiredSize) {
            localSaScratch = new Uint32Array(requiredSize);
            localRankScratch = new Uint32Array(requiredSize);
            localTmpRankScratch = new Uint32Array(requiredSize);
            localTmpSaScratch = new Uint32Array(requiredSize);
            localLcpScratch = new Uint32Array(requiredSize);
            localIdsScratch = new Uint32Array(requiredSize);
        }
        const cntSize = Math.max(requiredSize + 2, maxId + 3);
        if (localCntScratch.length < cntSize) {
            localCntScratch = new Uint32Array(cntSize);
        }
    }

    async function findAnchor(
        lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number
    ): Promise<DiffAnchor | null> {

        // console.log(`Finding anchor for LHS[${lhsLower}, ${lhsUpper}), RHS[${rhsLower}, ${rhsUpper}) with ${numCommonIds} common IDs out of ${maxId} total IDs.`);
        const MAX_BONUS_MULT = maxBonusMultiplier;

        const lhsRange = lhsUpper - lhsLower;
        const rhsRange = rhsUpper - rhsLower;

        const lhsCenter2 = lhsLower + lhsUpper;
        const rhsCenter2 = rhsLower + rhsUpper;

        const lhsHalf2 = lhsRange * CENTER_RANGE_RATIO * 2;
        const rhsHalf2 = rhsRange * CENTER_RANGE_RATIO * 2;

        const lhsBand2 = lhsRange * BAND_RANGE_RATIO * 2;
        const rhsBand2 = rhsRange * BAND_RANGE_RATIO * 2;

        let bestScore = -1, bestAnchorPosL = -1, bestAnchorPosR = -1, bestAnchorLen = 0;

        const rhsLoG = _pivot + rhsLower;
        const rhsHiG = _pivot + rhsUpper;

        // LHS와 RHS 사이에 sentinel을 삽입하여 경계를 넘는 LCP 매칭을 차단
        const sentinelId = maxId + 1;
        const m = lhsRange + 1 + rhsRange;
        if (m < 3) return null; // lhsRange + rhsRange < 2

        // 서브영역 토큰만으로 SA/LCP를 스크래치 빌드
        ensureLocalScratchCapacity(m);

        {
            const sa_l = localSaScratch.subarray(0, m);
            const rank_l = localRankScratch.subarray(0, m);
            const tmpRank_l = localTmpRankScratch.subarray(0, m);
            const tmpSa_l = localTmpSaScratch.subarray(0, m);
            const cnt_l = localCntScratch;
            const ids_l = localIdsScratch.subarray(0, m);

            // 1) ID를 연속 배열에 복사: [LHS tokens, sentinel, RHS tokens]
            for (let ii = 0; ii < lhsRange; ii++) ids_l[ii] = _lhsIds[lhsLower + ii];
            ids_l[lhsRange] = sentinelId;
            for (let ii = 0; ii < rhsRange; ii++) ids_l[lhsRange + 1 + ii] = _rhsIds[rhsLower + ii];

            let maxRank: number;
            // 원본 ID를 rank로 사용
            {
                for (let ii = 0; ii < m; ii++) {
                    sa_l[ii] = ii;
                    rank_l[ii] = ids_l[ii];
                }
                maxRank = sentinelId;
            }

            // 2) Doubling + Counting Sort
            for (let k = 1; k < m; k <<= 1) {
                const sentinel = maxRank + 1;

                // (A) second key
                cnt_l.fill(0, 0, maxRank + 2);
                for (let ii = 0; ii < m; ii++) {
                    const idx = sa_l[ii];
                    const key2 = (idx + k < m) ? rank_l[idx + k] : sentinel;
                    cnt_l[key2]++;
                }
                for (let ii = 1; ii <= sentinel; ii++) cnt_l[ii] += cnt_l[ii - 1];
                for (let ii = m - 1; ii >= 0; ii--) {
                    const idx = sa_l[ii];
                    const key2 = (idx + k < m) ? rank_l[idx + k] : sentinel;
                    tmpSa_l[--cnt_l[key2]] = idx;
                }

                // (B) first key
                cnt_l.fill(0, 0, maxRank + 1);
                for (let ii = 0; ii < m; ii++) cnt_l[rank_l[tmpSa_l[ii]]]++;
                for (let ii = 1; ii <= maxRank; ii++) cnt_l[ii] += cnt_l[ii - 1];
                for (let ii = m - 1; ii >= 0; ii--) {
                    const idx = tmpSa_l[ii];
                    sa_l[--cnt_l[rank_l[idx]]] = idx;
                }

                // (C) new ranks + maxRank 추적
                let r = 1;
                tmpRank_l[sa_l[0]] = r;
                for (let ii = 1; ii < m; ii++) {
                    const a = sa_l[ii - 1], b = sa_l[ii];
                    const a2 = (a + k < m) ? rank_l[a + k] : sentinel;
                    const b2 = (b + k < m) ? rank_l[b + k] : sentinel;
                    if (rank_l[a] !== rank_l[b] || a2 !== b2) r++;
                    tmpRank_l[b] = r;
                }
                for (let ii = 0; ii < m; ii++) rank_l[ii] = tmpRank_l[ii];
                maxRank = r;
                if (r === m) break;
            }

            // 3) Kasai LCP — ids_l로 분기 없이 비교
            const lcp_l = localLcpScratch.subarray(0, m);
            lcp_l[0] = 0;
            let h_k = 0;
            for (let ii = 0; ii < m; ii++) {
                const r = rank_l[ii];
                if (r <= 1) { h_k = 0; continue; }
                const jj = sa_l[r - 2];
                if (h_k > 0) h_k--;
                while (ii + h_k < m && jj + h_k < m) {
                    if (ids_l[ii + h_k] !== ids_l[jj + h_k]) break;
                    h_k++;
                }
                lcp_l[r - 1] = h_k;
            }

            // 4) local SA → global position 변환 (sentinel 위치는 그대로 유지)
            for (let ii = 0; ii < m; ii++) {
                const lp = sa_l[ii];
                if (lp < lhsRange) {
                    sa_l[ii] = lhsLower + lp;
                } else if (lp === lhsRange) {
                    // sentinel — LHS/RHS 어느 범위에도 속하지 않는 값
                    sa_l[ii] = rhsHiG;
                } else {
                    sa_l[ii] = _pivot + rhsLower + (lp - lhsRange - 1);
                }
            }
        }

        const localSa = localSaScratch;
        const localLcp = localLcpScratch;
        const intervalCount = m;

        let lPosBuf = _lhsResultBuffer.subarray(lhsLower * TOKEN_BUFFER_STRIDE, lhsUpper * TOKEN_BUFFER_STRIDE),
            rPosBuf = _rhsResultBuffer.subarray(rhsLower * TOKEN_BUFFER_STRIDE, rhsUpper * TOKEN_BUFFER_STRIDE);

        let numCandidates = 0;
        function tryUpdateBestAnchor(l: number, r: number, h: number, baseScore: number, structuralOnly: boolean) {
            // policyGrade 삭제됨: 앵커 범위 [l, l+h) 내 줄시작/헤딩 존재 여부를 정확히
            // 판정하려면 O(h) 루프 또는 prefix sum precompute가 필요한데,
            // 모든 (l, r) 쌍마다 돌아야 하므로 최대 12% 보너스 대비 비용이 과함.
            // 살리려면 headingPrefixSum / lineStartPrefixSum을 findAnchor 진입 시
            // O(n) sweep으로 만들고 O(1) 구간 조회하는 방식을 검토할 것.

            let posGrade = 0;

            if (!structuralOnly) {
                const lCenterDist2 = (l << 1) + h - lhsCenter2;
                const rCenterDist2 = (r << 1) + h - rhsCenter2;

                const absL = lCenterDist2 < 0 ? -lCenterDist2 : lCenterDist2;
                const absR = rCenterDist2 < 0 ? -rCenterDist2 : rCenterDist2;

                if (absL <= lhsHalf2 && absR <= rhsHalf2) {
                    posGrade = 2;
                } else if (absL <= lhsBand2 && absR <= rhsBand2) {
                    posGrade = 1;
                }
            }

            const finalScore = Math.round(baseScore * positionalMultipliers[posGrade]);
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
                const { h, lo, hi, bestPossibleScore, lengthGrade: lg } = anchorCandidates[i];
                if (bestPossibleScore <= bestScore) {
                    continue;
                }

                for (let k = lo; k <= hi; k++) {
                    const j = localSa[k];
                    const jEnd = j + h;
                    if (j >= lhsLower && j < lhsUpper && jEnd <= lhsUpper) {
                        lPosBuf[numL++] = j;
                    } else if (j >= rhsLoG && j < rhsHiG && jEnd <= rhsHiG) {
                        rPosBuf[numR++] = j - _pivot;
                    }
                }

                if (numL === 0 || numR === 0) continue;

                // 실제 빈도로 baseScore 재계산
                const actualFreqGrade = freqLUT[Math.min(numL, fMax) * fStride + Math.min(numR, fMax)];
                let actualBaseScore = core[fRow[actualFreqGrade] + lg];

                // 구조토큰 only 페널티: 첫 토큰이 structural이 아니면 즉시 skip
                let isStructuralOnly = false;
                const rep = lPosBuf[0]!;
                if ((_lhsFlags[rep] & TOKEN_TYPE_MASK) === TOKEN_FLAGS_TYPE_STRUCTURAL) {
                    isStructuralOnly = true;
                    let maxStructuralLevel = getStructuralElementType(_lhsFlags[rep]);
                    for (let t = rep + 1; t < rep + h; t++) {
                        const f = _lhsFlags[t];
                        if ((f & TOKEN_TYPE_MASK) !== TOKEN_FLAGS_TYPE_STRUCTURAL) {
                            isStructuralOnly = false;
                            break;
                        }
                        const level = getStructuralElementType(f);
                        if (level > maxStructuralLevel) maxStructuralLevel = level;
                    }
                    if (isStructuralOnly) {
                        const mIdx = h < _structuralOnlyMultipliers.length ? h : _structuralOnlyMultipliers.length - 1;
                        const sop = _structuralOnlyMultipliers[mIdx] * (_structuralLevelBonuses[maxStructuralLevel] ?? 1);
                        actualBaseScore = Math.round(actualBaseScore * sop) || 1;
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
                        tryUpdateBestAnchor(lPosBuf[x]!, rPosBuf[x]!, h, actualBaseScore, isStructuralOnly);
                    }
                    continue;
                }

                for (let x = 0; x < numL; x++) {
                    const l = lPosBuf[x]!;
                    for (let y = 0; y < numR; y++) {
                        tryUpdateBestAnchor(l, rPosBuf[y]!, h, actualBaseScore, isStructuralOnly);
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
                : (localLcp[i]);
            while (stackSize > 0 && stack[(stackSize - 1) * 2 + 1] > currentLCP) {
                stackSize--;
                const lo = stack[stackSize * 2];
                const h = stack[stackSize * 2 + 1];

                if (h === 0) {
                    lastLo = lo;
                    continue;
                }

                const hi = i - 1;
                // console.log(`Interval found: LCP=${h}, range=[${lo}, ${hi}] in local SA`);

                const occurrenceCount = hi - lo + 1;

                // 최소 양쪽에 하나씩은 있어야 하니까
                if (occurrenceCount < 2) {
                    lastLo = lo;
                    continue;
                }

                total++;

                const k = localSa[lo];

                const textLen = k < lhsUpper
                    ? _lhsOffsets[k + h] - _lhsOffsets[k]
                    : _rhsOffsets[k - _pivot + h] - _rhsOffsets[k - _pivot];
                const lengthGrade = lenLUT[textLen > lMax ? lMax : textLen];

                // 가능한 가장 높은 점수를 받도록 좌우 균등 freq를 가정.
                const bestFreq = Math.min(fMax, occurrenceCount >> 1);
                const bestFreqGrade = freqLUT[bestFreq * fStride + Math.min(fMax, occurrenceCount - bestFreq)];

                // pruning: freq/len 기반의 최대 점수로 될놈 안될놈 가려내기
                const baseScore = core[fRow[bestFreqGrade] + lengthGrade];
                if (bestScore >= Math.round(baseScore * MAX_BONUS_MULT)) {
                    prune1Count++;
                    lastLo = lo;
                    continue;
                }

                if (baseScore > 0) {
                    anchorCandidates[numCandidates].h = h;
                    anchorCandidates[numCandidates].lo = lo;
                    anchorCandidates[numCandidates].hi = hi;
                    anchorCandidates[numCandidates].baseScore = baseScore;
                    anchorCandidates[numCandidates].bestPossibleScore = Math.round(baseScore * MAX_BONUS_MULT);
                    anchorCandidates[numCandidates].lengthGrade = lengthGrade;
                    numCandidates++;
                    if (numCandidates === MAX_NUM_ANCHOR_CANDIDATES) {
                        squashAnchorCandidates();
                    }
                }

                lastLo = lo;
            }

            if (stackSize === 0 || stack[(stackSize - 1) * 2 + 1] < currentLCP) {
                if (stackSize >= stack.length / 2) {
                    // double the stack size
                    const newStack = new Uint32Array(stack.length * 2);
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

        if (bestScore < 0) return null;

        return {
            lhsStart: bestAnchorPosL,
            lhsEnd: bestAnchorPosL + bestAnchorLen,
            rhsStart: bestAnchorPosR,
            rhsEnd: bestAnchorPosR + bestAnchorLen,
        }
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

    console.log(`Total intervals processed: ${total}, Prune1 count: ${prune1Count}`);
}

function buildIdTables(lhsInput: DiffInput, rhsInput: DiffInput) {
    const lhsCnt = lhsInput.tokenCount, rhsCnt = rhsInput.tokenCount;
    const pivot = lhsCnt;
    const n = lhsCnt + rhsCnt;

    // 1. ID INTERN
    HEAD.fill(-1);
    const LINKS = new Int32Array(n);
    LINKS.fill(-1);

    const lhsIds = new Uint32Array(lhsCnt);
    const rhsIds = new Uint32Array(rhsCnt);
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
