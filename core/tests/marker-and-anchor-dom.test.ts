/**
 * DOM-level unit tests for getOrCreateAnchor, getOrCreateEmptyDiffMarker, cleanupUnusedMarkers.
 *
 * 이 함수들은 DOM 상태에 따라 marker/anchor 생성 여부가 결정됨.
 * DOM 동작은 결정적이므로 mock 없이 jsdom에서 직접 테스트 가능.
 */
import { describe, it, expect } from "vitest";
import {
    getOrCreateAnchor,
    getOrCreateEmptyDiffMarker,
    cleanupUnusedMarkers,
} from "../src/engine/process-diff-elements";
import { ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../src/constants";
import type { MarkerElementsMap } from "../src/engine/types";

// ── helpers ──────────────────────────────────────────────────────

function createMarkerMap(): MarkerElementsMap {
    return new Map();
}

function createAnchorEl(): HTMLElement {
    return document.createElement(ANCHOR_TAG_NAME);
}

function createDiffEl(): HTMLElement {
    const el = document.createElement(DIFF_TAG_NAME);
    el.contentEditable = "false";
    el.innerText = "\u200B";
    return el;
}

// ══════════════════════════════════════════════════════════════════
// getOrCreateAnchor
// ══════════════════════════════════════════════════════════════════

describe("getOrCreateAnchor", () => {

    // ─── 새 앵커 생성 ───

    it("afterend: creates new anchor after target node", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        parent.appendChild(target);

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "afterend");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(ANCHOR_TAG_NAME);
        expect(target.nextSibling).toBe(result);
        expect(map.has(result!)).toBe(true);
    });

    it("beforebegin: creates new anchor before target node", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        parent.appendChild(target);

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "beforebegin");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(ANCHOR_TAG_NAME);
        expect(target.previousSibling).toBe(result);
    });

    it("afterbegin: borrows target element itself as anchor (block borrow)", () => {
        const target = document.createElement("div");

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "afterbegin");

        // block borrow: returns target itself, no DOM insertion
        expect(result).toBe(target);
        expect(map.has(target)).toBe(true);
    });

    // ─── 기존 앵커 재사용 ───

    it("reuses existing unused anchor at afterend position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const existingAnchor = createAnchorEl();
        parent.appendChild(target);
        parent.appendChild(existingAnchor); // target.nextSibling = anchor

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "afterend");

        expect(result).toBe(existingAnchor);
        expect(map.has(existingAnchor)).toBe(true);
    });

    it("reuses existing unused anchor at beforebegin position", () => {
        const parent = document.createElement("div");
        const existingAnchor = createAnchorEl();
        const target = document.createElement("span");
        parent.appendChild(existingAnchor);
        parent.appendChild(target); // target.previousSibling = anchor

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "beforebegin");

        expect(result).toBe(existingAnchor);
    });

    // ─── 이미 사용 중인 앵커 → 실패 ───

    it("returns null when existing anchor is already in use", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const existingAnchor = createAnchorEl();
        parent.appendChild(target);
        parent.appendChild(existingAnchor);

        const map = createMarkerMap();
        map.set(existingAnchor, { adjust: 0 }); // already in use

        const result = getOrCreateAnchor(map, target, "afterend");
        expect(result).toBeNull();
    });

    it("afterbegin block borrow fails when target already in map", () => {
        const target = document.createElement("div");

        const map = createMarkerMap();
        map.set(target, { adjust: 0 }); // already borrowed

        // block borrow fails, falls through to DOM insertion
        const result = getOrCreateAnchor(map, target, "afterbegin");

        // should create new anchor as firstChild
        expect(result).not.toBeNull();
        expect(result).not.toBe(target);
        expect(result!.nodeName).toBe(ANCHOR_TAG_NAME);
        expect(target.firstChild).toBe(result);
    });

    // ─── 비앵커 요소가 있는 위치 ───

    it("creates new anchor when non-anchor element exists at position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const otherEl = document.createElement("p");
        parent.appendChild(target);
        parent.appendChild(otherEl); // not an anchor

        const map = createMarkerMap();
        const result = getOrCreateAnchor(map, target, "afterend");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(ANCHOR_TAG_NAME);
        // new anchor should be between target and otherEl
        expect(target.nextSibling).toBe(result);
        expect(result!.nextSibling).toBe(otherEl);
    });
});

// ══════════════════════════════════════════════════════════════════
// getOrCreateEmptyDiffMarker
// ══════════════════════════════════════════════════════════════════

describe("getOrCreateEmptyDiffMarker", () => {

    // ─── 새 marker 생성 ───

    it("creates new diff marker when nothing exists at position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        parent.appendChild(target);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "afterend");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(DIFF_TAG_NAME);
        expect(target.nextSibling).toBe(result);
        expect(map.has(result!)).toBe(true);
    });

    it("creates marker at beforebegin position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        parent.appendChild(target);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "beforebegin");

        expect(result).not.toBeNull();
        expect(target.previousSibling).toBe(result);
    });

    it("creates marker at afterbegin position", () => {
        const target = document.createElement("div");

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "afterbegin");

        expect(result).not.toBeNull();
        expect(target.firstChild).toBe(result);
    });

    it("creates marker at beforeend position", () => {
        const target = document.createElement("div");

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "beforeend");

        expect(result).not.toBeNull();
        expect(target.lastChild).toBe(result);
    });

    // ─── 기존 diff marker 재사용 ───

    it("reuses existing unused diff marker", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const existingDiff = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(existingDiff);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "afterend");

        expect(result).toBe(existingDiff);
        expect(map.has(existingDiff)).toBe(true);
    });

    // ─── 앵커가 있는 위치에서의 동작 ───

    it("returns null when used anchor occupies the position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const anchor = createAnchorEl();
        parent.appendChild(target);
        parent.appendChild(anchor);

        const map = createMarkerMap();
        map.set(anchor, { adjust: 0 }); // anchor already in use

        const result = getOrCreateEmptyDiffMarker(map, target, "afterend");
        expect(result).toBeNull();
    });

    it("skips unused anchor and finds diff marker behind it", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const anchor = createAnchorEl();
        const diffMarker = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(anchor);
        parent.appendChild(diffMarker);

        const map = createMarkerMap();
        // anchor is NOT in map → unused, so skip it and check next sibling
        const result = getOrCreateEmptyDiffMarker(map, target, "afterend");

        expect(result).toBe(diffMarker);
    });

    // ─── 이미 사용 중인 marker: stacking ───

    it("returns null when existing marker is used and stacking disabled", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const diffMarker = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(diffMarker);

        const map = createMarkerMap();
        map.set(diffMarker, { adjust: 0 }); // already used

        const result = getOrCreateEmptyDiffMarker(map, target, "afterend", false);
        expect(result).toBeNull();
    });

    it("stacking enabled: creates new marker after used marker chain", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const usedMarker = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(usedMarker);

        const map = createMarkerMap();
        map.set(usedMarker, { adjust: 0 });

        const result = getOrCreateEmptyDiffMarker(map, target, "afterend", true);

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(DIFF_TAG_NAME);
        expect(usedMarker.nextSibling).toBe(result);
    });

    it("stacking: reuses leftover marker at end of chain", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const usedMarker = createDiffEl();
        const leftoverMarker = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(usedMarker);
        parent.appendChild(leftoverMarker);

        const map = createMarkerMap();
        map.set(usedMarker, { adjust: 0 });
        // leftoverMarker NOT in map → can be reused

        const result = getOrCreateEmptyDiffMarker(map, target, "afterend", true);

        expect(result).toBe(leftoverMarker);
    });

    it("stacking: walks past multiple used markers in chain", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const m1 = createDiffEl();
        const m2 = createDiffEl();
        const m3 = createDiffEl();
        parent.appendChild(target);
        parent.appendChild(m1);
        parent.appendChild(m2);
        parent.appendChild(m3);

        const map = createMarkerMap();
        map.set(m1, { adjust: 0 });
        map.set(m2, { adjust: 0 });
        // m3 NOT in map → reuse

        const result = getOrCreateEmptyDiffMarker(map, target, "afterend", true);
        expect(result).toBe(m3);
    });

    // ─── 비diff/비anchor 요소가 있는 위치 ───

    it("creates new marker when non-diff element exists at position", () => {
        const parent = document.createElement("div");
        const target = document.createElement("span");
        const otherEl = document.createElement("p");
        parent.appendChild(target);
        parent.appendChild(otherEl);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, target, "afterend");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(DIFF_TAG_NAME);
        // new marker should be between target and otherEl
        expect(target.nextSibling).toBe(result);
    });
});

// ══════════════════════════════════════════════════════════════════
// cleanupUnusedMarkers
// ══════════════════════════════════════════════════════════════════

describe("cleanupUnusedMarkers", () => {

    // isConnected requires nodes to be in the actual document in jsdom
    function attachToDocument(el: HTMLElement) {
        document.body.appendChild(el);
        return () => el.remove();
    }

    it("removes unused anchor elements from DOM", () => {
        const parent = document.createElement("div");
        const anchor = createAnchorEl();
        parent.appendChild(anchor);
        const cleanup = attachToDocument(parent);

        const prev: MarkerElementsMap = new Map([[anchor, { adjust: 0 }]]);
        const curr: MarkerElementsMap = new Map();

        cleanupUnusedMarkers(prev, curr);

        expect(anchor.parentNode).toBeNull();
        expect(parent.children.length).toBe(0);
        cleanup();
    });

    it("removes unused diff markers from DOM", () => {
        const parent = document.createElement("div");
        const diff = createDiffEl();
        parent.appendChild(diff);
        const cleanup = attachToDocument(parent);

        const prev: MarkerElementsMap = new Map([[diff, { adjust: 0 }]]);
        const curr: MarkerElementsMap = new Map();

        cleanupUnusedMarkers(prev, curr);

        expect(diff.parentNode).toBeNull();
        cleanup();
    });

    it("keeps markers that are reused in current map", () => {
        const parent = document.createElement("div");
        const anchor = createAnchorEl();
        parent.appendChild(anchor);
        const cleanup = attachToDocument(parent);

        const prev: MarkerElementsMap = new Map([[anchor, { adjust: 0 }]]);
        const curr: MarkerElementsMap = new Map([[anchor, { adjust: 0 }]]);

        cleanupUnusedMarkers(prev, curr);

        expect(anchor.isConnected).toBe(true);
        cleanup();
    });

    it("cleans up borrowed block element (removes classes/styles, keeps in DOM)", () => {
        const parent = document.createElement("div");
        const blockEl = document.createElement("div");
        blockEl.classList.add("ds-padded", "ds-striped");
        blockEl.style.setProperty("--ds-adjust", "10px");
        blockEl.dataset.anchorIndex = "0";
        blockEl.dataset.diffIndex = "1";
        parent.appendChild(blockEl);
        const cleanup = attachToDocument(parent);

        const prev: MarkerElementsMap = new Map([[blockEl, { adjust: 0 }]]);
        const curr: MarkerElementsMap = new Map();

        cleanupUnusedMarkers(prev, curr);

        expect(blockEl.isConnected).toBe(true);
        expect(blockEl.classList.contains("ds-padded")).toBe(false);
        expect(blockEl.classList.contains("ds-striped")).toBe(false);
        expect(blockEl.style.getPropertyValue("--ds-adjust")).toBe("");
        expect(blockEl.dataset.anchorIndex).toBeUndefined();
        expect(blockEl.dataset.diffIndex).toBeUndefined();
        cleanup();
    });

    it("skips already-disconnected elements", () => {
        const anchor = createAnchorEl();

        const prev: MarkerElementsMap = new Map([[anchor, { adjust: 0 }]]);
        const curr: MarkerElementsMap = new Map();

        expect(() => cleanupUnusedMarkers(prev, curr)).not.toThrow();
    });

    it("handles mixed: some reused, some removed, some borrowed", () => {
        const parent = document.createElement("div");
        const anchor1 = createAnchorEl();
        const anchor2 = createAnchorEl();
        const diff1 = createDiffEl();
        const blockEl = document.createElement("p");
        blockEl.classList.add("ds-padded");
        blockEl.dataset.anchorIndex = "0";

        parent.appendChild(anchor1);
        parent.appendChild(anchor2);
        parent.appendChild(diff1);
        parent.appendChild(blockEl);
        const cleanup = attachToDocument(parent);

        const prev: MarkerElementsMap = new Map([
            [anchor1, { adjust: 0 }],
            [anchor2, { adjust: 0 }],
            [diff1, { adjust: 0 }],
            [blockEl, { adjust: 0 }],
        ]);
        const curr: MarkerElementsMap = new Map([
            [anchor1, { adjust: 0 }],
        ]);

        cleanupUnusedMarkers(prev, curr);

        expect(anchor1.isConnected).toBe(true);
        expect(anchor2.parentNode).toBeNull();
        expect(diff1.parentNode).toBeNull();
        expect(blockEl.isConnected).toBe(true);
        expect(blockEl.classList.contains("ds-padded")).toBe(false);
        cleanup();
    });
});
