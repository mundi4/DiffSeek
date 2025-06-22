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
}

type AnchorRequest = {
	leftTokenIndex?: number;
	rightTokenIndex?: number;
	diffIndex: number | null;
	flags: AnchorFlags;
};

type AnchorManagerUpdateHelper = {
	tryAddAnchorPair: (leftTokenIndex: number, leftFlags: AnchorFlags, rightTokenIndex: number, rightFlags: AnchorFlags, diffIndex?: number) => boolean;
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

	update(callback: (funcs: AnchorManagerUpdateHelper) => void) {
		this.#anchorMap.clear();
		const oldAnchorPairs = this.#anchorPairs;
		this.#anchorPairs = [];

		// 앵커 추가
		// 앵커맵 업데이트

		const tryAddAnchorPair = this.#tryAddAnchorPair.bind(this);

		callback({
			tryAddAnchorPair,
		});

		for (const anchorPair of oldAnchorPairs) {
			const { leftEl, rightEl } = anchorPair;
			if (!this.#anchorMap.has(leftEl)) {
				leftEl.remove();
			}
			if (!this.#anchorMap.has(rightEl)) {
				rightEl.remove();
			}
		}

		console.debug("AnchorManager.update", {
			anchorPairs: this.#anchorPairs,
			anchorMap: this.#anchorMap,
		});
	}

	#tryAddAnchorPair(leftTokenIndex: number, leftFlags: AnchorFlags, rightTokenIndex: number, rightFlags: AnchorFlags, diffIndex?: number) {
		const leftPoint = this.#findSlideSpot(this.#leftEditor, leftTokenIndex, leftFlags);
		if (!leftPoint) {
			return false;
		}
		const rightPoint = this.#findSlideSpot(this.#rightEditor, rightTokenIndex, rightFlags);
		if (!rightPoint) {
			return false;
		}

		const leftEl = this.#slideInGently(leftPoint, leftFlags & AnchorFlags.EMPTY_DIFF ? "diff" : "anchor");
		const rightEl = this.#slideInGently(rightPoint, rightFlags & AnchorFlags.EMPTY_DIFF ? "diff" : "anchor");
		this.addAnchorPair(leftEl, rightEl, diffIndex ?? null, leftFlags & rightFlags);
		return true;
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
		const existingAnchor =
			insertionPoint.startContainer.nodeType === 1 ? (insertionPoint.startContainer.childNodes[insertionPoint.startOffset] as HTMLElement) : null;
		if (existingAnchor && existingAnchor.nodeName === "A" && existingAnchor.classList.contains(type)) {
			return existingAnchor;
		}
		const newAnchor = document.createElement("A");
		newAnchor.classList.add(type);
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
		};
		this.#anchorPairs.push(pair);
		this.#anchorMap.set(leftEl, pair);
		this.#anchorMap.set(rightEl, pair);
	}

	alignAnchors(primaryEditor: Editor, containerRect: DOMRect): [boolean, number] {
		const anchors = this.#anchorPairs;
		if (!anchors) {
			return [false, NaN];
		}

		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		const firstPair = this.getFirstVisibleAnchorPair(primaryEditor, containerRect);
		if (!firstPair) {
			return [false, NaN];
		}

		const MIN_DELTA = 1;
		const MIN_STRIPED_DELTA = 10;

		const containerBottom = containerRect.bottom + 100;
		const leftEditorBottomThreshold = containerBottom + leftEditor.scrollTop + 100;
		const rightEditorBottomThreshold = containerBottom + rightEditor.scrollTop + 100;

		let firstIndex = firstPair.index - 1;
		if (firstIndex < 0) {
			firstIndex = 0;
		}

		let dirty = false;
		let leftY: number;
		let rightY: number;
		let delta: number;
		for (let i = firstIndex; i < anchors.length; i++) {
			const pair = anchors[i];
			if (!dirty) {
				if (pair.aligned) continue;
				else dirty = true;
			}

			const { leftEl, rightEl } = pair;

			// 먼저 리셋 해줘야함
			leftEl.classList.remove("padtop", "striped");
			rightEl.classList.remove("padtop", "striped");
			leftEl.style.removeProperty("--padding");
			rightEl.style.removeProperty("--padding");

			pair.aligned = true;
			leftY = leftEl.getBoundingClientRect().y;
			rightY = rightEl.getBoundingClientRect().y;
			leftY += leftEditor.scrollTop;
			rightY += rightEditor.scrollTop;
			delta = leftY - rightY;

			if (delta > -MIN_DELTA && delta < MIN_DELTA) {
				continue;
			}

			delta = Math.round(delta);
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

			if (leftY > leftEditorBottomThreshold && rightY > rightEditorBottomThreshold) {
				break;
			}
		}

		let editorHeight;
		if (leftY! !== undefined) {
			// 마지막 앵커부터 남은 영역의 높이
			let tailHeight = Math.max(leftEditor.contentHeight - leftY, rightEditor.contentHeight - rightY!);
			editorHeight = Math.max(leftY, rightY!) + tailHeight;
		} else {
			editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
		}

        this.#invalidated = false;
		return [dirty, editorHeight];
	}

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

    invalidateAllAnchors() {
        if (this.#invalidated) {
            return;
        }
        this.#invalidated = true;
        for (const pair of this.#anchorPairs) {
            pair.aligned = false;
        }
    }
}
