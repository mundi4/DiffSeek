import { DIFF_TAG_NAME } from "../constants";
import type { Editor } from "../editor/editor";
import type { SavedScrollRef } from "../editor/types";
import { nextAnimationFrame } from "../utils/next-animation-frame";
import type { AnchorPair, MarkerElementsMap } from "./types";

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

export async function alignAnchors({
	anchorPairs,
	leftEditor,
	rightEditor,
	markerElements,
	signal,
	scrollRestore: initialScrollRestore,
}: {
	anchorPairs: readonly AnchorPair[];
	leftEditor: Editor;
	rightEditor: Editor;
	markerElements: MarkerElementsMap;
	signal: AbortSignal;
	scrollRestore?: { saved: SavedScrollRef; editor: Editor; otherEditor: Editor };
}) {
	let scrollRestore = initialScrollRestore;
	await nextAnimationFrame(signal);

	const BATCH_SIZE = 16;
	const startTime = performance.now();
	let numFrames = 0;

	const leftEditorTop = leftEditor.rootElement.getBoundingClientRect().y;
	const rightEditorTop = rightEditor.rootElement.getBoundingClientRect().y;

	let leftScrollTop = leftEditor.rootElement.scrollTop;
	let rightScrollTop = rightEditor.rootElement.scrollTop;

	await nextAnimationFrame(signal);
	numFrames++;

	const IDLE_THRESHOLD = 10;
	let t = performance.now();

	let numAdjusted = 0;
	let numSkipped = 0;
	let adjustedAboveViewportBottom = false;

	// 단조성 방어: 이전 pair보다 앞선 Y로 측정되면 역전 → 적용 시 발산 가능.
	// run 전체에 걸쳐 단조 증가여야 함.
	let prevLeftY = Number.NEGATIVE_INFINITY;
	let prevRightY = Number.NEGATIVE_INFINITY;

	for (let batchStart = 0; batchStart < anchorPairs.length; batchStart += BATCH_SIZE) {
		const batchEnd = Math.min(batchStart + BATCH_SIZE, anchorPairs.length);
		const batchSize = batchEnd - batchStart;

		for (let j = 0; j < batchSize; j++) {
			const pair = anchorPairs[batchStart + j];

			// 측정 가능성 확인: DOM에 연결되어 있고 레이아웃에 포함되어야 함
			// (조상이 display:none이면 offsetParent === null, gBCR은 0을 반환하여
			//  잘못된 delta를 계산하고 양쪽에 발산하는 거대 패딩을 유발함)
			if (
				!pair.leftEl.isConnected ||
				pair.leftEl.offsetParent === null ||
				!pair.rightEl.isConnected ||
				pair.rightEl.offsetParent === null
			) {
				numSkipped++;
				continue;
			}

			const leftY = pair.leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
			const rightY = pair.rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;

			// 비단조 방어: 발산을 유발하는 것은 "교차 역전"뿐이다.
			// (e0e8e38의 실제 원인: pair가 left에서는 이전보다 아래인데 right에서는 위 —
			//  즉 한쪽만 역행. 이때 적용 delta가 이전 pair로 역피드백되어 프레임마다 배가됨.)
			// 반대로 "양쪽이 함께 역행"하는 경우는 표 셀/다단에서 새 열(column)이
			// 시작될 때 정상적으로 발생하는 좌표 리셋이므로 적법 → 허용하고 baseline을 갱신.
			const leftBack = leftY < prevLeftY;
			const rightBack = rightY < prevRightY;
			if (leftBack !== rightBack) {
				if (import.meta.env.DEV) {
					console.warn("[alignAnchors] cross-side non-monotonic anchor pair, skipping", {
						index: batchStart + j,
						leftY,
						rightY,
						prevLeftY,
						prevRightY,
					});
				}
				numSkipped++;
				continue;
			}
			prevLeftY = leftY;
			prevRightY = rightY;

			// delta = 패딩 적용 전 두 앵커의 Y 위치 차이.
			// gBCR.y는 ::before 패딩에 영향받지 않는 요소 top을 반환하므로
			// 별도 보정 없이 leftY - rightY가 패딩 전 위치 차이가 됨.
			const delta = Math.round(leftY - rightY);
			const deltadelta = delta - pair.delta;
			if (deltadelta < -MIN_DELTA || deltadelta > MIN_DELTA) {
				applyDeltaToPair(pair, delta, markerElements);
				// scroll anchoring 보정: 뷰포트 위 요소에 padding 적용 시
				// 브라우저가 scrollTop을 자동 조정하므로 즉시 다시 읽어야 함
				leftScrollTop = leftEditor.rootElement.scrollTop;
				rightScrollTop = rightEditor.rootElement.scrollTop;
				numAdjusted++;

				// 뷰포트 내/위 요소가 조정된 경우에만 restore 필요
				if (!adjustedAboveViewportBottom) {
					const adjustedY = delta > 0 ? rightY : leftY;
					const scrollTop = delta > 0 ? rightScrollTop : leftScrollTop;
					const viewportHeight =
						delta > 0 ? rightEditor.rootElement.clientHeight : leftEditor.rootElement.clientHeight;
					if (adjustedY < scrollTop + viewportHeight) {
						adjustedAboveViewportBottom = true;
					}
				}
			} else {
				numSkipped++;
			}
		}

		const now = performance.now();
		if (now - t > IDLE_THRESHOLD) {
			await nextAnimationFrame(signal);
			numFrames++;

			// yield 전후 scrollTop 비교로 사용자 스크롤 감지
			if (scrollRestore) {
				const newLeft = leftEditor.rootElement.scrollTop;
				const newRight = rightEditor.rootElement.scrollTop;
				const leftChanged = newLeft !== leftScrollTop;
				const rightChanged = newRight !== rightScrollTop;
				if (leftChanged || rightChanged) {
					// 사용자가 스크롤함 → restore 포기
					scrollRestore = undefined;
					adjustedAboveViewportBottom = false;
				}
			}

			if (adjustedAboveViewportBottom && scrollRestore) {
				scrollRestore.editor.restoreScrollPosition(scrollRestore.saved);
				scrollRestore.otherEditor.rootElement.scrollTop = scrollRestore.editor.rootElement.scrollTop;
				adjustedAboveViewportBottom = false;
			}
			t = performance.now();
			leftScrollTop = leftEditor.rootElement.scrollTop;
			rightScrollTop = rightEditor.rootElement.scrollTop;
		}
	}

	console.debug(
		`Adjusted ${numAdjusted} anchor pairs, skipped ${numSkipped} pairs that were within the delta threshold of ${MIN_DELTA}px`,
	);

	if (adjustedAboveViewportBottom && scrollRestore) {
		scrollRestore.editor.restoreScrollPosition(scrollRestore.saved);
		scrollRestore.otherEditor.rootElement.scrollTop = scrollRestore.editor.rootElement.scrollTop;
	}
	await nextAnimationFrame(signal);
	numFrames++;

	const leftContentHeight = leftEditor.contentElement.offsetHeight;
	const rightContentHeight = rightEditor.contentElement.offsetHeight;
	if (leftContentHeight > rightContentHeight) {
		leftEditor.heightBoostElement.style.height = `0px`;
		rightEditor.heightBoostElement.style.height = `${leftContentHeight - rightContentHeight}px`;
	} else if (rightContentHeight > leftContentHeight) {
		leftEditor.heightBoostElement.style.height = `${rightContentHeight - leftContentHeight}px`;
		rightEditor.heightBoostElement.style.height = `0px`;
	} else {
		leftEditor.heightBoostElement.style.height = `0px`;
		rightEditor.heightBoostElement.style.height = `0px`;
	}

	if (import.meta.env.DEV) {
		console.debug(
			`Aligned ${anchorPairs.length} anchor pairs in ${performance.now() - startTime}ms (${numFrames} frames)`,
		);
		diagnoseResidual(anchorPairs, leftEditor, rightEditor);
	}
}

/**
 * [DEV 진단] 정렬 패스가 끝난 뒤 각 pair를 다시 측정해 1px를 초과해 남은
 * 잔차(residual)를 보고한다. "누적"이 아니라 이산적으로 어긋난 pair를 찾기 위한 것.
 *
 * 각 offender에 대해:
 *   - residual: 정렬 후 실제 leftY-rightY (0에 가까워야 정상)
 *   - delta:    pair가 마지막으로 기록한 적용값
 *   - reason:   왜 어긋났는지 추정 (skip 여부/원인 분류)
 *   - left/right: 앵커 요소 태그 (DS-ANCHOR=별도 마커, 그 외=borrow된 블록)
 *   - pad:      실제 CSS --ds-adjust
 * 브라우저 콘솔에서 이 표를 보면 원인이 (a)skip (b)무앵커 (c)무효패딩 중 무엇인지 판별 가능.
 */
function diagnoseResidual(anchorPairs: readonly AnchorPair[], leftEditor: Editor, rightEditor: Editor) {
	const leftTop = leftEditor.rootElement.getBoundingClientRect().y;
	const rightTop = rightEditor.rootElement.getBoundingClientRect().y;
	const leftScrollTop = leftEditor.rootElement.scrollTop;
	const rightScrollTop = rightEditor.rootElement.scrollTop;

	const offenders: Record<string, unknown>[] = [];
	let prevLeftY = Number.NEGATIVE_INFINITY;
	let prevRightY = Number.NEGATIVE_INFINITY;

	for (let i = 0; i < anchorPairs.length; i++) {
		const p = anchorPairs[i];
		const measurable =
			p.leftEl.isConnected &&
			p.leftEl.offsetParent !== null &&
			p.rightEl.isConnected &&
			p.rightEl.offsetParent !== null;
		if (!measurable) {
			offenders.push({ index: i, reason: "unmeasurable(skip)", diffIndex: p.diffIndex });
			continue;
		}

		const leftY = p.leftEl.getBoundingClientRect().y + leftScrollTop - leftTop;
		const rightY = p.rightEl.getBoundingClientRect().y + rightScrollTop - rightTop;
		const residual = Math.round(leftY - rightY);

		// 실제 가드와 동일한 XOR 판정: 한쪽만 역행하는 교차 역전만 skip 대상.
		const crossInverted = leftY < prevLeftY !== rightY < prevRightY;
		if (!crossInverted) {
			prevLeftY = leftY;
			prevRightY = rightY;
		}

		if (residual < -1 || residual > 1) {
			offenders.push({
				index: i,
				residual,
				delta: p.delta,
				reason: crossInverted ? "cross-inverted(skip)" : "processed-but-off",
				diffIndex: p.diffIndex,
				left: p.leftEl.nodeName,
				right: p.rightEl.nodeName,
				leftPad: p.leftEl.style.getPropertyValue("--ds-adjust") || "-",
				rightPad: p.rightEl.style.getPropertyValue("--ds-adjust") || "-",
			});
		}
	}

	if (offenders.length) {
		console.warn(
			`[alignAnchors] ${offenders.length}/${anchorPairs.length} pair(s) still misaligned >1px after pass`,
		);
		console.table(offenders);
	}
}

function applyDeltaToPair(pair: AnchorPair, delta: number, markerElements: MarkerElementsMap) {
	let theEl: HTMLElement;
	let otherEl: HTMLElement;
	pair.delta = delta;
	if (delta > 0) {
		theEl = pair.rightEl;
		otherEl = pair.leftEl;
	} else {
		delta = -delta;
		theEl = pair.leftEl;
		otherEl = pair.rightEl;
	}
	// 반대쪽 이전 패딩 제거
	otherEl.classList.remove("ds-padded", "ds-striped");
	otherEl.style.removeProperty("--ds-adjust");
	const otherInfo = markerElements.get(otherEl);
	if (otherInfo) otherInfo.adjust = 0;

	// 적용
	theEl.style.setProperty("--ds-adjust", `${delta}px`);
	theEl.classList.add("ds-padded");
	if (theEl.nodeName !== DIFF_TAG_NAME && delta >= MIN_STRIPED_DELTA) {
		theEl.classList.add("ds-striped");
	}
	const theInfo = markerElements.get(theEl);
	if (theInfo) theInfo.adjust = delta;
}
