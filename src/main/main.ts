// 이것저것 이어붙이는 코드 집합

type SelectionHighlightRenderInfo = {
	editor: Editor;
	rects: Rect[];
};

type EditorRegion = {
	name: EditorName;
	x: number;
	y: number;
	width: number;
	height: number;
	scrollX: number;
	scrollY: number;
};

type HightlightRenderItems = {};

const enum RenderFlags {
	Scroll = 1 << 0,
	Diffs = 1 << 1,
	TextHighlight = 1 << 2,
	Layout = 1 << 3,
}

const DiffSeek = (function () {
	let _activeEditor: Editor | null = null;
	let _lastFocusedEditor: Editor | null = null;
	let _lastScrolledEditor: Editor | null = null;
	let _currentlyScrollingEditor: Editor | null = null;
	let _preventScrollSync = false;
	let _currentDiffIndex = -1;
	let _syncEditor = false;
	let _resetCurrentlyScrollingEditorId: number | null = null;
	// let _diffResult: DiffResponse | null = null;
	let _diffContext: DiffContext = { done: false, reqId: 0 } as DiffContext;
	let _outputOptions: OutputOptions = {
		// 어차피 나만 쓰는 기능일테니
		leftLabel: "대비표",
		rightLabel: "전문",
		htmlFormat: "div",
		textFormat: 0,
	};
	let _copyMode: CopyMode = "raw";
	let _lastNonRawCopyMode: Exclude<CopyMode, "raw"> = "compare";
	let _diffListItemElements: HTMLElement[] = [];
	let _aligned = true;
	const _anchors: AnchorPairs[] = [];

	const _leftBottomPadding = document.createElement("A");
	_leftBottomPadding.contentEditable = "false";
	_leftBottomPadding.className = "bottom-padding";
	const _rightBottomPadding = document.createElement("A");
	_rightBottomPadding.contentEditable = "false";
	_rightBottomPadding.className = "bottom-padding";

	// 정말 지저분한 코드 시작
	const _diffOptions = (function (defaultValues: DiffOptions) {
		let _diffOptions = { ...defaultValues };

		function setValue<K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) {
			if (_diffOptions[key] !== value) {
				_diffOptions[key] = value;
				computeDiff();
			}
		}

		return {
			get algorithm() {
				return _diffOptions.algorithm;
			},
			set algorithm(value: DiffAlgorithm) {
				if (value !== "histogram" && value !== "lcs") {
					throw new Error("Invalid algorithm: " + value);
				}
				setValue("algorithm", value);
			},

			get tokenization() {
				return _diffOptions.tokenization;
			},
			set tokenization(value: TokenizationMode) {
				if (value !== "char" && value !== "word" && value !== "line") {
					throw new Error("Invalid tokenization: " + value);
				}
				setValue("tokenization", value);
			},

			get whitespace() {
				return _diffOptions.whitespace;
			},
			set whitespace(value: WhitespaceHandling) {
				if (value !== "ignore" && value !== "normalize") {
					throw new Error("Invalid whitespace handling: " + value);
				}
				setValue("whitespace", value);
			},

			get greedyMatch() {
				return !!_diffOptions.greedyMatch;
			},
			set greedyMatch(value: boolean) {
				if (value !== true && value !== false) {
					throw new Error("Invalid greedyMatch: " + value);
				}
				setValue("greedyMatch", !!value);
			},

			get useLengthBias() {
				return !!_diffOptions.useLengthBias;
			},
			set useLengthBias(value: boolean) {
				if (value !== true && value !== false) {
					throw new Error("Invalid useLengthBias: " + value);
				}
				setValue("useLengthBias", !!value);
			},

			get maxGram() {
				return _diffOptions.maxGram;
			},
			set maxGram(value: number) {
				if (value < 1) {
					throw new Error("Invalid maxGram: " + value);
				}
				setValue("maxGram", value);
			},

			get lengthBiasFactor() {
				return _diffOptions.lengthBiasFactor;
			},
			set lengthBiasFactor(value: number) {
				if (value <= 0) {
					throw new Error("Invalid lengthBiasFactor: " + value);
				}
				setValue("lengthBiasFactor", value);
			},
			get sectionHeadingMultiplier() {
				return _diffOptions.sectionHeadingMultiplier;
			},
			set sectionHeadingMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid sectionHeadingMultiplier: " + value);
				}
				setValue("sectionHeadingMultiplier", value);
			},
			get lineStartMultiplier() {
				return _diffOptions.lineStartMultiplier;
			},
			set lineStartMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid lineStartMultiplier: " + value);
				}
				setValue("lineStartMultiplier", value);
			},
			get lineEndMultiplier() {
				return _diffOptions.lineEndMultiplier;
			},
			set lineEndMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid lineEndMultiplier: " + value);
				}
				setValue("lineEndMultiplier", value);
			},
			get uniqueMultiplier() {
				return _diffOptions.uniqueMultiplier;
			},
			set uniqueMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid uniqueMultiplier: " + value);
				}
				setValue("uniqueMultiplier", value);
			},
			get containerStartMultiplier() {
				return _diffOptions.containerStartMultiplier;
			},
			set containerStartMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid containerStartMultiplier: " + value);
				}
				setValue("containerStartMultiplier", value);
			},
			get containerEndMultiplier() {
				return _diffOptions.containerEndMultiplier;
			},
			set containerEndMultiplier(value: number) {
				if (value <= 0) {
					throw new Error("Invalid containerEndMultiplier: " + value);
				}
				setValue("containerEndMultiplier", value);
			},
		};
	})({
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
	});

	const mainContainer = document.getElementById("main") as HTMLElement;
	const leftEditor = createEditor(mainContainer, "left", getEditorCallbacks("left"));
	const rightEditor = createEditor(mainContainer, "right", getEditorCallbacks("right"));

	const diffCanvas = document.createElement("canvas");
	diffCanvas.id = "diffCanvas";
	mainContainer.appendChild(diffCanvas);
	const diffCanvasCtx = diffCanvas.getContext("2d")!;

	const highlightCanvas = document.createElement("canvas");
	highlightCanvas.id = "highlightCanvas";
	mainContainer.appendChild(highlightCanvas);

	const body = document.querySelector("body") as HTMLBodyElement;
	const diffList = document.getElementById("diffList") as HTMLUListElement;
	const highlightStyle = document.getElementById("highlightStyle") as HTMLStyleElement;
	const progress = document.getElementById("progress") as HTMLElement;
	const scrollSyncIndicator = document.getElementById("scrollSyncIndicator") as HTMLElement;
	const alignmentStyleElement = document.createElement("style");
	document.head.appendChild(alignmentStyleElement);

	const editorContentsChanged: Record<EditorName, boolean> = {
		left: true,
		right: true,
	};

	const renderer = createRenderer(mainContainer, leftEditor, rightEditor, {
		onDiffVisibilityChanged,
	} as RendererCallbacks);

	function onDiffVisibilityChanged(editorName: EditorName, shown: number[], hidden: number[]) {}

	function onSelectionChanged() {}

	function getEditorCallbacks(editorName: EditorName): EditorCallbacks {
		const pendingDiffVisibilities = new Map();
		let updateDiffVisilitiesPending = false;
		//const editor = editorName === "left" ? leftEditor : rightEditor;

		return {
			onTextChanged: function () {
				editorContentsChanged[editorName] = true;
				onSelectionChanged();
				computeDiff();
			},

			onScroll(scrollTop: number, _: number) {
				// updateCanvas();
				if (_preventScrollSync) {
					return;
				}
				const editor = editorName === "left" ? leftEditor : rightEditor;
				const otherEditor = editor === leftEditor ? rightEditor : leftEditor;
				otherEditor.scrollTop = scrollTop;
			},

			// 현재 화면 상에 보이는 diff 아이템들.
			onDiffVisibilityChanged: (entries: VisibilityChangeEntry[]) => {
				for (const entry of entries) {
					const diffIndex = entry.item as number;
					pendingDiffVisibilities.set(diffIndex, entry.isVisible);
				}
				if (!updateDiffVisilitiesPending) {
					updateDiffVisilitiesPending = true;
					requestAnimationFrame(() => {
						updateDiffVisilitiesPending = false;
						for (const [diffIndex, visible] of pendingDiffVisibilities) {
							const listItem = _diffListItemElements[diffIndex];
							if (listItem) {
								const button = listItem.firstElementChild as HTMLElement;
								button.classList.toggle(editorName + "-visible", visible);
							}
						}
						pendingDiffVisibilities.clear();
					});
				}
			},
		};
	}

	function createWorker() {
		// 보안 상 new Worker("worker.js")는 실행 안됨.
		let workerURL;
		const scriptElement = document.getElementById("worker.js") as HTMLScriptElement;
		const workerCode = scriptElement.textContent;
		if (workerCode!.length < 10) {
			workerURL = scriptElement.src; // "./dist/worker.js";
		} else {
			const blob = new Blob([workerCode!], { type: "application/javascript" });
			workerURL = URL.createObjectURL(blob);
		}
		const worker = new Worker(workerURL);

		return worker;
	}

	const { computeDiff } = (function () {
		const worker = createWorker();
		let _reqId = 0;
		let computeDiffTimeoutId: number | null = null;

		function* computeDiffGenerator(ctx: DiffContext) {
			let idleDeadline: IdleDeadline = yield ctx;

			const request: DiffRequest = {
				type: "diff",
				reqId: ctx.reqId,
				options: ctx.diffOptions,
				leftTokens: null,
				rightTokens: null,
			};

			const leftRichTokens: readonly RichToken[] = leftEditor.tokens;
			const rightRichTokens: readonly RichToken[] = rightEditor.tokens;

			if (editorContentsChanged.left) {
				const leftTokens: Token[] = new Array(leftEditor.tokens.length);
				for (let i = 0; i < leftEditor.tokens.length; i++) {
					const richToken = leftRichTokens[i];
					leftTokens[i] = {
						text: richToken.text,
						flags: richToken.flags,
					};
				}
				request.leftTokens = leftTokens;
				if (idleDeadline.timeRemaining() <= 1) {
					idleDeadline = yield;
				}
			}
			if (editorContentsChanged.right) {
				const rightTokens: Token[] = new Array(rightEditor.tokens.length);
				for (let i = 0; i < rightEditor.tokens.length; i++) {
					const richToken = rightRichTokens[i];
					rightTokens[i] = {
						text: richToken.text,
						flags: richToken.flags,
					};
				}
				request.rightTokens = rightTokens;
				if (idleDeadline.timeRemaining() <= 1) {
					idleDeadline = yield;
				}
			}
			console.debug("diff request:", request);
			worker.postMessage(request);
		}

		function computeDiff() {
			if (computeDiffTimeoutId) {
				cancelIdleCallback(computeDiffTimeoutId);
				//clearTimeout(computeDiffTimeoutId);
			}

			_currentDiffIndex = -1;
			body.classList.add("computing");
			progress.textContent = "...";

			const ctx = (_diffContext = {
				reqId: ++_reqId, //overflow 되는 순간 지구 멸망
				// leftText: leftText,
				// rightText: rightText,
				diffOptions: { ..._diffOptions },
				done: false,
				processTime: 0,
				leftTokens: leftEditor.tokens,
				rightTokens: rightEditor.tokens,
			});

			const generator = computeDiffGenerator(ctx);

			const step = (idleDeadline: IdleDeadline) => {
				computeDiffTimeoutId = null;
				const { done } = generator.next(idleDeadline);
				if (!done && ctx === _diffContext) {
					computeDiffTimeoutId = requestIdleCallback(step, { timeout: COMPUTE_DEBOUNCE_TIME });
				}
			};
			computeDiffTimeoutId = requestIdleCallback(step, { timeout: COMPUTE_DEBOUNCE_TIME });
		}

		worker.onmessage = function (e) {
			const data = e.data;
			console.debug("message received:", e);
			if (data.type === "diff") {
				if (data.reqId === _reqId) {
					body.classList.remove("computing");
					_diffContext.rawEntries = data.diffs;
					postProcess(_diffContext);
					_diffContext.done = true;
					_diffContext.processTime = data.processTime;

					renderer.setDiffRanges("left", _diffContext.leftDiffRanges!);
					renderer.setDiffRanges("right", _diffContext.rightDiffRanges!);

					onDiffComputed(_diffContext);
				}
			} else if (data.type === "start") {
				progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
			}
		};

		function onDiffComputed(diffContext: DiffContext) {
			// leftEditor.update(diffContext);
			// rightEditor.update(diffContext);
			// calculateDiffRects();
			// leftEditor.update({ diffs: diffContext.diffs!, anchors: diffContext.anchors!, headings: diffContext.headings! });
			// rightEditor.update({ diffs: diffContext.diffs!, anchors: diffContext.anchors!, headings: diffContext.headings! });
			// updateDiffList();
		}

		return { computeDiff };
	})();

	// function restoreSelectionRange({ editor, startOffset, endOffset }: { editor: Editor; startOffset: number; endOffset: number }) {
	// 	if (editor) {
	// 		editor.selectTextRange(startOffset, endOffset);
	// 	}
	// }

	function syncScrollPosition(sourceEditor: Editor | null) {}

	let resetHighlightId: number | null = null;
	function highlightDiff(diffIndex: number) {
		if (resetHighlightId !== null) {
			clearTimeout(resetHighlightId);
		}
		highlightStyle.textContent = `mark[data-diff="${diffIndex}"], mark[data-diff="${diffIndex}"]::after { 
	box-shadow: 0px 0px 15px 3px hsl(var(--diff-hue) 100% 80% / 0.8);
	animation: highlightAnimation 0.3s linear 3; 
	}`;
		resetHighlightId = setTimeout(() => {
			highlightStyle.textContent = "";
		}, 3000);
	}

	function highlightHeading(headingIndex: number) {
		if (resetHighlightId !== null) {
			clearTimeout(resetHighlightId);
		}
		highlightStyle.textContent = `[data-heading="${headingIndex}"] { 
	text-decoration-line: underline !important;
	}`;
		resetHighlightId = setTimeout(() => {
			highlightStyle.textContent = "";
		}, 2000);
	}

	document.addEventListener("mouseover", (e) => {
		if ((e.target as HTMLElement).dataset.diff !== undefined) {
			const diff = Number((e.target as HTMLElement).dataset.diff);
			// highlightDiff(diff);
			return;
		}
		if ((e.target as HTMLElement).dataset.heading !== undefined) {
			const heading = Number((e.target as HTMLElement).dataset.heading);
			highlightHeading(heading);
		}
	});

	document.addEventListener("mouseout", (e) => {
		if ((e.target as HTMLElement).dataset.diff !== undefined) {
			// const diff = Number((e.target as HTMLElement).dataset.diff);
			// highlightStyle.textContent = "";
			return;
		}
		if ((e.target as HTMLElement).dataset.heading !== undefined) {
			highlightStyle.textContent = "";
			if (resetHighlightId !== null) {
				clearTimeout(resetHighlightId);
			}
		}
	});

	document.addEventListener("selectionchange", (e) => {
		onSelectionChanged();
	});

	// syncScrollToggle.addEventListener("click", () => {
	// 	toggleSyncScroll();
	// });

	// alignedModeToggle.addEventListener("click", () => {
	// 	if (_alignedMode) {
	// 		disableAlignedMode();
	// 	} else {
	// 		enableAlignedMode();
	// 	}
	// });

	function toggleSyncScroll() {
		_syncEditor = !_syncEditor;
	}

	function updateDiffList() {
		// if (!_diffContext.done) {
		// 	return;
		// }
		// const diffs = _diffContext.diffs!;
		// const headings = _diffContext.headings ?? [];
		// _diffListItemElements.length = 0;
		// const fragment = document.createDocumentFragment();
		// let headingIndex = 0;
		// let leftPos = 0;
		// for (let i = 0; i < diffs.length; i++) {
		// 	const diff = diffs[i];
		// 	const thisLeftPos = diff.left.pos;
		// 	// 귀찮음의 정점. 대충 돌아가게만... 딱 거기까지만...
		// 	for (let j = leftPos; j < thisLeftPos; j++) {
		// 		for (; headingIndex < headings.length; headingIndex++) {
		// 			const heading = headings[headingIndex];
		// 			if (heading.left.pos > thisLeftPos) {
		// 				break;
		// 			}
		// 			const li = document.createElement("LI");
		// 			const hd = document.createElement("A");
		// 			hd.className = "heading";
		// 			hd.dataset.heading = headingIndex.toString();
		// 			hd.textContent = heading.ordinalText + " " + heading.title;
		// 			li.appendChild(hd);
		// 			fragment.appendChild(li);
		// 		}
		// 	}
		// 	const li = document.createElement("LI");
		// 	const button = document.createElement("MARK");
		// 	button.draggable = true;
		// 	button.dataset.diff = i.toString();
		// 	button.className = "diff-color" + ((i % NUM_DIFF_COLORS) + 1);
		// 	li.appendChild(button);
		// 	const leftText = leftEditor.sliceText(diff.left.pos, diff.left.pos + diff.left.len);
		// 	const leftSpan = document.createElement("SPAN");
		// 	leftSpan.textContent = leftText;
		// 	leftSpan.classList.add("left");
		// 	button.appendChild(leftSpan);
		// 	const rightText = rightEditor.sliceText(diff.right.pos, diff.right.pos + diff.right.len);
		// 	const rightSpan = document.createElement("SPAN");
		// 	rightSpan.textContent = rightText;
		// 	rightSpan.classList.add("right");
		// 	button.appendChild(rightSpan);
		// 	fragment.appendChild(li);
		// 	_diffListItemElements[i] = li;
		// 	leftPos = thisLeftPos;
		// }
		// for (; headingIndex < headings.length; headingIndex++) {
		// 	const heading = headings[headingIndex];
		// 	const li = document.createElement("LI");
		// 	const hd = document.createElement("A");
		// 	hd.className = "heading";
		// 	hd.dataset.heading = headingIndex.toString();
		// 	hd.textContent = heading.ordinalText + " " + heading.title;
		// 	li.appendChild(hd);
		// 	fragment.appendChild(li);
		// }
		// diffList.innerHTML = "";
		// diffList.appendChild(fragment);
	}

	document.addEventListener("copy", (e) => {
		if (_diffContext.done === false) {
			return;
		}

		if (true) {
			return;
		}

		// const selection = window.getSelection();
		// if (!selection || selection.isCollapsed) return;

		// const range = selection.getRangeAt(0);
		// const editor = leftEditor.wrapper.contains(range.commonAncestorContainer)
		// 	? leftEditor
		// 	: rightEditor.wrapper.contains(range.commonAncestorContainer)
		// 	? rightEditor
		// 	: null;
		// if (editor === null) {
		// 	return;
		// }

		// const [startOffset, endOffset] = editor.getTextSelectionRange();
		// if (startOffset === null || endOffset === null) return;
		// if (_copyMode === "raw" && !_alignedMode) {
		// 	return;
		// }

		// e.preventDefault();

		// const text = editor.text;
		// const tokens = editor === leftEditor ? _diffContext.leftTokens! : _diffContext.rightTokens!;
		// const otherTokens = editor === leftEditor ? _diffContext.rightTokens! : _diffContext.leftTokens!;
		// const rawEntries = _diffContext.rawEntries!;
		// const sideKey = editor === leftEditor ? "left" : "right";
		// const otherSideKey = sideKey === "left" ? "right" : "left";
		// const diffs = _diffContext.diffs!;

		// if (_copyMode === "raw") {
		// 	const plain = editor.text.slice(startOffset, endOffset);
		// 	e.clipboardData?.setData("text/plain", plain);
		// } else if (_copyMode === "compare") {
		// 	const [startIndex, endIndex] = getSelectedTokenRange(tokens, startOffset, endOffset);
		// 	const [mappedStartIndex, mappedEndIndex] = mapTokenRangeToOtherSide(rawEntries, sideKey, startIndex, endIndex);
		// 	const startToken = tokens[startIndex];
		// 	const endToken = tokens[endIndex - 1];
		// 	const otherStartToken = otherTokens[mappedStartIndex];
		// 	const otherEndToken = otherTokens[mappedEndIndex - 1];

		// 	const startPos = startToken?.pos ?? 0;
		// 	const endPos = endToken ? endToken.pos + endToken.len : startPos;
		// 	const otherStartPos = otherStartToken?.pos ?? 0;
		// 	const otherEndPos = otherEndToken ? otherEndToken.pos + otherEndToken.len : otherStartPos;

		// 	const leftRuns = getTextRuns(
		// 		"left",
		// 		leftEditor.text,
		// 		{ diffs },
		// 		sideKey === "left" ? startPos : otherStartPos,
		// 		sideKey === "left" ? endPos : otherEndPos
		// 	);
		// 	const rightRuns = getTextRuns(
		// 		"right",
		// 		rightEditor.text,
		// 		{ diffs },
		// 		sideKey === "right" ? startPos : otherStartPos,
		// 		sideKey === "right" ? endPos : otherEndPos
		// 	);

		// 	const html = buildOutputHTML(leftEditor.text, leftRuns, rightEditor.text, rightRuns, _outputOptions);
		// 	const plain = buildOutputPlainText(leftEditor.text, leftRuns, rightEditor.text, rightRuns, _outputOptions);

		// 	e.clipboardData?.setData("text/html", html);
		// 	e.clipboardData?.setData("text/plain", plain);
		// } else {
		// 	const [startIndex, endIndex] = getSelectedTokenRange(tokens, startOffset, endOffset);
		// 	const startToken = tokens[startIndex];
		// 	const endToken = tokens[endIndex - 1];
		// 	const startPos = startToken?.pos ?? 0;
		// 	const endPos = endToken ? endToken.pos + endToken.len : startPos;
		// 	const textRuns = getTextRuns(sideKey, leftEditor.text, { diffs }, startPos, endPos);

		// 	const html = buildOutputHTMLFromRuns(text, textRuns, _outputOptions);
		// 	const plain = buildOutputPlainTextFromRuns(text, textRuns, _outputOptions);
		// 	e.clipboardData?.setData("text/html", html);
		// 	e.clipboardData?.setData("text/plain", plain);
		// }
	});

	document.addEventListener("keydown", (e) => {
		// 어느 단축키를 써야 잘썼다고 소문나냐?
		if (e.key === "F2") {
			e.preventDefault();

			if (e.shiftKey) {
				toggleSyncScroll();
				return;
			}

			return;
		}

		if (e.key === "F4") {
			e.preventDefault();

			if (_copyMode === "raw") {
				_copyMode = _lastNonRawCopyMode;
			} else {
				_lastNonRawCopyMode = _copyMode;
				_copyMode = "raw";
			}
			return;
		}

		if (e.key === "F8") {
			_diffOptions.whitespace = _diffOptions.whitespace === "ignore" ? "normalize" : "ignore";
		}

		// 기본적으로 브라우저의 첫번째 탭, 두번째 탭을 선택하는 단축키인데...
		// 브라우저에서 기본적으로 사용되는 단축키를 덮어쓰는 건 정말 못된 짓이긴 한데...
		// 사용자의 의도를 무시해버릴 수 있는 아주 나쁜 단축키지만... 인터넷도 안되는 컴에서 누가 엣지에 탭을 여러개 열어놓고 쓸까 싶다.
		if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
			e.preventDefault();
			const editor = e.key === "1" ? leftEditor : rightEditor;
			editor.editor.focus();
			return;
		}

		// diff cycling
		if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			if (_diffContext.done) {
				const diffs = _diffContext.diffs!;
				if (!diffs || diffs.length === 0) {
					return;
				}

				_currentDiffIndex += e.key === "ArrowUp" ? -1 : 1;
				if (_currentDiffIndex < 0) {
					_currentDiffIndex = diffs.length - 1;
				}
				if (_currentDiffIndex >= diffs.length) {
					_currentDiffIndex = 0;
				}
				scrollToDiff(_currentDiffIndex);
				highlightDiff(_currentDiffIndex);
			}
		}
	});

	diffList.addEventListener("click", (e) => {
		const diffIndex = Number((e.target as HTMLElement).dataset.diff);
		if (!isNaN(diffIndex)) {
			_currentDiffIndex = diffIndex;
			scrollToDiff(diffIndex);
			return;
		}
		const headingIndex = Number((e.target as HTMLElement).dataset.heading);
		if (!isNaN(headingIndex)) {
			scrollToHeading(headingIndex);
			return;
		}
	});

	function scrollToDiff(diffIndex: number) {
		_preventScrollSync = true;
		leftEditor.scrollToDiff(diffIndex);
		rightEditor.scrollToDiff(diffIndex);
		requestAnimationFrame(() => {
			_preventScrollSync = false;
		});
	}

	function scrollToHeading(headingIndex: number) {}

	for (const editor of [leftEditor, rightEditor]) {
		function onFocus() {
			_activeEditor = _lastFocusedEditor = editor;
		}

		function onBlur() {
			_activeEditor = null;
		}
		editor.editor.addEventListener("focus", onFocus);
		editor.editor.addEventListener("blur", onBlur);
		editor.editor.addEventListener("keydown", (e) => {
			if (e.key === " " && e.ctrlKey) {
				// 에디터에서 편집 중 반대쪽 에디터의 스크롤 위치를 현재 에디터의 내용에 맞추...려고 시도만 해 봄.
				syncScrollPosition(editor);
				return;
			}

			if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
				// 이정도 스크롤은 기본적으로 되어되는거 아니야?? 이 기능 나만 쓰나?
				// 스크롤 영역 밖의 딱 한두줄! 딱 그정도만 보면 된다 싶을 때?
				// 텍스트커서가 중앙 부분에 위치하지 않으면 마음이 놓이지 않아서 지금 당장 위아래로 조금 스크롤 해야만 할 때!!!!
				e.preventDefault();
				const fontSize = parseFloat(getComputedStyle(editor.editor).fontSize);
				const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2 * fontSize;
				console.log("delta:", delta);
				editor.scrollByOffset(delta);
			}

			if (e.key === "Escape") {
				const sel = window.getSelection();
				if (sel) sel.removeAllRanges(); // 선택 해제
			}
		});

		// editor.editor.addEventListener("click", (e) => {
		// 	if (e.ctrlKey) {
		// 		enableAlignedMode(true);
		// 	}
		// });

		function onClick(e: MouseEvent) {
			if (e.altKey) {
				// const [start, end] = editor.getTextSelectionRange();
				// if (start !== null && end !== null && start === end) {
				// 	_activeEditor = editor;
				// 	disableAlignedMode();
				// 	setTimeout(() => {
				// 		//syncScrollPosition(editor);
				// 		document.execCommand("insertText", false, " " + MANUAL_ANCHOR1 + " ");
				// 		requestAnimationFrame(() => {
				// 			editor.updateText();
				// 		});
				// 	}, 0);
				// 	return;
				// }
			}
		}

		editor.editor.addEventListener("click", onClick);
	}

	function clearAnchors() {
		for (let i = 0; i < _anchors.length; i++) {
			const entry = _anchors[i];
			const leftEl = entry.leftEl;
			const rightEl = entry.rightEl;

			leftEl.classList.remove("padtop");
			leftEl.removeAttribute("data-anchor");
			leftEl.style.removeProperty("--padding");

			rightEl.classList.remove("padtop");
			rightEl.removeAttribute("data-anchor");
			leftEl.style.removeProperty("--padding");
		}
		_anchors.length = 0;
	}

	let _resizeCancelId: number | null = null;
	function alignAnchors() {
		if (_resizeCancelId !== null) {
			cancelIdleCallback(_resizeCancelId);
			//clearTimeout(_resizeCancelId);
		}
		// _leftBottomPadding.remove();
		// _rightBottomPadding.remove();

		_preventScrollSync = true;
		let changed = false;

		const MAX_ITERATIONS = 10;
		let iteration = 0;

		do {
			changed = false;

			const leftAnchors = leftEditor.anchors;
			const rightAnchors = rightEditor.anchors;

			for (let i = 0; i < _anchors.length; i++) {
				const leftScrollTop = leftEditor.wrapper.scrollTop;
				const rightScrollTop = rightEditor.wrapper.scrollTop;
				const entry = _anchors[i];
				const { leftEl, rightEl } = entry;

				let leftY: number;
				let rightY: number;
				let delta: number;
				// leftY = leftEl.getBoundingClientRect().y + leftEditor.wrapper.scrollTop;
				// rightY = rightEl.getBoundingClientRect().y + rightEditor.wrapper.scrollTop;
				// delta = Math.round(leftY - rightY);
				// reset current padding. 이걸 하지 않으면 패딩이 줄어들지 않고 계속 쌓여나가기만 함.
				leftEl.classList.remove("padtop");
				rightEl.classList.remove("padtop");
				// padtop 클래스가 있어야 --padding 값이 적용이 되므로 --padding 값을 지울 필요는 없을 것 같지만
				// 지우지 않고 냅두면 당최 이해가 안되는 괴상한 rect가 튀어나올 수 있다.
				leftEl.style.removeProperty("--padding");
				rightEl.style.removeProperty("--padding");

				void leftEl.offsetHeight; // force reflow
				void rightEl.offsetHeight; // force reflow

				leftY = leftEl.getBoundingClientRect().y + leftEditor.wrapper.scrollTop;
				rightY = rightEl.getBoundingClientRect().y + rightEditor.wrapper.scrollTop;

				// console.log("[CURRENT] Left Y:", leftY, "Right Y:", rightY);
				delta = Math.round(leftY - rightY);
				if (delta !== 0) {
					delta = Math.round(leftY - rightY);
					if (delta > 0) {
						rightEl.classList.add("padtop");
						leftEl.classList.remove("padtop");
						rightEl.style.setProperty("--padding", `${delta}px`);
						changed = true;
					} else if (delta < 0) {
						// pad left
						leftEl.classList.add("padtop");
						rightEl.classList.remove("padtop");
						leftEl.style.setProperty("--padding", `${-delta}px`);
						changed = true;
					}
				}
				if (entry.delta !== delta) {
					entry.delta = delta;
					changed = true;
				}
			}
			changed = false;
		} while (changed && ++iteration < MAX_ITERATIONS);

		console.log("sync height:", {
			leftWrapperScrollHeight: leftEditor.wrapper.scrollHeight,
			rightWrapperScrollHeight: rightEditor.wrapper.scrollHeight,
			leftWrapperHeight: leftEditor.wrapper.clientHeight,
			rightWrapperHeight: rightEditor.wrapper.clientHeight,
			leftEditorHeight: leftEditor.editor.clientHeight,
			rightEditorHeight: rightEditor.editor.clientHeight,
			leftEditorScrollHeight: leftEditor.editor.scrollHeight,
			rightEditorScrollHeight: rightEditor.editor.scrollHeight,
			leftScrollTop: leftEditor.wrapper.scrollTop,
			rightScrollTop: rightEditor.wrapper.scrollTop,
			leftEditorWrapperRect: leftEditor.wrapper.getBoundingClientRect(),
			rightEditorWrapperRect: rightEditor.wrapper.getBoundingClientRect(),
			leftEditorRect: leftEditor.editor.getBoundingClientRect(),
			rightEditorRect: rightEditor.editor.getBoundingClientRect(),
		});

		// 이것도 --padding 값과 마찬가지로 지우지 않고 냅두면 어느순간 납득이 안되는 높이가 나온다.
		leftEditor.editor.style.removeProperty("--min-height");
		rightEditor.editor.style.removeProperty("--min-height");
		_resizeCancelId = requestAnimationFrame(() => {
			const leftHeight = leftEditor.editor.scrollHeight;
			const rightHeight = rightEditor.editor.scrollHeight;
			const maxHeight = Math.max(leftHeight, rightHeight);
			// leftEditor.wrapper.style.setProperty("--bottom-padding", `${maxHeight - leftHeight}px`);
			// rightEditor.wrapper.style.setProperty("--bottom-padding", `${maxHeight - rightHeight}px`);
			leftEditor.editor.style.setProperty("--min-height", `${maxHeight}px`);
			rightEditor.editor.style.setProperty("--min-height", `${maxHeight}px`);
			void rightEditor.editor.offsetHeight;

			if (document.activeElement === leftEditor.editor) {
				rightEditor.scrollTop = leftEditor.scrollTop;
			} else {
				leftEditor.scrollTop = rightEditor.scrollTop;
			}

			leftEditor.markDirty(RenderFlags.ALL);
			rightEditor.markDirty(RenderFlags.ALL);

			_preventScrollSync = false;
		});
	}

	// 무식하게 큰 함수
	// 찝찝한데... 재미 없는 부분이라...
	function postProcess(diffContext: DiffContext) {
		// const leftText = diffContext.leftText!;
		// const rightText = diffContext.rightText!;
		const leftTokens = diffContext.leftTokens!;
		const rightTokens = diffContext.rightTokens!;
		const rawEntries = diffContext.rawEntries!;

		const diffs: DiffEntry[] = [];
		const leftDiffs: DiffItem[] = [];
		const rightDiffs: DiffItem[] = [];
		const leftAnchors: AnchorItem[] = [];
		const rightAnchors: AnchorItem[] = [];

		const anchors: AnchorPairs[] = [];
		const sectionHeadings: SectionHeading[] = [];
		const headingStack: SectionHeading[] = [];
		const MAX_ANCHOR_SKIP = 5;
		let anchorSkipCount = 0;

		const leftDiffRanges: Range[][] = [];

		const rightDiffRanges: Range[][] = [];
		diffContext.leftDiffRanges = leftDiffRanges;
		diffContext.rightDiffRanges = rightDiffRanges;

		let currentDiff: DiffEntry | null = null;
		for (let i = 0; i < rawEntries.length; i++) {
			const entry = rawEntries[i];
			const left = entry.left;
			const right = entry.right;

			if (entry.type) {
				// diff entry
				if (currentDiff) {
					console.assert(currentDiff.left.pos + currentDiff.left.len === entry.left.pos, currentDiff, entry);
					console.assert(currentDiff.right.pos + currentDiff.right.len === entry.right.pos, currentDiff, entry);
					currentDiff.type |= entry.type;
					currentDiff.left.len += entry.left.len;
					currentDiff.right.len += entry.right.len;
				} else {
					currentDiff = { left: { ...entry.left }, right: { ...entry.right }, type: entry.type };
					//prevEntry = entry;
				}
			} else {
				// common entry
				if (currentDiff) {
					finalizeDiff();
				}
				currentDiff = null;

				const leftToken = leftTokens[left.pos];
				const rightToken = rightTokens[right.pos];

				if (leftToken.flags & rightToken.flags & (CONTAINER_START | LINE_START)) {
					leftAnchors.push({
						tokenIndex: left.pos,
						type: "start",
					});
					rightAnchors.push({
						tokenIndex: right.pos,
						type: "start",
					});
				}
			}
		}

		if (currentDiff) {
			finalizeDiff();
		}

		let _alignAnchorCancelId: number | null = null;
		// TODO: => finalizeDiff 로 바꾸고 args 제거
		function finalizeDiff() {
			const diffIndex = diffs.length;
			const leftIndex = currentDiff!.left.pos;
			const rightIndex = currentDiff!.right.pos;
			const leftTokenCount = currentDiff!.left.len;
			const rightTokenCount = currentDiff!.right.len;

			const leftDiffItem: DiffItem = {
				tokenIndex: leftIndex,
				tokenCount: leftTokenCount,
				preferBlockStart: false,
				preferBlockEnd: false,
				flags: 0,
			};

			const rightDiffItem: DiffItem = {
				tokenIndex: rightIndex,
				tokenCount: rightTokenCount,
				preferBlockStart: false,
				preferBlockEnd: false,
				flags: 0,
			};

			if (leftTokenCount > 0 && rightTokenCount > 0) {
				const leftToken = leftTokens[leftIndex];
				const leftEndToken = leftTokens[leftIndex + leftTokenCount - 1];
				const rightToken = rightTokens[rightIndex];
				const rightEndToken = rightTokens[rightIndex + rightTokenCount - 1];
				if (leftToken.flags & rightToken.flags & LINE_START) {
					leftDiffItem.preferBlockStart = true;
					rightDiffItem.preferBlockStart = true;
					if (leftEndToken.flags & rightEndToken.flags & LINE_END) {
						leftDiffItem.preferBlockEnd = true;
						rightDiffItem.preferBlockEnd = true;
					}
				}
			} else {
				let filledItem, emptyItem;
				let filledTokens, emptyTokens;
				let filledTokenIndex, emptyTokenIndex;
				let filledTokenCount;

				if (leftTokenCount > 0) {
					filledItem = leftDiffItem;
					filledTokens = leftTokens;
					filledTokenIndex = leftIndex;
					filledTokenCount = leftTokenCount;
					emptyItem = rightDiffItem;
					emptyTokenIndex = rightIndex;
					emptyTokens = rightTokens;
				} else {
					filledItem = rightDiffItem;
					filledTokens = rightTokens;
					filledTokenIndex = rightIndex;
					filledTokenCount = rightTokenCount;
					emptyItem = leftDiffItem;
					emptyTokens = leftTokens;
					emptyTokenIndex = leftIndex;
				}

				const filledToken = filledTokens[filledTokenIndex];
				const filledEndToken = filledTokens[filledTokenIndex + filledTokenCount - 1];
				const emptyBeforeToken: Token | undefined = emptyTokens[emptyTokenIndex - 1];
				const emptyAfterToken: Token | undefined = emptyTokens[emptyTokenIndex];

				if (filledToken.flags & LINE_START) {
					filledItem.preferBlockStart = true;
					if (emptyBeforeToken && emptyBeforeToken.flags & LINE_END) {
						// empty item starts with a line end token, so it should be considered as a block start
						emptyItem.preferBlockStart = true;
					}
				}
				if (filledEndToken.flags & LINE_END) {
					filledItem.preferBlockEnd = true;
					if (emptyAfterToken && emptyAfterToken.flags & LINE_START) {
						// empty item ends with a line start token, so it should be considered as a block end
						emptyItem.preferBlockEnd = true;
					}
				}
			}

			leftDiffs.push(leftDiffItem);
			rightDiffs.push(rightDiffItem);
		}

		leftEditor.update({ diffs: leftDiffs, anchors: leftAnchors });
		rightEditor.update({ diffs: rightDiffs, anchors: rightAnchors });

		const leftAnchorEls = leftEditor.anchors;
		const rightAnchorEls = rightEditor.anchors;
		_anchors.length = 0;
		for (let i = 0; i < leftAnchors.length; i++) {
			const leftAnchor = leftAnchorEls[i];
			const rightAnchor = rightAnchorEls[i];
			if (!leftAnchor || !rightAnchor) {
				continue;
			}
			_anchors.push({
				leftEl: leftAnchor,
				rightEl: rightAnchor,
				// type : leftAnchors[i].type,
				delta: 0,
			});
		}
		

		if (_alignAnchorCancelId !== null) {
			cancelIdleCallback(_alignAnchorCancelId);
			//clearTimeout(_alignAnchorCancelId);
		}
		_alignAnchorCancelId = requestAnimationFrame(() => {
			// alignAnchors();
		});
	}

	_diffContext = {
		reqId: 0,
		// leftText: leftEditor.text,
		// rightText: rightEditor.text,
		diffOptions: { ..._diffOptions },
		done: false,
		leftTokens: null,
		rightTokens: null,
	};
	computeDiff();

	return {
		get dump() {
			// 디버깅 할 때...
			return {
				_diffContext: _diffContext,
				// diffs: _diffResult?.diffs,
				// anchors: _diffResult?.anchors,
				diffOptions: _diffOptions,
				leftEditor,
				rightEditor,
				activeEditor: _activeEditor,
			};
		},
		clearAnchors,

		compute: computeDiff,

		diffOptions: _diffOptions,

		get outputOptions() {
			return _outputOptions;
		},
	};
})();
