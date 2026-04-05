import { QuickDiffType, type QuickDiffEntry, type QuickDiffResult } from "./types";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function toGraphemes(text: string): string[] {
    const result: string[] = [];
    for (const { segment } of segmenter.segment(text)) {
        result.push(segment);
    }
    return result;
}

/**
 * LCS 기반 글자(grapheme) 단위 diff.
 * O(n*m) DP.
 */
export function computeCharDiff(leftText: string, rightText: string): QuickDiffResult {
    const leftG = toGraphemes(leftText);
    const rightG = toGraphemes(rightText);
    const n = leftG.length;
    const m = rightG.length;

    if (n === 0 && m === 0) {
        return { leftText, rightText, entries: [] };
    }
    if (n === 0) {
        return { leftText, rightText, entries: [{ type: QuickDiffType.Added, text: rightText }] };
    }
    if (m === 0) {
        return { leftText, rightText, entries: [{ type: QuickDiffType.Removed, text: leftText }] };
    }

    const cols = m + 1;
    const dp = new Int32Array((n + 1) * cols);

    for (let i = 1; i <= n; i++) {
        const row = i * cols;
        const prevRow = (i - 1) * cols;
        for (let j = 1; j <= m; j++) {
            if (leftG[i - 1] === rightG[j - 1]) {
                dp[row + j] = dp[prevRow + j - 1] + 1;
            } else {
                dp[row + j] = dp[prevRow + j] > dp[row + j - 1]
                    ? dp[prevRow + j]
                    : dp[row + j - 1];
            }
        }
    }

    const rawOps: { type: QuickDiffType; grapheme: string }[] = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && leftG[i - 1] === rightG[j - 1]) {
            rawOps.push({ type: QuickDiffType.Unchanged, grapheme: leftG[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[(i - 1) * cols + j] <= dp[i * cols + j - 1])) {
            rawOps.push({ type: QuickDiffType.Added, grapheme: rightG[j - 1] });
            j--;
        } else {
            rawOps.push({ type: QuickDiffType.Removed, grapheme: leftG[i - 1] });
            i--;
        }
    }

    rawOps.reverse();

    const entries: QuickDiffEntry[] = [];
    for (const op of rawOps) {
        const last = entries[entries.length - 1];
        if (last && last.type === op.type) {
            last.text += op.grapheme;
        } else {
            entries.push({ type: op.type, text: op.grapheme });
        }
    }

    return { leftText, rightText, entries };
}
