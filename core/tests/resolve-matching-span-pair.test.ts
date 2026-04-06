import { describe, it, expect } from "vitest";
import { resolveMatchingSpanPair } from "../src/engine/resolve-matching-span-pair";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";
import type { DiffContext } from "../src/engine/types";

/**
 * Build a minimal DiffContext for testing resolveMatchingSpanPair.
 * Each token entry in the buffer has:
 *   [0] = thisStart, [1] = thisEnd, [2] = oppStart, [3] = oppEnd, [4] = diffType
 */
function makeDiffContext(
    leftEntries: Array<[thisStart: number, thisEnd: number, oppStart: number, oppEnd: number, diffType: number]>,
    rightEntries: Array<[thisStart: number, thisEnd: number, oppStart: number, oppEnd: number, diffType: number]>,
): DiffContext {
    const leftBuf = new Int32Array(leftEntries.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < leftEntries.length; i++) {
        const e = leftEntries[i];
        leftBuf[i * TOKEN_BUFFER_STRIDE + 0] = e[0];
        leftBuf[i * TOKEN_BUFFER_STRIDE + 1] = e[1];
        leftBuf[i * TOKEN_BUFFER_STRIDE + 2] = e[2];
        leftBuf[i * TOKEN_BUFFER_STRIDE + 3] = e[3];
        leftBuf[i * TOKEN_BUFFER_STRIDE + 4] = e[4];
    }

    const rightBuf = new Int32Array(rightEntries.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < rightEntries.length; i++) {
        const e = rightEntries[i];
        rightBuf[i * TOKEN_BUFFER_STRIDE + 0] = e[0];
        rightBuf[i * TOKEN_BUFFER_STRIDE + 1] = e[1];
        rightBuf[i * TOKEN_BUFFER_STRIDE + 2] = e[2];
        rightBuf[i * TOKEN_BUFFER_STRIDE + 3] = e[3];
        rightBuf[i * TOKEN_BUFFER_STRIDE + 4] = e[4];
    }

    return {
        leftTokens: [],
        rightTokens: [],
        commonOutline: [],
        diffOptions: {} as any,
        diffs: [],
        anchorPairs: [],
        leftTokenBuffer: leftBuf,
        rightTokenBuffer: rightBuf,
        timing: { tokenizingMs: 0, diffingMs: 0, processingMs: 0, totalMs: 0 },
        isValid: true,
    };
}

describe("resolveMatchingSpanPair", () => {
    it("returns nulls for empty span", () => {
        const ctx = makeDiffContext(
            [[0, 2, 0, 2, 0]],
            [[0, 2, 0, 2, 0]],
        );
        const result = resolveMatchingSpanPair(ctx, "left", { start: 0, end: 0 });
        expect(result.left).toBe(null);
        expect(result.right).toBe(null);
    });

    it("returns nulls for empty token buffer", () => {
        const ctx = makeDiffContext([], []);
        const result = resolveMatchingSpanPair(ctx, "left", { start: 0, end: 1 });
        expect(result.left).toBe(null);
        expect(result.right).toBe(null);
    });

    it("resolves 1:1 matching from left side", () => {
        // Left token 0: thisRange=[0,3), oppRange=[0,3), type=unchanged
        const ctx = makeDiffContext(
            [[0, 3, 0, 3, 0]],
            [[0, 3, 0, 3, 0]],
        );
        const result = resolveMatchingSpanPair(ctx, "left", { start: 0, end: 1 });
        expect(result.left).toEqual({ start: 0, end: 3 });
        expect(result.right).toEqual({ start: 0, end: 3 });
    });

    it("resolves 1:1 matching from right side", () => {
        const ctx = makeDiffContext(
            [[0, 5, 0, 5, 0]],
            [[0, 5, 0, 5, 0]],
        );
        const result = resolveMatchingSpanPair(ctx, "right", { start: 0, end: 1 });
        expect(result.left).toEqual({ start: 0, end: 5 });
        expect(result.right).toEqual({ start: 0, end: 5 });
    });

    it("resolves multi-token span", () => {
        // Left has 2 tokens: token 0 → this[0,2) opp[0,3), token 1 → this[2,4) opp[3,6)
        const ctx = makeDiffContext(
            [[0, 2, 0, 3, 0], [2, 4, 3, 6, 0]],
            [[0, 3, 0, 2, 0], [3, 6, 2, 4, 0]],
        );
        const result = resolveMatchingSpanPair(ctx, "left", { start: 0, end: 2 });
        // left span: start of token 0 to end of token 1 = [0, 4)
        expect(result.left).toEqual({ start: 0, end: 4 });
        // right span: oppStart of token 0 to oppEnd of token 1 = [0, 6)
        expect(result.right).toEqual({ start: 0, end: 6 });
    });

    it("returns null for opposite span when oppEnd <= oppStart", () => {
        // Left token where opposite range is empty/invalid
        const ctx = makeDiffContext(
            [[0, 3, 5, 5, 1]], // oppStart=5, oppEnd=5 → empty opposite
            [[0, 3, 0, 3, 0]],
        );
        const result = resolveMatchingSpanPair(ctx, "left", { start: 0, end: 1 });
        expect(result.left).toEqual({ start: 0, end: 3 });
        expect(result.right).toBe(null);
    });
});
