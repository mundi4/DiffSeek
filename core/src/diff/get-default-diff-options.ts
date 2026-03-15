import type { DiffOptions } from "./types";

const defaultDiffOptions: DiffOptions = {
    // ─────────────────────────────
    // Whitespace
    // ─────────────────────────────
    whitespace: "collapse",

    // ─────────────────────────────
    // Patience Diff
    // ─────────────────────────────
    usePatience: true,
    patienceMinLines: 50,
    patienceMinTokens: 2000,

    // ─────────────────────────────
    // Histogram Diff
    // ─────────────────────────────
    histogramBitWidth: "auto",
    allowHistogramBitWidthSwitching: true,
} as const;

export function getDefaultDiffOptions(): DiffOptions {
    return structuredClone(defaultDiffOptions);
}
