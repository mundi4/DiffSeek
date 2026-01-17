import type { DiffOptions } from "../types";

const defaultDiffOptions: DiffOptions = {
    // ─────────────────────────────
    // Whitespace
    // ─────────────────────────────
    whitespace: "collapse",

    // ─────────────────────────────
    // Gram matching
    // ─────────────────────────────
    useGrams: true,
    maxGram: 4,

    // ─────────────────────────────
    // Length bonus
    // ─────────────────────────────
    useLengthBonus: true,
    lengthBonusMultiplier: 1.0,
    maxLengthPerGramForBonus: 5,

    // ─────────────────────────────
    // Line start bonus
    // ─────────────────────────────
    useLineStartBonus: true,
    lineStartBonusMultiplier: 1.0,

    // ─────────────────────────────
    // Uniqueness bonus
    // ─────────────────────────────
    useUniqueBonus: true,
    uniqueBonusMultiplier: 1.0,

    // ─────────────────────────────
    // Coarse split (performance gate)
    // ─────────────────────────────
    useCoarseSplit: true,

    // anchor 생성 방식
    coarseAnchorMode: "linePrefix",

    // ── anchor 품질 기준 (anchor-level)
    coarseAnchorMinTokens: 6,
    coarseAnchorTokenWindow: 8,
    coarseAnchorMinWordLikeTokens: 2,
    coarseAnchorMinEffectiveChars: 5,

    // ── split 시도 기준 (range-level)
    coarseSplitMinTokens: 6000,
    coarseSplitMinSideTokens: 400,
    coarseSplitMinGainRatio: 0.18,
    coarseSplitMaxUniqueAnchors: 6000,
} as const;

export function getDefaultDiffOptions(): DiffOptions {
    return structuredClone(defaultDiffOptions);
}