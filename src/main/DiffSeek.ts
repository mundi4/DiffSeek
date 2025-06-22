// atoms
// 이렇게까지 하게 될지는 몰랐는데 ui요소마다 콜백을 넘기고 또 그걸 또 감싸서 자식으로 넘기고... 귀찮잖아...
const highlightedDiffIndexAtom = createAtom<number | null>("highlightedDiffIndex", null);
const diffItemClickedEvent = createEventAtom<number>("diffItemClickedEvent");

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
	#textSelectionRange: Range | null = null;
	#zoom = window.devicePixelRatio; //내가 이걸... 어디에서 썼더라...? ;;
	#sideView: SideView;
	#scrollSync = false;
	#scrollingEditor: Editor | null = null;
	#lastScrolledEditor: Editor | null = null;
	#preventScrollSync = false;
	#activeEditor: Editor | null = null;
	#lastActiveEditor: Editor | null = null;
	#scrollEndTimeoutId: number | null = null;
	#lastScrolledToDiffIndex: number | null = null;

	#anchorObserver = new IntersectionObserver((entries) => {}, {});
	#anchorManager: AnchorManager;
	#resized = true;
	#renderer: Renderer;

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
			onScroll: (editor, scrollTop, scrollLeft) => this.#onEditorScroll(editor, scrollTop, scrollLeft),
			onScrollEnd: (editor) => this.#onEditorScrollEnd(editor),
			onResize: (editor) => this.#onEditorResize(editor),
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
		this.#anchorManager = new AnchorManager(this.#leftEditor, this.#rightEditor);

		this.#sideView = new SideView(asideContainer);

		const resizeObserver = new ResizeObserver(() => this.#onContainerResize());
		resizeObserver.observe(mainContainer);

		const rendererCallbacks: RendererCallbacks = {
			onRender: () => this.#onRender(),
			onDiffVisibilityChanged: (region, entries) => this.#onDiffVisibilityChanged(region, entries),
		};

		this.#renderer = new Renderer(mainContainer, this.#leftEditor, this.#rightEditor, rendererCallbacks);
		this.setupEventListeners();
	}

	#onContainerResize() {
		this.#renderer.invalidateLayout();
	}

	#onRender() {
		if (this.#scrollSync) {
			this.alignAnchors();
		}
	}

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
					e.preventDefault();
					this.#onEditorContentChanged(this.#leftEditor);
					this.#onEditorContentChanged(this.#rightEditor);
				} else if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
					e.preventDefault();
					const editor = e.key === "1" ? this.#leftEditor : this.#rightEditor;
					editor.focus();
					return;
				} else if (e.key === "F2") {
					e.preventDefault();
					this.syncScroll = !this.#scrollSync;
				}
				if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
					e.preventDefault();
					const diffs = this.#diffContext?.diffs;
					if (!diffs || diffs.length === 0) {
						return;
					}

					let diffIndex;
					if (this.#lastScrolledToDiffIndex === null) {
						diffIndex = e.key === "ArrowUp" ? diffs.length - 1 : 0;
					} else {
						diffIndex = this.#lastScrolledToDiffIndex + (e.key === "ArrowUp" ? -1 : 1);
						if (diffIndex < 0) {
							diffIndex = diffs.length - 1;
						} else if (diffIndex >= diffs.length) {
							diffIndex = 0;
						}
					}
					this.#lastScrolledToDiffIndex = diffIndex;
					// this.scrollToDiff(diffIndex);
					diffItemClickedEvent.emit(diffIndex);
				}
			},
			true
		);

		this.#mainContainer.addEventListener("mousemove", (e) => {
			const rect = this.#mainContainer.getBoundingClientRect();
			let x = e.clientX - rect.x;
			let y = e.clientY - rect.y;
			const diffIndex = this.#renderer.hitTest(x, y);
			highlightedDiffIndexAtom.set(diffIndex);
		});

		highlightedDiffIndexAtom.subscribe((diffIndex) => {
			this.#renderer.setDiffHighlight(diffIndex);
		});

		diffItemClickedEvent.subscribe((diffIndex) => {
			this.#lastScrolledToDiffIndex = diffIndex;
			this.scrollToDiff(diffIndex);
		});
	}

	#onEditorContentChanging(editor: Editor) {
		this.#reset();
	}

	#onEditorContentChanged(editor: Editor) {
		this.#editorContentsChanged[editor.name] = true;
		this.#computeDiff();
	}

	#onEditorScroll(editor: Editor, scrollTop: number, scrollLeft: number) {
		this.#renderer.invalidateScroll(editor.name);

		if (this.#preventScrollSync) {
			return;
		}

		if (this.#scrollingEditor === null) {
			this.#lastScrolledEditor = this.#scrollingEditor = editor;
		}

		if (this.#scrollingEditor === editor) {
			if (this.#scrollEndTimeoutId !== null) {
				clearTimeout(this.#scrollEndTimeoutId);
			}
			this.#scrollEndTimeoutId = setTimeout(() => {
				this.#onEditorScrollEnd(editor);
				this.#scrollEndTimeoutId = null;
			}, 100);
		}
	}

	#onEditorScrollEnd(editor: Editor) {
		if (this.#scrollingEditor === editor) {
			this.#scrollingEditor = null;
		}
	}

	#onEditorResize(editor: Editor) {
		this.#anchorManager.invalidateAllAnchors();
		this.#renderer.invalidateLayout();
	}

	#onDiffVisibilityChanged(region: "left" | "right", entries: VisibilityChangeEntry[]) {
		this.#sideView.onDiffVisibilityChange(region, entries);
	}

	// #requestRender() {
	// 	console.log("Requesting render...");
	// 	if (this.#renderCallbackId) {
	// 		// 거~의 모든 경우에 render는 가장 마지막에 일어나야 하므로 이미 예약된 콜백을 취소하고 다시 등록함.
	// 		cancelAnimationFrame(this.#renderCallbackId);
	// 		this.#renderCallbackId = null;
	// 	}

	// 	// if (this.#resized) {
	// 	// 	this.#resized = false;
	// 	// 	const anchors = this.#diffContext?.anchors;
	// 	// 	if (anchors && anchors.length > 0) {
	// 	// 		for (const anchor of anchors) {
	// 	// 			anchor.aligned = false;
	// 	// 		}
	// 	// 	}
	// 	// }

	// 	this.#renderCallbackId = requestAnimationFrame(() => {
	// 		this.#renderCallbackId = null;
	// 		this.#doRender();
	// 	});

	// 	this.#renderer.render();
	// }

	// #doRender() {
	// 	if (this.#scrollSync) {
	// 		this.alignAnchors();
	// 	}

	// 	// this.#leftEditor.render();
	// 	// this.#rightEditor.render();
	// }

	#updateTextSelection() {
		if (!this.#diffContext || !this.#diffContext.rawDiffs) return;

		const selection = window.getSelection();
		let editor: Editor | null = null;
		let targetEditor: Editor | null = null;
		let targetRange: Range | null = null;

		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);

			if (this.#leftEditor.contains(range)) {
				editor = this.#leftEditor;
			} else if (this.#rightEditor.contains(range)) {
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
		this.#renderer.setSelectionHighlight(targetEditor === this.#leftEditor ? "left" : "right", targetRange);
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
			ready: false,
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
			// console.debug("Diff computed:", result.processTime, "ms", result);

			// if (this.#diffComputedCallbackId !== null) {
			// 	cancelIdleCallback(this.#diffComputedCallbackId);
			// 	this.#diffComputedCallbackId = null;
			// }

			this.#diffComputedCallbackId = requestIdleCallback(() => {
				this.#diffComputedCallbackId = null;
				if (this.#diffContext !== diffContext) {
					return;
				}
				// 행여나 이게 짜증날 정도로 오래 걸린다면 generator로 쪼개서 쬐끔씩 처리해야하는데 지금은 일단 그냥 둠.
				this.#onDiffComputed(diffContext);
			});
		});
	}

	#onDiffComputed(diffContext: Partial<DiffContext>) {
		if (this.#diffContext !== diffContext) {
			return;
		}

		const leftTokens = diffContext.leftTokens!;
		const rightTokens = diffContext.rightTokens!;
		const rawEntries = diffContext.rawDiffs!;

		const diffs: DiffItem[] = [];
		highlightedDiffIndexAtom.set(null);
		this.#lastScrolledToDiffIndex = null;

		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		// 지옥으로 간다...
		this.#anchorManager.update((amFn) => {
			const ANCHOR_MIN_LINE_BREAKS = 0; // 앵커를 붙일 때 최소한의 줄바꿈 수.
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
					let leftAnchorFlags = AnchorFlags.None;
					let rightAnchorFlags = AnchorFlags.None;

					let anchorEligible = false;
					if (commonFlags & TokenFlags.LINE_START) {
						anchorEligible = forceStart;
						leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftTokenFlags);
						rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightTokenFlags);
						if (!(leftAnchorFlags & rightAnchorFlags)) {
						}
						// if (!leftAnchorFlags) {
						// 	if (
						// 		(leftTokenFlags | rightTokenFlags) &
						// 		(TokenFlags.TABLECELL_START | TokenFlags.TABLEROW_START | TokenFlags.TABLE_START | TokenFlags.CONTAINER_START)
						// 	) {
						// 		leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftTokenFlags | rightTokenFlags);
						// 		anchorEligible = true;
						// 	}

						// 	const leftPrevToken = leftTokens[left.pos - 1];
						// 	const rightPrevToken = rightTokens[right.pos - 1];
						// 	if (!anchorEligible) {
						// 		const l = !leftPrevToken || leftToken.lineNum - leftTokens[left.pos - 1].lineNum >= ANCHOR_MIN_LINE_BREAKS;
						// 		const r = !rightPrevToken || rightToken.lineNum - rightTokens[right.pos - 1].lineNum >= ANCHOR_MIN_LINE_BREAKS;
						// 		anchorEligible = l || r;
						// 	}
						// }
					}

					if (anchorEligible || (leftAnchorFlags && rightAnchorFlags)) {
						forceStart = false;
						// let anchorFlagsArr: AnchorFlags[] = [];
						// if (commonFlags & TokenFlags.TABLECELL_START) {
						// 	if (commonFlags & TokenFlags.TABLE_START) {
						// 		anchorFlagsArr.push(AnchorFlags.TABLE_START);
						// 	}
						// 	anchorFlagsArr.push(AnchorFlags.TABLECELL_START);
						// } else if (commonFlags & TokenFlags.BLOCK_START) {
						// 	anchorFlagsArr.push(AnchorFlags.BLOCK_START);
						// }

						// for (const anchorFlags of anchorFlagsArr) {
						// }
						amFn.tryAddAnchorPair(left.pos, leftAnchorFlags, right.pos, rightAnchorFlags);
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
				let leftAnchorFlags = AnchorFlags.None;
				let rightAnchorFlags = AnchorFlags.None;
				if (leftTokenCount > 0 && rightTokenCount > 0) {
					const leftToken = leftTokens[leftIndex];
					const rightToken = rightTokens[rightIndex];
					if (leftToken.flags & rightToken.flags & TokenFlags.LINE_START) {
						leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[leftIndex + leftTokenCount - 1].flags);
						rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[rightIndex + rightTokenCount - 1].flags);
					}
				} else {
					let filledTokens, emptyTokens;
					let filledTokenIndex, emptyTokenIndex;
					let filledTokenCount;
					if (leftTokenCount > 0) {
						filledTokens = leftTokens;
						filledTokenIndex = leftIndex;
						filledTokenCount = leftTokenCount;
						emptyTokenIndex = rightIndex;
						emptyTokens = rightTokens;
					} else {
						filledTokens = rightTokens;
						filledTokenIndex = rightIndex;
						filledTokenCount = rightTokenCount;
						emptyTokens = leftTokens;
						emptyTokenIndex = leftIndex;
					}

					const filledStartToken = filledTokens[filledTokenIndex];
					const filledStartFlags = filledStartToken.flags;
					const filledEndToken = filledTokens[filledTokenIndex + filledTokenCount - 1];
					const filledEndFlags = filledEndToken.flags;

					let filledAnchorFlags = AnchorFlags.None;
					let emptyAnchorFlags = AnchorFlags.None;
					if (
						filledStartFlags & TokenFlags.LINE_START
						// && filledEndFlags & TokenFlags.LINE_END
					) {
						filledAnchorFlags = translateTokenFlagsToAnchorFlags(filledStartFlags, filledEndFlags);
						emptyAnchorFlags = AnchorFlags.EMPTY_DIFF;
					}

					if (leftTokenCount > 0) {
						leftAnchorFlags = filledAnchorFlags;
						rightAnchorFlags = emptyAnchorFlags;
					} else {
						rightAnchorFlags = filledAnchorFlags;
						leftAnchorFlags = emptyAnchorFlags;
					}
				}

				const leftRange = leftEditor.getTokenRange(leftIndex, leftTokenCount);
				const rightRange = rightEditor.getTokenRange(rightIndex, rightTokenCount);

				diffs.push({
					diffIndex,
					hue,
					leftRange,
					rightRange,
				});

				if (leftAnchorFlags && rightAnchorFlags) {
					amFn.tryAddAnchorPair(leftIndex, leftAnchorFlags, rightIndex, rightAnchorFlags);
				}

				currentDiff = null;
				forceStart = true;
			}
		});

		diffContext.diffs = diffs;
		diffContext.ready = true;
		this.#renderer.setDiffs(diffs);
		this.#sideView.setDiffs(diffs);
		this.#updateTextSelection();
		this.#renderer.invalidateAll();
	}

	alignAnchors() {
		if (!this.#diffContext?.ready) {
			return;
		}

		this.#preventScrollSync = true;
		const primaryEditor = this.#lastScrolledEditor ?? this.#lastActiveEditor ?? this.#rightEditor;
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		let [changed, maxContentHeight] = this.#anchorManager.alignAnchors(primaryEditor, this.#mainContainer.getBoundingClientRect());
		if (changed) {
			if (isNaN(maxContentHeight)) {
				maxContentHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
			}
			leftEditor.height = maxContentHeight;
			rightEditor.height = maxContentHeight;
			//this.#renderer.invalidateScroll();
			this.#renderer.invalidateGeometries();
		}

		if (primaryEditor === leftEditor) {
			rightEditor.scrollTo(primaryEditor.scrollTop, { behavior: "instant" });
		} else {
			leftEditor.scrollTo(primaryEditor.scrollTop, { behavior: "instant" });
		}

		this.#scrollingEditor = null;
		this.#preventScrollSync = false;
		return changed;
	}

	#reset() {
		this.#diffContext = null;
		this.#textSelectionRange = null;
		this.#cancelAllCallbacks();
	}

	#cancelAllCallbacks() {
		if (this.#computeDiffCallbackId !== null) {
			cancelIdleCallback(this.#computeDiffCallbackId);
			this.#computeDiffCallbackId = null;
		}
		if (this.#diffComputedCallbackId !== null) {
			cancelIdleCallback(this.#diffComputedCallbackId);
			this.#diffComputedCallbackId = null;
		}
	}

	scrollToDiff(diffIndex: number) {
		const leftRect = this.#renderer.getDiffRect("left", diffIndex);
		const rightRect = this.#renderer.getDiffRect("right", diffIndex);
		if (!leftRect || !rightRect) {
			return;
		}

		if (this.#scrollSync) {
			let scrollTop = Math.min(leftRect.y, rightRect.y);
			scrollTop = Math.max(scrollTop - SCROLL_MARGIN, 0);
			this.#leftEditor.scrollTo(scrollTop, { behavior: "smooth" });
		} else {
			const leftScrollTop = Math.min(leftRect.y - SCROLL_MARGIN);
			const rightScrollTop = Math.min(rightRect.y - SCROLL_MARGIN);
			this.#leftEditor.scrollTo(leftScrollTop, { behavior: "smooth" });
			this.#rightEditor.scrollTo(rightScrollTop, { behavior: "smooth" });
		}
	}

	get syncScroll() {
		return this.#scrollSync;
	}

	set syncScroll(value: boolean) {
		value = !!value;
		if (value === this.#scrollSync) {
			return;
		}

		this.#scrollSync = value;
		this.#mainContainer.classList.toggle("same-height-besties", value);
		this.#renderer.invalidateLayout();
	}

	setContent(editorName: EditorName, contentHTML: string) {
		const editor = editorName === "left" ? this.#leftEditor : this.#rightEditor;
		editor.setContent(contentHTML);
	}
}

function findCommonEdgeContainer(
	lhsContainer: TextFlowContainer,
	lhsTokenIndex: number,
	rhsContainer: TextFlowContainer,
	rhsTokenIndex: number
): TextFlowContainer | null {
	while (lhsContainer && rhsContainer && lhsContainer !== rhsContainer) {
		if (lhsContainer.depth >= rhsContainer.depth) {
			if (lhsTokenIndex === lhsContainer.startTokenIndex || lhsTokenIndex === lhsContainer.startTokenIndex + lhsContainer.tokenCount - 1) {
				lhsContainer = lhsContainer.parent!;
			} else {
				break;
			}
		} else if (rhsContainer.depth >= lhsContainer.depth) {
			if (rhsTokenIndex === rhsContainer.startTokenIndex || rhsTokenIndex === rhsContainer.startTokenIndex + rhsContainer.tokenCount - 1) {
				rhsContainer = rhsContainer.parent!;
			} else {
				break;
			}
		}
	}

	return lhsContainer === rhsContainer ? lhsContainer : null;
}
