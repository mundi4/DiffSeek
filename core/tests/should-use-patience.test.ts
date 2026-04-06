import { describe, it, expect } from "vitest";
import { shouldUsePatience } from "../src/diff/should-use-patience";
import { getDefaultDiffOptions } from "../src/diff/get-default-diff-options";
import type { DiffInput } from "../src/diff/types";

function makeMockInput(tokenCount: number): DiffInput {
    return {
        buffer: new Uint16Array(0),
        offsets: new Uint32Array(0),
        flags: new Uint32Array(0),
        resultBuffer: new Int32Array(0),
        tokenCount,
    };
}

describe("shouldUsePatience", () => {
    it("returns false when usePatience is disabled", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = false;
        expect(shouldUsePatience(makeMockInput(1000), makeMockInput(1000), opts, 100, 100)).toBe(false);
    });

    it("returns false when total tokens below threshold", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = true;
        opts.patienceMinTokens = 200;
        expect(shouldUsePatience(makeMockInput(50), makeMockInput(50), opts, 100, 100)).toBe(false);
    });

    it("returns false when line count below threshold", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = true;
        opts.patienceMinLines = 50;
        expect(shouldUsePatience(makeMockInput(500), makeMockInput(500), opts, 10, 10)).toBe(false);
    });

    it("returns true when all thresholds met", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = true;
        opts.patienceMinTokens = 200;
        opts.patienceMinLines = 50;
        expect(shouldUsePatience(makeMockInput(500), makeMockInput(500), opts, 100, 100)).toBe(true);
    });

    it("uses the min of both line counts", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = true;
        opts.patienceMinLines = 50;
        opts.patienceMinTokens = 200;
        // One side has enough lines, the other doesn't
        expect(shouldUsePatience(makeMockInput(500), makeMockInput(500), opts, 100, 10)).toBe(false);
    });

    it("uses default thresholds when options are 0/falsy", () => {
        const opts = getDefaultDiffOptions();
        opts.usePatience = true;
        opts.patienceMinTokens = 0;
        opts.patienceMinLines = 0;
        // Defaults: minTokens=200, minLines=50
        expect(shouldUsePatience(makeMockInput(500), makeMockInput(500), opts, 100, 100)).toBe(true);
        expect(shouldUsePatience(makeMockInput(50), makeMockInput(50), opts, 100, 100)).toBe(false);
    });
});
