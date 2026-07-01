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
	// alignAnchors의 가시성 가드(isConnected + offsetParent)를 통과시키기 위해
	// jsdom에서 둘 다 truthy하게 강제. 실제 브라우저 레이아웃과 무관.
	Object.defineProperty(el, "isConnected", { value: true, configurable: true });
	Object.defineProperty(el, "offsetParent", { value: document.body, configurable: true });
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

describe("alignAnchors — 양쪽 패딩(both-padding) 방어", () => {
	it("양쪽에 ds-padded가 남아있으면 정규화하여 최대 한쪽만 패딩", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		// 불가능한 상태를 인위적으로 구성: 양쪽 모두 ds-padded
		mockGBCR(leftEl, 150);
		mockGBCR(rightEl, 100);
		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		leftEl.style.setProperty("--ds-adjust", "20px");
		leftEl.classList.add("ds-padded");
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

		// 정규화로 둘 다 제거된 뒤, 실제 위치(150 vs 100)로 right에만 재적용
		expect(pair.delta).toBe(50);
		expect(rightEl.classList.contains("ds-padded")).toBe(true);
		expect(rightEl.style.getPropertyValue("--ds-adjust")).toBe("50px");
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("");
	});

	it("양쪽 ds-padded + 위치 정렬(delta 0)이면 둘 다 제거", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		// 박스 top이 같음(정렬) → 정규화로 둘 다 제거되고 재적용 없음
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 100);
		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		leftEl.style.setProperty("--ds-adjust", "20px");
		leftEl.classList.add("ds-padded");
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

		expect(pair.delta).toBe(0);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(rightEl.classList.contains("ds-padded")).toBe(false);
		expect(leftEl.style.getPropertyValue("--ds-adjust")).toBe("");
		expect(rightEl.style.getPropertyValue("--ds-adjust")).toBe("");
	});
});

// ══════════════════════════════════════════════════════════════════

describe("alignAnchors — 방어 가드", () => {
	it("leftEl이 DOM에서 분리되어 있으면 skip (적용 안 함)", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 200);
		// left만 분리된 상태로 override
		Object.defineProperty(leftEl, "isConnected", { value: false, configurable: true });

		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// 측정 불가 → skip. delta/패딩 변화 없음.
		expect(pair.delta).toBe(0);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(rightEl.classList.contains("ds-padded")).toBe(false);
	});

	it("offsetParent이 null인 요소(display:none 조상)는 skip", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const leftEl = makeDsAnchor();
		const rightEl = makeDsAnchor();
		mockGBCR(leftEl, 100);
		mockGBCR(rightEl, 200);
		// right가 display:none 조상 아래로 숨겨진 상황
		Object.defineProperty(rightEl, "offsetParent", { value: null, configurable: true });

		const pair = createAnchorPair(leftEl, rightEl, 0, markerElements);
		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// 측정 불가 → skip.
		expect(pair.delta).toBe(0);
		expect(leftEl.classList.contains("ds-padded")).toBe(false);
		expect(rightEl.classList.contains("ds-padded")).toBe(false);
	});

	it("앵커 Y 순서가 비단조이면 해당 pair를 skip (발산 방지)", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		// pair1: left=100, right=500 (양쪽 정상)
		// pair2: left=300, right=200 → right가 pair1.right(500)보다 작음 = 역전
		// 적용하면 피드백으로 발산하므로 skip해야 함.
		const l1 = makeDsAnchor();
		const r1 = makeDsAnchor();
		mockGBCR(l1, 100);
		mockGBCR(r1, 500);
		const pair1 = createAnchorPair(l1, r1, 0, markerElements, 0);

		const l2 = makeDsAnchor();
		const r2 = makeDsAnchor();
		mockGBCR(l2, 300);
		mockGBCR(r2, 200); // right 역전
		const pair2 = createAnchorPair(l2, r2, 0, markerElements, 1);

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair1, pair2],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		// pair1은 정상 적용 (delta = 100-500 = -400)
		expect(pair1.delta).toBe(-400);
		expect(l1.classList.contains("ds-padded")).toBe(true);
		// pair2는 비단조라 skip → 패딩 없음, delta 유지
		expect(pair2.delta).toBe(0);
		expect(l2.classList.contains("ds-padded")).toBe(false);
		expect(r2.classList.contains("ds-padded")).toBe(false);
	});

	it("left-Y 역전만 있어도 skip", async () => {
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		const l1 = makeDsAnchor();
		const r1 = makeDsAnchor();
		mockGBCR(l1, 300);
		mockGBCR(r1, 100);
		const pair1 = createAnchorPair(l1, r1, 0, markerElements, 0);

		const l2 = makeDsAnchor();
		const r2 = makeDsAnchor();
		mockGBCR(l2, 200); // left 역전 (pair1.left=300보다 앞)
		mockGBCR(r2, 400);
		const pair2 = createAnchorPair(l2, r2, 0, markerElements, 1);

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair1, pair2],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		expect(pair1.delta).toBe(200); // 300-100
		expect(pair2.delta).toBe(0); // skip
		expect(l2.classList.contains("ds-padded")).toBe(false);
		expect(r2.classList.contains("ds-padded")).toBe(false);
	});

	it("[표/다단] 양쪽이 함께 역행(새 열 시작)하면 교차 역전이 아니므로 적용", async () => {
		// 표 셀/다단에서 다음 열이 시작되면 좌우 앵커 Y가 함께 위로 돌아간다.
		// 이는 발산을 유발하는 "한쪽만 역행(교차 역전)"이 아니므로 적법 → 적용되어야 함.
		// (예전 OR 가드에서는 이 적법한 앵커가 잘못 skip되었다.)
		const left = createMockEditor(0);
		const right = createMockEditor(0);
		const markerElements: MarkerElementsMap = new Map();

		// pair1: 첫 열의 아래쪽 줄
		const l1 = makeDsAnchor();
		const r1 = makeDsAnchor();
		mockGBCR(l1, 400);
		mockGBCR(r1, 500);
		const pair1 = createAnchorPair(l1, r1, 0, markerElements, 0);

		// pair2: 다음 셀/열의 첫 줄 → 양쪽 모두 Y 감소 (coordinated reset)
		const l2 = makeDsAnchor();
		const r2 = makeDsAnchor();
		mockGBCR(l2, 100);
		mockGBCR(r2, 130);
		const pair2 = createAnchorPair(l2, r2, 0, markerElements, 1);

		const controller = new AbortController();
		await alignAnchors({
			anchorPairs: [pair1, pair2],
			leftEditor: left,
			rightEditor: right,
			markerElements,
			signal: controller.signal,
		});

		expect(pair1.delta).toBe(-100); // 400-500 → left에 100px
		// 핵심: pair2도 적용되어야 함
		expect(pair2.delta).toBe(-30); // 100-130 → left에 30px
		expect(l2.classList.contains("ds-padded")).toBe(true);
	});
});
