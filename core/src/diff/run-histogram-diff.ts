import { calculateHash, isTokenRangeTextEqual, writeToResultBuffer } from "./helpers";
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffAnchor, type DiffInput, type DiffJobContext } from "./types";
import { TOKEN_FLAGS_TYPE_STRUCTURAL, TOKEN_TYPE_MASK } from "../tokenization";
import { getStructuralElementType } from "../tokenization/token-flags";
import { TOKEN_BUFFER_STRIDE } from "../constants";

const HASH_SIZE = 0xfffff + 1;
const HEAD = new Int32Array(HASH_SIZE);
const YIELD_INTERVAL = 0xff as const;
const CENTER_RANGE_RATIO = 0.3 as const; // 중앙의 30% 영역
const BAND_RANGE_RATIO = 0.7 as const; // 중앙의 70% 영역

export async function runHistogramDiff(
    ctx: DiffJobContext,
    lhsInput: DiffInput,
    rhsInput: DiffInput,
    lhsResultOffset = 0,
    rhsResultOffset = 0,
) {
    const _structuralOnlyMultipliers = ctx.diffOptions.structuralOnlyMultipliers;
    const _structuralLevelBonuses = ctx.diffOptions.structuralLevelBonuses;

    const { tokenCount: _lhsTokenCount, offsets: _lhsOffsets, flags: _lhsFlags, resultBuffer: _lhsResultBuffer } = lhsInput;
    const { tokenCount: _rhsTokenCount, flags: _rhsFlags, resultBuffer: _rhsResultBuffer } = rhsInput;

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
        lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number,
        depth = 0,
        parentRank?: InstanceType<typeof Uint32Array> | null,
        parentLhsLower?: number,
        parentRhsLower?: number,
        parentLhsRange?: number,
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

        const { anchor, rank: currentRank } = await findAnchor(
            lhsLower, lhsUpper, rhsLower, rhsUpper, depth,
            parentRank, parentLhsLower, parentRhsLower, parentLhsRange,
        );
        const childLhsRange = lhsCount;
        if (anchor
        ) {
            if (anchor.lhsStart === anchor.lhsEnd || anchor.rhsStart === anchor.rhsEnd) {
                console.warn(`Anchor with zero length found: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Ignoring this anchor.`);
            }
            if (anchor.lhsEnd - anchor.lhsStart !== anchor.rhsEnd - anchor.rhsStart) {
                console.warn(`Anchor length mismatch: lhs length ${anchor.lhsEnd - anchor.lhsStart}, rhs length ${anchor.rhsEnd - anchor.rhsStart}. This should not happen. Adjusting to minimum of the two.`);
            }

            if (lhsLower < anchor.lhsStart || rhsLower < anchor.rhsStart) {
                await diffCore(lhsLower, anchor.lhsStart, rhsLower, anchor.rhsStart,
                    depth + 1, currentRank, lhsLower, rhsLower, childLhsRange);
            }

            // 지금 구현에서는 앵커는 반드시 토큰 대 토큰이 정확히 매치되어야 한다.
            let afterLhsStart: number, afterRhsStart: number;
            if (anchor.lhsEnd - anchor.lhsStart === anchor.rhsEnd - anchor.rhsStart) {
                for (let i = anchor.lhsStart, j = anchor.rhsStart; i < anchor.lhsEnd && j < anchor.rhsEnd; i++, j++) {
                    writeToResultBuffer(_lhsResultBuffer, _rhsResultBuffer, i, i + 1, j, j + 1, DIFF_TYPE_UNCHANGED, lhsResultOffset, rhsResultOffset);
                }
                afterLhsStart = anchor.lhsEnd;
                afterRhsStart = anchor.rhsEnd;
            } else {
                afterLhsStart = anchor.lhsStart;
                afterRhsStart = anchor.rhsStart;
            }

            if (afterLhsStart < lhsUpper || afterRhsStart < rhsUpper) {
                await diffCore(afterLhsStart, lhsUpper, afterRhsStart, rhsUpper,
                    depth + 1, currentRank, lhsLower, rhsLower, childLhsRange);
            }

        } else {
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


    let stack = new Uint32Array(1024 * 2);
    type AnchorCandidate = {
        h: number,
        lo: number,
        hi: number,
        baseScore: number,
        bestPossibleScore: number,
        structuralOnly: boolean
    };

    const MAX_NUM_ANCHOR_CANDIDATES = 20;
    const anchorCandidates: AnchorCandidate[] = new Array(MAX_NUM_ANCHOR_CANDIDATES);
    for (let i = 0; i < MAX_NUM_ANCHOR_CANDIDATES; i++) {
        anchorCandidates[i] = { h: 0, lo: 0, hi: 0, baseScore: 0, bestPossibleScore: 0, structuralOnly: false };
    }

    // Local SA scratch buffers — 서브영역 SA를 스크래치 빌드할 때 재사용
    let localSaScratch = new Uint32Array(0);
    let localRankScratch = new Uint32Array(0);
    let localTmpRankScratch = new Uint32Array(0);
    let localTmpSaScratch = new Uint32Array(0);
    let localCntScratch = new Uint32Array(0);
    let localLcpScratch = new Uint32Array(0);
    let localIdsScratch = new Uint32Array(0);

    // depth-indexed rank pool — 재귀 깊이별로 rank 버퍼 재사용
    const rankPool: InstanceType<typeof Uint32Array>[] = [];
    function getRankBuffer(depth: number, size: number): InstanceType<typeof Uint32Array> {
        if (depth >= rankPool.length) rankPool.length = depth + 1;
        if (!rankPool[depth] || rankPool[depth].length < size) {
            rankPool[depth] = new Uint32Array(size);
        }
        return rankPool[depth];
    }

    type FindAnchorResult = { anchor: DiffAnchor | null, rank: InstanceType<typeof Uint32Array> | null };

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
        lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number,
        depth: number,
        parentRank?: InstanceType<typeof Uint32Array> | null,
        parentLhsLower?: number,
        parentRhsLower?: number,
        parentLhsRange?: number,
    ): Promise<FindAnchorResult> {
        _findAnchorTotal++;
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

        const rhsLoG = _pivot + rhsLower;
        const rhsHiG = _pivot + rhsUpper;

        // LHS와 RHS 사이에 sentinel을 삽입하여 경계를 넘는 LCP 매칭을 차단
        const sentinelId = maxId + 1;
        const m = lhsRange + 1 + rhsRange;
        if (m < 3) return { anchor: null, rank: null }; // lhsRange + rhsRange < 2

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
            // const lf = _lhsFlags[l];
            // const rf = _rhsFlags[r];

            // policyGrade 비활성화: 앵커 매치 범위 [l, l+h) 중 항상 첫 토큰만
            // 체크하므로 줄시작/헤딩 판정이 부정확함
            // let policyGrade = 0;
            // if ((lf & HEADING_MASK) && (rf & HEADING_MASK)) {
            //     policyGrade = 2;
            // } else if ((lf & TOKEN_FLAGS_LINE_START) && (rf & TOKEN_FLAGS_LINE_START)) {
            //     policyGrade = 1;
            // }

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

            const bonusScore = /* policyTable[policyGrade] + */ positionalTable[posGrade];
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
                const { h, lo, hi, baseScore, bestPossibleScore, structuralOnly } = anchorCandidates[i];
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

                if (numL > 1) {
                    lPosBuf.subarray(0, numL).sort();
                }
                if (numR > 1) {
                    rPosBuf.subarray(0, numR).sort();
                }

                if (numL === numR) {
                    for (let x = 0; x < numL; x++) {
                        tryUpdateBestAnchor(lPosBuf[x]!, rPosBuf[x]!, h, baseScore, structuralOnly);
                    }
                    continue;
                }

                for (let x = 0; x < numL; x++) {
                    const l = lPosBuf[x]!;
                    for (let y = 0; y < numR; y++) {
                        tryUpdateBestAnchor(l, rPosBuf[y]!, h, baseScore, structuralOnly);
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

                // lhs/rhs 분류 + 이어붙인 배열의 lhs↔rhs 경계 초과 매치 제외
                let freqL = 0, freqR = 0;
                let lengthGrade = 0;
                let textLen = -1;
                let freqGrade: number;
                let baseScore = 0;
                let structuralOnlyPenalty = 1;
                for (let k = lo; k <= hi; k++) {
                    const j = localSa[k];
                    const jEnd = j + h;
                    if (j >= lhsLower && j < lhsUpper && jEnd <= lhsUpper && freqL < fMax) {
                        // lPosBuf[freqL] = j;
                        freqL++;
                        // 왼쪽에서만 계산해도 됨. 어차피 왼쪽에서 한번도 등장하지 않는다면 이후로는 무시할 거니까!
                        if (textLen === -1) {
                            textLen = _lhsOffsets[jEnd] - _lhsOffsets[j];
                            lengthGrade = lenLUT[textLen > lMax ? lMax : textLen];

                            // structural-only 판정 + max level 추적 (early exit)
                            let isStructuralOnly = true;
                            let maxStructuralLevel = 0;
                            for (let t = j; t < jEnd; t++) {
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
                                structuralOnlyPenalty = _structuralOnlyMultipliers[mIdx] * (_structuralLevelBonuses[maxStructuralLevel] ?? 1);
                            }
                        }
                        if (freqR > 0) {
                            freqGrade = freqLUT[freqL * fStride + freqR];
                            baseScore = core[fRow[freqGrade] + lengthGrade];
                            if (structuralOnlyPenalty !== 1) baseScore = Math.round(baseScore * structuralOnlyPenalty) || 1;
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
                            if (structuralOnlyPenalty !== 1) baseScore = Math.round(baseScore * structuralOnlyPenalty) || 1;
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
                    anchorCandidates[numCandidates].structuralOnly = structuralOnlyPenalty !== 1;
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

        // rank를 depth-indexed pool에 저장하여 자식에게 전달
        const savedRank = getRankBuffer(depth, m);
        const rank_l = localRankScratch.subarray(0, m);
        savedRank.set(rank_l);

        if (bestAnchorPosL !== -1) {
            return {
                anchor: {
                    lhsStart: bestAnchorPosL,
                    lhsEnd: bestAnchorPosL + bestAnchorLen,
                    rhsStart: bestAnchorPosR,
                    rhsEnd: bestAnchorPosR + bestAnchorLen,
                }, rank: savedRank
            };
        }

        return { anchor: null, rank: null };
    }

    let _findAnchorTotal = 0;

    await diffCore(0, _lhsTokenCount, 0, _rhsTokenCount);

    // console.log(`[findAnchor] total=${_findAnchorTotal}`);
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
