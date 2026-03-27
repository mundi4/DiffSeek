/**
 * Core diff algorithm types
 */

export const DIFF_TYPE_UNCHANGED = 0x0 as const;
export const DIFF_TYPE_REMOVED = 0x1 as const;
export const DIFF_TYPE_ADDED = 0x2 as const;
export const DIFF_TYPE_MODIFIED = 0x3 as const;

export type DiffOptions = {
    whitespace: "collapse" | "ignore";
    mergeNonWordTokens: boolean;
    mergeLetterNumberBoundary: boolean;
    allowStandaloneLawArticle: boolean;
    usePatience: boolean;
    patienceMinLines: number;
    patienceMinTokens: number;
    localSAHybridRatio: number;
};

export type DiffInput = {
    buffer: Uint16Array;
    offsets: Uint32Array;
    flags: Uint32Array;
    resultBuffer: Int32Array;
    tokenCount: number;
}

export interface DiffJobContext {
    reqId: number;
    diffOptions: DiffOptions;
    score: DiffScoreSystem;
    signal: AbortSignal;
}

export interface HistogramAnchorScoreOptions {
    coreMaxScore?: number;          // default 65535
    freqMax?: number;              // default 8
    freqGradeCount?: number;       // default 4

    lenMax?: number;               // default 128
    lenGradeCount?: number;        // default 8

    // 완전 테이블 방식(A안) 기본값
    freqBase?: number[];           // length = freqGradeCount
    lenBase?: number[];            // length = lenGradeCount

    // bonus
    policyWeights?: number[];         // default [0,0.05,0.12]
    positionalWeights?: number[];     // default [0,0.03,0.07]
}

export interface DiffScoreSystem {
    freqPairGradeLUT: Uint8Array;
    freqStride: number;
    freqMax: number;
    freqGradeCount: number;
    freqRowBase: Uint16Array;

    lenToGrade: Uint8Array;
    lenMax: number;
    lenGradeCount: number;

    coreScoreTable: Uint16Array;
    maxCoreScore: number;

    policyTable: Uint16Array;
    positionalTable: Uint16Array;
    maxBonus: number;
}

export type DiffAnchor = {
    lhsStart: number;
    lhsEnd: number;
    rhsStart: number;
    rhsEnd: number;
}
