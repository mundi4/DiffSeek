import { describe, it, expect } from "vitest";
import { serializeTokens } from "../src/engine/process-diff-elements";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";
import type { Token } from "../src/tokenization";

function makeToken(textOffset: number, textLength: number, flags: number): Token {
    return {
        textOffset,
        textLength,
        flags,
        startNode: null as any,
        startOffset: 0,
        endNode: null as any,
        endOffset: 0,
    };
}

describe("serializeTokens", () => {
    it("serializes empty token array", () => {
        const result = serializeTokens([]);
        expect(result.length).toBe(0);
    });

    it("serializes single token", () => {
        const tokens = [makeToken(10, 5, 0x21)];
        const result = serializeTokens(tokens);
        expect(result.length).toBe(TOKEN_BUFFER_STRIDE);
        expect(result[0]).toBe(10); // textOffset
        expect(result[1]).toBe(5);  // textLength
        expect(result[2]).toBe(0x21); // flags
    });

    it("serializes multiple tokens with correct stride", () => {
        const tokens = [
            makeToken(0, 3, 1),
            makeToken(3, 4, 2),
            makeToken(7, 2, 4),
        ];
        const result = serializeTokens(tokens);
        expect(result.length).toBe(3 * TOKEN_BUFFER_STRIDE);

        // Token 0
        expect(result[0 * TOKEN_BUFFER_STRIDE + 0]).toBe(0);
        expect(result[0 * TOKEN_BUFFER_STRIDE + 1]).toBe(3);
        expect(result[0 * TOKEN_BUFFER_STRIDE + 2]).toBe(1);

        // Token 1
        expect(result[1 * TOKEN_BUFFER_STRIDE + 0]).toBe(3);
        expect(result[1 * TOKEN_BUFFER_STRIDE + 1]).toBe(4);
        expect(result[1 * TOKEN_BUFFER_STRIDE + 2]).toBe(2);

        // Token 2
        expect(result[2 * TOKEN_BUFFER_STRIDE + 0]).toBe(7);
        expect(result[2 * TOKEN_BUFFER_STRIDE + 1]).toBe(2);
        expect(result[2 * TOKEN_BUFFER_STRIDE + 2]).toBe(4);
    });

    it("preserves negative flags (structural open tokens)", () => {
        // Structural OPEN has bit 31 set → negative signed int
        const flags = -2147483648 | 4; // TOKEN_FLAGS_STRUCTURAL_OPEN | TOKEN_FLAGS_TYPE_STRUCTURAL
        const tokens = [makeToken(0, 1, flags)];
        const result = serializeTokens(tokens);
        expect(result[2]).toBe(flags);
    });
});
