const enum AnchorFlags {
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
	diffIndex?: number;
	aligned: boolean;
	delta: number; // delta Y
	leftVisible: boolean; // visible in left editor
	rightVisible: boolean; // visible in right editor
};

type AnchorRequest = {
	leftTokenIndex?: number;
	rightTokenIndex?: number;
	diffIndex: number | null;
	flags: AnchorFlags;
};

type AnchorManagerUpdateHelper = {
	tryAddAnchorPair: (
		leftTokenIndex: number,
		leftFlags: AnchorFlags,
		rightTokenIndex: number,
		rightFlags: AnchorFlags,
		diffIndex?: number
	) => AnchorPair | null;
	addAnchorEls: (leftEl: HTMLElement, rightEl: HTMLElement, diffIndex: number | null, flags: AnchorFlags) => AnchorPair;
};

class AnchorManager {
	#leftEditor: Editor;
	#rightEditor: Editor;
	#anchorPairs: AnchorPair[] = [];
	#anchorMap: Map<HTMLElement, AnchorPair> = new Map();
	#invalidated: boolean = false;

	constructor(leftEditor: Editor, rightEditor: Editor) {
		this.#leftEditor = leftEditor;
		this.#rightEditor = rightEditor;
	}

	#oldAnchorPairs: AnchorPair[] = [];
	beginUpdate() {
		this.#anchorMap.clear();
		this.#oldAnchorPairs = this.#anchorPairs;
		this.#anchorPairs = [];
	}

	endUpdate() {
		// 이거 미쳤다
		// remove() 함수 정말 미쳤다. 자식도 없고 display:none인 상태인데도 전체 파이프라인인의 대부분의 시간을 잡아먹음. 미쳤다 미쳤다
		// 사실 안지워도 된다... 앵커를 박을 때 해당 위치에 이미 앵커가 있으면 재사용 하고 있으니까.
		// console.log("AnchorManager.endUpdate: cleaning up old anchors", this.#oldAnchorPairs.length, "pairs");
		for (const anchorPair of this.#oldAnchorPairs) {
			const { leftEl, rightEl } = anchorPair;
			if (!this.#anchorMap.has(leftEl)) {
				leftEl.style.display = "none";
				// leftEl.classList.remove("padtop", "striped");
				// leftEl.style.removeProperty("--padding");
				// leftEl.remove();
			}
			if (!this.#anchorMap.has(rightEl)) {
				leftEl.style.display = "none";
				// rightEl.classList.remove("padtop", "striped");
				// rightEl.style.removeProperty("--padding");
				// rightEl.remove();
			}
		}
	}

	// zzzupdate(callback: (funcs: AnchorManagerUpdateHelper) => void) {
	// 	this.#leftVisiblePairs.clear();
	// 	this.#rightVisiblePairs.clear();
	// 	this.#observerPristine = true;
	// 	this.#observer.disconnect();
	// 	this.#anchorMap.clear();
	// 	const oldAnchorPairs = this.#anchorPairs;
	// 	this.#anchorPairs = [];

	// 	// 앵커 추가
	// 	// 앵커맵 업데이트

	// 	const tryAddAnchorPair = this.tryAddAnchorPair.bind(this);
	// 	const addAnchorEls = this.addAnchorPair.bind(this);
	// 	callback({
	// 		tryAddAnchorPair,
	// 		addAnchorEls,
	// 	});

	// 	for (const anchorPair of oldAnchorPairs) {
	// 		const { leftEl, rightEl } = anchorPair;
	// 		if (!this.#anchorMap.has(leftEl)) {
	// 			leftEl.remove();
	// 		}
	// 		if (!this.#anchorMap.has(rightEl)) {
	// 			rightEl.remove();
	// 		}
	// 	}

	// 	// console.debug("AnchorManager.update", {
	// 	// 	anchorPairs: this.#anchorPairs,
	// 	// 	anchorMap: this.#anchorMap,
	// 	// 	numLeftVisible: this.#leftVisiblePairs.size,
	// 	// 	numRightVisible: this.#rightVisiblePairs.size,
	// 	// });
	// }

	#anchorFlagsToString(flags: AnchorFlags): string {
		const flagsArray: string[] = [];
		if (flags & AnchorFlags.LINE_START) {
			flagsArray.push("LINE_START");
		}
		if (flags & AnchorFlags.BLOCK_START) {
			flagsArray.push("BLOCK_START");
		}
		if (flags & AnchorFlags.CONTAINER_START) {
			flagsArray.push("CONTAINER_START");
		}
		if (flags & AnchorFlags.TABLECELL_START) {
			flagsArray.push("TABLECELL_START");
		}
		if (flags & AnchorFlags.TABLEROW_START) {
			flagsArray.push("TABLEROW_START");
		}
		if (flags & AnchorFlags.TABLE_START) {
			flagsArray.push("TABLE_START");
		}
		if (flags & AnchorFlags.AFTER_CONTAINER) {
			flagsArray.push("AFTER_CONTAINER");
		}
		if (flags & AnchorFlags.EMPTY_DIFF) {
			flagsArray.push("EMPTY_DIFF");
		}
		if (flags & AnchorFlags.SECTION_HEADING) {
			flagsArray.push("SECTION_HEADING");
		}
		if (flagsArray.length === 0) {
			return "None";
		}
		return flagsArray.join(" | ");
	}

	tryAddAnchorPair(leftTokenIndex: number, leftFlags: AnchorFlags, rightTokenIndex: number, rightFlags: AnchorFlags, diffIndex?: number) {
		const leftPoint = this.#findSlideSpot(this.#leftEditor, leftTokenIndex, leftFlags);
		if (!leftPoint) {
			// console.warn("AnchorManager: No valid left anchor point found for token index", leftTokenIndex, "with flags", this.#anchorFlagsToString(leftFlags));
			// console.debug("AnchorManager:
			return null;
		}
		const rightPoint = this.#findSlideSpot(this.#rightEditor, rightTokenIndex, rightFlags);
		if (!rightPoint) {
			// console.warn("AnchorManager: No valid right anchor point found for token index", rightTokenIndex, "with flags", this.#anchorFlagsToString(rightFlags));
			return null;
		}

		// console.debug(
		// 	"AnchorManager: tryAddAnchorPair",
		// 	this.#anchorPairs.length,
		// 	`leftTokenIndex: ${leftTokenIndex}, leftFlags: ${this.#anchorFlagsToString(
		// 		leftFlags
		// 	)}, rightTokenIndex: ${rightTokenIndex}, rightFlags: ${this.#anchorFlagsToString(rightFlags)}, diffIndex: ${diffIndex}`
		// );

		const leftEl = this.#slideInGently(leftPoint, leftFlags & AnchorFlags.EMPTY_DIFF ? "diff" : "anchor");
		const rightEl = this.#slideInGently(rightPoint, rightFlags & AnchorFlags.EMPTY_DIFF ? "diff" : "anchor");
		return this.addAnchorPair(leftEl, rightEl, diffIndex ?? null, leftFlags & rightFlags);
	}

	#getLastAnchorRange(editor: Editor): Range | null {
		let lastPair = this.#anchorPairs[this.#anchorPairs.length - 1];
		if (lastPair) {
			let lastAnchorRange = document.createRange();
			lastAnchorRange.selectNode(editor === this.#leftEditor ? lastPair.leftEl : lastPair.rightEl);
			return lastAnchorRange;
		}
		return null;
	}

	#findSlideSpot(editor: Editor, tokenIndex: number, flags: AnchorFlags) {
		const lastAnchorRange = this.#getLastAnchorRange(editor);
		if (flags & AnchorFlags.EMPTY_DIFF) {
			let bestPoint: AnchorInsertionPoint | null = null;
			let bestScore = -1;
			const insertionRange = document.createRange();
			for (const point of editor.yieldDiffAnchorPointsInRange(tokenIndex)) {
				let score = 0;
				// 귀찮아... 그냥 가장 바깥에 앵커 박기 ;;;

				insertionRange.setStart(point.container, point.offset);
				if (!lastAnchorRange || lastAnchorRange.compareBoundaryPoints(Range.START_TO_END, insertionRange) <= 0) {
					if (!bestPoint || bestPoint.depth > point.depth) {
						bestPoint = point;
					}
				}
				//console.log("point", point, "score", score, "filledStartFlags", filledStartFlags);
				// break;

				// if (point.flags & InsertionPointFlags.TABLE_START && filledStartFlags & TokenFlags.TABLE_START) {
				// 	score += 5;
				// } else if (point.flags & InsertionPointFlags.TABLEROW_START && filledStartFlags & TokenFlags.TABLEROW_START) {
				// 	score += 4;
				// } else if (point.flags & InsertionPointFlags.TABLECELL_START && filledStartFlags & TokenFlags.TABLECELL_START) {
				// 	score += 3;
				// } else if (point.flags & InsertionPointFlags.CONTAINER_START && filledStartFlags & TokenFlags.CONTAINER_START) {
				// 	score += 2;
				// } else if (point.flags & InsertionPointFlags.BLOCK_START && filledStartFlags & TokenFlags.BLOCK_START) {
				// 	score += 1;
				// }
				// console.log("point", point, "score", score, "filledStartFlags", filledStartFlags);
				// if (score > bestScore) {
				// 	bestScore = score;
				// 	bestPoint = point;
				// }
				// break;
			}
			if (bestPoint) {
				const range = document.createRange();
				range.setStart(bestPoint.container, bestPoint.offset);
				return range;
			}
			return null;
		} else {
			const range = editor.getAnchorInsertionPoint(tokenIndex, flags);
			if (range && (!lastAnchorRange || lastAnchorRange.compareBoundaryPoints(Range.START_TO_END, range) <= 0)) {
				return range;
			}
			return null;
		}
	}

	#slideInGently(insertionPoint: Range, type: "anchor" | "diff"): HTMLElement {
		let existingAnchor =
			insertionPoint.startContainer.nodeType === 1 ? (insertionPoint.startContainer.childNodes[insertionPoint.startOffset] as HTMLElement) : null;
		if (existingAnchor) {
			if (existingAnchor.nodeName === "A" && existingAnchor.classList.contains(type)) {
				return existingAnchor;
			}
			if (existingAnchor.previousElementSibling) {
				existingAnchor = existingAnchor.previousElementSibling as HTMLElement;
				if (existingAnchor && existingAnchor.nodeName === "A" && existingAnchor.classList.contains(type)) {
					return existingAnchor;
				}
			}
		}
		const newAnchor = document.createElement("A");
		newAnchor.classList.add(type);
		newAnchor.contentEditable = "false";
		insertionPoint.insertNode(newAnchor);
		return newAnchor;
	}

	addAnchorPair(leftEl: HTMLElement, rightEl: HTMLElement, diffIndex: number | null, flags: AnchorFlags) {
		const pair: AnchorPair = {
			index: this.#anchorPairs.length,
			leftEl,
			rightEl,
			diffIndex: diffIndex ?? undefined,
			flags,
			aligned: false,
			delta: 0,
			leftVisible: false,
			rightVisible: false,
		};
		this.#anchorPairs.push(pair);
		this.#anchorMap.set(leftEl, pair);
		this.#anchorMap.set(rightEl, pair);
		leftEl.dataset.anchorIndex = pair.index.toString();
		rightEl.dataset.anchorIndex = pair.index.toString();
		if (diffIndex !== null) {
			leftEl.dataset.diffIndex = diffIndex.toString();
			rightEl.dataset.diffIndex = diffIndex.toString();
		} else {
			delete leftEl.dataset.diffIndex;
			delete rightEl.dataset.diffIndex;
		}
		return pair;
	}

	#doAlignAnchors(pairs: AnchorPair[]): number {
		// console.debug("AnchorManager.doAlingPairs: aligning pairs", pairs.length);

		const MIN_DELTA = 1;
		const MIN_STRIPED_DELTA = 10;

		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;
		let leftScrollTop = leftEditor.scrollTop;
		let rightScrollTop = rightEditor.scrollTop;
		let changeCount = 0;

		// 초기화
		for (const pair of pairs) {
			const { leftEl, rightEl } = pair;
			rightEl.style.removeProperty("display");
			rightEl.classList.remove("padtop", "striped");
			rightEl.style.removeProperty("--padding");
			leftEl.style.removeProperty("display");
			leftEl.classList.remove("padtop", "striped");
			leftEl.style.removeProperty("--padding");
		}
		leftEditor.forceReflow();
		rightEditor.forceReflow();

		rightScrollTop = rightEditor.scrollTop;
		leftScrollTop = leftEditor.scrollTop;

		for (const pair of pairs) {
			const { leftEl, rightEl } = pair;
			let leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
			let rightY = rightEl.getBoundingClientRect().y + rightScrollTop;
			let delta = Math.round(leftY - rightY);
			if (delta < -MIN_DELTA || delta > MIN_DELTA) {
				let theEl: HTMLElement;
				if (delta > 0) {
					theEl = rightEl;
				} else {
					delta = -delta;
					theEl = leftEl;
				}

				theEl.classList.add("padtop");
				theEl.style.setProperty("--padding", `${delta}px`);
				if (delta >= MIN_STRIPED_DELTA) {
					theEl.classList.add("striped");
				}
				void theEl.offsetHeight;
				leftScrollTop = leftEditor.scrollTop;
				rightScrollTop = rightEditor.scrollTop;
				changeCount++;
			}
		}
		return changeCount;
	}

	alignAnchors(): [boolean, number] {
		// if (isScrolling) {
		// 	return [false, NaN];
		// }
		const anchors = this.#anchorPairs;
		if (!anchors) {
			return [false, NaN];
		}

		// const startTime = performance.now();
		if (this.#invalidated) {
			// console.debug("AnchorManager.alignAnchors: invalidated, resetting alignment");
			this.#invalidated = false;
			for (const pair of this.#anchorPairs) {
				pair.aligned = false;
				pair.delta = 0;
			}
		}

		let changedCount = this.#doAlignAnchors(anchors);
		// console.debug("AnchorManager.alignAnchors: aligned pairs", changedCount);

		//console.log("numHandled", numHandled, this.#numLeftVisible, this.#numRightVisible);
		let editorHeight = Math.max(this.#leftEditor.contentHeight, this.#rightEditor.contentHeight);

		// const endTime = performance.now();
		// console.debug(`AnchorManager.alignAnchors: aligned ${changedCount} pairs in ${endTime - startTime}ms, editorHeight: ${editorHeight}`);
		return [changedCount > 0, editorHeight];
	}

	invalidate() {
		this.#invalidated = true;
	}

	// 문제가 있다.
	// 앵커는 문서 상의 순서로 정렬되어 있지만
	// 문서 상의 순서가 반드시 y좌표의 순서와 일치하는 건 아니다(테이블 셀들).
	findFirstVisibleAnchorIndex(editor: Editor, containerRect: DOMRect): number {
		const anchorPairs = this.#anchorPairs;
		const { top: viewportTop, bottom: viewportBottom } = containerRect;

		let low = 0;
		let high = anchorPairs.length - 1;
		let found = -1;

		while (low <= high) {
			const mid = (low + high) >> 1;
			const { top, bottom } =
				editor === this.#leftEditor ? anchorPairs[mid].leftEl.getBoundingClientRect() : anchorPairs[mid].rightEl.getBoundingClientRect();
			if (bottom < viewportTop) {
				low = mid + 1;
			} else if (top > viewportBottom) {
				high = mid - 1;
			} else {
				found = mid;
				high = mid - 1;
			}
		}

		return found >= 0 ? found : ~low;
	}

	getFirstVisibleAnchorPair(editor: Editor, containerRect: DOMRect): AnchorPair | null {
		const index = this.findFirstVisibleAnchorIndex(editor, containerRect);
		if (index < 0) {
			return null;
		}
		return this.#anchorPairs[index];
	}
}
