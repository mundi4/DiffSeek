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

    // ─── beforebegin: 이전 run 잔여 마커 건너뛰기 ───

    it("beforebegin: skips leftover anchor+diff chain and reuses old diff marker", () => {
        // 두 번째 run 시나리오: <p>[old-ds-diff][ds-anchor][textNode]</p>
        // findEmptyDiffMarkerPosition이 {which: textNode, where: "beforebegin"} 반환
        // → 역방향으로 ds-anchor, old-ds-diff를 건너뛰어 old-ds-diff를 재사용해야 함
        const p = document.createElement("p");
        const oldDiff = createDiffEl();
        const oldAnchor = createAnchorEl();
        const textNode = document.createTextNode("b");
        p.appendChild(oldDiff);
        p.appendChild(oldAnchor);
        p.appendChild(textNode);

        const map = createMarkerMap();
        // 둘 다 markerElements에 없음 (이전 run 잔여)
        const result = getOrCreateEmptyDiffMarker(map, textNode, "beforebegin");

        expect(result).toBe(oldDiff);
        expect(map.has(oldDiff)).toBe(true);
    });

    it("beforebegin: stops at marker already in use by current run", () => {
        // <p>[used-ds-diff][old-ds-anchor][textNode]</p>
        // used-ds-diff는 이번 run에서 이미 사용 중 → 건너뛰지 않음
        // stacking 없이는 null 반환 (이미 사용 중인 diff가 유일한 후보)
        const p = document.createElement("p");
        const usedDiff = createDiffEl();
        const oldAnchor = createAnchorEl();
        const textNode = document.createTextNode("b");
        p.appendChild(usedDiff);
        p.appendChild(oldAnchor);
        p.appendChild(textNode);

        const map = createMarkerMap();
        map.set(usedDiff, { adjust: 0 }); // 이미 사용 중

        const result = getOrCreateEmptyDiffMarker(map, textNode, "beforebegin");

        // 역방향 탐색으로 oldAnchor에서 멈추고, foundEl = usedDiff
        // usedDiff가 이미 사용 중이고 stacking 비활성 → null
        expect(result).toBeNull();
    });

    it("beforebegin: stops at non-marker node", () => {
        // <p><span/>[old-ds-diff][textNode]</p>
        const p = document.createElement("p");
        const span = document.createElement("span");
        const oldDiff = createDiffEl();
        const textNode = document.createTextNode("b");
        p.appendChild(span);
        p.appendChild(oldDiff);
        p.appendChild(textNode);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, textNode, "beforebegin");

        expect(result).toBe(oldDiff);
    });

    it("beforebegin: no leftover markers → normal behavior", () => {
        // <p>[textNode]</p> — 첫 run, 잔여 마커 없음
        const p = document.createElement("p");
        const textNode = document.createTextNode("b");
        p.appendChild(textNode);

        const map = createMarkerMap();
        const result = getOrCreateEmptyDiffMarker(map, textNode, "beforebegin");

        expect(result).not.toBeNull();
        expect(result!.nodeName).toBe(DIFF_TAG_NAME);
        expect(textNode.previousSibling).toBe(result);
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

    it("regression #111: second run preserves ds-diff before ds-anchor order", () => {
        // 시나리오: 왼쪽 <p>a</p><p>b</p>, 오른쪽 <p>b</p><p><br></p>
        // 첫 run → <p>[ds-diff][ds-anchor]b</p> (정상 순서)
        // 두 번째 run → 순서가 역전되면 안됨
        const p = document.createElement("p");
        const textNode = document.createTextNode("b");
        p.appendChild(textNode);
        const cleanup = attachToDocument(p);

        // ── 첫 run ──
        const map1 = createMarkerMap();

        // handleDiff: diff marker 생성 (beforebegin of textNode)
        const diff = getOrCreateEmptyDiffMarker(map1, textNode, "beforebegin");
        expect(diff).not.toBeNull();
        expect(diff!.nodeName).toBe(DIFF_TAG_NAME);

        // handleCommon: anchor 생성 (afterend of diff → diff를 건너뛴 위치)
        const anchor = getOrCreateAnchor(map1, diff!, "afterend");
        expect(anchor).not.toBeNull();
        expect(anchor!.nodeName).toBe(ANCHOR_TAG_NAME);

        // 첫 run 결과: <p>[ds-diff][ds-anchor]b</p>
        expect(p.childNodes[0]).toBe(diff);
        expect(p.childNodes[1]).toBe(anchor);
        expect(p.childNodes[2]).toBe(textNode);

        // ── 두 번째 run ── (markerElements 새로 시작, 이전 마커는 DOM에 잔존)
        const map2 = createMarkerMap();

        // handleDiff: diff marker 재사용 시도 (beforebegin of textNode)
        const diff2 = getOrCreateEmptyDiffMarker(map2, textNode, "beforebegin");
        expect(diff2).toBe(diff); // 기존 요소 재사용

        // handleCommon: anchor 재사용 시도 (afterend of diff)
        const anchor2 = getOrCreateAnchor(map2, diff2!, "afterend");
        expect(anchor2).toBe(anchor); // 기존 요소 재사용

        // 핵심: 순서가 유지되어야 함 (ds-diff → ds-anchor → textNode)
        expect(p.childNodes[0]).toBe(diff2);
        expect(p.childNodes[1]).toBe(anchor2);
        expect(p.childNodes[2]).toBe(textNode);

        cleanup();
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
