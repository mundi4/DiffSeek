// ==============================
// types & options
// ==============================

import { HEADING_MASK, TokenFlags } from "../TokenFlags";

export type FreqRank = number; // 0-based

export interface AnchorScoreOptions {
    maxLen?: number;
    kneeLen?: number;
    satLen?: number;
    baseScore?: number;
    maxScore?: number;

    freqRankWeights?: readonly number[];
    freqRankThresholds?: readonly number[];

    // centerness
    centernessBase?: readonly number[]; // length 10, values 0..9
    centernessRatio?: number;           // e.g. 0.1

    // structural bonuses
    headingBonusRatio?: number;          // e.g. 0.2
    lineStartBonusRatio?: number;        // e.g. 0.1
}

// ==============================
// length curve (포화형, 단조 증가)
// ==============================

function lengthCurve(
    len: number,
    kneeLen: number,
    satLen: number,
    baseScore: number,
    maxScore: number,
): number {
    if (len <= 0) return baseScore;
    if (len >= satLen) return maxScore;

    if (len <= kneeLen) {
        const t = len / kneeLen;
        return baseScore + ((maxScore - baseScore) * t * 0.7) | 0;
    } else {
        const t = (len - kneeLen) / (satLen - kneeLen);
        return baseScore + ((maxScore - baseScore) * (0.7 + 0.3 * t)) | 0;
    }
}

// ==============================
// centerness bonus table builder
// ==============================

function buildCenternessBonusTable(
    maxScore: number,
    centernessBase: readonly number[],
    centernessRatio: number,
): Int32Array {
    if (centernessBase.length !== 10) {
        throw new Error("centernessBase must have length 10");
    }

    const table = new Int32Array(10);
    const scale = maxScore * centernessRatio;

    for (let i = 0; i < 10; i++) {
        table[i] = ((scale * centernessBase[i]) / 9) | 0;
    }
    return table;
}

// ==============================
// main builder
// ==============================

export function buildAnchorScoreSystem(opts: AnchorScoreOptions = {}) {
    let {
        maxLen = 100,
        kneeLen = 40,
        satLen = 80,
        baseScore = 0,
        maxScore = 65536,

        freqRankWeights = [1.00, 0.70, 0.58, 0.50, 0.44],
        freqRankThresholds,

        centernessBase = [0, 0, 1, 1, 1, 2, 2, 2, 2, 2], // 너무 세분화 하면 가지치기 어렵다! 우리는 2까지만 나와도 충분하다고 보고 최고점을 이 수준으로 잡음
        centernessRatio = 0.1,

        headingBonusRatio = 0.2,
        lineStartBonusRatio = 0.1,
    } = opts;

    // ------------------------------
    // freq rank table
    // ------------------------------

    freqRankThresholds = freqRankThresholds ?? freqRankWeights.slice(1).map((_, i) => 1 << i);

    if (freqRankThresholds.length + 1 !== freqRankWeights.length) {
        throw new Error("freqRankWeights length must be freqRankThresholds.length + 1");
    }

    const freqRankTable = new Uint8Array(
        freqRankThresholds[freqRankThresholds.length - 1] + 1
    );

    for (let i = 0; i < freqRankTable.length; i++) {
        let r = 0;
        while (r < freqRankThresholds.length && i > freqRankThresholds[r]) r++;
        freqRankTable[i] = r;
    }

    // ------------------------------
    // length curve table
    // ------------------------------

    const strideLen = maxLen + 1;
    const lengthScores = new Uint32Array(strideLen);

    for (let len = 0; len <= maxLen; len++) {
        lengthScores[len] = lengthCurve(
            len, kneeLen, satLen, baseScore, maxScore
        );
    }

    // ------------------------------
    // core score table (freq × len)
    // ------------------------------

    const numFreq = freqRankWeights.length;
    const coreTable = new Uint32Array(numFreq * strideLen);

    for (let r = 0; r < numFreq; r++) {
        const w = freqRankWeights[r];
        const baseIdx = r * strideLen;
        for (let len = 0; len <= maxLen; len++) {
            coreTable[baseIdx + len] = (lengthScores[len] * w) | 0;
        }
    }

    const maxRank = numFreq - 1;

    // ------------------------------
    // baked policy constants
    // ------------------------------

    const centernessBonusTable =
        buildCenternessBonusTable(
            maxScore,
            centernessBase,
            centernessRatio
        );

    const headingBonus =
        (maxScore * headingBonusRatio) | 0;

    const lineStartBonus =
        (maxScore * lineStartBonusRatio) | 0;

    // 정책 보너스 최대값 (LHS + RHS 기준)
    const maxPolicyBonus =
        centernessBonusTable[9] * 2 +
        Math.max(headingBonus, lineStartBonus);

    // ------------------------------
    // score functions
    // ------------------------------

    function scoreCore(
        length: number,
        lhsFreq: number,
        rhsFreq: number,
    ): number {
        const lxr = lhsFreq * rhsFreq;
        const rank =
            lxr < freqRankTable.length
                ? freqRankTable[lxr]
                : maxRank;

        const lenIdx = length <= maxLen ? length : maxLen;
        return coreTable[rank * strideLen + lenIdx];
    }

    function scorePolicyBonus(
        lhsPos: number,
        lhsLower: number,
        lhsUpper: number,
        lhsFlags: Uint32Array,
        rhsPos: number,
        rhsLower: number,
        rhsUpper: number,
        rhsFlags: Uint32Array,

        tokenCount: number,
        // HEADING_MASK: number,
        // TokenFlags: {
        //     LINE_START: number;
        //     WORD_LIKE: number;
        // },
    ): number {
        let bonus = 0;

        // centerness LHS
        {
            const range = lhsUpper - lhsLower;
            if (range > 0) {
                const mid = (lhsLower + lhsUpper) >> 1;
                const dist = Math.abs(lhsPos - mid);
                const rank = 9 - ((dist * 18 / range) | 0);
                bonus += centernessBonusTable[rank > 0 ? rank : 0];
            }
        }

        // centerness RHS
        {
            const range = rhsUpper - rhsLower;
            if (range > 0) {
                const mid = (rhsLower + rhsUpper) >> 1;
                const dist = Math.abs(rhsPos - mid);
                const rank = 9 - ((dist * 18 / range) | 0);
                bonus += centernessBonusTable[rank > 0 ? rank : 0];
            }
        }

        const lhsF = lhsFlags[lhsPos];
        const rhsF = rhsFlags[rhsPos];

        // heading (최우선)
        if ((lhsF & HEADING_MASK) && (rhsF & HEADING_MASK)) {
            const lhsEnd = lhsPos + tokenCount;
            for (let i = lhsPos + 1; i < lhsEnd; i++) {
                const f = lhsFlags[i];
                if (f & TokenFlags.LINE_START) break;
                if (f & TokenFlags.WORD_LIKE) {
                    return bonus + headingBonus;
                }
            }
        }

        // line-start (차선)
        if (
            (lhsF & TokenFlags.LINE_START) &&
            (rhsF & TokenFlags.LINE_START)
        ) {
            bonus += lineStartBonus;
        }

        return bonus;
    }

    return {
        scoreCore,
        scorePolicyBonus,
        centernessBonusTable,
        headingBonus,
        lineStartBonus,
        maxPolicyBonus,
        maxScoreWithoutBonus: maxScore,
    };
}
