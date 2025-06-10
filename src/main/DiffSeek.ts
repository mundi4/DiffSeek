// atoms
// 이렇게까지 하게 될지는 몰랐는데 ui요소마다 콜백을 넘기고 또 그걸 또 감싸서 자식으로 넘기고... 귀찮잖아...
const highlightedDiffIndexAtom = createAtom<number | null>("highlightedDiffIndex", null);
const diffItemClickedEvent = createEventAtom<number>("diffItemClickedEvent");

type EditorDiff = {
	diffIndex: number;
	tokenIndex: number;
	tokenCount: number;
	flags: number;
	hue: number;
	preferBlockStart: boolean;
};

const enum DiffFlags {
	PreferBlockStart = 1 << 0,
	PreferBlockEnd = 1 << 1,
}

const enum InsertionPointFlags {
	// FirstChild = 1 << 0, // 첫번째 자식 1
	// LastChild = 1 << 1, // 마지막 자식 2
	// BeforeTable = 1 << 2, // 테이블 이전 4
	// AfterTable = 1 << 3, // 테이블 다음 8
	CONTAINER_START = 1 << 4, // 컨테이너 시작 16
	CONTAINER_END = 1 << 5, // 컨테이너 끝 32
	BLOCK_START = 1 << 6, // 블럭 시작 64
	BLOCK_END = 1 << 7, // 블럭 끝 128
	TABLECELL_START = 1 << 8, // 테이블 셀 시작 256
	TABLECELL_END = 1 << 9, // 테이블 셀 끝 512
	TABLEROW_START = 1 << 10, // 테이블 행 시작 1024
	TABLEROW_END = 1 << 11, // 테이블 행 끝 2048
	TABLE_START = 1 << 12, // 테이블 시작 4096
	TABLE_END = 1 << 13, // 테이블 끝 8192
}

const enum AnchorFlags {
	PREFER_LINE_START = 1 << 0,
	PREFER_BLOCK_START = 1 << 1,
	PREFER_CONTAINER_START = 1 << 2,
	PREFER_TABLECELL_START = 1 << 3,
	PREFER_TABLEROW_START = 1 << 4,
	PREFER_TABLE_START = 1 << 5,
	AFTER_CONTAINER = 1 << 6,
}

function translateTokenFlagsToAnchorFlags(tokenFlags: number): AnchorFlags {
	let flags = 0;
	if (tokenFlags & TokenFlags.LINE_START) {
		flags |= AnchorFlags.PREFER_LINE_START;
	}
	if (tokenFlags & TokenFlags.CONTAINER_START) {
		flags |= AnchorFlags.PREFER_CONTAINER_START;
	}
	if (tokenFlags & TokenFlags.TABLE_START) {
		flags |= AnchorFlags.PREFER_TABLE_START;
	}
	if (tokenFlags & TokenFlags.TABLEROW_START) {
		flags |= AnchorFlags.PREFER_TABLEROW_START;
	}
	if (tokenFlags & TokenFlags.TABLECELL_START) {
		flags |= AnchorFlags.PREFER_TABLECELL_START;
	}
	return flags;
}

class DiffSeek {
	#mainContainer: HTMLElement;
	//#preventScrollSync = false;
	#renderCallbackId: number | null = null;
	#leftEditor: Editor;
	#rightEditor: Editor;
	#editorContentsChanged: Record<EditorName, boolean> = {
		left: false,
		right: false,
	};

	#diffOptions: DiffOptions;
	#diffContext: DiffContext | null = null;
	#computeDiffCallbackId: number | null = null;
	#diffComputedCallbackId: number | null = null;
	#alignAnchorsCallbackId: number | null = null;
	#anchorsAligned = false;
	#textSelectionRange: Range | null = null;
	#zoom = window.devicePixelRatio;
	#sideView: SideView;
	#syncScroll = false;
	#scrollingEditor: Editor | null = null;
	#lastScrolledEditor: Editor | null = null;
	#preventScrollSync = false;
	#activeEditor: Editor | null = null;
	#lastActiveEditor: Editor | null = null;

	highlightedDiffIndexAtom = createAtom<number | null>("highlightedDiffIndex", null);

	constructor(mainContainer: HTMLElement, asideContainer: HTMLElement) {
		this.#mainContainer = mainContainer;

		this.#diffOptions = {
			algorithm: "histogram",
			tokenization: "word",
			whitespace: "ignore",
			greedyMatch: false,
			useLengthBias: true,
			maxGram: 4,
			lengthBiasFactor: 0.7,
			containerStartMultiplier: 1 / 0.85,
			containerEndMultiplier: 1 / 0.9,
			sectionHeadingMultiplier: 1 / 0.75,
			lineStartMultiplier: 1 / 0.9,
			lineEndMultiplier: 1 / 0.95,
			uniqueMultiplier: 1 / 0.6667,
		};

		const editorCallbacks: EditorCallbacks = {
			onContentChanging: (editor) => this.#onEditorContentChanging(editor),
			onContentChanged: (editor) => this.#onEditorContentChanged(editor),
			onHoverDiff: (editor, diffIndex) => this.#onEditorHoverDiff(editor, diffIndex),
			onRender: (editor) => this.#onEditorRender(editor),
			onScroll: (editor, scrollTop, scrollLeft) => this.#onEditorScroll(editor, scrollTop, scrollLeft),
			onScrollEnd: (editor) => this.#onEditorScrollEnd(editor),
			onResize: (editor) => this.#onEditorResize(editor),
			onDiffVisibilityChanged: (editor, entries) => this.#onEditorDiffVisibilityChanged(editor, entries),
			onRenderInvalidated: (editor, flags) => this.#onEditorRenderInvalidated(editor, flags),
			onFocus: (editor) => {
				this.#lastActiveEditor = this.#activeEditor = editor;
			},
			onBlur: (editor) => {
				this.#activeEditor = null;
			},
		};

		this.#leftEditor = new Editor(mainContainer, "left", editorCallbacks);
		this.#rightEditor = new Editor(mainContainer, "right", editorCallbacks);
		this.#editorContentsChanged = { left: true, right: true };

		this.#sideView = new SideView(asideContainer, this.#sideViewCallbacks);

		this.setupEventListeners();
	}

	#sideViewCallbacks: SideViewCallbacks = {
		onDiffItemMouseOver: (diffIndex) => {
			this.#leftEditor.setDiffHighlight(diffIndex);
			this.#rightEditor.setDiffHighlight(diffIndex);
			this.#requestRender();
		},
		onDiffItemMouseOut: () => {
			this.#leftEditor.setDiffHighlight(null);
			this.#rightEditor.setDiffHighlight(null);
			this.#requestRender();
		},
	};

	private setupEventListeners() {
		window.addEventListener("resize", () => {});

		document.addEventListener("selectionchange", () => {
			this.#updateTextSelection();
		});

		document.addEventListener(
			"keydown",
			(e) => {
				if (e.key === "F8") {
					this.#diffOptions.whitespace = this.#diffOptions.whitespace === "ignore" ? "normalize" : "ignore";
				}
				if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
					e.preventDefault();
					const editor = e.key === "1" ? this.#leftEditor : this.#rightEditor;
					editor.editor.focus();
					return;
				}
				if (e.key === "F2") {
					e.preventDefault();
					this.syncScroll = !this.#syncScroll;
				}
			},
			true
		);

		highlightedDiffIndexAtom.subscribe((diffIndex) => {
			this.#leftEditor.setDiffHighlight(diffIndex);
			this.#rightEditor.setDiffHighlight(diffIndex);
			this.#requestRender();
		});

		diffItemClickedEvent.subscribe((diffIndex) => {
			// let count = 2;
			// function onScrollEnd() {
			// 	if (--count === 0) {
			// 		preventScrollSync = false;
			// 	}
			// }
			// this.#leftEditor.wrapper.addEventListener("scrollend", onScrollEnd, { once: true });
			// this.#rightEditor.wrapper.addEventListener("scrollend", onScrollEnd, { once: true });

			// this.#leftEditor.scrollToDiff(diffIndex);

			// TODO
			// 양쪽 에디터에서 해당 diff의 y좌표를 구해서 그 중 작은 값을 기준으로 스크롤 해야함.
			// 혹은 위로 스크롤 해야되는지 아래로 스크롤 해야하는지를 확인해서...
			this.scrollToDiff(diffIndex);
		});
	}

	#onEditorContentChanging(editor: Editor) {
		this.reset();
		this.#leftEditor.setDiffHighlight(null);
		this.#rightEditor.setDiffHighlight(null);
		this.#cancelAllCallbacks();
	}

	#onEditorContentChanged(editor: Editor) {
		this.#editorContentsChanged[editor.name] = true;
		this.#cancelAllCallbacks();
		this.#computeDiff();
	}

	#onEditorHoverDiff(editor: Editor, diffIndex: number | null) {
		// this.#leftEditor.setDiffHighlight(diffIndex);
		// this.#rightEditor.setDiffHighlight(diffIndex);
		this.#requestRender();
	}

	#onEditorScroll(editor: Editor, scrollTop: number, scrollLeft: number) {
		if (this.#scrollingEditor === null) {
			this.#lastScrolledEditor = this.#scrollingEditor = editor;
		}

		if (this.#syncScroll) {
			if (!this.#preventScrollSync && this.#scrollingEditor === editor) {
				const otherEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
				otherEditor.scrollTo(scrollTop, { behavior: "instant" });
			}
		}

		this.#requestRender();
	}

	#onEditorScrollEnd(editor: Editor) {
		if (this.#scrollingEditor === editor) {
			this.#scrollingEditor = null;
		}
	}

	#onEditorResize(editor: Editor) {
		this.#anchorsAligned = false;
		this.#requestRender();
	}

	#onEditorDiffVisibilityChanged(editor: Editor, entries: VisibilityChangeEntry[]) {
		this.#sideView.onDiffVisibilityChange(editor.name, entries);
	}

	#onEditorRenderInvalidated(editor: Editor, flags: RenderFlags = RenderFlags.NONE) {
		this.#requestRender();
	}

	#onEditorRender(editor: Editor) {
		this.#anchorsAligned = false;
		this.#requestRender();
	}

	#requestRender() {
		if (this.#renderCallbackId) {
			// 거~의 모든 경우에 render는 가장 마지막에 일어나야 하므로 이미 예약된 콜백을 취소하고 다시 등록함.
			cancelAnimationFrame(this.#renderCallbackId);
			this.#renderCallbackId = null;
		}

		if (this.#syncScroll && !this.#anchorsAligned) {
			this.alignAnchors();
		}
		this.#renderCallbackId = requestAnimationFrame(() => {
			this.#renderCallbackId = null;
			this.#doRender();
		});
	}

	#doRender() {
		this.#leftEditor.render();
		this.#rightEditor.render();
	}

	#updateTextSelection() {
		if (!this.#diffContext || !this.#diffContext.rawDiffs) return;

		const selection = window.getSelection();
		let editor: Editor | null = null;
		let targetEditor: Editor | null = null;
		let targetRange: Range | null = null;

		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);

			if (this.#leftEditor.wrapper.contains(range.commonAncestorContainer)) {
				editor = this.#leftEditor;
			} else if (this.#rightEditor.wrapper.contains(range.commonAncestorContainer)) {
				editor = this.#rightEditor;
			}

			if (editor) {
				// onContentChanging에서 diffContext를 null로 설정하므로 이 시점에서 에디터는 유효한 토큰 배열을 가지고 있다고 볼 수 있다.
				const [startTokenIndex, endTokenIndex] = editor.findTokenOverlapIndices(range);
				if (startTokenIndex >= 0 && endTokenIndex >= startTokenIndex) {
					const [otherStartTokenIndex, otherEndTokenIndex] = mapTokenRangeToOtherSide(
						this.#diffContext.rawDiffs,
						editor === this.#leftEditor ? "left" : "right",
						startTokenIndex,
						endTokenIndex
					);

					if (otherStartTokenIndex >= 0) {
						targetEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
						const otherStartToken = targetEditor.tokens[otherStartTokenIndex];
						const otherEndToken = targetEditor.tokens[otherEndTokenIndex - 1];
						if (otherStartToken && otherEndToken) {
							targetRange = document.createRange();
							targetRange.setStart(otherStartToken.range.startContainer, otherStartToken.range.startOffset);
							targetRange.setEnd(otherEndToken.range.endContainer, otherEndToken.range.endOffset);
						}
					}
				}
			}
		}

		if (this.#textSelectionRange === targetRange) {
			return;
		}

		if (this.#textSelectionRange && targetRange) {
			if (
				targetRange.startContainer === this.#textSelectionRange.startContainer &&
				targetRange.startOffset === this.#textSelectionRange.startOffset &&
				targetRange.endContainer === this.#textSelectionRange.endContainer &&
				targetRange.endOffset === this.#textSelectionRange.endOffset
			) {
				return;
			}
		}

		this.#textSelectionRange = targetRange;
		if (targetRange) {
			editor!.setSelectionHighlight(null);
			targetEditor!.setSelectionHighlight(targetRange);
		} else {
			this.#leftEditor.setSelectionHighlight(null);
			this.#rightEditor.setSelectionHighlight(null);
		}

		this.#requestRender();
	}

	#computeDiff() {
		this.#cancelAllCallbacks();

		const leftRichTokens = this.#leftEditor.tokens;
		const rightRichTokens = this.#rightEditor.tokens;
		const options = { ...this.#diffOptions };
		const diffContext: Partial<DiffContext> = {
			leftTokens: leftRichTokens,
			rightTokens: rightRichTokens,
			diffOptions: options,
			outdated: false,
		};
		this.#diffContext = diffContext as DiffContext;

		function buildTokenArray(richTokens: readonly RichToken[]): Token[] {
			const result: Token[] = new Array(richTokens.length);
			for (let i = 0; i < richTokens.length; i++) {
				const richToken = richTokens[i];
				result[i] = {
					text: richToken.text,
					flags: richToken.flags,
				};
			}
			return result;
		}

		this.#computeDiffCallbackId = requestIdleCallback(async () => {
			this.#computeDiffCallbackId = null;
			if (this.#diffContext !== diffContext) {
				return;
			}

			// worker에서 이전 토큰들을 캐시하고 있기 때문에 변경되지 않았으면 그냥 null을 보냄
			const leftTokens = this.#editorContentsChanged.left ? buildTokenArray(leftRichTokens) : null;
			const rightTokens = this.#editorContentsChanged.right ? buildTokenArray(rightRichTokens) : null;

			let result: DiffResult;
			try {
				result = await computeDiffAsync(leftTokens, rightTokens, options);
			} catch (error) {
				if (error instanceof Error && error.message === "cancelled") {
					return;
				}
				throw error;
			}

			if (this.#diffContext !== diffContext) {
				return;
			}

			diffContext.rawDiffs = result.diffs;
			diffContext.processTime = result.processTime;

			// if (this.#diffComputedCallbackId !== null) {
			// 	cancelIdleCallback(this.#diffComputedCallbackId);
			// 	this.#diffComputedCallbackId = null;
			// }

			this.#diffComputedCallbackId = requestIdleCallback(() => {
				this.#diffComputedCallbackId = null;
				if (this.#diffContext !== diffContext) {
					return;
				}
				// 이게 짜증날정도로 오래 걸린다면 generator로 쪼개서 스텝 바이 스텝으로 처리해야된다.
				// 지금은 일단 그냥 둠.
				this.#onDiffComputed(diffContext);
			});
		});
	}

	#onDiffComputed(diffContext: Partial<DiffContext>) {
		const leftTokens = diffContext.leftTokens!;
		const rightTokens = diffContext.rightTokens!;
		const rawEntries = diffContext.rawDiffs!;

		const diffs: DiffItem[] = [];
		const anchors: AnchorPair[] = [];

		// 지옥으로 간다...
		this.#leftEditor.withUpdate((leftFn) => {
			this.#rightEditor.withUpdate((rightFn) => {
				const ANCHOR_MIN_LINE_BREAKS = 1; // 앵커를 붙일 때 최소한의 줄바꿈 수.
				let forceStart = true;
				let currentDiff: RawDiff | null = null;

				for (let i = 0; i < rawEntries.length; i++) {
					const rawEntry = rawEntries[i];
					const left = rawEntry.left;
					const right = rawEntry.right;

					if (rawEntry.type) {
						if (currentDiff) {
							console.assert(currentDiff.left.pos + currentDiff.left.len === rawEntry.left.pos, currentDiff, rawEntry);
							console.assert(currentDiff.right.pos + currentDiff.right.len === rawEntry.right.pos, currentDiff, rawEntry);
							currentDiff.type |= rawEntry.type;
							currentDiff.left.len += rawEntry.left.len;
							currentDiff.right.len += rawEntry.right.len;
						} else {
							currentDiff = { left: { ...rawEntry.left }, right: { ...rawEntry.right }, type: rawEntry.type };
						}
					} else {
						// common entry
						if (currentDiff) {
							finalizeDiff();
						}

						const leftToken = leftTokens[left.pos];
						const rightToken = rightTokens[right.pos];

						const leftTokenFlags = leftToken.flags;
						const rightTokenFlags = rightToken.flags;
						const commonFlags = leftTokenFlags & rightTokenFlags;
						let anchorEligible = false;
						if (commonFlags & TokenFlags.LINE_START) {
							anchorEligible = forceStart;

							if (!anchorEligible && commonFlags & TokenFlags.CONTAINER_START) {
								anchorEligible = true;
							}

							if (!anchorEligible && commonFlags & SECTION_HEADING_MASK) {
								anchorEligible = true;
							}

							if (!anchorEligible) {
								const leftPrevToken = leftTokens[left.pos - 1];
								const rightPrevToken = rightTokens[right.pos - 1];
								if (
									(leftTokenFlags | rightTokenFlags) &
									(TokenFlags.TABLECELL_START | TokenFlags.TABLEROW_START | TokenFlags.TABLE_START | TokenFlags.CONTAINER_START)
								) {
									anchorEligible = true;
								}

								if (!anchorEligible) {
									const l = !leftPrevToken || leftToken.lineNum - leftTokens[left.pos - 1].lineNum >= ANCHOR_MIN_LINE_BREAKS;
									const r = !rightPrevToken || rightToken.lineNum - rightTokens[right.pos - 1].lineNum >= ANCHOR_MIN_LINE_BREAKS;
									anchorEligible = l || r;
								}
							}
						}

						if (anchorEligible) {
							forceStart = false;
							const leftAnchorEl = leftFn.getAnchor(left.pos, translateTokenFlagsToAnchorFlags(leftTokenFlags));
							const rightAnchorEl = rightFn.getAnchor(right.pos, translateTokenFlagsToAnchorFlags(rightTokenFlags));
							if (leftAnchorEl && rightAnchorEl) {
								leftAnchorEl.dataset.tokenIndex = String(left.pos);
								rightAnchorEl.dataset.tokenIndex = String(right.pos);
								anchors.push({
									leftEl: leftAnchorEl,
									rightEl: rightAnchorEl,
								});
							} else {
							}
						}
					}
				}
				if (currentDiff) {
					finalizeDiff();
				}

				function finalizeDiff() {
					const diffIndex = diffs.length;
					const leftIndex = currentDiff!.left.pos;
					const rightIndex = currentDiff!.right.pos;
					const leftTokenCount = currentDiff!.left.len;
					const rightTokenCount = currentDiff!.right.len;
					const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];
					let leftRange: Range | null;
					let rightRange: Range | null;
					let leftAnchorEl: HTMLElement | null = null;
					let rightAnchorEl: HTMLElement | null = null;

					const leftDiffItem: EditorDiff = {
						diffIndex,
						tokenIndex: leftIndex,
						tokenCount: leftTokenCount,
						flags: 0,
						hue,
						preferBlockStart: false,
					};

					const rightDiffItem: EditorDiff = {
						diffIndex,
						tokenIndex: rightIndex,
						tokenCount: rightTokenCount,
						flags: 0,
						hue,
						preferBlockStart: false,
					};

					if (leftTokenCount > 0 && rightTokenCount > 0) {
						leftRange = leftFn.getTokenRange(leftIndex, leftTokenCount);
						rightRange = rightFn.getTokenRange(rightIndex, rightTokenCount);
						const leftToken = leftTokens[leftIndex];
						const rightToken = rightTokens[rightIndex];
						if (leftToken.flags & rightToken.flags & TokenFlags.LINE_START) {
							leftAnchorEl = leftFn.getAnchor(leftIndex, translateTokenFlagsToAnchorFlags(leftToken.flags));
							rightAnchorEl = rightFn.getAnchor(rightIndex, translateTokenFlagsToAnchorFlags(rightToken.flags));
						}
					} else {
						let filledItem, emptyItem;
						let filledTokens, emptyTokens;
						let filledTokenIndex, emptyTokenIndex;
						let filledTokenCount;
						let filledFn: UpdateFuncs;
						let emptyFn: UpdateFuncs;
						let filledAnchor: HTMLElement | null = null;
						let emptyAnchor: HTMLElement | null = null;

						if (leftTokenCount > 0) {
							filledItem = leftDiffItem;
							filledTokens = leftTokens;
							filledTokenIndex = leftIndex;
							filledTokenCount = leftTokenCount;
							filledFn = leftFn;
							emptyItem = rightDiffItem;
							emptyTokenIndex = rightIndex;
							emptyTokens = rightTokens;
							emptyFn = rightFn;
						} else {
							filledItem = rightDiffItem;
							filledTokens = rightTokens;
							filledTokenIndex = rightIndex;
							filledTokenCount = rightTokenCount;
							filledFn = rightFn;
							emptyItem = leftDiffItem;
							emptyTokens = leftTokens;
							emptyTokenIndex = leftIndex;
							emptyFn = leftFn;
						}

						const filledToken = filledTokens[filledTokenIndex];
						const filledStartFlags = filledToken.flags;

						let bestPoint: InsertionPoint | null = null;
						let bestScore = 0;
						for (const point of emptyFn.getDiffAnchorPointsInRange(emptyTokenIndex)) {
							let score = 0;
							if (point.flags & InsertionPointFlags.TABLEROW_START && filledStartFlags & TokenFlags.TABLEROW_START) {
								score += 5;
							} else if (point.flags & InsertionPointFlags.TABLEROW_START && filledStartFlags & TokenFlags.TABLEROW_START) {
								score += 4;
							} else if (point.flags & InsertionPointFlags.TABLECELL_START && filledStartFlags & TokenFlags.TABLECELL_START) {
								score += 3;
							} else if (point.flags & InsertionPointFlags.CONTAINER_START && filledStartFlags & TokenFlags.CONTAINER_START) {
								score += 2;
							} else if (point.flags & InsertionPointFlags.BLOCK_START && filledStartFlags & TokenFlags.BLOCK_START) {
								score += 1;
							}
							if (score > bestScore) {
								bestScore = score;
								bestPoint = point;
							}
						}

						if (bestPoint) {
							emptyAnchor = emptyFn.getDiffAnchor(bestPoint);
							if (emptyAnchor) {
								if (filledStartFlags & TokenFlags.LINE_START) {
									filledAnchor = filledFn.getAnchor(filledTokenIndex, translateTokenFlagsToAnchorFlags(filledStartFlags));
								}
							}
						}

						const filledRange = filledFn.getTokenRange(filledTokenIndex, filledTokenCount);
						let emptyRange: Range | null = null;
						if (emptyAnchor) {
							emptyRange = document.createRange();
							emptyRange.selectNode(emptyAnchor);
						} else {
							emptyRange = emptyFn.getTokenRange(emptyTokenIndex, 0);
						}

						if (leftTokenCount > 0) {
							leftRange = filledRange;
							leftAnchorEl = filledAnchor;
							rightRange = emptyRange;
							rightAnchorEl = emptyAnchor;
						} else {
							rightRange = filledRange;
							rightAnchorEl = filledAnchor;
							leftRange = emptyRange;
							leftAnchorEl = emptyAnchor;
						}
					}

					leftFn.setDiff(leftRange, leftDiffItem);
					rightFn.setDiff(rightRange, rightDiffItem);
					diffs.push({
						diffIndex,
						hue,
						leftRange,
						rightRange,
					});
					if (leftAnchorEl && rightAnchorEl) {
						anchors.push({
							leftEl: leftAnchorEl,
							rightEl: rightAnchorEl,
							diffIndex,
						});
					}
					currentDiff = null;
					forceStart = true;
				}
			});
		});

		diffContext.diffs = diffs;
		diffContext.anchors = anchors;

		this.#diffContext = diffContext as DiffContext;
		// console.log("results", diffs, anchors);
		// this.alignAnchors();
		this.#updateTextSelection();
		this.#requestRender();

		this.#sideView.setDiffs(diffs);
	}

	#_resizeCancelId: number | null = null;

	/*
	눈물나게 무거운 작업임. 연속적으로 reflow 발생.
	특히 앵커가 많은 경우 브라우저가 "좀 심한데?"라고 경고를 던져주는데 딱히 대안이 없음.
	대안1: 화면에 렌더링되는 앵커들만 맞춰준다? 이건 현재 보이는 영역보다 위의 앵커들이 다 맞춰진 걸로 치고 거기서부터 기준점을 잡고 화면을 벗어날 때까지 앵커좌표를 맞춰가는 건데
	      문서의 흐름이 반드시 위에서 아래로 흐르지는 않기 때문에(table) 하나의 기준점을 찾기가 어렵다.
	*/
	alignAnchors() {
		if (this.#_resizeCancelId !== null) {
			cancelIdleCallback(this.#_resizeCancelId);
			this.#_resizeCancelId = null;
		}

		if (!this.#syncScroll) {
			return;
		}

		if (this.#anchorsAligned) {
			return;
		}

		if (!this.#diffContext || !this.#diffContext.anchors) {
			return;
		}

		this.#preventScrollSync = true;

		const MIN_DELTA = 1;
		const MIN_STRIPED_DELTA = 10;
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;
		let leftScrollTop = leftEditor.scrollTop;
		let rightScrollTop = rightEditor.scrollTop;
		const anchors = this.#diffContext.anchors;
		for (let i = 0; i < anchors.length; i++) {
			const { leftEl, rightEl } = anchors[i];
			leftEl.classList.remove("padtop", "striped");
			rightEl.classList.remove("padtop", "striped");
			leftEl.style.removeProperty("--padding");
			rightEl.style.removeProperty("--padding");

			void this.#leftEditor.wrapper.offsetHeight; // force reflow
			void this.#rightEditor.wrapper.offsetHeight; // force reflow

			let leftY: number;
			let rightY: number;
			let delta: number;

			leftY = leftEl.getBoundingClientRect().y + leftScrollTop; //leftEditor.wrapper.scrollTop;
			rightY = rightEl.getBoundingClientRect().y + rightScrollTop; //rightEditor.wrapper.scrollTop;
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
		}

		leftEditor.editor.style.removeProperty("--min-height");
		rightEditor.editor.style.removeProperty("--min-height");
		this.#_resizeCancelId = requestAnimationFrame(() => {
			this.#anchorsAligned = true; // do we really need this?

			const leftHeight = leftEditor.editor.scrollHeight;
			const rightHeight = rightEditor.editor.scrollHeight;
			const maxHeight = Math.max(leftHeight, rightHeight);
			leftEditor.editor.style.setProperty("--min-height", `${maxHeight}px`);
			rightEditor.editor.style.setProperty("--min-height", `${maxHeight}px`);

			const currentEditor = this.#lastScrolledEditor ?? this.#lastActiveEditor ?? this.#rightEditor;
			const newScrollTop = currentEditor.scrollTop;
	
			this.#scrollingEditor = null;
			if (currentEditor === leftEditor) {
				rightEditor.scrollTo(newScrollTop, { behavior: "instant" });
			} else {
				leftEditor.scrollTo(newScrollTop, { behavior: "instant" });
			}
			this.#preventScrollSync = false;
		});

		this.#anchorsAligned = true;
	}

	#cancelAllCallbacks() {
		if (this.#alignAnchorsCallbackId !== null) {
			cancelAnimationFrame(this.#alignAnchorsCallbackId);
			this.#alignAnchorsCallbackId = null;
		}
		if (this.#computeDiffCallbackId !== null) {
			cancelIdleCallback(this.#computeDiffCallbackId);
			this.#computeDiffCallbackId = null;
		}
		if (this.#diffComputedCallbackId !== null) {
			cancelIdleCallback(this.#diffComputedCallbackId);
			this.#diffComputedCallbackId = null;
		}
	}

	reset() {
		this.#diffContext = null;
		this.#textSelectionRange = null;
		this.#anchorsAligned = false;
		this.#leftEditor.setSelectionHighlight(null);
		this.#rightEditor.setSelectionHighlight(null);
	}

	scrollToDiff(diffIndex: number) {
		const leftRect = this.#leftEditor.getDiffRect(diffIndex);
		const rightRect = this.#rightEditor.getDiffRect(diffIndex);
		if (!leftRect || !rightRect) {
			return;
		}

		if (this.#syncScroll) {
			let scrollTop = Math.min(leftRect.y, rightRect.y);
			scrollTop = Math.max(scrollTop - SCROLL_MARGIN, 0);
			this.#leftEditor.scrollTo(scrollTop, { behavior: "smooth" });
		} else {
			const leftScrollTop = leftRect.y - SCROLL_MARGIN;
			const rightScrollTop = rightRect.y - SCROLL_MARGIN;
			this.#leftEditor.scrollTo(leftScrollTop, { behavior: "smooth" });
			this.#rightEditor.scrollTo(rightScrollTop, { behavior: "smooth" });
		}
	}

	get syncScroll() {
		return this.#syncScroll;
	}

	set syncScroll(value: boolean) {
		value = !!value;
		if (value === this.#syncScroll) {
			return;
		}

		this.#syncScroll = value;
		this.#mainContainer.classList.toggle("sync-scroll", value);

		if (value) {
			if (this.#alignAnchorsCallbackId !== null) {
				cancelAnimationFrame(this.#alignAnchorsCallbackId);
				this.#alignAnchorsCallbackId = null;
			}
			this.#alignAnchorsCallbackId = requestAnimationFrame(() => {
				this.#alignAnchorsCallbackId = null;
				this.alignAnchors();
			});
			this.#requestRender();
		}
	}
}
