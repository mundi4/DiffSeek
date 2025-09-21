import type { Editor } from "@/core/Editor";
import {
	ANCHOR_CLASS_NAME,
	ANCHOR_TAG_NAME,
	BLOCK_ELEMENTS,
	DEBUG,
	DIFF_CLASS_NAME,
	DIFF_TAG_NAME,
	FRAME_BUDGET_MS,
	TEXTLESS_ELEMENTS,
	VOID_ELEMENTS,
} from "./constants";
import type { EditorName } from "./types";
import { clampRange } from "@/utils/clampRange";
import { getTableCellPosition } from "@/utils/getTableCellPosition";
import { TokenFlags } from "./tokenization/TokenFlags";

export const enum AnchorFlags {
	None = 0,
	LINE_START = 1 << 0,
	BLOCK_START = 1 << 1,
	CONTAINER_START = 1 << 2,
	TABLECELL_START = 1 << 3,
	TABLEROW_START = 1 << 4, // ??
	TABLE_START = 1 << 5,
	AFTER_CONTAINER = 1 << 6,
	EMPTY_DIFF = 1 << 7,
	SECTION_HEADING = 1 << 8,
	MANUAL_ANCHOR = 1 << 9,
}

type AnchorPair = {
	index: number;
	leftEl: HTMLElement;
	rightEl: HTMLElement;
	flags: number;
	diffIndex: number | null;
	aligned: boolean;
	delta: number; // delta Y
	leftFlags: AnchorFlags;
	rightFlags: AnchorFlags;
};

export class EditorPairer {
	static readonly MIN_DELTA = 1;
	static readonly MIN_STRIPED_DELTA = 10;
	static readonly MIN_CHUNK_SIZE = 20;

	#leftEditor: Editor;
	#rightEditor: Editor;
	#diffMarkers: Set<HTMLElement> = new Set();
	#anchorPairs: AnchorPair[] = [];
	#anchorMap: Map<HTMLElement, AnchorPair> = new Map();
	#oldAnchorPairs: AnchorPair[] | null = null;
	#oldDiffMarkers: Set<HTMLElement> | null = null;
	#chunkCancellationToken: number | null = null;
	#elapsedTotal: number = 0;
	#unusedAnchors: Set<HTMLElement> = new Set();
	#leftEditorElement: HTMLElement;
	#rightEditorElement: HTMLElement;

	constructor(leftEditor: Editor, rightEditor: Editor) {
		this.#leftEditor = leftEditor;
		this.#rightEditor = rightEditor;
		this.#leftEditorElement = leftEditor.editorElement;
		this.#rightEditorElement = rightEditor.editorElement;
	}

	cancelAnchorAligning() {
		if (this.#chunkCancellationToken !== null) {
			if (import.meta.env.DEV) {
				console.debug("AnchorManager: canceling anchor aligning");
			}
			cancelAnimationFrame(this.#chunkCancellationToken);
			this.#chunkCancellationToken = null;
		}
	}

	beginUpdate() {
		this.cancelAnchorAligning();
		this.#anchorMap.clear();
		if (this.#oldAnchorPairs || this.#oldDiffMarkers) {
			this.endUpdate();
		}
		this.#oldAnchorPairs = this.#anchorPairs;
		this.#oldDiffMarkers = this.#diffMarkers;
		this.#anchorPairs = [];
		this.#diffMarkers = new Set();
	}

	endUpdate() {
		if (this.#oldAnchorPairs) {
			for (const anchorPair of this.#oldAnchorPairs) {
				const { leftEl, rightEl } = anchorPair;
				if (!this.#anchorMap.has(leftEl)) {
					if (leftEl.nodeName === ANCHOR_TAG_NAME) {
						leftEl.remove(); // remove unused anchor elements we created manually
					} else {
						leftEl.classList.remove(ANCHOR_CLASS_NAME);
						leftEl.style.removeProperty("--anchor-adjust");
						delete leftEl.dataset.anchorIndex;
						this.#unusedAnchors.add(leftEl);
					}
				}
				if (!this.#anchorMap.has(rightEl)) {
					if (rightEl.nodeName === ANCHOR_TAG_NAME) {
						rightEl.remove(); // remove unused anchor elements we created manually
					} else {
						rightEl.classList.remove(ANCHOR_CLASS_NAME);
						rightEl.style.removeProperty("--anchor-adjust");
						delete rightEl.dataset.anchorIndex;
						this.#unusedAnchors.add(rightEl);
					}
				}
			}
		}
		if (this.#oldDiffMarkers) {
			for (const marker of this.#oldDiffMarkers) {
				if (!this.#diffMarkers.has(marker)) {
					marker.remove();
				}
			}
		}
		this.#oldAnchorPairs = null;
		this.#oldDiffMarkers = null;


		if (import.meta.env.DEV) {
			// console.log("anchorPairs", this.#anchorPairs);
			// console.log("diffMarkers", this.#diffMarkers);
		}
	}

	#createDiffMarker(container: HTMLElement, offset: number, diffIndex: number): HTMLElement {
		let markerEl = container.childNodes[offset] as HTMLElement | null;
		if (markerEl) {
			if (markerEl.nodeName === DIFF_TAG_NAME) {
				if (this.#diffMarkers.has(markerEl)) {
					markerEl = null;
					offset++;
				}
			} else {
				markerEl = null;
			}
		}
		if (!markerEl) {
			markerEl = document.createElement(DIFF_TAG_NAME);
			container.insertBefore(markerEl, container.childNodes[offset] || null);
		}

		markerEl.contentEditable = "false";
		markerEl.classList.add(DIFF_CLASS_NAME);
		markerEl.dataset.diffIndex = diffIndex.toString();
		this.#diffMarkers.add(markerEl);
		return markerEl;
	}

	insertDiffMarker(_side: EditorName, range: Range, targetFlags: TokenFlags, diffIndex: number): HTMLElement | null {
		if (this.#anchorPairs.length > 0) {
		}
		let container: Node = range.startContainer;
		let offset: number = range.startOffset;
		const endContainer: Node = range.endContainer;
		let endOffset: number = range.endOffset;

		if (container.nodeType === 3) {
			offset = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
			container = container.parentNode!;
		}
		if (endContainer.nodeType === 3) {
			endOffset = Array.prototype.indexOf.call(endContainer.parentNode!.childNodes, endContainer);
		}

		const indexStack: number[] = [];
		let isTextlessContainer = TEXTLESS_ELEMENTS[(container as HTMLElement).nodeName] || false;
		while (container) {
			if (!isTextlessContainer) {
				if (
					targetFlags & (TokenFlags.TABLE_START | TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START) &&
					container.nodeName === "TD" &&
					offset === 0
				) {
					// TD 내부의 맨 앞임.
					// `targetFlags`에 따라 이 TD가 조건에 만족하는지 확인.
					if (targetFlags & TokenFlags.TABLE_START) {
						const rowcol = getTableCellPosition(container as HTMLElement);
						if (rowcol && rowcol[0] === 0 && rowcol[1] === 0) {
							// 첫 TR, 첫 TD
							return this.#createDiffMarker(container as HTMLElement, offset, diffIndex);
						}
					} else if (targetFlags & TokenFlags.TABLEROW_START) {
						const rowcol = getTableCellPosition(container as HTMLElement);
						if (rowcol && rowcol[1] === 0) {
							// 첫 TD
							return this.#createDiffMarker(container as HTMLElement, offset, diffIndex);
						}
					} else if (targetFlags & TokenFlags.TABLECELL_START) {
						return this.#createDiffMarker(container as HTMLElement, offset, diffIndex);
					}
				} else if (targetFlags & TokenFlags.LINE_START) {
					if (offset === 0) {
						if (BLOCK_ELEMENTS[container.nodeName]) {
							return this.#createDiffMarker(container as HTMLElement, offset, diffIndex);
						}
					} else {
						const prev = container.childNodes[offset - 1];
						if (prev.nodeName === "BR" || prev.nodeName === "HR" || BLOCK_ELEMENTS[prev.nodeName]) {
							return this.#createDiffMarker(container as HTMLElement, offset, diffIndex);
						}
					}
				}
			}

			if (container === endContainer && offset >= endOffset) break;

			const child = container.childNodes[offset];
			if (!child) {
				const parent = container.parentNode;
				if (!parent) break;
				isTextlessContainer = TEXTLESS_ELEMENTS[parent.nodeName] || false;
				if (indexStack.length > 0) {
					offset = indexStack.pop()!;
				} else {
					offset = Array.prototype.indexOf.call(parent.childNodes, container);
				}
				offset++;
				container = parent;
				continue;
			}

			if (child.nodeType === 1 && !VOID_ELEMENTS[child.nodeName]) {
				indexStack.push(offset);
				container = child;
				isTextlessContainer = TEXTLESS_ELEMENTS[child.nodeName] || false;
				offset = 0;
				continue;
			}

			offset++;
		}

		return null;
	}

	zzinsertDiffMarker(container: HTMLElement, offset: number) {
		let markerEl = container.childNodes[offset] as HTMLElement;
		if (markerEl && markerEl.nodeName === DIFF_TAG_NAME) {
			console.warn("Existing diff marker found at offset", offset, "in", container, markerEl);
			//throw new Error("Diff marker already exists at the specified offset");
			return null;
		} else {
		}
		const insertBefore = markerEl;
		markerEl = document.createElement(DIFF_TAG_NAME);
		markerEl.contentEditable = "false";
		container.insertBefore(markerEl, insertBefore);
		this.#diffMarkers.add(markerEl);
		return markerEl;
	}

	getAnchorInsertableRange(side: EditorName, tokenIndex: number) {
		const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
		let range = editor.getTokenRange(tokenIndex, 0);
		if (this.#anchorPairs.length > 0) {
			const prevPair = this.#anchorPairs[this.#anchorPairs.length - 1];
			const prevAnchor = side === "left" ? prevPair.leftEl : prevPair.rightEl;
			range = clampRange(range, prevAnchor, null);
		}
		return range;
	}

	ensureAnchorElement2(refElem: Element, insertMethod: "afterend" | "prepend"): HTMLElement {
		let anchorEl = insertMethod === "afterend"
			? (refElem as HTMLElement).nextElementSibling
			: (refElem as HTMLElement).firstElementChild;

		if (!anchorEl || anchorEl.nodeName !== ANCHOR_TAG_NAME || !anchorEl.classList.contains(ANCHOR_CLASS_NAME)) {
			anchorEl = document.createElement(ANCHOR_TAG_NAME);
			anchorEl.className = ANCHOR_CLASS_NAME;
			if (insertMethod === "afterend") {
				refElem.insertAdjacentElement("afterend", anchorEl);
			} else {
				refElem.insertBefore(anchorEl, refElem.firstElementChild);
			}
		}
		return anchorEl as HTMLElement;
	}

	getAnchorElement(lineBreakerEl: Element): HTMLElement | null {
		let insertMethod: "afterend" | "prepend";
		if (lineBreakerEl === this.#leftEditorElement ||
			lineBreakerEl === this.#rightEditorElement ||
			lineBreakerEl.nodeName === "TD" || lineBreakerEl.nodeName === "TH") {
			insertMethod = "prepend";
		} else if (BLOCK_ELEMENTS[lineBreakerEl.nodeName]) {
			return lineBreakerEl as HTMLElement;
		} else {
			insertMethod = "afterend";
		}

		let anchorEl: HTMLElement | null = null;
		if (insertMethod === "afterend") {
			anchorEl = lineBreakerEl.nextElementSibling as HTMLElement;
		} else {
			anchorEl = lineBreakerEl.firstElementChild as HTMLElement;
		}

		if (anchorEl && anchorEl.nodeName === ANCHOR_TAG_NAME) {
			if (this.#anchorMap.has(anchorEl)) {
				// 이미 사용 중.
				return null;
			}
		} else {
			anchorEl = document.createElement(ANCHOR_TAG_NAME);
			if (insertMethod === "afterend") {
				lineBreakerEl.insertAdjacentElement("afterend", anchorEl);
			} else {
				lineBreakerEl.insertBefore(anchorEl, lineBreakerEl.firstElementChild);
			}
		}

		return anchorEl as HTMLElement;
	}

	addAnchorPair(leftTokenIndex: number, leftEl: HTMLElement | null, rightTokenIndex: number, rightEl: HTMLElement | null, diffIndex: number | null) {
		//console.warn("EditorPairer: addAnchorPair2", leftTokenIndex, rightTokenIndex, diffIndex)

		const leftToken = this.#leftEditor.tokens[leftTokenIndex];
		const rightToken = this.#rightEditor.tokens[rightTokenIndex];

		if (!leftEl && leftToken.lineBreakerElement) {
			leftEl = this.getAnchorElement(leftToken.lineBreakerElement);
		}
		if (!rightEl && rightToken.lineBreakerElement) {
			rightEl = this.getAnchorElement(rightToken.lineBreakerElement);
		}

		if (leftEl && rightEl) {
			const anchorIndex = this.#anchorPairs.length;
			leftEl.classList.add(ANCHOR_CLASS_NAME);
			rightEl.classList.add(ANCHOR_CLASS_NAME);
			rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = anchorIndex.toString();
			if (diffIndex !== null) {
				leftEl.dataset.diffIndex = rightEl.dataset.diffIndex = diffIndex.toString();
			} else {
				delete leftEl.dataset.diffIndex;
				delete rightEl.dataset.diffIndex;
			}

			const pair: AnchorPair = {
				index: anchorIndex,
				leftEl,
				rightEl,
				diffIndex: diffIndex,
				flags: AnchorFlags.None,
				aligned: false,
				delta: 0,
				leftFlags: AnchorFlags.None,
				rightFlags: AnchorFlags.None,
			};
			this.#anchorPairs.push(pair);
			this.#anchorMap.set(leftEl, pair);
			this.#anchorMap.set(rightEl, pair);
		} else {
			console.warn("EditorPairer: addAnchorPair2 failed to create anchors");
		}
	}

	// addAnchorPair(
	// 	leftRange: Range | LightRange,
	// 	leftFlags: AnchorFlags,
	// 	leftDiffEl: HTMLElement | null,
	// 	rightRange: Range | LightRange,
	// 	rightFlags: AnchorFlags,
	// 	rightDiffEl: HTMLElement | null,
	// 	diffIndex: number | null
	// ) {
	// 	const lastPair = this.#anchorPairs[this.#anchorPairs.length - 1];
	// 	let leftEl = leftDiffEl ?? this.zzgetOrCreateAnchor(leftRange.startContainer, leftRange.startOffset, leftFlags, null); // this.#leftEditor.getAnchorTargetForToken(leftRange, leftFlags);
	// 	if (!leftEl) {
	// 		return;
	// 	} else {
	// 		const lastEl = lastPair?.leftEl;
	// 		if (lastEl && !(lastEl.compareDocumentPosition(leftEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
	// 			return;
	// 		}
	// 	}

	// 	let rightEl = rightDiffEl ?? this.zzgetOrCreateAnchor(rightRange.startContainer, rightRange.startOffset, rightFlags, null); // this.#rightEditor.getAnchorTargetForToken(rightRange, rightFlags);
	// 	if (!rightEl) {
	// 		return;
	// 	} else {
	// 		const lastEl = lastPair?.rightEl;
	// 		if (lastEl && !(lastEl.compareDocumentPosition(rightEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
	// 			return;
	// 		}
	// 	}

	// 	const pair: AnchorPair = {
	// 		index: this.#anchorPairs.length,
	// 		leftEl,
	// 		rightEl,
	// 		diffIndex,
	// 		flags: leftFlags | rightFlags,
	// 		aligned: false,
	// 		delta: 0,
	// 		leftFlags,
	// 		rightFlags,
	// 	};

	// 	leftEl.classList.add("anchor");
	// 	rightEl.classList.add("anchor");
	// 	rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = pair.index.toString();
	// 	if (diffIndex !== null) {
	// 		leftEl.dataset.diffIndex = diffIndex.toString();
	// 		rightEl.dataset.diffIndex = diffIndex.toString();
	// 	} else {
	// 		delete leftEl.dataset.diffIndex;
	// 		delete rightEl.dataset.diffIndex;
	// 	}
	// 	this.#anchorPairs.push(pair);
	// 	this.#anchorMap.set(leftEl, pair);
	// 	this.#anchorMap.set(rightEl, pair);

	// 	const leftPadding = parseInt(leftEl.style.getPropertyValue("--anchor-adjust")) || 0;
	// 	const rightPadding = parseInt(rightEl.style.getPropertyValue("--anchor-adjust")) || 0;
	// 	leftEl.style.removeProperty("--anchor-adjust");
	// 	rightEl.style.removeProperty("--anchor-adjust");

	// 	// if (leftPadding && rightPadding) {
	// 	// 	leftEl.style.removeProperty("--anchor-adjust");
	// 	// 	rightEl.style.removeProperty("--anchor-adjust");
	// 	// } else if (leftPadding) {
	// 	// 	pair.delta = -leftPadding;
	// 	// } else if (rightPadding) {
	// 	// 	pair.delta = rightPadding;
	// 	// }

	// 	// if (diffIndex !== null) {
	// 	// 	leftEl.dataset.diffIndex = diffIndex.toString();
	// 	// 	rightEl.dataset.diffIndex = diffIndex.toString();
	// 	// } else {
	// 	// 	delete leftEl.dataset.diffIndex;
	// 	// 	delete rightEl.dataset.diffIndex;
	// 	// }
	// 	return pair;
	// }

	getOrInsertAnchor(startContainer: Node, startOffset: number, endContainer: Node, endOffset: number) {
		function getChildIndex(container: Node): number {
			const parent = container.parentNode;
			if (!parent) return -1;
			const childNodes = parent.childNodes;
			for (let i = 0; i < childNodes.length; i++) {
				if (childNodes[i] === container) return i;
			}
			return -1;
		}

		let container = endContainer as HTMLElement;
		let offset = endOffset;

		if (container.nodeType === 3) {
			if (container === startContainer) {
				// if (offset === endOffset) {
				// 	if (offset === 0) {
				// 		// 텍스트노드 시작 위치에 앵커 삽입 가능.
				// 		offset = Array.prototype.indexOf.call(container.parentNode!, container);
				// 		container = container.parentNode as HTMLElement;
				// 	} else if (offset === container.nodeValu e!.length) {
				// 		// 텍스트노드 끝 위치에 앵커 삽입 가능.
				// 		offset = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
				// 		container = container.parentNode as HTMLElement;
				// 	}
				// }
				return null;
			} else {
				offset = getChildIndex(container); // Array.prototype.indexOf.call(container.parentNode!, container);
				container = container.parentNode as HTMLElement;
			}
		}

		if (startContainer.nodeType === 3) {
			startOffset = getChildIndex(startContainer);
			startContainer = startContainer.parentNode as HTMLElement;
		}

		const offsetStack: number[] = [];
		let insertContainer: HTMLElement | null = null;
		let insertBeforeMe: Node | null = null;

		offset--; // 이전 형제노드부터 줄바꿈 경계인지 아닌지 체크 시작.
		while (container) {
			if (offset < 0) {
				// 부모로 올라가기
				if (offsetStack.length > 0) {
					offset = offsetStack.pop()!; // 이미 확인한 요소이고 이미 offset-1된 값이 들어있으므로 바로 다음 루프에서 사용하면 됨.
				} else {
					// 새 부모 요소로 올라감. 이전에 만나지 못했던 요소이기 때문에 current로 넣어서 테스트 해봐야하므로 offset은 -1을 하지 않음.
					offset = getChildIndex(container);
				}
				container = container.parentNode as HTMLElement;
				continue;
			}

			const current = container.childNodes[offset--];
			const currentNodeName = current.nodeName;
			const isBlockElement = BLOCK_ELEMENTS[currentNodeName];
			if (isBlockElement && !TEXTLESS_ELEMENTS[currentNodeName] && current.contains(endContainer)) {
				// 현재 블록 요소가 endContainer를 포함하고 있으므로, 앵커를 이 블록 요소의 시작 부분에 삽입해야 함.
				insertContainer = current as HTMLElement;
				insertBeforeMe = current.firstChild;
				break;
			} else if (!TEXTLESS_ELEMENTS[container.nodeName] && (isBlockElement || currentNodeName === "BR" || currentNodeName === "HR")) {
				// 해당 요소가 끝남으로써 새 줄이 시작되는 경우
				insertContainer = container;
				insertBeforeMe = current.nextSibling;
				break;
			}

			if (container === startContainer && offset <= startOffset) {
				// 그만 찾자
				break;
			}

			if (current.nodeType === 1 && current.childNodes.length > 0 && !current.contains(endContainer)) {
				// 자식 노드로 내려가서 마찬가지로 뒤에서부터 탐색.
				offsetStack.push(offset);
				offset = current.childNodes.length - 1;
				container = current as HTMLElement;
			}
		}

		if (!insertContainer) {
			console.warn("No insert container found for", { startContainer, startOffset, endContainer, endOffset });
			return null;
		}

		let anchor: HTMLElement | null = insertBeforeMe as HTMLElement;
		if (anchor) {
			if (anchor.nodeName === ANCHOR_TAG_NAME && anchor.classList.contains(ANCHOR_CLASS_NAME)) {
				if (this.#anchorMap.has(anchor)) {
					console.warn("Anchor already exists at", { startContainer, startOffset, endContainer, endOffset });
					// 이미 이번 업데이트 싸이클에 만들어진 앵커임. 재사용 불가.
					// 이 앵커 이후 요소로 추가할 수도 있지만 무슨 의미일까 싶다.
					return null;
				}
			} else {
				anchor = null;
			}
		}
		if (!anchor) {
			anchor = document.createElement(ANCHOR_TAG_NAME);
			anchor.classList.add(ANCHOR_CLASS_NAME);
			insertContainer.insertBefore(anchor, insertBeforeMe);
		}

		return anchor;
	}

	#processChunk(startIndex: number, onDone: () => void, deadline: number) {
		const startTime = performance.now();
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		leftEditor.forceReflow();
		rightEditor.forceReflow();

		let leftScrollTop = leftEditor.scrollTop;
		let rightScrollTop = rightEditor.scrollTop;
		let leftEditorTop = leftEditor.getBoundingClientRect().y;
		let rightEditorTop = rightEditor.getBoundingClientRect().y;

		let i = startIndex;
		const pairs = this.#anchorPairs;
		let count = 0;

		while (i < pairs.length) {
			const pair = pairs[i];
			const { leftEl, rightEl } = pair;
			// 낙관적으로 --anchor-adjust 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기
			let leftY;
			let rightY;
			leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
			rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
			let delta = Math.round(leftY - rightY);
			// console.log("chunk", i, "pair", { ...pair }, leftY, "rightY", rightY, "delta", delta);

			// if (Math.abs(delta) > 1000) {
			// 	console.warn("AnchorManager.processChunk: large delta detected", { pair, leftY, rightY, delta, leftScrollTop, rightScrollTop });
			// }

			// delta가 significant함
			if (delta < -EditorPairer.MIN_DELTA || delta > EditorPairer.MIN_DELTA) {
				// 패딩이 이미 적용되어 있다면 초기화
				// pair의 delta값은 항상 앵커의 --anchor-adjust 값과 같게 유지된다고 가정함. 다른 부분에서도 이부분을 확실하게 체크할 것.
				if (pair.delta > 0) {
					rightEl.classList.remove("padded");
					rightEl.style.removeProperty("--anchor-adjust");
					void rightEl.offsetHeight; // force reflow
					rightEditorTop = rightEditor.getBoundingClientRect().y;
					rightScrollTop = rightEditor.scrollTop;
				} else if (pair.delta < 0) {
					leftEl.classList.remove("padded");
					leftEl.style.removeProperty("--anchor-adjust");
					void leftEl.offsetHeight; // force reflow
					leftEditorTop = leftEditor.getBoundingClientRect().y;
					leftScrollTop = leftEditor.scrollTop;
				}

				leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
				rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
				delta = Math.round(leftY - rightY);

				if (delta < -EditorPairer.MIN_DELTA || delta > EditorPairer.MIN_DELTA) {
					if (this.#applyDeltaToPair(pair, delta, true)) {
						leftScrollTop = leftEditor.scrollTop;
						rightScrollTop = rightEditor.scrollTop;
					}
				}
			}

			i++;
			count++;

			if (
				count >= EditorPairer.MIN_CHUNK_SIZE && // 최소 요만큼 정도는 deadline 무시하고 처리
				(i & 0xf) === 0 && // 16개마다 한번씩만 deadline 체크
				performance.now() > deadline // deadline이 지났다면
			) {
				//
				// console.debug("AnchorManager.processChunk: yielding after processing", count, "pairs");
				break;
			}
		}

		this.#elapsedTotal += performance.now() - startTime;

		if (i < pairs.length) {
			this.#queueProcessChunk(i, onDone);
		} else {
			if (import.meta.env.DEV) {
				console.debug("AnchorManager: processed", count, "/", this.#anchorPairs.length, "pairs in", this.#elapsedTotal.toFixed(2), "ms");
			}
			this.#onAlignDone(onDone);
		}
	}

	#queueProcessChunk(startIndex: number, onDone: () => void) {
		this.#chunkCancellationToken = requestAnimationFrame((time) => {
			this.#chunkCancellationToken = null;
			const deadline = time + FRAME_BUDGET_MS;
			this.#processChunk(startIndex, onDone, deadline);
		});
	}

	alignAnchorsGently(onDone: () => void, reset = false) {
		this.cancelAnchorAligning();
		this.#elapsedTotal = 0;

		const pairs = this.#anchorPairs;
		if (pairs.length === 0) {
			this.#onAlignDone(onDone);
			return;
		}

		if (reset) {
			for (const pair of pairs) {
				pair.delta = 0;
				pair.leftEl.classList.remove("padded");
				pair.leftEl.style.removeProperty("--anchor-adjust");
				pair.rightEl.classList.remove("padded");
				pair.rightEl.style.removeProperty("--anchor-adjust");
			}
		}

		// 초기화
		//this.#clearAnchorStyles();

		// Queue
		this.#queueProcessChunk(0, onDone);
	}

	#onAlignDone(onDone: () => void) {
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		leftEditor.forceReflow();
		rightEditor.forceReflow();

		let editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
		leftEditor.height = editorHeight;
		rightEditor.height = editorHeight;

		onDone();
	}

	#applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean) {
		let changed = false;
		if (delta < -EditorPairer.MIN_DELTA || delta > EditorPairer.MIN_DELTA) {
			if (pair.delta !== delta) {
				pair.delta = delta;
				changed = true;
			}
			let theEl: HTMLElement;
			if (delta > 0) {
				theEl = pair.rightEl;
			} else {
				delta = -delta;
				theEl = pair.leftEl;
			}
			theEl.style.setProperty("--anchor-adjust", `${delta}px`);
			theEl.classList.add("padded");
			if (theEl.nodeName !== DIFF_TAG_NAME) {
				theEl.classList.toggle("striped", delta >= EditorPairer.MIN_STRIPED_DELTA);
			}
			if (reflow) {
				void theEl.offsetHeight; // force reflow
			}
		}
		return changed;
	}
}
