/**
 * End-to-end seam test: tokenize → buildDiffInput → runHistogramDiff → processDiffElements
 *
 * 기존 테스트들은 각 단계를 개별 검증했지만, 단계 간 이음매(seam)를 검증하지 않았음.
 * 이 테스트는 실제 HTML 입력부터 최종 DiffEntry[] 생성까지의 전체 흐름을 검증한다.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";
import { buildDiffInput } from "../src/diff/build-diff-input";
import { buildDiffScoreSystem } from "../src/diff/build-diff-score-system";
import { getDefaultDiffOptions } from "../src/diff/get-default-diff-options";
import { runHistogramDiff } from "../src/diff/run-histogram-diff";
import { tokenize } from "../src/tokenization/tokenize";
import { TOKEN_FLAGS_TYPE_STRUCTURAL } from "../src/tokenization/token-flags";
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

async function tokenizeHtml(html: string) {
    const el = document.createElement("div");
    el.innerHTML = html;
    const signal = new AbortController().signal;
    const result = await tokenize(el, signal);
    return { el, ...result };
}

function buildInput(wholeText: string, tokens: Token[]) {
    const data = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        data[i * TOKEN_BUFFER_STRIDE + 0] = t.textOffset;
        data[i * TOKEN_BUFFER_STRIDE + 1] = t.textLength;
        data[i * TOKEN_BUFFER_STRIDE + 2] = t.flags;
    }
    return buildDiffInput(wholeText, data, getDefaultDiffOptions());
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
            // structural 토큰 trim (실제 Editor.getTokenRange의 간소화 버전)
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
                // empty range
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

/**
 * 전체 파이프라인 실행: HTML → tokenize → diff → processDiffElements → DiffEntry[]
 */
async function runFullPipeline(leftHtml: string, rightHtml: string) {
    const leftTokenized = await tokenizeHtml(leftHtml);
    const rightTokenized = await tokenizeHtml(rightHtml);

    const { input: lhsInput } = buildInput(leftTokenized.wholeText, leftTokenized.tokens);
    const { input: rhsInput } = buildInput(rightTokenized.wholeText, rightTokenized.tokens);

    const ctx = {
        reqId: 1,
        diffOptions: getDefaultDiffOptions(),
        score: buildDiffScoreSystem(),
        signal: new AbortController().signal,
    };

    await runHistogramDiff(ctx, lhsInput, rhsInput, 0, 0);

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

// ── tests ────────────────────────────────────────────────────────

describe("diff pipeline end-to-end", () => {

    it("identical documents produce zero diffs", async () => {
        const { diffContext } = await runFullPipeline(
            "<p>hello world</p>",
            "<p>hello world</p>",
        );
        expect(diffContext.diffs.length).toBe(0);
    });

    it("simple text change produces diffs with correct side assignment", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>hello world</p>",
            "<p>hello earth</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);

        for (const diff of diffContext.diffs) {
            // DiffEntry invariant: leftRange references left DOM
            expect(
                leftEl.contains(diff.leftRange.startContainer) || diff.leftRange.startContainer === leftEl,
                "leftRange should reference left editor DOM"
            ).toBe(true);

            // DiffEntry invariant: rightRange references right DOM
            expect(
                rightEl.contains(diff.rightRange.startContainer) || diff.rightRange.startContainer === rightEl,
                "rightRange should reference right editor DOM"
            ).toBe(true);
        }
    });

    it("table with empty cells: structural tokens stay aligned, content diffs have correct sides", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td>내용A</td><td>내용B</td></tr></table>",
            "<table><tr><td></td><td></td></tr></table>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);

        for (const diff of diffContext.diffs) {
            // leftRange must be in left DOM
            expect(
                leftEl.contains(diff.leftRange.startContainer) || diff.leftRange.startContainer === leftEl,
                `diff[${diff.diffIndex}] leftRange should reference left editor DOM`
            ).toBe(true);

            // rightRange must be in right DOM
            expect(
                rightEl.contains(diff.rightRange.startContainer) || diff.rightRange.startContainer === rightEl,
                `diff[${diff.diffIndex}] rightRange should reference right editor DOM`
            ).toBe(true);

            // marker exclusivity
            expect(
                diff.leftMarkerEl !== null && diff.rightMarkerEl !== null,
                `diff[${diff.diffIndex}] should not have markers on both sides`
            ).toBe(false);
        }
    });

    it("added content on right: leftSpan is empty, rightSpan is filled", async () => {
        const { diffContext } = await runFullPipeline(
            "<p>hello</p>",
            "<p>hello world</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);

        // At least one diff should have an empty left side (pure addition)
        const addedDiffs = diffContext.diffs.filter(d =>
            d.leftSpan.start === d.leftSpan.end && d.rightSpan.end > d.rightSpan.start
        );
        expect(addedDiffs.length).toBeGreaterThan(0);
    });

    it("removed content on left: rightSpan is empty, leftSpan is filled", async () => {
        const { diffContext } = await runFullPipeline(
            "<p>hello world</p>",
            "<p>hello</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);

        // At least one diff should have an empty right side (pure removal)
        const removedDiffs = diffContext.diffs.filter(d =>
            d.rightSpan.start === d.rightSpan.end && d.leftSpan.end > d.leftSpan.start
        );
        expect(removedDiffs.length).toBeGreaterThan(0);
    });

    it("complex table: filled vs empty cells produce valid DiffEntry invariants", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td>연령</td><td>만 세</td><td></td><td>현주소</td></tr></table>",
            "<table><tr><td></td><td></td><td></td><td>현주소</td></tr></table>",
        );

        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });
});

// ── shared invariant checker ─────────────────────────────────────

function assertPipelineDiffInvariants(
    diff: { diffIndex: number; leftRange: Range; rightRange: Range; leftMarkerEl: HTMLElement | null; rightMarkerEl: HTMLElement | null; leftSpan: { start: number; end: number }; rightSpan: { start: number; end: number } },
    leftEl: HTMLElement,
    rightEl: HTMLElement,
) {
    const leftInLeft = leftEl.contains(diff.leftRange.startContainer) || diff.leftRange.startContainer === leftEl;
    const rightInRight = rightEl.contains(diff.rightRange.startContainer) || diff.rightRange.startContainer === rightEl;

    expect(leftInLeft, `diff[${diff.diffIndex}] leftRange in left DOM`).toBe(true);
    expect(rightInRight, `diff[${diff.diffIndex}] rightRange in right DOM`).toBe(true);
    expect(diff.leftMarkerEl !== null && diff.rightMarkerEl !== null, `diff[${diff.diffIndex}] both markers non-null`).toBe(false);
    expect(diff.leftSpan.end, `diff[${diff.diffIndex}] leftSpan valid`).toBeGreaterThanOrEqual(diff.leftSpan.start);
    expect(diff.rightSpan.end, `diff[${diff.diffIndex}] rightSpan valid`).toBeGreaterThanOrEqual(diff.rightSpan.start);
}

// ── pipeline edge case tests ─────────────────────────────────────

describe("diff pipeline: table structure edge cases", () => {

    it("nested tables: invariants hold", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td><table><tr><td>inner</td></tr></table></td></tr></table>",
            "<table><tr><td><table><tr><td></td></tr></table></td></tr></table>",
        );

        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("table row added: right has extra row", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td>A</td></tr></table>",
            "<table><tr><td>A</td></tr><tr><td>B</td></tr></table>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("table row removed: left has extra row", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td>A</td></tr><tr><td>B</td></tr></table>",
            "<table><tr><td>A</td></tr></table>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("reverse direction: right filled, left empty cells", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td></td><td></td></tr></table>",
            "<table><tr><td>내용A</td><td>내용B</td></tr></table>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("multiple cells: some matching, some different", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<table><tr><td>same</td><td>left</td><td>common</td></tr></table>",
            "<table><tr><td>same</td><td>right</td><td>common</td></tr></table>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });
});

describe("diff pipeline: text content edge cases", () => {

    it("whitespace-only differences", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>hello  world</p>",
            "<p>hello world</p>",
        );

        // whitespace: "collapse" mode — may or may not produce diffs
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("content added at document start", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>world</p>",
            "<p>hello world</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("content added at document end", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>hello</p>",
            "<p>hello world</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("completely different content", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>alpha beta gamma</p>",
            "<p>delta epsilon zeta</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("multiple paragraphs with mixed changes", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>first paragraph</p><p>second paragraph</p><p>third paragraph</p>",
            "<p>first paragraph</p><p>changed paragraph</p><p>third paragraph</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("Korean text with special characters", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>제1조 본 계약은 갑과 을 사이에 체결된다.</p>",
            "<p>제1조 본 계약은 갑과 병 사이에 체결된다.</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });
});

describe("diff pipeline: empty document edge cases", () => {

    it("left empty, right has content", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "",
            "<p>content</p>",
        );

        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("right empty, left has content", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>content</p>",
            "",
        );

        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });

    it("both empty: no diffs", async () => {
        const { diffContext } = await runFullPipeline("", "");
        expect(diffContext.diffs.length).toBe(0);
    });

    it("single character difference", async () => {
        const { diffContext, leftEl, rightEl } = await runFullPipeline(
            "<p>a</p>",
            "<p>b</p>",
        );

        expect(diffContext.diffs.length).toBeGreaterThan(0);
        for (const diff of diffContext.diffs) {
            assertPipelineDiffInvariants(diff, leftEl, rightEl);
        }
    });
});
