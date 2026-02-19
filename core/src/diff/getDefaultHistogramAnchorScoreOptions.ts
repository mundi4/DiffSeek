import type { HistogramAnchorScoreOptions } from "./types";

export function getDefaultHistogramAnchorScoreOptions(): HistogramAnchorScoreOptions {
    return {
        freqMax: 8,
        freqGradeCount: 4,
        lenMax: 128,
        lenGradeCount: 8,
        freqBase: [64, 28, 12, 4],
        lenBase: [1, 2, 3, 5, 8, 12, 17, 24],
        policyWeights: [0, 0.05, 0.12],
        positionalWeights: [0, 0.03, 0.07],
    }
}