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
import { ANCHOR_TAG_NAME } from "../src/constants";
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

/** Create a setup with N tokens of given flags */
function makeEditorWithTokens(flags: number, count = 2) {
    const el = document.createElement("div");
    el.innerHTML = Array.from({ length: count }, (_, i) => `<span>${String.fromCharCode(97 + i)}</span>`).join("");
    const tokens = Array.from({ length: count }, (_, i) =>
        makeToken(i, (i === 0 ? TOKEN_FLAGS_LINE_START : 0) | flags, el.childNodes[i]!)
    );
    return { el, tokens, snapshot: makeSnapshot(tokens, el), editor: makeMockEditor(tokens, el) };
}

/** Create a setup with mixed flags per token */
function makeEditorWithMixedTokens(flagsPerToken: number[]) {
    const el = document.createElement("div");
    el.innerHTML = flagsPerToken.map((_, i) => `<span>${String.fromCharCode(97 + i)}</span>`).join("");
    const tokens = flagsPerToken.map((f, i) =>
        makeToken(i, (i === 0 ? TOKEN_FLAGS_LINE_START : 0) | f, el.childNodes[i]!)
    );
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

    it("emptyStart=0: falls back to contentElement when marker creation is blocked", async () => {
        // getDiffMarkerEl → findEmptyDiffMarkerPosition returns {leftEl, "afterbegin"}
        // for empty documents. To force getOrCreateEmptyDiffMarker to return null,
        // place an already-used anchor at afterbegin so the marker position is blocked.
        const leftEl = document.createElement("div");
        const usedAnchor = document.createElement(ANCHOR_TAG_NAME);
        leftEl.appendChild(usedAnchor); // sits at afterbegin position

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
        // Mark the anchor as already used so getOrCreateEmptyDiffMarker returns null
        markerElements.set(usedAnchor, { adjust: 0 });

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

        // emptyEl is null, emptyStart is 0 → fallback to editor root
        expect(diff.leftRange.startContainer).toBe(leftEl);
        expect(diff.leftRange.startOffset).toBe(0);
        expect(diff.leftRange.collapsed).toBe(true);
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

// ── edge case tests ──────────────────────────────────────────────

describe("processDiffElements edge cases: sequential diff groups", () => {

    it("UNCHANGED → MODIFIED → UNCHANGED produces exactly one diff", async () => {
        // 4 left tokens: [0,1) UNCHANGED, [1,3) MODIFIED, [3,4) UNCHANGED
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 4);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 4);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 3, leftStart: 1, leftEnd: 3, rightStart: 1, rightEnd: 3, type: DIFF_TYPE_MODIFIED },
            { tokenStart: 3, tokenEnd: 4, leftStart: 3, leftEnd: 4, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
        ];
        const ctx = await runProcessDiffElements(left, right, leftEntries, leftEntries);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan).toEqual({ start: 1, end: 3 });
        expect(diff.rightSpan).toEqual({ start: 1, end: 3 });
    });

    it("multiple separate diffs: MODIFIED → UNCHANGED → MODIFIED", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);

        const entries = [
            { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 2, leftEnd: 3, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 3, tokenEnd: 5, leftStart: 3, leftEnd: 5, rightStart: 3, rightEnd: 5, type: DIFF_TYPE_MODIFIED },
        ];
        const ctx = await runProcessDiffElements(left, right, entries, entries);

        expect(ctx.diffs.length).toBe(2);
        expect(ctx.diffs[0].leftSpan).toEqual({ start: 0, end: 2 });
        expect(ctx.diffs[1].leftSpan).toEqual({ start: 3, end: 5 });
        for (const diff of ctx.diffs) {
            assertDiffEntryInvariants(diff, left.el, right.el);
        }
    });

    it("REMOVED then ADDED in sequence (adjacent diff groups)", async () => {
        // left: 3 tokens. [0,1) UNCHANGED, [1,2) REMOVED, [2,3) UNCHANGED
        // right: 4 tokens. [0,1) UNCHANGED, [1,3) first two map to UNCHANGED+gap, [3,4) UNCHANGED
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 3);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 4);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 1, leftEnd: 2, rightStart: 1, rightEnd: 1, type: DIFF_TYPE_REMOVED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 3, leftStart: 1, leftEnd: 1, rightStart: 1, rightEnd: 3, type: DIFF_TYPE_ADDED },
            { tokenStart: 3, tokenEnd: 4, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        // REMOVED [1,2)↔[1,1) + gap ADDED [1,1)↔[1,3) → merged into one MODIFIED chunk
        expect(ctx.diffs.length).toBeGreaterThanOrEqual(1);
        for (const diff of ctx.diffs) {
            assertDiffEntryInvariants(diff, left.el, right.el);
        }
    });
});

describe("processDiffElements edge cases: tail gap detection", () => {

    it("ADDED tokens at document end via tail gap", async () => {
        // left: 1 token, right: 3 tokens
        // left result maps only right[0,1) as UNCHANGED
        // right[1,3) should be detected as ADDED via tail gap
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 3);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 3, leftStart: 1, leftEnd: 1, rightStart: 1, rightEnd: 3, type: DIFF_TYPE_ADDED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan.start).toBe(diff.leftSpan.end); // empty left
        expect(diff.rightSpan).toEqual({ start: 1, end: 3 }); // right tokens added
    });

    it("ADDED tokens at document start via gap before first left group", async () => {
        // left: 1 token, right: 3 tokens
        // left token maps to right[2,3), so right[0,2) is ADDED via gap
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 3);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 0, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_ADDED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 0, leftEnd: 1, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.rightSpan.end).toBeGreaterThan(diff.rightSpan.start);
    });
});

describe("processDiffElements edge cases: mixed structural + content", () => {

    it("left has structural then content, right has content only: only content part diffed", async () => {
        // left: [structural, text, text], right: [text, text]
        // diff chunk covers all tokens, but left starts with structural
        const left = makeEditorWithMixedTokens([TOKEN_FLAGS_TYPE_STRUCTURAL, TOKEN_FLAGS_TYPE_TEXT, TOKEN_FLAGS_TYPE_TEXT]);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 2);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 3, leftStart: 0, leftEnd: 3, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 3, rightStart: 0, rightEnd: 2, type: DIFF_TYPE_MODIFIED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
    });

    it("single token per side: MODIFIED creates correct DiffEntry", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);

        const entry = { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftMarkerEl).toBeNull();
        expect(diff.rightMarkerEl).toBeNull();
    });

    it("single structural token left vs single content token right", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_STRUCTURAL, 1);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);

        const entry = { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_MODIFIED };
        const ctx = await runProcessDiffElements(left, right, [entry], [entry]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        // left is structural-only → treated as empty side
        expect(diff.rightMarkerEl).toBeNull();
    });
});

describe("processDiffElements edge cases: empty documents", () => {

    it("both sides empty: no diffs", async () => {
        const leftEl = document.createElement("div");
        const rightEl = document.createElement("div");
        const left = { el: leftEl, tokens: [] as Token[], snapshot: makeSnapshot([], leftEl), editor: makeMockEditor([], leftEl) };
        const right = { el: rightEl, tokens: [] as Token[], snapshot: makeSnapshot([], rightEl), editor: makeMockEditor([], rightEl) };

        const ctx = await runProcessDiffElements(left, right, [], []);
        expect(ctx.diffs.length).toBe(0);
    });

    it("left empty, right has many tokens: all ADDED", async () => {
        const leftEl = document.createElement("div");
        const left = { el: leftEl, tokens: [] as Token[], snapshot: makeSnapshot([], leftEl), editor: makeMockEditor([], leftEl) };
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);

        const ctx = await runProcessDiffElements(left, right, [], [
            { tokenStart: 0, tokenEnd: 5, leftStart: 0, leftEnd: 0, rightStart: 0, rightEnd: 5, type: DIFF_TYPE_ADDED },
        ]);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan.start).toBe(diff.leftSpan.end);
        expect(diff.rightSpan).toEqual({ start: 0, end: 5 });
    });

    it("right empty, left has many tokens: all REMOVED", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);
        const rightEl = document.createElement("div");
        const right = { el: rightEl, tokens: [] as Token[], snapshot: makeSnapshot([], rightEl), editor: makeMockEditor([], rightEl) };

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 5, leftStart: 0, leftEnd: 5, rightStart: 0, rightEnd: 0, type: DIFF_TYPE_REMOVED },
        ];
        const ctx = await runProcessDiffElements(left, right, leftEntries, []);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan).toEqual({ start: 0, end: 5 });
        expect(diff.rightSpan.start).toBe(diff.rightSpan.end);
    });
});

describe("processDiffElements edge cases: N:M token groups", () => {

    it("asymmetric UNCHANGED: left 2 tokens ↔ right 3 tokens", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 2);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 3);

        // N:M UNCHANGED mapping: left[0,2) ↔ right[0,3)
        const leftEntries = [
            { tokenStart: 0, tokenEnd: 2, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 3, leftStart: 0, leftEnd: 2, rightStart: 0, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
        ];
        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        // UNCHANGED → no diffs
        expect(ctx.diffs.length).toBe(0);
    });

    it("asymmetric MODIFIED: left 1 token ↔ right 3 tokens", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 1);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 3);

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 3, type: DIFF_TYPE_MODIFIED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 3, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 3, type: DIFF_TYPE_MODIFIED },
        ];
        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        expect(ctx.diffs.length).toBe(1);
        const diff = ctx.diffs[0];
        assertDiffEntryInvariants(diff, left.el, right.el);
        expect(diff.leftSpan).toEqual({ start: 0, end: 1 });
        expect(diff.rightSpan).toEqual({ start: 0, end: 3 });
    });
});

describe("processDiffElements: non-adjacent empty-side merge guard", () => {

    // ─── Case A: 순수 content 토큰, 비연속 left-empty diff → 병합 안됨 ───

    it("non-adjacent left-empty diffs should NOT be merged (content tokens only)", async () => {
        // Left: 3 content tokens  [a] [b] [c]  — all in separate <span>
        // Right: 5 content tokens  [x] [a] [b] [c] [y]
        //   → [x] is ADDED (gap before first match)
        //   → [a][b][c] UNCHANGED
        //   → [y] is ADDED (tail gap)
        //
        // [c]와 [y]가 같은 텍스트 노드에 있어 findEmptyDiffMarkerPosition이 Case B로 null 반환.
        // 수정 전: [y] diff가 [x] diff에 병합됨. 수정 후: 별개 diff 2개.
        const leftEl = document.createElement("div");
        leftEl.innerHTML = "<span>a</span><span>b</span><span>c</span>";
        const leftTokens = Array.from({ length: 3 }, (_, i) =>
            makeToken(i, (i === 0 ? TOKEN_FLAGS_LINE_START : 0) | TOKEN_FLAGS_TYPE_TEXT, leftEl.childNodes[i]!)
        );
        const left = { el: leftEl, tokens: leftTokens, snapshot: makeSnapshot(leftTokens, leftEl), editor: makeMockEditor(leftTokens, leftEl) };

        // Right: 5 tokens. [3]="c"와 [4]="y"가 같은 텍스트 노드 공유 → Case B 트리거
        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<span>x</span><span>a</span><span>b</span>c y";
        // rightEl children: <span>x</span>, <span>a</span>, <span>b</span>, text("c y")
        const sharedTextNode = rightEl.childNodes[3]!; // text node "c y"
        const rightTokens: Token[] = [
            makeToken(0, TOKEN_FLAGS_LINE_START | TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[0]!),
            makeToken(1, TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[1]!),
            makeToken(2, TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[2]!),
            {
                index: 3, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 3, textLength: 1,
                startNode: sharedTextNode, startOffset: 0,
                endNode: sharedTextNode, endOffset: 1,
                lineNumber: 0, containerIndex: 0,
            },
            {
                index: 4, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 4, textLength: 1,
                startNode: sharedTextNode, startOffset: 2,
                endNode: sharedTextNode, endOffset: 3,
                lineNumber: 0, containerIndex: 0,
            },
        ];
        const right = { el: rightEl, tokens: rightTokens, snapshot: makeSnapshot(rightTokens, rightEl), editor: makeMockEditor(rightTokens, rightEl) };

        // Left result buffer: 3 tokens, all UNCHANGED
        // token 0 → left[0,1) ↔ right[1,2)  (gap: right[0,1) ADDED)
        // token 1 → left[1,2) ↔ right[2,3)
        // token 2 → left[2,3) ↔ right[3,4)  (tail gap: right[4,5) ADDED)
        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 1, rightEnd: 2, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 1, leftEnd: 2, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 0, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_ADDED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 0, leftEnd: 1, rightStart: 1, rightEnd: 2, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 1, leftEnd: 2, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 3, tokenEnd: 4, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 4, tokenEnd: 5, leftStart: 3, leftEnd: 3, rightStart: 4, rightEnd: 5, type: DIFF_TYPE_ADDED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        // 별개 diff 2개여야 함 (수정 전: 1개로 병합됨)
        expect(ctx.diffs.length).toBe(2);
        expect(ctx.diffs[0].rightSpan).toEqual({ start: 0, end: 1 });
        expect(ctx.diffs[1].rightSpan).toEqual({ start: 4, end: 5 });

        for (const diff of ctx.diffs) {
            assertDiffEntryInvariants(diff, left.el, right.el);
        }
    });

    // ─── Case B: structural 토큰 섞인 비연속 left-empty diff → 병합 안됨 ───

    it("non-adjacent left-empty diffs should NOT be merged (with structural tokens)", async () => {
        // Left: [structural] [text-a] [text-b]  — structural 다음 content 2개
        // Right: [structural] [text-x] [text-a] [text-b] [text-y]
        //   → [text-x] ADDED, [text-y] ADDED, [text-b]와 [text-y]가 같은 텍스트 노드
        const leftEl = document.createElement("div");
        leftEl.innerHTML = "<br><span>a</span><span>b</span>";
        const leftTokens: Token[] = [
            makeToken(0, TOKEN_FLAGS_LINE_START | TOKEN_FLAGS_TYPE_STRUCTURAL, leftEl.childNodes[0]!),
            makeToken(1, TOKEN_FLAGS_TYPE_TEXT, leftEl.childNodes[1]!),
            makeToken(2, TOKEN_FLAGS_TYPE_TEXT, leftEl.childNodes[2]!),
        ];
        const left = { el: leftEl, tokens: leftTokens, snapshot: makeSnapshot(leftTokens, leftEl), editor: makeMockEditor(leftTokens, leftEl) };

        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<br><span>x</span><span>a</span>b y";
        const sharedTextNode = rightEl.childNodes[3]!; // text node "b y"
        const rightTokens: Token[] = [
            makeToken(0, TOKEN_FLAGS_LINE_START | TOKEN_FLAGS_TYPE_STRUCTURAL, rightEl.childNodes[0]!),
            makeToken(1, TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[1]!),
            makeToken(2, TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[2]!),
            {
                index: 3, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 3, textLength: 1,
                startNode: sharedTextNode, startOffset: 0,
                endNode: sharedTextNode, endOffset: 1,
                lineNumber: 0, containerIndex: 0,
            },
            {
                index: 4, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 4, textLength: 1,
                startNode: sharedTextNode, startOffset: 2,
                endNode: sharedTextNode, endOffset: 3,
                lineNumber: 0, containerIndex: 0,
            },
        ];
        const right = { el: rightEl, tokens: rightTokens, snapshot: makeSnapshot(rightTokens, rightEl), editor: makeMockEditor(rightTokens, rightEl) };

        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 1, leftEnd: 2, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 1, leftEnd: 1, rightStart: 1, rightEnd: 2, type: DIFF_TYPE_ADDED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 1, leftEnd: 2, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 3, tokenEnd: 4, leftStart: 2, leftEnd: 3, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 4, tokenEnd: 5, leftStart: 3, leftEnd: 3, rightStart: 4, rightEnd: 5, type: DIFF_TYPE_ADDED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        // structural 섞여도 별개 diff 2개여야 함
        expect(ctx.diffs.length).toBe(2);

        for (const diff of ctx.diffs) {
            assertDiffEntryInvariants(diff, left.el, right.el);
        }
    });

    // ─── Case C: 진짜 연속(adjacent) left-empty diff → 기존처럼 병합 허용 ───

    it("adjacent left-empty diffs CAN still be merged", async () => {
        // Left: [text-a]
        // Right: [text-x] [text-y]  — 둘 다 같은 텍스트 노드, 연속 ADDED
        //
        // extendOrFlush가 이미 연속 ADDED를 하나의 chunk로 병합하므로
        // handleDiff는 한 번만 호출됨 → diff 1개.
        const leftEl = document.createElement("div");
        leftEl.innerHTML = "<span>a</span>";
        const leftTokens = [makeToken(0, TOKEN_FLAGS_LINE_START | TOKEN_FLAGS_TYPE_TEXT, leftEl.childNodes[0]!)];
        const left = { el: leftEl, tokens: leftTokens, snapshot: makeSnapshot(leftTokens, leftEl), editor: makeMockEditor(leftTokens, leftEl) };

        const rightEl = document.createElement("div");
        rightEl.innerHTML = "<span>a</span>x y";
        const sharedTextNode = rightEl.childNodes[1]!;
        const rightTokens: Token[] = [
            makeToken(0, TOKEN_FLAGS_LINE_START | TOKEN_FLAGS_TYPE_TEXT, rightEl.childNodes[0]!),
            {
                index: 1, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 1, textLength: 1,
                startNode: sharedTextNode, startOffset: 0,
                endNode: sharedTextNode, endOffset: 1,
                lineNumber: 0, containerIndex: 0,
            },
            {
                index: 2, flags: TOKEN_FLAGS_TYPE_TEXT,
                textOffset: 2, textLength: 1,
                startNode: sharedTextNode, startOffset: 2,
                endNode: sharedTextNode, endOffset: 3,
                lineNumber: 0, containerIndex: 0,
            },
        ];
        const right = { el: rightEl, tokens: rightTokens, snapshot: makeSnapshot(rightTokens, rightEl), editor: makeMockEditor(rightTokens, rightEl) };

        // Left: token 0 UNCHANGED left[0,1) ↔ right[0,1), tail gap right[1,3) ADDED
        const leftEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
        ];
        const rightEntries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 1, tokenEnd: 3, leftStart: 1, leftEnd: 1, rightStart: 1, rightEnd: 3, type: DIFF_TYPE_ADDED },
        ];

        const ctx = await runProcessDiffElements(left, right, leftEntries, rightEntries);

        // 연속 ADDED → extendOrFlush가 하나로 병합 → diff 1개
        expect(ctx.diffs.length).toBe(1);
        expect(ctx.diffs[0].rightSpan).toEqual({ start: 1, end: 3 });

        assertDiffEntryInvariants(ctx.diffs[0], left.el, right.el);
    });
});

describe("processDiffElements edge cases: diffIndex consistency", () => {

    it("diffIndex is sequential and matches array position", async () => {
        const left = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);
        const right = makeEditorWithTokens(TOKEN_FLAGS_TYPE_TEXT, 5);

        const entries = [
            { tokenStart: 0, tokenEnd: 1, leftStart: 0, leftEnd: 1, rightStart: 0, rightEnd: 1, type: DIFF_TYPE_MODIFIED },
            { tokenStart: 1, tokenEnd: 2, leftStart: 1, leftEnd: 2, rightStart: 1, rightEnd: 2, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 2, tokenEnd: 3, leftStart: 2, leftEnd: 3, rightStart: 2, rightEnd: 3, type: DIFF_TYPE_MODIFIED },
            { tokenStart: 3, tokenEnd: 4, leftStart: 3, leftEnd: 4, rightStart: 3, rightEnd: 4, type: DIFF_TYPE_UNCHANGED },
            { tokenStart: 4, tokenEnd: 5, leftStart: 4, leftEnd: 5, rightStart: 4, rightEnd: 5, type: DIFF_TYPE_MODIFIED },
        ];
        const ctx = await runProcessDiffElements(left, right, entries, entries);

        expect(ctx.diffs.length).toBe(3);
        for (let i = 0; i < ctx.diffs.length; i++) {
            expect(ctx.diffs[i].diffIndex).toBe(i);
        }
    });
});
