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
	diffIndex: number | null;
	aligned: boolean;
	delta: number; // delta Y
	leftFlags: AnchorFlags;
	rightFlags: AnchorFlags;
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

class EditorPairer {
	static readonly MIN_DELTA = 1;
	static readonly MIN_STRIPED_DELTA = 10;
	static readonly MIN_CHUNK_SIZE = 20;

	#leftEditor: Editor;
	#rightEditor: Editor;
	#diffMarkers: HTMLElement[] = [];
	#anchorPairs: AnchorPair[] = [];
	#anchorMap: Map<HTMLElement, AnchorPair> = new Map();
	#oldAnchorPairs: AnchorPair[] | null = null;
	#oldDiffMarkers: HTMLElement[] | null = null;
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
		this.#oldDiffMarkers = this.#diffMarkers;
		for (const marker of this.#diffMarkers) {
			if (marker) {
				marker.remove();;
			}
		}
		this.#diffMarkers = [];
		this.#oldAnchorPairs = this.#anchorPairs;
		this.#anchorPairs = [];
		this.#largestCache = this.#recentCache = null;
	}

	endUpdate() {
		if (this.#oldAnchorPairs) {
			for (const anchorPair of this.#oldAnchorPairs) {
				const { leftEl, rightEl } = anchorPair;
				if (!this.#anchorMap.has(leftEl)) {
					leftEl.classList.remove("anchor");
					leftEl.style.removeProperty("--anchor-adjust");
					delete leftEl.dataset.anchorIndex;
					this.#unusedAnchors.add(leftEl);
				}
				if (!this.#anchorMap.has(rightEl)) {
					rightEl.classList.remove("anchor");
					rightEl.style.removeProperty("--anchor-adjust");
					delete rightEl.dataset.anchorIndex;
					this.#unusedAnchors.add(rightEl);
				}
			}
			this.#oldAnchorPairs = null;
		}
		if (this.#oldDiffMarkers) {
			for (const marker of this.#oldDiffMarkers) {
				if (marker) {
					console.log("Removing...", marker);
					marker.remove();
				}
			}
			this.#oldDiffMarkers = null;
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

	insertDiffMarker(container: HTMLElement, offset: number) {
		let markerEl = container.childNodes[offset] as HTMLElement;
		if (markerEl && markerEl.nodeName === DIFF_ELEMENT_NAME) {
			console.warn("Existing diff marker found at offset", offset, "in", container, markerEl);
			//throw new Error("Diff marker already exists at the specified offset");
			return null;
		} else {

		}
		const insertBefore = markerEl;
		markerEl = document.createElement(DIFF_ELEMENT_NAME);
		container.insertBefore(markerEl, insertBefore);
		this.#diffMarkers.push(markerEl);
		return markerEl;
	}

	addAnchorPair(leftRange: Range | LightRange, leftFlags: AnchorFlags, leftDiffEl: HTMLElement | null, rightRange: Range | LightRange, rightFlags: AnchorFlags, rightDiffEl: HTMLElement | null, diffIndex: number | null) {
		const lastPair = this.#anchorPairs[this.#anchorPairs.length - 1];
		let leftEl = leftDiffEl ?? this.#leftEditor.getAnchorTargetForToken(leftRange, leftFlags);
		if (!leftEl) {


			return;
		} else {
			const lastEl = lastPair?.leftEl
			if (lastEl && !(lastEl.compareDocumentPosition(leftEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
				return;
			}
		}

		let rightEl = rightDiffEl ?? this.#rightEditor.getAnchorTargetForToken(rightRange, rightFlags);
		if (!rightEl) {
			return;
		}
		else {
			const lastEl = lastPair?.rightEl;
			if (lastEl && !(lastEl.compareDocumentPosition(rightEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
				return;
			}
		}

		const pair: AnchorPair = {
			index: this.#anchorPairs.length,
			leftEl,
			rightEl,
			diffIndex,
			flags: leftFlags | rightFlags,
			aligned: false,
			delta: 0,
			leftFlags,
			rightFlags,
		};

		leftEl.classList.add("anchor");
		rightEl.classList.add("anchor");
		rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = pair.index.toString();
		if (diffIndex !== null) {
			leftEl.dataset.diffIndex = diffIndex.toString();
			rightEl.dataset.diffIndex = diffIndex.toString();
		} else {
			delete leftEl.dataset.diffIndex;
			delete rightEl.dataset.diffIndex;
		}
		this.#anchorPairs.push(pair);
		this.#anchorMap.set(leftEl, pair);
		this.#anchorMap.set(rightEl, pair);

		const leftPadding = parseInt(leftEl.style.getPropertyValue("--anchor-adjust")) || 0;
		const rightPadding = parseInt(rightEl.style.getPropertyValue("--anchor-adjust")) || 0;
		leftEl.style.removeProperty("--anchor-adjust");
		rightEl.style.removeProperty("--anchor-adjust");

		// if (leftPadding && rightPadding) {
		// 	leftEl.style.removeProperty("--anchor-adjust");
		// 	rightEl.style.removeProperty("--anchor-adjust");
		// } else if (leftPadding) {
		// 	pair.delta = -leftPadding;
		// } else if (rightPadding) {
		// 	pair.delta = rightPadding;
		// }

		// if (diffIndex !== null) {
		// 	leftEl.dataset.diffIndex = diffIndex.toString();
		// 	rightEl.dataset.diffIndex = diffIndex.toString();
		// } else {
		// 	delete leftEl.dataset.diffIndex;
		// 	delete rightEl.dataset.diffIndex;
		// }
		return pair;
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
		console.log("AnchorManager.processChunk: processing anchors from index", startIndex, "deadline:", deadline);
		const startTime = performance.now();
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;


		let leftScrollTop = leftEditor.scrollTop;
		let rightScrollTop = rightEditor.scrollTop;

		let i = startIndex;
		const pairs = this.#anchorPairs;
		let count = 0;

		while (i < pairs.length) {
			const pair = pairs[i];
			const { leftEl, rightEl } = pair;
			// 낙관적으로 --anchor-adjust 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기
			let leftY;
			let rightY;
			leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
			rightY = rightEl.getBoundingClientRect().y + rightScrollTop;

			let delta = Math.round(leftY - rightY);
			// console.log("chunk", i, "pair", { ...pair }, leftY, "rightY", rightY, "delta", delta);

			if (Math.abs(delta) > 1000) {
				console.warn("AnchorManager.processChunk: large delta detected", { pair, leftY, rightY, delta, leftScrollTop, rightScrollTop });
			}

			// delta가 significant함
			if (delta < -EditorPairer.MIN_DELTA || delta > EditorPairer.MIN_DELTA) {
				// 패딩이 이미 적용되어 있다면 초기화
				// pair의 delta값은 항상 앵커의 --anchor-adjust 값과 같게 유지된다고 가정함. 다른 부분에서도 이부분을 확실하게 체크할 것.
				if (pair.delta > 0) {
					rightEl.style.removeProperty("--anchor-adjust");
					void rightEl.offsetHeight; // force reflow
					rightScrollTop = rightEditor.scrollTop;
				} else if (pair.delta < 0) {
					leftEl.style.removeProperty("--anchor-adjust");
					void leftEl.offsetHeight; // force reflow
					leftScrollTop = leftEditor.scrollTop;
				}

				leftY = leftEl.getBoundingClientRect().y + leftScrollTop;
				rightY = rightEl.getBoundingClientRect().y + rightScrollTop;
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
			if (theEl.nodeName !== DIFF_ELEMENT_NAME) {
				theEl.classList.toggle("striped", delta >= EditorPairer.MIN_STRIPED_DELTA);
			}
			if (reflow) {
				void theEl.offsetHeight; // force reflow
			}
		}
		return changed;
	}
}
