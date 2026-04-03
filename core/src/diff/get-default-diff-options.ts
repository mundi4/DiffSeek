import type { DiffOptions } from "./types";

const defaultDiffOptions: DiffOptions = {
    // ─────────────────────────────
    // Whitespace
    // ─────────────────────────────
    whitespace: "collapse",

    // ─────────────────────────────
    // Tokenization
    // ─────────────────────────────
    mergeNonWordTokens: false,
    mergeLetterNumberBoundary: false,
    allowStandaloneLawArticle: true,

    // ─────────────────────────────
    // Patience Diff
    // ─────────────────────────────
    usePatience: true,
    patienceMinLines: 50,
    patienceMinTokens: 2000,
    patienceMinTokenCount: 4,
    patienceMinTextLen: 12,
    localSAHybridRatio: 0.6,

    // ─────────────────────────────
    // Structural tokens
    // ─────────────────────────────
    structuralTokenLength: 1,
    // h=0: unused, h=1: 0.02, h=2: 0.1, h=3: 0.15, h=4: 0.3, h=5+: 0.5
    structuralOnlyMultipliers: [0, 0.02, 0.1, 0.15, 0.3, 0.5],
    // index 0: unused, 1: TD/TH only = ×1 (보너스 없음), 2: TR 포함 = ×2, 3: TABLE 포함 = ×3
    structuralLevelBonuses: [1, 1, 2, 3],

    // ─────────────────────────────
    // Empty diff marker
    // ─────────────────────────────
    stackEmptyDiffMarkers: false,

} as const;

export function getDefaultDiffOptions(): DiffOptions {
    return structuredClone(defaultDiffOptions);
}
