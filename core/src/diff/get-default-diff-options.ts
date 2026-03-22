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

    // ─────────────────────────────
    // Patience Diff
    // ─────────────────────────────
    usePatience: true,
    patienceMinLines: 50,
    patienceMinTokens: 2000,
    localSAHybridRatio: 0.6,

} as const;

export function getDefaultDiffOptions(): DiffOptions {
    return structuredClone(defaultDiffOptions);
}
