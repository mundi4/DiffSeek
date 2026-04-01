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

    // ─────────────────────────────
    // Empty diff marker
    // ─────────────────────────────
    stackEmptyDiffMarkers: false,

} as const;

export function getDefaultDiffOptions(): DiffOptions {
    return structuredClone(defaultDiffOptions);
}
