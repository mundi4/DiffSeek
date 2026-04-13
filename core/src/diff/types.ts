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
    patienceMinTokenCount: number;
    patienceMinTextLen: number;

    structuralTokenLength: number;
    /** structural 토큰만으로 이루어진 앵커 후보의 base score에 곱할 multiplier. index = h (매칭 토큰 수). h가 배열 길이 이상이면 마지막 값 사용. */
    structuralOnlyMultipliers: number[];
    /** structural level(TD=1, TR=2, TABLE=3)별 추가 배율. index = max structural element type. 높은 level이 포함될수록 앵커 가치가 높으므로 배율 증가. */
    structuralLevelBonuses: number[];
    stackEmptyDiffMarkers: boolean;

    /**
     * whitespace: "ignore" 모드에서 SA 앵커도 없고 외곽 consume 워커도 막힌
     * sub-range에 대해 anti-diagonal n*m 폴백을 시도할 최대 토큰 쌍 수 상한.
     * (n*m)이 이 값 이하일 때만 폴백이 실행된다. 0이면 폴백 비활성.
     */
    fallbackNmThreshold: number;
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
    positionalMultipliers: Float64Array;
    maxBonusMultiplier: number;
}

export type DiffAnchor = {
    lhsStart: number;
    lhsEnd: number;
    rhsStart: number;
    rhsEnd: number;
}
