import { describe, it, expect } from "vitest";
import { buildDiffInput } from "../src/diff/build-diff-input";
import { buildDiffScoreSystem } from "../src/diff/build-diff-score-system";
import { getDefaultDiffOptions } from "../src/diff/get-default-diff-options";
import {
	calculateHash,
	isTokenRangeTextEqual,
	matchPrefixTokens,
	matchSuffixTokens,
	compareBuffers,
	sliceDiffInput,
	writeToResultBuffer,
	tokenRangeToString,
} from "../src/diff/helpers";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";
import {
	TOKEN_FLAGS_TYPE_TEXT,
	TOKEN_FLAGS_LINE_START,
	TOKEN_FLAGS_LINE_END,
	TOKEN_FLAGS_HAS_FOLLOWING_SPACE,
} from "../src/tokenization/token-flags";
import type { DiffInput, DiffOptions } from "../src/diff/types";

// ── helpers: test data builders ─────────────────────────────────

function makeTokenBuffer(tokens: Array<{ offset: number; length: number; flags: number }>): Int32Array {
	const buf = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		buf[i * TOKEN_BUFFER_STRIDE + 0] = t.offset;
		buf[i * TOKEN_BUFFER_STRIDE + 1] = t.length;
		buf[i * TOKEN_BUFFER_STRIDE + 2] = t.flags;
	}
	return buf;
}

function makeDiffInput(text: string, offsets: number[], flags: number[]): DiffInput {
	const tokenCount = flags.length;
	const buf = new Uint16Array(text.length);
	for (let i = 0; i < text.length; i++) buf[i] = text.charCodeAt(i);
	const offsetArr = new Uint32Array(offsets);
	const flagArr = new Uint32Array(flags);
	const resultBuf = new Int32Array(tokenCount * TOKEN_BUFFER_STRIDE);
	return { buffer: buf, offsets: offsetArr, flags: flagArr, resultBuffer: resultBuf, tokenCount };
}

// ── getDefaultDiffOptions ───────────────────────────────────────

describe("getDefaultDiffOptions", () => {
	it("returns an object with expected keys", () => {
		const opts = getDefaultDiffOptions();
		expect(opts).toHaveProperty("whitespace");
		expect(opts).toHaveProperty("mergeNonWordTokens");
		expect(opts).toHaveProperty("usePatience");
		expect(opts).toHaveProperty("structuralTokenLength");
	});

	it("returns a fresh clone each time", () => {
		const a = getDefaultDiffOptions();
		const b = getDefaultDiffOptions();
		expect(a).not.toBe(b);
		expect(a).toEqual(b);
	});

	it("mutating returned object doesn't affect next call", () => {
		const a = getDefaultDiffOptions();
		a.whitespace = "ignore";
		const b = getDefaultDiffOptions();
		expect(b.whitespace).toBe("collapse");
	});
});

// ── calculateHash ───────────────────────────────────────────────

describe("calculateHash", () => {
	it("is deterministic", () => {
		const buf = new Uint16Array([65, 66, 67]); // "ABC"
		expect(calculateHash(buf, 0, 3)).toBe(calculateHash(buf, 0, 3));
	});

	it("differs for different content", () => {
		const a = new Uint16Array([65, 66]); // "AB"
		const b = new Uint16Array([67, 68]); // "CD"
		expect(calculateHash(a, 0, 2)).not.toBe(calculateHash(b, 0, 2));
	});

	it("returns unsigned 32-bit integer", () => {
		const buf = new Uint16Array([72, 101, 108, 108, 111]); // "Hello"
		const h = calculateHash(buf, 0, 5);
		expect(h).toBeGreaterThanOrEqual(0);
		expect(h).toBeLessThanOrEqual(0xffffffff);
	});

	it("works with offset", () => {
		const buf = new Uint16Array([0, 65, 66, 67, 0]); // padding around "ABC"
		const h1 = calculateHash(buf, 1, 3);
		const buf2 = new Uint16Array([65, 66, 67]);
		const h2 = calculateHash(buf2, 0, 3);
		expect(h1).toBe(h2);
	});

	it("empty range returns a consistent value", () => {
		const buf = new Uint16Array([65]);
		expect(calculateHash(buf, 0, 0)).toBe(calculateHash(buf, 0, 0));
	});
});

// ── isTokenRangeTextEqual ───────────────────────────────────────

describe("isTokenRangeTextEqual", () => {
	it("returns true for identical ranges", () => {
		// "ab" as two char codes
		const buf = new Uint16Array([97, 98]);
		const off = new Uint32Array([0, 2]);
		expect(isTokenRangeTextEqual(buf, off, 0, 1, buf, off, 0, 1)).toBe(true);
	});

	it("returns false for different length ranges", () => {
		const bufA = new Uint16Array([97, 98, 99]); // "abc"
		const offA = new Uint32Array([0, 3]);
		const bufB = new Uint16Array([97, 98]); // "ab"
		const offB = new Uint32Array([0, 2]);
		expect(isTokenRangeTextEqual(bufA, offA, 0, 1, bufB, offB, 0, 1)).toBe(false);
	});

	it("returns false for same length but different content", () => {
		const bufA = new Uint16Array([97, 98]); // "ab"
		const bufB = new Uint16Array([97, 99]); // "ac"
		const off = new Uint32Array([0, 2]);
		expect(isTokenRangeTextEqual(bufA, off, 0, 1, bufB, off, 0, 1)).toBe(false);
	});
});

// ── compareBuffers ──────────────────────────────────────────────

describe("compareBuffers", () => {
	it("returns true for identical slices", () => {
		const a = new Uint16Array([1, 2, 3, 4]);
		const b = new Uint16Array([1, 2, 3, 4]);
		expect(compareBuffers(a, 0, b, 0, 4)).toBe(true);
	});

	it("returns false for different slices", () => {
		const a = new Uint16Array([1, 2, 3]);
		const b = new Uint16Array([1, 2, 4]);
		expect(compareBuffers(a, 0, b, 0, 3)).toBe(false);
	});

	it("returns false when count exceeds buffer length", () => {
		const a = new Uint16Array([1, 2]);
		const b = new Uint16Array([1, 2, 3]);
		expect(compareBuffers(a, 0, b, 0, 3)).toBe(false);
	});

	it("works with offsets", () => {
		const a = new Uint16Array([0, 0, 1, 2]);
		const b = new Uint16Array([1, 2, 0, 0]);
		expect(compareBuffers(a, 2, b, 0, 2)).toBe(true);
	});
});

// ── writeToResultBuffer ─────────────────────────────────────────

describe("writeToResultBuffer", () => {
	it("writes diff type into both buffers", () => {
		const lhs = new Int32Array(2 * TOKEN_BUFFER_STRIDE);
		const rhs = new Int32Array(2 * TOKEN_BUFFER_STRIDE);
		writeToResultBuffer(lhs, rhs, 0, 2, 0, 2, 3); // MODIFIED=3

		// LHS token 0: lhsPos=0, lhsEnd=2, rhsPos=0, rhsEnd=2, type=3
		expect(lhs[0]).toBe(0);
		expect(lhs[1]).toBe(2);
		expect(lhs[2]).toBe(0);
		expect(lhs[3]).toBe(2);
		expect(lhs[4]).toBe(3);

		// RHS token 0
		expect(rhs[0]).toBe(0);
		expect(rhs[1]).toBe(2);
		expect(rhs[2]).toBe(0);
		expect(rhs[3]).toBe(2);
		expect(rhs[4]).toBe(3);
	});

	it("applies base offsets correctly", () => {
		const lhs = new Int32Array(1 * TOKEN_BUFFER_STRIDE);
		const rhs = new Int32Array(1 * TOKEN_BUFFER_STRIDE);
		writeToResultBuffer(lhs, rhs, 0, 1, 0, 1, 0, 10, 20);
		expect(lhs[0]).toBe(10); // lhsPos + lhsBase
		expect(lhs[1]).toBe(11); // lhsEnd + lhsBase
		expect(lhs[2]).toBe(20); // rhsPos + rhsBase
		expect(lhs[3]).toBe(21); // rhsEnd + rhsBase
	});
});

// ── tokenRangeToString ──────────────────────────────────────────

describe("tokenRangeToString", () => {
	it("converts buffer range to string", () => {
		const text = "helloworld";
		const buf = new Uint16Array(text.length);
		for (let i = 0; i < text.length; i++) buf[i] = text.charCodeAt(i);
		// Token 0: "hello" (0..5), Token 1: "world" (5..10)
		const offsets = new Uint32Array([0, 5, 10]);
		expect(tokenRangeToString(buf, offsets, 0, 1)).toBe("hello");
		expect(tokenRangeToString(buf, offsets, 1, 2)).toBe("world");
		expect(tokenRangeToString(buf, offsets, 0, 2)).toBe("helloworld");
	});
});

// ── sliceDiffInput ──────────────────────────────────────────────

describe("sliceDiffInput", () => {
	it("creates a slice with correct tokenCount", () => {
		const input = makeDiffInput("abcdef", [0, 2, 4, 6], [1, 1, 1]);
		const sliced = sliceDiffInput(input, 1, 3);
		expect(sliced.tokenCount).toBe(2);
	});

	it("shares the same underlying buffer", () => {
		const input = makeDiffInput("abcdef", [0, 2, 4, 6], [1, 1, 1]);
		const sliced = sliceDiffInput(input, 0, 2);
		expect(sliced.buffer).toBe(input.buffer);
	});
});

// ── matchPrefixTokens / matchSuffixTokens ───────────────────────

describe("matchPrefixTokens", () => {
	it("matches identical single tokens", () => {
		const text = "abc";
		const input = makeDiffInput(text, [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const result = matchPrefixTokens(input, input, 0, 1, 0, 1);
		expect(result).toEqual([1, 1]);
	});

	it("returns null for different tokens", () => {
		const lhs = makeDiffInput("abc", [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const rhs = makeDiffInput("xyz", [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const result = matchPrefixTokens(lhs, rhs, 0, 1, 0, 1);
		expect(result).toBe(null);
	});
});

describe("matchSuffixTokens", () => {
	it("matches identical single tokens from the end", () => {
		const text = "abc";
		const input = makeDiffInput(text, [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const result = matchSuffixTokens(input, input, 0, 1, 0, 1);
		expect(result).toEqual([1, 1]);
	});

	it("returns null for different tokens from the end", () => {
		const lhs = makeDiffInput("abc", [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const rhs = makeDiffInput("xyz", [0, 3], [TOKEN_FLAGS_TYPE_TEXT]);
		const result = matchSuffixTokens(lhs, rhs, 0, 1, 0, 1);
		expect(result).toBe(null);
	});
});

// ── buildDiffInput ──────────────────────────────────────────────

describe("buildDiffInput", () => {
	it("handles empty input", () => {
		const opts = getDefaultDiffOptions();
		const data = new Int32Array(0);
		const { input, lineCount } = buildDiffInput("", data, opts);
		expect(input.tokenCount).toBe(0);
		expect(lineCount).toBe(0);
	});

	it("builds input for a single text token", () => {
		const opts = getDefaultDiffOptions();
		const text = "hello";
		const flags = TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_LINE_START;
		const data = makeTokenBuffer([{ offset: 0, length: 5, flags }]);
		const { input, lineCount } = buildDiffInput(text, data, opts);
		expect(input.tokenCount).toBe(1);
		expect(lineCount).toBe(1);
		// The text should be present in the buffer
		let decoded = "";
		for (let i = input.offsets[0]; i < input.offsets[1]; i++) {
			decoded += String.fromCharCode(input.buffer[i]);
		}
		expect(decoded).toBe("hello");
	});

	it("inserts spaces between tokens with following space (collapse mode)", () => {
		const opts = getDefaultDiffOptions();
		opts.whitespace = "collapse";
		const text = "ab";
		// Token "a" at offset 0 len 1 with following space, Token "b" at offset 1 len 1
		const flags0 = TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_HAS_FOLLOWING_SPACE;
		const flags1 = TOKEN_FLAGS_TYPE_TEXT;
		const data = makeTokenBuffer([
			{ offset: 0, length: 1, flags: flags0 },
			{ offset: 1, length: 1, flags: flags1 },
		]);
		const { input } = buildDiffInput(text, data, opts);
		// Should be "a b" = 3 chars
		expect(input.offsets[input.tokenCount]).toBe(3);
	});

	it("clears the original data buffer (fills with 0)", () => {
		const opts = getDefaultDiffOptions();
		const data = makeTokenBuffer([{ offset: 0, length: 3, flags: TOKEN_FLAGS_TYPE_TEXT }]);
		buildDiffInput("abc", data, opts);
		// data should be zeroed
		for (let i = 0; i < data.length; i++) {
			expect(data[i]).toBe(0);
		}
	});
});

// ── buildDiffScoreSystem ────────────────────────────────────────

describe("buildDiffScoreSystem", () => {
	it("returns an object with all required fields", () => {
		const system = buildDiffScoreSystem();
		expect(system).toHaveProperty("freqPairGradeLUT");
		expect(system).toHaveProperty("freqStride");
		expect(system).toHaveProperty("lenToGrade");
		expect(system).toHaveProperty("coreScoreTable");
		expect(system).toHaveProperty("maxCoreScore");
		expect(system).toHaveProperty("policyTable");
		expect(system).toHaveProperty("positionalMultipliers");
		expect(system).toHaveProperty("maxBonusMultiplier");
	});

	it("unique (1:1) frequency pair gets grade 0", () => {
		const system = buildDiffScoreSystem();
		const grade = system.freqPairGradeLUT[1 * system.freqStride + 1];
		expect(grade).toBe(0);
	});

	it("higher frequency pairs get higher grades", () => {
		const system = buildDiffScoreSystem();
		const grade_1_1 = system.freqPairGradeLUT[1 * system.freqStride + 1];
		const grade_5_5 = system.freqPairGradeLUT[5 * system.freqStride + 5];
		expect(grade_5_5).toBeGreaterThan(grade_1_1);
	});

	it("lenToGrade assigns grade 0 to length 0 and 1", () => {
		const system = buildDiffScoreSystem();
		expect(system.lenToGrade[0]).toBe(0);
		expect(system.lenToGrade[1]).toBe(0);
	});

	it("lenToGrade increases with length", () => {
		const system = buildDiffScoreSystem();
		expect(system.lenToGrade[2]).toBeGreaterThanOrEqual(system.lenToGrade[1]);
		expect(system.lenToGrade[64]).toBeGreaterThan(system.lenToGrade[2]);
	});

	it("coreScoreTable has maxCoreScore at best grade combination", () => {
		const system = buildDiffScoreSystem();
		// Grade 0 freq × highest len grade should be maxCoreScore
		const bestIdx = system.freqRowBase[0] + system.lenGradeCount - 1;
		expect(system.coreScoreTable[bestIdx]).toBe(system.maxCoreScore);
	});

	it("respects custom options", () => {
		const system = buildDiffScoreSystem({ coreMaxScore: 100 });
		expect(system.maxCoreScore).toBe(100);
	});
});
