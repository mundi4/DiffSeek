/**
 * alignAnchors의 delta 계산 및 패딩 적용 테스트.
 *
 * 핵심 불변식:
 *   delta = leftEl.gBCR.y − rightEl.gBCR.y  (raw, 보정 없음)
 *   → delta > 0이면 rightEl에 |delta| 패딩, delta < 0이면 leftEl에 |delta| 패딩.
 *
 * jsdom에서는 gBCR이 항상 0을 반환하므로, 각 요소에 mock gBCR.y를 주입하여 테스트.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { alignAnchors } from "../src/engine/align-anchors";
import { ANCHOR_TAG_NAME } from "../src/constants";
import type { AnchorPair, MarkerElementsMap } from "../src/engine/types";
import type { Editor } from "../src/editor/editor";

// ── requestAnimationFrame mock ──
// jsdom에 rAF가 없을 수 있으므로 즉시 실행으로 대체
beforeEach(() => {
	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		cb(performance.now());
		return 0;
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── helpers ──────────────────────────────────────────────────────

function mockGBCR(el: HTMLElement, y: number) {
	el.getBoundingClientRect = () => ({
		x: 0,
		y,
		width: 100,
		height: 20,
		top: y,
		left: 0,
		right: 100,
		bottom: y + 20,
		toJSON() {},
	});
}

/**
 * 최소한의 Editor mock.
 * alignAnchors가 접근하는 속성만 구현.
 */
function createMockEditor(editorTopY: number): Editor {
	const root = document.createElement("div");
	mockGBCR(root, editorTopY);
	Object.defineProperty(root, "scrollTop", { value: 0, writable: true });
	Object.defineProperty(root, "clientHeight", { value: 800, writable: true });

	const content = document.createElement("div");
	Object.defineProperty(content, "offsetHeight", { value: 600, writable: true });

	const heightBoost = document.createElement("div");

	return {
		rootElement: root,
		contentElement: content,
		heightBoostElement: heightBoost,
		restoreScrollPosition: vi.fn(),
	} as unknown as Editor;
}

function createAnchorPair(
	leftEl: HTMLElement,
	rightEl: HTMLElement,
	delta: number,
	markerElements: MarkerElementsMap,
	index = 0,
): AnchorPair {
	markerElements.set(leftEl, { adjust: delta < 0 ? -delta : 0 });
	markerElements.set(rightEl, { adjust: delta > 0 ? delta : 0 });
	return {
		index,
		leftEl,
		rightEl,
		diffIndex: null,
		leftContainerIndex: 0,
		rightContainerIndex: 0,
		delta,
	};
}

function makeBorrowedBlock(tag = "td"): HTMLElement {
	return document.createElement(tag);
}

function makeDsAnchor(): HTMLElement {
	return document.createElement(ANCHOR_TAG_NAME);
}

// ══════════════════════════════════════════════════════════════════

describe("alignAnchors — delta 계산", () => {
	it("첫 정렬: left가 높으면 left에 패딩 적용", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 130);

		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		const controller = new AbortController();

		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// delta < 0 → left에 30px 패딩
		expect(pair.delta).toBe(-30);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("30px");
		expect(leftEl.classList.contains("ds-padded")).toBe(true);
		expect(rightEl.classList.contains("ds-padded")).toBe(false);
	});

	it("첫 정렬: right가 높으면 right에 패딩 적용", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 150);
		mockGBCR(rightEl, 100);

		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		const controller = new AbortController();

		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		expect(pair.delta).toBe(50);
		expect(rightEl.style.getPropertyValue("--ds-adjust")).toBe("50px");
		expect(rightEl.classList.contains("ds-padded")).toBe(true);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
	});

	it("위치 변화 없으면 기존 delta 유지 (재조정 안 함)", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 120);

		// 기존 delta = -20 (left에 20px 패딩)
		const pair = createAnchorPair(leftEl, rightEl, -20, markerElements);
		const controller = new AbortController();

		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// delta 변화 없음 → skip
		expect(pair.delta).toBe(-20);
	});
});

// ══════════════════════════════════════════════════════════════════

describe("alignAnchors — borrowed block + DS-ANCHOR 혼합", () => {
	it("borrowed td에 기존 패딩 없고, DS-ANCHOR에 패딩 있을 때: DS-ANCHOR 쪽 패딩 유지", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		// left = borrowed <td>, right = DS-ANCHOR
		// 기존 상태: right에 30px 패딩 (pair.delta = 30)
		const leftEl = makeBorrowedBlock("td");
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 200);
		mockGBCR(rightEl, 180);

		const pair = createAnchorPair(leftEl, rightEl, 30, markerElements);

		// 기존 CSS 상태 반영
		rightEl.style.setProperty("--ds-adjust", "30px");
		rightEl.classList.add("ds-padded");

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// delta = 200 - 180 = 20 → right에 20px (기존 30 → 20으로 감소)
		expect(pair.delta).toBe(20);
		expect(rightEl.style.getPropertyValue("--ds-adjust")).toBe("20px");
		expect(rightEl.classList.contains("ds-padded")).toBe(true);
		// borrowed td에는 패딩이 붙으면 안 됨
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
	});

	it("주변 요소 이동으로 borrowed 쪽이 내려가도 패딩이 같은 쪽(DS-ANCHOR)에 유지됨", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		// 기존: rightEl(DS-ANCHOR)에 30px 패딩
		const leftEl = makeBorrowedBlock("td");
		const rightEl = makeDsAnchor();

		// 주변 요소가 이동하여 left가 5px 아래로 내려감
		mockGBCR(leftEl, 195); // was 200, now 195 (다른 요소가 줄어듦)
		mockGBCR(rightEl, 170);

		const pair = createAnchorPair(leftEl, rightEl, 30, markerElements);
		rightEl.style.setProperty("--ds-adjust", "30px");
		rightEl.classList.add("ds-padded");

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// delta = 195 - 170 = 25 → right에 25px
		expect(pair.delta).toBe(25);
		expect(rightEl.classList.contains("ds-padded")).toBe(true);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
	});

	it("[회귀] 보정이 있었다면 delta 부호가 뒤집혀 borrowed 쪽에 패딩이 붙는 케이스", async () => {
		// 이 테스트는 기존 버그를 재현:
		// 보정 코드(rightY += pair.delta)가 있으면 rightY가 부풀려져
		// delta 부호가 뒤집히고 borrowed 쪽에 패딩이 발생함.
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeBorrowedBlock("td");
		const rightEl = makeDsAnchor();
		// 기존: right에 30px 패딩 (pair.delta = 30)
		// 현재 gBCR: left=195, right=170
		// 보정 있을 때: rightY = 170+30=200, delta = 195-200 = -5 → LEFT에 패딩! (버그)
		// 보정 없을 때: delta = 195-170 = 25 → RIGHT에 패딩 (정상)
		mockGBCR(leftEl, 195);
		mockGBCR(rightEl, 170);

		const pair = createAnchorPair(leftEl, rightEl, 30, markerElements);
		rightEl.style.setProperty("--ds-adjust", "30px");
		rightEl.classList.add("ds-padded");

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// 정상: delta > 0 → right에 패딩. borrowed td에는 패딩 없어야 함.
		expect(pair.delta).toBeGreaterThan(0);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("");
	});

	it("[회귀] DS-ANCHOR에 기존 패딩이 있을 때 steady state에서 불필요한 재조정 없음", async () => {
		// 보정 코드가 있으면 steady state에서도 deltadelta ≠ 0이 되어
		// 패딩이 제거되는 버그 발생.
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		// 기존 delta = -20 (left에 20px 패딩)
		// gBCR 차이도 정확히 -20 → 변경 불필요
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 120);

		const pair = createAnchorPair(leftEl, rightEl, -20, markerElements);
		leftEl.style.setProperty("--ds-adjust", "20px");
		leftEl.classList.add("ds-padded");

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// deltadelta = 0 → skip (재조정 안 함)
		expect(pair.delta).toBe(-20);
		expect(leftEl.classList.contains("ds-padded")).toBe(true);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("20px");
	});
});

describe("alignAnchors — 패딩 방향 전환", () => {
	it("위치 역전 시 패딩이 반대쪽으로 전환됨", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeBorrowedBlock("div");
		// 기존: left에 20px 패딩 (delta = -20)
		// 이제 위치가 역전: left가 더 아래
		mockGBCR(leftEl, 150);
		mockGBCR(rightEl, 100);

		const pair = createAnchorPair(leftEl, rightEl, -20, markerElements);
		leftEl.style.setProperty("--ds-adjust", "20px");
		leftEl.classList.add("ds-padded");

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// delta = 150-100 = 50 → right에 패딩, left 패딩 제거
		expect(pair.delta).toBe(50);
		expect(rightEl.classList.contains("ds-padded")).toBe(true);
		expect(rightEl.style.getPropertyValue("--ds-adjust")).toBe("50px");
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("");
	});
});
