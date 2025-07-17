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
};

type AnchorRequest = {
	leftTokenIndex?: number;
	rightTokenIndex?: number;
	diffIndex: number | null;
	flags: AnchorFlags;
};

type DeltaCacheEntry = {
	width: number;
	deltas: number[];
	timestamp: number;
};

class AnchorManager {
	static readonly MIN_DELTA = 1;
	static readonly MIN_STRIPED_DELTA = 10;
	static readonly MIN_CHUNK_SIZE = 20;

	#leftEditor: Editor;
	#rightEditor: Editor;
	#anchorPairs: AnchorPair[] = [];
	#anchorMap: Map<HTMLElement, AnchorPair> = new Map();
	#oldAnchorPairs: AnchorPair[] | null = null;
	#chunkCancellationToken: number | null = null;
	#largestCache: DeltaCacheEntry | null = null;
	#recentCache: DeltaCacheEntry | null = null;
	#elapsedTotal: number = 0;
	#unusedAnchors: Set<HTMLElement> = new Set();

	constructor(leftEditor: Editor, rightEditor: Editor) {
		this.#leftEditor = leftEditor;
		this.#rightEditor = rightEditor;
	}

	cancelAnchorAligning() {
		if (this.#chunkCancellationToken !== null) {
			console.debug("AnchorManager: canceling anchor aligning");
			cancelAnimationFrame(this.#chunkCancellationToken);
			this.#chunkCancellationToken = null;
		}
	}

	beginUpdate() {
		this.cancelAnchorAligning();
		this.#anchorMap.clear();
		if (this.#oldAnchorPairs) {
			this.endUpdate();
		}
		this.#oldAnchorPairs = this.#anchorPairs;
		this.#anchorPairs = [];
		this.#largestCache = this.#recentCache = null;
	}

	endUpdate() {
		// 이거 미쳤다
		// remove() 함수 정말 미쳤다. 자식도 없고 display:none인 상태인데도 전체 파이프라인인의 대부분의 시간을 잡아먹음. 미쳤다 미쳤다
		// 사실 안지워도 된다... 앵커를 박을 때 해당 위치에 이미 앵커가 있으면 재사용 하고 있으니까.
		// console.log("AnchorManager.endUpdate: cleaning up old anchors", this.#oldAnchorPairs.length, "pairs");
		if (this.#oldAnchorPairs) {
			for (const anchorPair of this.#oldAnchorPairs) {
				const { leftEl, rightEl } = anchorPair;
				if (!this.#anchorMap.has(leftEl)) {
					leftEl.style.display = "none";
					leftEl.style.removeProperty("--padding");
					leftEl.removeAttribute("class");
					delete leftEl.dataset.anchorIndex;
					this.#unusedAnchors.add(leftEl);
				}
				if (!this.#anchorMap.has(rightEl)) {
					rightEl.style.display = "none";
					rightEl.style.removeProperty("--padding");
					rightEl.removeAttribute("class");
					delete rightEl.dataset.anchorIndex;
					this.#unusedAnchors.add(rightEl);
				}
			}
		}
	}

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

	addAnchorPair(leftTokenIndex: number, leftFlags: AnchorFlags, rightTokenIndex: number, rightFlags: AnchorFlags, diffIndex: number | null) {
		const leftPoint = this.#findSlideSpot(
			this.#leftEditor,
			leftTokenIndex,
			leftFlags & AnchorFlags.EMPTY_DIFF ? rightFlags | AnchorFlags.EMPTY_DIFF : leftFlags
		);
		if (!leftPoint) {
			// console.warn("AnchorManager: No valid left anchor point found for token index", leftTokenIndex, "with flags", this.#anchorFlagsToString(leftFlags));
			// console.debug("AnchorManager:
			return null;
		}
		const rightPoint = this.#findSlideSpot(
			this.#rightEditor,
			rightTokenIndex,
			rightFlags & AnchorFlags.EMPTY_DIFF ? leftFlags | AnchorFlags.EMPTY_DIFF : rightFlags
		);
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

		const pair: AnchorPair = {
			index: this.#anchorPairs.length,
			leftEl,
			rightEl,
			diffIndex: diffIndex ?? undefined,
			flags: leftFlags | rightFlags,
			aligned: false,
			delta: 0,
		};

		this.#anchorPairs.push(pair);
		this.#anchorMap.set(leftEl, pair);
		this.#anchorMap.set(rightEl, pair);
		leftEl.dataset.anchorIndex = pair.index.toString();
		rightEl.dataset.anchorIndex = pair.index.toString();

		const leftPadding = parseInt(leftEl.style.getPropertyValue("--padding")) || 0;
		const rightPadding = parseInt(rightEl.style.getPropertyValue("--padding")) || 0;
		if (leftPadding && rightPadding) {
			// 이전에 다른 앵커에 매치되던 앵커끼리 매치된 경우
			// 이 경우 그냥 padding을 제거해버림
			leftEl.style.removeProperty("--padding");
			rightEl.style.removeProperty("--padding");
		} else if (leftPadding) {
			pair.delta = -leftPadding;
		} else if (rightPadding) {
			pair.delta = rightPadding;
		}

		if (diffIndex !== null) {
			leftEl.dataset.diffIndex = diffIndex.toString();
			rightEl.dataset.diffIndex = diffIndex.toString();
		} else {
			delete leftEl.dataset.diffIndex;
			delete rightEl.dataset.diffIndex;
		}
		return pair;

		//return this.addAnchorPair(leftEl, rightEl, diffIndex ?? null, leftFlags & rightFlags);
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

	#findSlideSpot(editor: Editor, tokenIndex: number, flags: AnchorFlags): Range | null {
		let bestPoint: AnchorInsertionPoint | null = null;

		const lastAnchorRange = this.#getLastAnchorRange(editor);
		if (flags & AnchorFlags.EMPTY_DIFF) {
			let bestScore = -1;
			for (const point of editor.yieldDiffAnchorPointsInRange(tokenIndex)) {
				// console.log(editor.name, tokenIndex, "point", point, "flags", flags, "lastAnchorRange", lastAnchorRange);
				let score = 0;
				
				const insertionRange = toRange(point.range);
				if (lastAnchorRange && lastAnchorRange.compareBoundaryPoints(Range.START_TO_END, insertionRange) >= 0) {
					continue;
				}
				// bestPoint = point;
				// break;
				
				// 귀찮아... 그냥 가장 바깥에 앵커 박기 ;;;
				if (!bestPoint) {
					bestPoint = point;
				}

				if (point.flags & InsertionPointFlags.TABLE_START && flags & AnchorFlags.TABLE_START) {
					score += 5;
				} else if (point.flags & InsertionPointFlags.TABLEROW_START && flags & AnchorFlags.TABLEROW_START) {
					score += 4;
				} else if (point.flags & InsertionPointFlags.TABLECELL_START && flags & AnchorFlags.TABLECELL_START) {
					score += 3;
				} else if (point.flags & InsertionPointFlags.CONTAINER_START && flags & AnchorFlags.CONTAINER_START) {
					score += 2;
				} else if (point.flags & InsertionPointFlags.BLOCK_START && flags & AnchorFlags.BLOCK_START) {
					score += 1;
				}
				// console.log(tokenIndex, "point", point, "score", score, "flags", flags, "prevBestScore", bestScore);
				if (score > bestScore) {
					bestScore = score;
					bestPoint = point;
				} else {
				}
			}
		} else {
			bestPoint = editor.getAnchorInsertionPoint(tokenIndex, flags);
		}

		if (bestPoint) {
			let range: Range | null = null;
			if (bestPoint.range instanceof Range) {
				range = bestPoint.range;
			} else {
				range = document.createRange();
				range.setStart(bestPoint.range.startContainer, bestPoint.range.startOffset);
				range.collapse(true);
			}

			if (!lastAnchorRange || lastAnchorRange.compareBoundaryPoints(Range.START_TO_END, range) < 0) {
				return range;
			}
		}

		return null;
	}

	#slideInGently(insertionPoint: Range, type: "anchor" | "diff"): HTMLElement {
		let existingAnchor =
			insertionPoint.startContainer.nodeType === 1 ? (insertionPoint.startContainer.childNodes[insertionPoint.startOffset] as HTMLElement) : null;

		if (existingAnchor) {
			if (this.#unusedAnchors.delete(existingAnchor)) {
				existingAnchor.style.removeProperty("display");
				existingAnchor.classList.add(type);
				return existingAnchor;
			}
			let adjacent = existingAnchor.previousSibling as HTMLElement;
			if (adjacent && adjacent.nodeType === 1 && this.#unusedAnchors.delete(adjacent)) {
				existingAnchor.style.removeProperty("display");
				existingAnchor.classList.add(type);
				return existingAnchor;
			}

			adjacent = existingAnchor.nextSibling as HTMLElement;
			if (adjacent && adjacent.nodeType === 1 && this.#unusedAnchors.delete(adjacent)) {
				existingAnchor.style.removeProperty("display");
				existingAnchor.classList.add(type);
				return existingAnchor;
			}
		}

		const newAnchor = document.createElement("A");
		newAnchor.classList.add(type);
		newAnchor.contentEditable = "false";
		insertionPoint.insertNode(newAnchor);
		return newAnchor;
	}

	#getDeltaCache(width: number): number[] | undefined {
		if (this.#largestCache?.width === width) return this.#largestCache.deltas;
		if (this.#recentCache?.width === width) return this.#recentCache.deltas;
		return undefined;
	}

	#saveDeltaCache(width: number, deltas: number[]) {
		const newEntry = { width, deltas, timestamp: performance.now() };

		// width 값마다 캐시를 저장하는 것은 미친 짓이다.
		// 최근 사용했던 width와 가장 큰 width만 저장함.
		// 가장 큰 width는 창 최대화 시의 캐시를 보관하기 위함.

		// 가장 큰 캐시가 없다면 그냥 저장하고 끝
		if (!this.#largestCache) {
			this.#largestCache = newEntry;
			return;
		}

		if (width > this.#largestCache.width) {
			const isLargestNewer = this.#recentCache === null || this.#largestCache.timestamp > this.#recentCache.timestamp;
			if (!isLargestNewer) {
				this.#recentCache = this.#largestCache;
			}
			this.#largestCache = newEntry;
			return;
		}

		if (width === this.#largestCache.width) return;
		this.#recentCache = newEntry;
	}

	#processChunk(startIndex: number, onDone: () => void, deadline: number) {
		const startTime = performance.now();
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;
		let leftScrollTop = leftEditor.scrollTop;
		let rightScrollTop = rightEditor.scrollTop;

		const cacheKey = leftEditor.getBoundingClientRect().width;
		const cachedDeltas = this.#getDeltaCache(cacheKey);
		let i = startIndex;
		const pairs = this.#anchorPairs;
		let count = 0;
		while (i < pairs.length) {
			const pair = pairs[i];
			const { leftEl, rightEl } = pair;
			const cachedDelta = cachedDeltas?.[i] ?? null;
			if (cachedDelta !== null) {
				if (cachedDelta !== pair.delta) {
					//console.log("AnchorManager: applying cached delta", cachedDelta, "to pair", i, { ...pair });
					if (pair.delta > 0) {
						rightEl.style.removeProperty("--padding");
						void rightEl.offsetHeight; // force reflow
						rightScrollTop = rightEditor.scrollTop;
					} else if (pair.delta < 0) {
						leftEl.style.removeProperty("--padding");
						void leftEl.offsetHeight; // force reflow
						leftScrollTop = leftEditor.scrollTop;
					}
					if (this.#applyDeltaToPair(pair, cachedDelta, true)) {
						leftScrollTop = leftEditor.scrollTop;
						rightScrollTop = rightEditor.scrollTop;
					}
					count++;
				}
				i++;
				continue;
			}

			// 낙관적으로 --padding 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기
			let leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
			let rightY = rightEl.getBoundingClientRect().y + rightScrollTop;
			let delta = Math.round(leftY - rightY);
			// console.log("chunk", i, "pair", { ...pair }, leftY, "rightY", rightY, "delta", delta);

			// delta가 significant함
			if (delta < -AnchorManager.MIN_DELTA || delta > AnchorManager.MIN_DELTA) {
				// 패딩이 이미 적용되어 있다면 초기화
				// pair의 delta값은 항상 앵커의 --padding 값과 같게 유지된다고 가정함. 다른 부분에서도 이부분을 확실하게 체크할 것.
				if (pair.delta > 0) {
					rightEl.style.removeProperty("--padding");
					void rightEl.offsetHeight; // force reflow
					rightScrollTop = rightEditor.scrollTop;
				} else if (pair.delta < 0) {
					leftEl.style.removeProperty("--padding");
					void leftEl.offsetHeight; // force reflow
					leftScrollTop = leftEditor.scrollTop;
				}

				leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
				rightY = rightEl.getBoundingClientRect().y + rightScrollTop;
				delta = Math.round(leftY - rightY);

				if (delta < -AnchorManager.MIN_DELTA || delta > AnchorManager.MIN_DELTA) {
					if (this.#applyDeltaToPair(pair, delta, true)) {
						leftScrollTop = leftEditor.scrollTop;
						rightScrollTop = rightEditor.scrollTop;
					}
				}
			}

			i++;
			count++;
			if (
				count >= AnchorManager.MIN_CHUNK_SIZE && // 최소 요만큼 정도는 deadline 무시하고 처리
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
			if (!cachedDeltas) {
				const deltas = pairs.map((pair) => pair.delta);
				//console.log("AnchorManager: saving deltas for width", cacheKey, "with", deltas);
				this.#saveDeltaCache(cacheKey, deltas);
			}
			if (DEBUG) {
				console.debug("AnchorManager: processed", count, "/", this.#anchorPairs.length, "pairs in", this.#elapsedTotal.toFixed(2), "ms");
			}
			onDone();
		}
	}

	#queueProcessChunk(startIndex: number, onDone: () => void) {
		this.#chunkCancellationToken = requestAnimationFrame((time) => {
			this.#chunkCancellationToken = null;
			const deadline = time + FRAME_BUDGET_MS;
			this.#processChunk(startIndex, onDone, deadline);
		});
	}

	alignAnchorsGently(onDone: () => void) {
		this.cancelAnchorAligning();
		this.#elapsedTotal = 0;

		const pairs = this.#anchorPairs;
		if (pairs.length === 0) {
			onDone();
			return;
		}

		// 초기화
		//this.#clearAnchorStyles();

		// Queue
		this.#queueProcessChunk(0, onDone);
	}

	// alignAnchors(): boolean {
	// 	// if (isScrolling) {
	// 	// 	return [false, NaN];
	// 	// }
	// 	const pairs = this.#anchorPairs;
	// 	const previouslyDirty = this.#anchorsDirty;
	// 	this.#anchorsDirty = false;

	// 	if (pairs.length === 0) {
	// 		return previouslyDirty;
	// 	}

	// 	const leftEditor = this.#leftEditor;
	// 	const rightEditor = this.#rightEditor;
	// 	let leftScrollTop = leftEditor.scrollTop;
	// 	let rightScrollTop = rightEditor.scrollTop;
	// 	let changeCount = 0;

	// 	const currentWidth = this.#leftEditor.getBoundingClientRect().width;
	// 	const cachedDeltas = this.#getCachedDelta(currentWidth);
	// 	if (cachedDeltas) {
	// 		// console.debug("AnchorManager.alignAnchors: using cached deltas for width", currentWidth);
	// 		for (let i = 0; i < pairs.length; i++) {
	// 			const pair = pairs[i];
	// 			const { leftEl, rightEl } = pair;
	// 			const cachedDelta = cachedDeltas[i];
	// 			if (cachedDelta >= 0) {
	// 				leftEl.classList.remove("padtop", "striped");
	// 				leftEl.style.removeProperty("--padding");
	// 			} else if (cachedDelta <= 0) {
	// 				rightEl.classList.remove("padtop", "striped");
	// 				rightEl.style.removeProperty("--padding");
	// 			}

	// 			if (this.#applyDeltaToPair(pair, cachedDelta, false)) {
	// 				changeCount++;
	// 			}
	// 		}
	// 		return previouslyDirty || changeCount > 0;
	// 	}

	// 	// 초기화
	// 	for (const pair of pairs) {
	// 		const { leftEl, rightEl } = pair;
	// 		rightEl.classList.remove("padtop", "striped");
	// 		rightEl.style.removeProperty("--padding");
	// 		leftEl.classList.remove("padtop", "striped");
	// 		leftEl.style.removeProperty("--padding");
	// 	}
	// 	leftEditor.forceReflow();
	// 	rightEditor.forceReflow();

	// 	rightScrollTop = rightEditor.scrollTop;
	// 	leftScrollTop = leftEditor.scrollTop;

	// 	for (const pair of pairs) {
	// 		const { leftEl, rightEl } = pair;
	// 		let leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
	// 		let rightY = rightEl.getBoundingClientRect().y + rightScrollTop;
	// 		let delta = Math.round(leftY - rightY);
	// 		if (this.#applyDeltaToPair(pair, delta, true)) {
	// 			leftScrollTop = leftEditor.scrollTop;
	// 			rightScrollTop = rightEditor.scrollTop;
	// 			changeCount++;
	// 		}
	// 	}
	// 	console.debug("AnchorManager.alignAnchors: aligned", changeCount, "pairs", pairs.length);

	// 	return previouslyDirty || changeCount > 0;
	// }

	#applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean) {
		let changed = false;
		if (delta < -AnchorManager.MIN_DELTA || delta > AnchorManager.MIN_DELTA) {
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
			theEl.style.setProperty("--padding", `${delta}px`);
			theEl.classList.toggle("striped", delta >= AnchorManager.MIN_STRIPED_DELTA);
			if (reflow) {
				void theEl.offsetHeight; // force reflow
			}
		}
		return changed;
	}
}
