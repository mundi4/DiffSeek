import { describe, it, expect, beforeAll } from "vitest";
import { TOKEN_BUFFER_STRIDE } from "../src/constants";

// jsdom에 scheduler.yield()가 없으므로 polyfill
beforeAll(() => {
    const scheduler = (globalThis as any).scheduler;
    if (typeof scheduler?.yield !== "function") {
        (globalThis as any).scheduler = {
            ...scheduler,
            yield: () => Promise.resolve(),
        };
    }
});

import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED } from "../src/diff/types";
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
        containers: [{ el, firstTokenIndex: 0, lastTokenIndex: tokens.length - 1 }],
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

/** Create a standard 2-token setup for one side */
function makeEditorWithTokens(flags: number) {
    const el = document.createElement("div");
    el.innerHTML = "<span>a</span><span>b</span>";
    const tokens = [
        makeToken(0, flags | TOKEN_FLAGS_LINE_START, el.childNodes[0]!),
        makeToken(1, flags, el.childNodes[1]!),
    ];
    return { el, tokens, snapshot: makeSnapshot(tokens, el), editor: makeMockEditor(tokens, el) };
}

async function runProcessDiffElements(
    left: ReturnType<typeof makeEditorWithTokens>,
    right: ReturnType<typeof makeEditorWithTokens>,
    leftResultEntries: Array<{ tokenStart: number; tokenEnd: number; leftStart: number; leftEnd: number; rightStart: number; rightEnd: number; type: number }>,
    rightResultEntries: Array<{ tokenStart: number; tokenEnd: number; leftStart: number; leftEnd: number; rightStart: number; rightEnd: number; type: number }>,
) {
    const leftResultBuffer = makeResultBuffer(left.tokens.length, leftResultEntries);
    const rightResultBuffer = makeResultBuffer(right.tokens.length, rightResultEntries);

    const result: DiffWorkerResult = { leftResultBuffer, rightResultBuffer, elapsedTime: 0 };
    const markerElements: MarkerElementsMap = new Map();

    return processDiffElements({
        leftEditor: left.editor,
        rightEditor: right.editor,
        leftTokenSnapshot: left.snapshot,
        rightTokenSnapshot: right.snapshot,
        diffOptions: getDefaultDiffOptions(),
        result,
        markerElements,
        prevMarkerElements: null,
    });
}

/** Assert fundamental DiffEntry invariants */
function assertDiffEntryInvariants(
    diff: { leftRange: Range; rightRange: Range; leftMarkerEl: HTMLElement | null; rightMarkerEl: HTMLElement | null },
    leftEl: HTMLElement,
    rightEl: HTMLElement,
) {
    // leftRange must reference left editor DOM
    expect(
        leftEl.contains(diff.leftRange.startContainer) || diff.leftRange.startContainer === leftEl,
        "leftRange.startContainer should be in left editor DOM"
    ).toBe(true);

    // rightRange must reference right editor DOM
    expect(
        rightEl.contains(diff.rightRange.startContainer) || diff.rightRange.startContainer === rightEl,
        "rightRange.startContainer should be in right editor DOM"
    ).toBe(true);

    // markerEl exclusivity: at most one side has a marker
    expect(
        diff.leftMarkerEl !== null && diff.rightMarkerEl !== null,
        "leftMarkerEl and rightMarkerEl should not both be non-null"
    ).toBe(false);
}

// ── tests ────────────────────────────────────────────────────────

describe("processDiffElements handleDiff branch coverage", () => {

    // ─── Branch: leftStructuralOnly (기존 버그 회귀 테스트) ───

    it("leftStructuralOnly: assigns marker/range to left side", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_STRUCTURAL);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);

        const entry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.rightMarkerEl).toBeNull();
        expect(diff.leftSpan).toEqual({ start: 0, end: 2 });
        expect(diff.rightSpan).toEqual({ start: 0, end: 2 });
    });

    // ─── Branch: rightStructuralOnly (대칭 케이스) ───

    it("rightStructuralOnly: assigns marker/range to right side", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_STRUCTURAL);

        const entry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftMarkerEl).toBeNull();
    });

    // ─── Branch: 양쪽 structural-only → skip (DiffEntry 생성 안 함) ───

    it("both structural-only: no DiffEntry created", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_STRUCTURAL);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_STRUCTURAL);

        const entry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(0);
    });

    // ─── Branch: leftCount === 0 (순수 ADDED) ───

    it("leftCount=0 (pure ADDED): leftRange in left editor, rightRange in right editor", async () => {
        const leftEl = document.createElement("div");
        leftEl.innerHTML = "<span>prev</span>";
        const leftTokens = [
            makeToken(0, TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_LINE_START, leftEl.childNodes[0]!),
        ];
        const left = {
            el: leftEl, tokens: leftTokens,
            snapshot: makeSnapshot(leftTokens, leftEl),
            editor: makeMockEditor(leftTokens, leftEl),
        };

        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);

        // Left has 1 UNCHANGED token, then right has tokens [1,2) as ADDED (gap detection)
        // Left result: token 0 is UNCHANGED [0,1) ↔ [0,1)
        const leftEntry = { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED };
        const rightEntry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED };

        // After UNCHANGED [0,1)↔[0,1), right has tokens [1,2) unaccounted → ADDED via gap detection
        // To trigger this: right has 2 tokens but left result only maps right[0,1)
        const ctx = await runProcessDiffElements(left, right, [leftEntry], [rightEntry]);

        // Should have 1 diff for the ADDED right[1,2)
        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan).toEqual({ start: 1, end: 1 }); // empty left side
        expect(diff.rightSpan).toEqual({ start: 1, end: 2 }); // right token added
    });

    // ─── Branch: rightCount === 0 (순수 REMOVED) ───

    it("rightCount=0 (pure REMOVED): ranges reference correct editors", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);

        const rightEl = document.createElement("div");
        const rightTokens: Token[] = [];
        const right = {
            el: rightEl, tokens: rightTokens,
            snapshot: makeSnapshot(rightTokens, rightEl),
            editor: makeMockEditor(rightTokens, rightEl),
        };

        // All left tokens are REMOVED: left[0,2) ↔ right[0,0)
        const leftEntry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 0, type: DIFF_TYPE_REMOVED };
        const ctx = await runProcessDiffElements(left, right, [leftEntry], []);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan).toEqual({ start: 0, end: 2 });
        expect(diff.rightSpan).toEqual({ start: 0, end: 0 });
    });

    // ─── Branch: 양쪽 content (MODIFIED) → 표준 range pair ───

    it("both sides have content (MODIFIED): both ranges from correct editors, no markers", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);

        const entry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];

        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftMarkerEl).toBeNull();
        expect(diff.rightMarkerEl).toBeNull();
    });

    // ─── Boundary: emptyStart === 0 fallback ───

    it("emptyStart=0: does not underflow when emptyEl is null", async () => {
        const leftEl = document.createElement("div");
        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<span>a</span>";

        const leftTokens: Token[] = [];
        const rightTokens = [
            makeToken(0, TOKEN_FLAGS_TYPE_TEXT | TOKEN_FLAGS_LINE_START, rightEl.childNodes[0]!),
        ];

        const left = {
            el: leftEl, tokens: leftTokens,
            snapshot: makeSnapshot(leftTokens, leftEl),
            editor: makeMockEditor(leftTokens, leftEl),
        };
        const right = {
            el: rightEl, tokens: rightTokens,
            snapshot: makeSnapshot(rightTokens, rightEl),
            editor: makeMockEditor(rightTokens, rightEl),
        };

        const leftResultBuffer = new Int32Array(0);
        const rightResultBuffer = makeResultBuffer(1, [{
            tokenStart: 0, tokenEnd: 1,
            leftStart: 0, leftEnd: 0,
            rightStart: 0, rightEnd: 1,
            type: DIFF_TYPE_MODIFIED,
        }]);

        const result: DiffWorkerResult = { leftResultBuffer, rightResultBuffer, elapsedTime: 0 };
        const markerElements: MarkerElementsMap = new Map();

        const ctx = await processDiffElements({
            leftEditor: left.editor,
            rightEditor: right.editor,
            leftTokenSnapshot: left.snapshot,
            rightTokenSnapshot: right.snapshot,
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

    // ─── UNCHANGED tokens → no DiffEntry, only anchors ───

    it("all UNCHANGED: no DiffEntry created", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT);

        const entry = { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_UNCHANGED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(0);
    });
});
