/**
 * cleanCopiedAnchorAttrs: 에디터 MutationObserver가 added node에서 마커 잔여 attr을
 * 제거하는 로직. 핵심 불변식:
 *   - 브라우저가 줄 분할 시 복사한 '컨텐츠 블록'(p/div/td 등)의 data-anchor-index는 제거.
 *   - 엔진이 직접 삽입한 DS-ANCHOR / DS-DIFF는 절대 건드리지 않음
 *     (삽입 직후 동기 설정한 index를 옵저버 콜백이 지워버리는 버그 방지).
 */
import { describe, it, expect } from "vitest";
import { cleanCopiedAnchorAttrs } from "../src/editor/editor";
import { ANCHOR_TAG_NAME, DIFF_TAG_NAME } from "../src/constants";

function padded(el: HTMLElement, index: string) {
	el.dataset.anchorIndex = index;
	el.dataset.diffIndex = "5";
	el.classList.add("ds-padded", "ds-striped");
	el.style.setProperty("--ds-adjust", "12px");
	return el;
}

describe("cleanCopiedAnchorAttrs", () => {
	it("[회귀] 엔진이 삽입한 DS-ANCHOR의 index/패딩은 건드리지 않는다", () => {
		const el = padded(document.createElement(ANCHOR_TAG_NAME), "0");
		cleanCopiedAnchorAttrs(el);
		expect(el.dataset.anchorIndex).toBe("0");
		expect(el.classList.contains("ds-padded")).toBe(true);
		expect(el.style.getPropertyValue("--ds-adjust")).toBe("12px");
	});

	it("[회귀] 엔진이 삽입한 DS-DIFF도 건드리지 않는다", () => {
		const el = padded(document.createElement(DIFF_TAG_NAME), "1");
		cleanCopiedAnchorAttrs(el);
		expect(el.dataset.anchorIndex).toBe("1");
		expect(el.classList.contains("ds-padded")).toBe(true);
	});

	it("브라우저가 복사한 컨텐츠 블록(p)의 잔여 attr은 제거한다", () => {
		const el = padded(document.createElement("p"), "3");
		cleanCopiedAnchorAttrs(el);
		expect(el.dataset.anchorIndex).toBeUndefined();
		expect(el.dataset.diffIndex).toBeUndefined();
		expect(el.classList.contains("ds-padded")).toBe(false);
		expect(el.style.getPropertyValue("--ds-adjust")).toBe("");
	});

	it("borrow 블록(td) 복사본도 제거 대상", () => {
		const el = padded(document.createElement("td"), "2");
		cleanCopiedAnchorAttrs(el);
		expect(el.dataset.anchorIndex).toBeUndefined();
		expect(el.classList.contains("ds-padded")).toBe(false);
	});

	it("data-anchor-index가 없는 노드는 그대로 둔다", () => {
		const el = document.createElement("p");
		el.classList.add("some-class");
		cleanCopiedAnchorAttrs(el);
		expect(el.classList.contains("some-class")).toBe(true);
	});

	it("텍스트 노드는 무시한다", () => {
		const text = document.createTextNode("hello");
		expect(() => cleanCopiedAnchorAttrs(text)).not.toThrow();
	});
});
