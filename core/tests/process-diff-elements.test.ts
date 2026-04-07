import { describe, it, expect, beforeAll } from "vitest";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";

// jsdom에 scheduler.yield()가 없으므로 polyfill
beforeAll(() => {
    if (typeof globalThis.scheduler === "undefined") {
        (globalThis as any).scheduler = { yield: () => Promise.resolve() };
    }
});
import { DIFF_TYPE_MODIFIED, DIFF_TYPE_UNCHANGED } from "../src/diff/types";
import { TOKEN_FLAGS_TYPE_STRUCTURAL, TOKEN_FLAGS_TYPE_TEXT, TOKEN_FLAGS_LINE_START } from "../src/tokenization/token-flags";
import { processDiffElements } from "../src/engine/process-diff-elements";
import { getDefaultDiffOptions } from "../src/diff/get-default-diff-options";
import type { Token } from "../src/tokenization";
import type { TokenSnapshot } from "../src/editor/editor";
import type { DiffWorkerResult } from "../src/diff-worker/types";
import type { MarkerElementsMap } from "../src/engine/types";

// ── helpers ──────────────────────────────────────────────────────

function makeToken(
    index: number,
    flags: number,
    el: Node,
): Token {
    return {
        index,
        flags,
        textOffset: index,
        textLength: 1,
        startNode: el,
        startOffset: 0,
        endNode: el,
        endOffset: 1,
        lineNumber: 0,
        containerIndex: 0,
    };
}

function makeSnapshot(tokens: Token[], el: HTMLElement): TokenSnapshot {
    return {
        wholeText: "x".repeat(tokens.length),
        tokens,
        lineBoundaries: [{
            startWhich: el,
            startWhere: "afterbegin",
            endWhich: el,
            endWhere: "beforeend",
            containerIndex: 0,
        }],
        sectionHeadings: [],
        containers: [{ el, firstTokenIndex: 0, lastTokenIndex: Math.max(0, tokens.length - 1) }],
        elapsedTime: 0,
    };
}

function makeResultBuffer(
    tokenCount: number,
    entries: Array<{
        tokenStart: number;
        tokenEnd: number;
        leftStart: number;
        leftEnd: number;
        rightStart: number;
        rightEnd: number;
        type: number;
    }>,
): Int32Array {
    const buf = new Int32Array(tokenCount * TOKEN_BUFFER_STRIDE);
    for (const e of entries) {
        for (let i = e.tokenStart; i < e.tokenEnd; i++) {
            const base = i * TOKEN_BUFFER_STRIDE;
            buf[base + 0] = e.leftStart;
            buf[base + 1] = e.leftEnd;
            buf[base + 2] = e.rightStart;
            buf[base + 3] = e.rightEnd;
            buf[base + 4] = e.type;
        }
    }
    return buf;
}

/** Minimal Editor mock */
function makeMockEditor(tokens: Token[], contentEl: HTMLElement) {
    return {
        contentElement: contentEl,
        tokens,
        getTokenRange(start: number, end: number) {
            const range = document.createRange();
            if (start < tokens.length) {
                range.setStart(tokens[start].startNode, tokens[start].startOffset);
            } else {
                range.setStart(contentEl, 0);
            }
            if (end > 0 && end - 1 < tokens.length) {
                range.setEnd(tokens[end - 1].endNode, tokens[end - 1].endOffset);
            } else {
                range.setEnd(contentEl, contentEl.childNodes.length);
            }
            return range;
        },
    } as any;
}

// ── tests ────────────────────────────────────────────────────────

describe("processDiffElements handleDiff leftStructuralOnly", () => {
    it("assigns marker/range to left side when left is structural-only", async () => {
        // Left: 2 structural tokens (e.g. </td><td>)
        // Right: 2 text tokens (content)
        // Diff: left structural-only vs right content → left is "empty" side
        const leftEl = document.createElement("div");
        leftEl.innerHTML = "<span>a</span><span>b</span>";
        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<span>c</span><span>d</span>";

        const leftTokens = [
            makeToken(0, TOKEN_FLAGS_TYPE_STRUCTURAL | TOKEN_FLAGS_LINE_START, leftEl.childNodes[0]!),
            makeToken(1, TOKEN_FLAGS_TYPE_STRUCTURAL, leftEl.childNodes[1]!),
        ];
        const rightTokens = [
            makeToken(0, TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_LINE_START, rightEl.childNodes[0]!),
            makeToken(1, TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[1]!),
        ];

        const leftSnapshot = makeSnapshot(leftTokens, leftEl);
        const rightSnapshot = makeSnapshot(rightTokens, rightEl);
        const leftEditor = makeMockEditor(leftTokens, leftEl);
        const rightEditor = makeMockEditor(rightTokens, rightEl);

        // Result buffer: MODIFIED, left[0,2) vs right[0,2)
        const leftResultBuffer = makeResultBuffer(2, [{
            tokenStart: 0, tokenEnd: 2,
            leftStart: 0, leftEnd: 2,
            rightStart: 0, rightEnd: 2,
            type: DIFF_TYPE_MODIFIED,
        }]);
        const rightResultBuffer = makeResultBuffer(2, [{
            tokenStart: 0, tokenEnd: 2,
            leftStart: 0, leftEnd: 2,
            rightStart: 0, rightEnd: 2,
            type: DIFF_TYPE_MODIFIED,
        }]);

        const result: DiffWorkerResult = {
            leftResultBuffer,
            rightResultBuffer,
            elapsedTime: 0,
        };

        const markerElements: MarkerElementsMap = new Map();

        const ctx = await processDiffElements({
            leftEditor,
            rightEditor,
            leftTokenSnapshot: leftSnapshot,
            rightTokenSnapshot: rightSnapshot,
            diffOptions: getDefaultDiffOptions(),
            result,
            markerElements,
            prevMarkerElements: null,
        });

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        // Left side is structural-only → treated as empty side
        // leftSpan covers the structural tokens, rightSpan covers the content
        expect(diff.leftSpan).toEqual({ start: 0, end: 2 });
        expect(diff.rightSpan).toEqual({ start: 0, end: 2 });

        // Key assertions: rightRange must reference right editor DOM, not left
        // rightMarkerEl should be null (right side is the filled side)
        expect(diff.rightMarkerEl).toBeNull();

        // rightRange should reference nodes from rightEl, not leftEl
        const rightContainer = diff.rightRange.startContainer;
        expect(rightEl.contains(rightContainer)).toBe(true);
        expect(leftEl.contains(rightContainer)).toBe(false);
    });

    it("handles emptyStart === 0 without underflow when emptyEl is null", async () => {
        // Scenario: diff at document start, left is empty (0 tokens), right has content
        // AND getDiffMarkerEl returns null (no insertion point available)
        const leftEl = document.createElement("div");
        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<span>a</span>";

        const leftTokens: Token[] = [];
        const rightTokens = [
            makeToken(0, TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_LINE_START, rightEl.childNodes[0]!),
        ];

        const leftSnapshot = makeSnapshot(leftTokens, leftEl);
        const rightSnapshot = makeSnapshot(rightTokens, rightEl);
        const leftEditor = makeMockEditor(leftTokens, leftEl);
        const rightEditor = makeMockEditor(rightTokens, rightEl);

        // Result buffer: left has 0 tokens, right has 1 token
        // The reading loop iterates 0 times (leftTokenCount=0)
        // Then the tail gap detection emits ADDED for right[0,1)
        const leftResultBuffer = new Int32Array(0);
        const rightResultBuffer = makeResultBuffer(1, [{
            tokenStart: 0, tokenEnd: 1,
            leftStart: 0, leftEnd: 0,
            rightStart: 0, rightEnd: 1,
            type: DIFF_TYPE_MODIFIED,
        }]);

        const result: DiffWorkerResult = {
            leftResultBuffer,
            rightResultBuffer,
            elapsedTime: 0,
        };

        const markerElements: MarkerElementsMap = new Map();

        // Should not throw (emptyStart === 0, tokens[-1] would underflow)
        const ctx = await processDiffElements({
            leftEditor,
            rightEditor,
            leftTokenSnapshot: leftSnapshot,
            rightTokenSnapshot: rightSnapshot,
            diffOptions: getDefaultDiffOptions(),
            result,
            markerElements,
            prevMarkerElements: null,
        });

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        // leftRange should start at leftEditor.contentElement (emptyStart=0 fallback)
        expect(diff.leftRange.startContainer).toBe(leftEl);
        expect(diff.leftRange.startOffset).toBe(0);
    });
});
