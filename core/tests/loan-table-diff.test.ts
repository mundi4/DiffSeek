/**
 * Plain text vs HTML table diff 테스트
 *
 * Left: "1.대출개요 개인택시" (plain text)
 * Right: <table><tr><td>1.대출개요</td><td>개인택시</td></tr></table>
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";
import { buildDiffInput } from "../src/diff/build-diff-input";
import { buildDiffScoreSystem } from "../src/diff/build-diff-score-system";
import { getDefaultDiffOptions } from "../src/diff/get-default-diff-options";
import { runHistogramDiff } from "../src/diff/run-histogram-diff";
import { DIFF_TYPE_ADDED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED } from "../src/diff/types";
import { tokenize } from "../src/tokenization/tokenize";
import { TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_TYPE_STRUCTURAL } from "../src/tokenization/token-flags";
import { processDiffElements } from "../src/engine/process-diff-elements";
import type { Token } from "../src/tokenization";
import type { TokenSnapshot } from "../src/editor/editor";
import type { MarkerElementsMap } from "../src/engine/types";

beforeAll(() => {
    if (typeof (globalThis as any).scheduler?.yield !== "function") {
        (globalThis as any).scheduler = {
            ...(globalThis as any).scheduler,
            yield: () => Promise.resolve(),
        };
    }
});

// ── helpers ──────────────────────────────────────────────────────

const PLAIN_TEXT = "1.대출개요 개인택시";
const TABLE_HTML = "<table><tr><td>1.대출개요</td><td>개인택시</td></tr></table>";

async function tokenizeHtml(html: string) {
    const el = document.createElement("div");
    el.innerHTML = html;
    const signal = new AbortController().signal;
    const result = await tokenize(el, signal);
    return { el, ...result };
}

async function makeInputFromHtml(html: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    const signal = new AbortController().signal;
    const { tokens, wholeText } = await tokenize(div, signal);

    const data = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        data[i * TOKEN_BUFFER_STRIDE + 0] = t.textOffset;
        data[i * TOKEN_BUFFER_STRIDE + 1] = t.textLength;
        data[i * TOKEN_BUFFER_STRIDE + 2] = t.flags;
    }

    return { tokens, wholeText, ...buildDiffInput(wholeText, data, getDefaultDiffOptions()).input };
}

function readType(resultBuffer: Int32Array, i: number) {
    return resultBuffer[i * TOKEN_BUFFER_STRIDE + 4]!;
}

function readRange(resultBuffer: Int32Array, i: number) {
    const base = i * TOKEN_BUFFER_STRIDE;
    return {
        selfStart: resultBuffer[base + 0]!,
        selfEnd: resultBuffer[base + 1]!,
        otherStart: resultBuffer[base + 2]!,
        otherEnd: resultBuffer[base + 3]!,
        type: resultBuffer[base + 4]!,
    };
}

function getTokenText(tokens: Token[], wholeText: string, i: number): string {
    const t = tokens[i]!;
    return wholeText.slice(t.textOffset, t.textOffset + t.textLength);
}

function makeSnapshot(tokenizeResult: Awaited<ReturnType<typeof tokenizeHtml>>): TokenSnapshot {
    return {
        wholeText: tokenizeResult.wholeText,
        tokens: tokenizeResult.tokens,
        lineBoundaries: tokenizeResult.lineBoundaries,
        sectionHeadings: tokenizeResult.sectionHeadings,
        containers: tokenizeResult.containers,
        elapsedTime: 0,
    };
}

function makeMockEditor(tokens: Token[], contentEl: HTMLElement) {
    return {
        contentElement: contentEl,
        tokens,
        getTokenRange(start: number, end: number) {
            while (start < end && (tokens[start]?.flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) start++;
            while (end > start && (tokens[end - 1]?.flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) end--;

            const range = document.createRange();
            const count = end - start;
            if (count > 0 && start < tokens.length) {
                range.setStart(tokens[start].startNode, tokens[start].startOffset);
                if (end - 1 < tokens.length) {
                    range.setEnd(tokens[end - 1].endNode, tokens[end - 1].endOffset);
                } else {
                    range.setEnd(contentEl, contentEl.childNodes.length);
                }
            } else {
                if (start > 0 && start - 1 < tokens.length) {
                    range.setStart(tokens[start - 1].endNode, tokens[start - 1].endOffset);
                } else {
                    range.setStart(contentEl, 0);
                }
                range.collapse(true);
            }
            return range;
        },
    } as any;
}

async function runFullPipeline(leftHtml: string, rightHtml: string) {
    const leftTokenized = await tokenizeHtml(leftHtml);
    const rightTokenized = await tokenizeHtml(rightHtml);

    const { input: lhsInput } = buildDiffInput(
        leftTokenized.wholeText,
        serializeTokens(leftTokenized.tokens),
        getDefaultDiffOptions(),
    );
    const { input: rhsInput } = buildDiffInput(
        rightTokenized.wholeText,
        serializeTokens(rightTokenized.tokens),
        getDefaultDiffOptions(),
    );

    await runHistogramDiff({
        reqId: 1,
        diffOptions: getDefaultDiffOptions(),
        score: buildDiffScoreSystem(),
        signal: new AbortController().signal,
    }, lhsInput, rhsInput, 0, 0);

    const leftSnapshot = makeSnapshot(leftTokenized);
    const rightSnapshot = makeSnapshot(rightTokenized);
    const leftEditor = makeMockEditor(leftTokenized.tokens, leftTokenized.el);
    const rightEditor = makeMockEditor(rightTokenized.tokens, rightTokenized.el);

    const markerElements: MarkerElementsMap = new Map();

    const diffContext = await processDiffElements({
        leftEditor,
        rightEditor,
        leftTokenSnapshot: leftSnapshot,
        rightTokenSnapshot: rightSnapshot,
        diffOptions: getDefaultDiffOptions(),
        result: {
            leftResultBuffer: lhsInput.resultBuffer,
            rightResultBuffer: rhsInput.resultBuffer,
            elapsedTime: 0,
        },
        markerElements,
        prevMarkerElements: null,
    });

    return {
        diffContext,
        leftEl: leftTokenized.el,
        rightEl: rightTokenized.el,
        leftTokens: leftTokenized.tokens,
        rightTokens: rightTokenized.tokens,
    };
}

function serializeTokens(tokens: Token[]) {
    const data = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        data[i * TOKEN_BUFFER_STRIDE + 0] = t.textOffset;
        data[i * TOKEN_BUFFER_STRIDE + 1] = t.textLength;
        data[i * TOKEN_BUFFER_STRIDE + 2] = t.flags;
    }
    return data;
}

// ── tests ────────────────────────────────────────────────────────

describe("plain text vs table: tokenization", () => {

    it("last text token in each TD has LINE_END", async () => {
        const result = await tokenizeHtml(TABLE_HTML);
        // 각 TD의 마지막 텍스트 토큰 찾기
        const textTokens = result.tokens
            .map((t, i) => ({ ...t, i }))
            .filter(t => !(t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL));

        // "대출개요" — 첫 번째 TD의 마지막 텍스트
        const token_대출개요 = textTokens.find(t =>
            result.wholeText.slice(t.textOffset, t.textOffset + t.textLength) === "대출개요"
        );
        expect(token_대출개요, "대출개요 토큰이 존재해야 함").toBeTruthy();
        expect(token_대출개요!.flags & TOKEN_FLAGS_LINE_END, "대출개요에 LINE_END 필요").toBeTruthy();

        // "개인택시" — 두 번째 TD의 마지막 텍스트
        const token_개인택시 = textTokens.find(t =>
            result.wholeText.slice(t.textOffset, t.textOffset + t.textLength) === "개인택시"
        );
        expect(token_개인택시, "개인택시 토큰이 존재해야 함").toBeTruthy();
        expect(token_개인택시!.flags & TOKEN_FLAGS_LINE_END, "개인택시에 LINE_END 필요").toBeTruthy();
    });
});

describe("plain text vs table: histogram diff", () => {

    it("shared text content is matched as UNCHANGED", async () => {
        const lhs = await makeInputFromHtml(PLAIN_TEXT);
        const rhs = await makeInputFromHtml(TABLE_HTML);

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        // 왼쪽의 텍스트 토큰 중 UNCHANGED인 것들의 텍스트를 수집
        const unchangedTexts: string[] = [];
        for (let i = 0; i < lhs.tokens.length; i++) {
            if (lhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) continue;
            if (readType(lhs.resultBuffer, i) === DIFF_TYPE_UNCHANGED) {
                unchangedTexts.push(getTokenText(lhs.tokens, lhs.wholeText, i));
            }
        }

        const joined = unchangedTexts.join("");
        // 대출개요와 개인택시 둘 다 매칭되어야 함
        expect(joined, `UNCHANGED texts: [${unchangedTexts.join(", ")}]`).toContain("대출개요");
        expect(joined, `UNCHANGED texts: [${unchangedTexts.join(", ")}]`).toContain("개인택시");
    });

    it("right-side structural tokens are not UNCHANGED (no matching structure on left)", async () => {
        const lhs = await makeInputFromHtml(PLAIN_TEXT);
        const rhs = await makeInputFromHtml(TABLE_HTML);

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        for (let i = 0; i < rhs.tokens.length; i++) {
            if (rhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) {
                const type = readType(rhs.resultBuffer, i);
                expect(type, `rhs structural token[${i}] should not be UNCHANGED`).not.toBe(DIFF_TYPE_UNCHANGED);
            }
        }
    });

    it("resultBuffer ranges are self-consistent on both sides", async () => {
        const lhs = await makeInputFromHtml(PLAIN_TEXT);
        const rhs = await makeInputFromHtml(TABLE_HTML);

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        for (let i = 0; i < lhs.tokenCount; i++) {
            const lr = readRange(lhs.resultBuffer, i);
            expect(lr.selfEnd, `lhs token[${i}] selfEnd > selfStart`).toBeGreaterThan(lr.selfStart);
            expect(i, `lhs token[${i}] >= selfStart`).toBeGreaterThanOrEqual(lr.selfStart);
            expect(i, `lhs token[${i}] < selfEnd`).toBeLessThan(lr.selfEnd);
            expect(lr.otherEnd, `lhs token[${i}] otherEnd >= otherStart`).toBeGreaterThanOrEqual(lr.otherStart);
        }
        for (let i = 0; i < rhs.tokenCount; i++) {
            const rr = readRange(rhs.resultBuffer, i);
            expect(rr.selfEnd, `rhs token[${i}] selfEnd > selfStart`).toBeGreaterThan(rr.selfStart);
            expect(i, `rhs token[${i}] >= selfStart`).toBeGreaterThanOrEqual(rr.selfStart);
            expect(i, `rhs token[${i}] < selfEnd`).toBeLessThan(rr.selfEnd);
            expect(rr.otherEnd, `rhs token[${i}] otherEnd >= otherStart`).toBeGreaterThanOrEqual(rr.otherStart);
        }
    });
});

describe("plain text vs table: full pipeline", () => {

    it("text content fully matches — structural-only diffs are filtered out", async () => {
        const { diffContext } = await runFullPipeline(PLAIN_TEXT, TABLE_HTML);
        // 텍스트가 모두 매칭되므로 구조적 토큰만의 diff는 processDiffElements에서 필터됨
        expect(diffContext.diffs.length).toBe(0);
    });

    it("DiffEntry invariants hold", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(PLAIN_TEXT, TABLE_HTML);

        for (const diff of diffContext.diffs) {
            // leftRange references left DOM
            expect(
                leftEl.contains(diff.leftRange.startContainer) || diff.leftRange.startContainer === leftEl,
                `diff[${diff.diffIndex}] leftRange in left DOM`
            ).toBe(true);

            // rightRange references right DOM
            expect(
                rightEl.contains(diff.rightRange.startContainer) || diff.rightRange.startContainer === rightEl,
                `diff[${diff.diffIndex}] rightRange in right DOM`
            ).toBe(true);

            // marker exclusivity
            expect(
                diff.leftMarkerEl !== null && diff.rightMarkerEl !== null,
                `diff[${diff.diffIndex}] both markers non-null`
            ).toBe(false);

            // span validity
            expect(diff.leftSpan.end, `diff[${diff.diffIndex}] leftSpan valid`).toBeGreaterThanOrEqual(diff.leftSpan.start);
            expect(diff.rightSpan.end, `diff[${diff.diffIndex}] rightSpan valid`).toBeGreaterThanOrEqual(diff.rightSpan.start);
        }
    });

    it("reverse direction (table left, plain text right) also fully matches", async () => {
        const { diffContext } = await runFullPipeline(TABLE_HTML, PLAIN_TEXT);
        expect(diffContext.diffs.length).toBe(0);
    });
});
