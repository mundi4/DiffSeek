// 이것저것 이어붙이는 코드 집합

type SelectionHighlightRenderInfo = {
	editor: Editor;
	rects: DiffRect[];
};

type HightlightRenderItems = {};

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

	let _selectionHighlight: SelectionHighlightRenderInfo | null = null;

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
		};
	})({
		algorithm: "histogram",
		tokenization: "word",
		whitespace: "ignore",
		greedyMatch: false,
		useLengthBias: true,
		maxGram: 4,
		lengthBiasFactor: 0.7,
		sectionHeadingMultiplier: 1 / 0.75,
		lineStartMultiplier: 1 / 0.85,
		lineEndMultiplier: 1 / 0.9,
		uniqueMultiplier: 1 / 0.6667,
	});

	const editorContainer = document.getElementById("main") as HTMLElement;
	const leftEditor = createEditor(editorContainer, "left", getEditorCallbacks("left"));
	const rightEditor = createEditor(editorContainer, "right", getEditorCallbacks("right"));
	const canvas = document.createElement("canvas");
	canvas.id = "highlightCanvas";
	editorContainer.appendChild(canvas);
	const canvasCtx = canvas.getContext("2d")!;

	leftEditor.wrapper.tabIndex = 100;
	rightEditor.wrapper.tabIndex = 101;

	const body = document.querySelector("body") as HTMLBodyElement;
	const diffList = document.getElementById("diffList") as HTMLUListElement;
	const highlightStyle = document.getElementById("highlightStyle") as HTMLStyleElement;
	const progress = document.getElementById("progress") as HTMLElement;
	const scrollSyncIndicator = document.getElementById("scrollSyncIndicator") as HTMLElement;
	const alignmentStyleElement = document.createElement("style");
	document.head.appendChild(alignmentStyleElement);

	const resizeObserver = new ResizeObserver(() => {
		canvas.width = editorContainer.offsetWidth;
		canvas.height = editorContainer.offsetHeight;
	});
	resizeObserver.observe(editorContainer);

	function onSelectionChanged() {
		if (_diffContext.done === false) {
			_selectionHighlight = null;
			leftEditor.clearTextHighlight();
			rightEditor.clearTextHighlight();
			return;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
			_selectionHighlight = null;
			leftEditor.clearTextHighlight();
			rightEditor.clearTextHighlight();
			return;
		}

		const range = selection.getRangeAt(0);
		const editor = leftEditor.wrapper.contains(range.commonAncestorContainer)
			? leftEditor
			: rightEditor.wrapper.contains(range.commonAncestorContainer)
			? rightEditor
			: null;
		if (editor === null) {
			leftEditor.clearTextHighlight();
			rightEditor.clearTextHighlight();
			return;
		}

		_selectionHighlight = null;
		const [startOffset, endOffset] = editor.getTextSelectionRange();
		console.log("Selection:", startOffset, endOffset);
		if (startOffset === null || endOffset === null) {
			leftEditor.clearTextHighlight();
			rightEditor.clearTextHighlight();
			return;
		}

		const rawEntries = _diffContext.rawEntries!;
		const tokens = editor === leftEditor ? _diffContext.leftTokens! : _diffContext.rightTokens!;
		const otherTokens = editor === leftEditor ? _diffContext.rightTokens! : _diffContext.leftTokens!;
		const sideKey = editor === leftEditor ? "left" : "right";
		const otherEditor = editor === leftEditor ? rightEditor : leftEditor;

		const [startIndex, endIndex] = getSelectedTokenRange(tokens, startOffset, endOffset);
		console.log("Selected tokens:", startIndex, endIndex);
		const [mappedStartIndex, mappedEndIndex] = mapTokenRangeToOtherSide(rawEntries, sideKey, startIndex, endIndex);
		console.log("Mapped tokens:", mappedStartIndex, mappedEndIndex);

		const otherStartToken = otherTokens[mappedStartIndex];
		const otherEndToken = otherTokens[mappedEndIndex - 1];
		if (otherStartToken && otherEndToken) {
			const otherStartPos = otherStartToken.pos;
			const otherEndPos = otherEndToken.pos + otherEndToken.len;
			otherEditor.applyTextHighlight(otherStartPos, otherEndPos);
			// const rectSet = otherEditor.getTextRects(otherStartPos, otherEndPos);
			// console.log("Rect set:", rectSet);
			// if (rectSet && rectSet.rects.length > 0) {
			// 	_selectionHighlight = {
			// 		editor: otherEditor,
			// 		rects: rectSet!.rects,
			// 	};
			// }
			// updateHighlightCanvas();
		}
	}

	function getEditorCallbacks(editorName: EditorName) {
		const pendingDiffVisibilities = new Map();
		let updateDiffVisilitiesPending = false;

		return {
			onTextChanged: function () {
				onSelectionChanged();
				computeDiff();
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

			ctx.leftTokens = tokenizeNode(leftEditor.editor);
			if (idleDeadline.timeRemaining() <= 1) {
				idleDeadline = yield;
			}

			ctx.rightTokens = tokenizeNode(rightEditor.editor);
			if (idleDeadline.timeRemaining() <= 1) {
				idleDeadline = yield;
			}

			const request: DiffRequest = {
				type: "diff",
				reqId: ctx.reqId,
				options: ctx.diffOptions,
				leftTokens: ctx.leftTokens!,
				rightTokens: ctx.rightTokens!,
			};

			worker.postMessage(request);
		}

		function computeDiff() {
			if (computeDiffTimeoutId) {
				cancelIdleCallback(computeDiffTimeoutId);
				//clearTimeout(computeDiffTimeoutId);
			}

			_currentDiffIndex = -1;

			// const leftText = leftEditor.text;
			// const rightText = rightEditor.text;

			body.classList.add("computing");
			progress.textContent = "...";

			const ctx = (_diffContext = {
				reqId: ++_reqId, //overflow 되는 순간 지구 멸망
				// leftText: leftText,
				// rightText: rightText,
				diffOptions: { ..._diffOptions },
				done: false,
				processTime: 0,
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
			if (data.type === "diff") {
				if (data.reqId === _reqId) {
					// console.debug("diff response:", data);
					body.classList.remove("computing");
					_diffContext.rawEntries = data.diffs;
					postProcess(_diffContext);
					_diffContext.done = true;
					_diffContext.processTime = data.processTime;
					onDiffComputed(_diffContext);
				}
			} else if (data.type === "start") {
				progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
			}
		};

		function onDiffComputed(diffContext: DiffContext) {
			leftEditor.update(diffContext);
			rightEditor.update(diffContext);
			// calculateDiffRects();
			// leftEditor.update({ diffs: diffContext.diffs!, anchors: diffContext.anchors!, headings: diffContext.headings! });
			// rightEditor.update({ diffs: diffContext.diffs!, anchors: diffContext.anchors!, headings: diffContext.headings! });
			updateDiffList();
		}

		return { computeDiff };
	})();

	function restoreSelectionRange({ editor, startOffset, endOffset }: { editor: Editor; startOffset: number; endOffset: number }) {
		if (editor) {
			editor.selectTextRange(startOffset, endOffset);
		}
	}

	function getSelectionRange(): { editor: Editor; startOffset: number; endOffset: number } | null {
		let editor: Editor | null = null;
		let [startOffset, endOffset] = leftEditor.getTextSelectionRange();
		if (startOffset !== null) {
			editor = leftEditor;
		} else {
			[startOffset, endOffset] = rightEditor.getTextSelectionRange();
			if (startOffset !== null) {
				editor = rightEditor;
			}
		}

		if (editor) {
			return {
				editor,
				startOffset: startOffset!,
				endOffset: endOffset!,
			};
		} else {
			return null;
		}
	}

	function syncScrollPosition(sourceEditor: Editor | null) {
		if (_preventScrollSync) {
			return;
		}

		if (!sourceEditor) {
			sourceEditor = _currentlyScrollingEditor || _activeEditor || _lastFocusedEditor;
			if (!sourceEditor) {
				return;
			}
		}

		if (_currentlyScrollingEditor !== null && _currentlyScrollingEditor !== sourceEditor) {
			return;
		}

		_preventScrollSync = true;
		const targetEditor = sourceEditor === leftEditor ? rightEditor : leftEditor;
		let sourceAnchor = null;
		let targetAnchor = null;

		sourceAnchor = sourceEditor.getClosestAnchorToCaret() || sourceEditor.getFirstVisibleAnchor();
		if (sourceAnchor) {
			const anchorIndex = Number(sourceAnchor.dataset.anchor);
			targetAnchor = targetEditor.anchorElements[anchorIndex];
		}

		if (sourceAnchor && targetAnchor) {
			const prevLastScrolledEditor = _lastScrolledEditor;
			const sourceWrapper = sourceEditor.wrapper;
			const targetWrapper = targetEditor.wrapper;
			targetWrapper.scrollTop = sourceWrapper.scrollTop - sourceAnchor.offsetTop + targetAnchor.offsetTop;
			_lastScrolledEditor = prevLastScrolledEditor;
		}
		requestAnimationFrame(() => {
			_preventScrollSync = false;
		});
	}

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
			leftEditor.applyDiffHighlight(diff);
			rightEditor.applyDiffHighlight(diff);
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
			leftEditor.clearDiffHighlight();
			rightEditor.clearDiffHighlight();
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

	function updateHighlightCanvas() {
		canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
		if (_selectionHighlight) {
			const scrollTop = _selectionHighlight.editor.wrapper.scrollTop;
			const scrollLeft = _selectionHighlight.editor.wrapper.scrollLeft;
			// canvasCtx.fillStyle = "hsl(240 100% 90%)";
			canvasCtx.fillStyle = "hsl(210 100% 80%)";
			for (const rect of _selectionHighlight.rects) {
				const x = rect.x - scrollLeft;
				const y = rect.y - scrollTop;

				canvasCtx.fillRect(x, y, rect.width, rect.height);
			}
		}
	}

	function toggleSyncScroll() {
		_syncEditor = !_syncEditor;
	}

	function updateDiffList() {
		if (!_diffContext.done) {
			return;
		}

		const diffs = _diffContext.diffs!;
		const headings = _diffContext.headings ?? [];
		_diffListItemElements.length = 0;

		const fragment = document.createDocumentFragment();
		let headingIndex = 0;
		let leftPos = 0;
		for (let i = 0; i < diffs.length; i++) {
			const diff = diffs[i];
			const thisLeftPos = diff.left.pos;
			// 귀찮음의 정점. 대충 돌아가게만... 딱 거기까지만...
			for (let j = leftPos; j < thisLeftPos; j++) {
				for (; headingIndex < headings.length; headingIndex++) {
					const heading = headings[headingIndex];
					if (heading.left.pos > thisLeftPos) {
						break;
					}
					const li = document.createElement("LI");
					const hd = document.createElement("A");
					hd.className = "heading";
					hd.dataset.heading = headingIndex.toString();
					hd.textContent = heading.ordinalText + " " + heading.title;
					li.appendChild(hd);
					fragment.appendChild(li);
				}
			}
			const li = document.createElement("LI");
			const button = document.createElement("MARK");
			button.draggable = true;
			button.dataset.diff = i.toString();
			button.className = "diff-color" + ((i % NUM_DIFF_COLORS) + 1);
			li.appendChild(button);

			const leftText = leftEditor.sliceText(diff.left.pos, diff.left.pos + diff.left.len);
			const leftSpan = document.createElement("SPAN");
			leftSpan.textContent = leftText;
			leftSpan.classList.add("left");
			button.appendChild(leftSpan);

			const rightText = rightEditor.sliceText(diff.right.pos, diff.right.pos + diff.right.len);
			const rightSpan = document.createElement("SPAN");
			rightSpan.textContent = rightText;
			rightSpan.classList.add("right");
			button.appendChild(rightSpan);

			fragment.appendChild(li);
			_diffListItemElements[i] = li;
			leftPos = thisLeftPos;
		}

		for (; headingIndex < headings.length; headingIndex++) {
			const heading = headings[headingIndex];
			const li = document.createElement("LI");
			const hd = document.createElement("A");
			hd.className = "heading";
			hd.dataset.heading = headingIndex.toString();
			hd.textContent = heading.ordinalText + " " + heading.title;
			li.appendChild(hd);
			fragment.appendChild(li);
		}

		diffList.innerHTML = "";
		diffList.appendChild(fragment);
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

	function scrollToHeading(headingIndex: number) {
		_preventScrollSync = true;
		leftEditor.scrollToHeading(headingIndex);
		rightEditor.scrollToHeading(headingIndex);
		requestAnimationFrame(() => {
			_preventScrollSync = false;
		});
	}

	for (const editor of [leftEditor, rightEditor]) {
		editor.wrapper.addEventListener("scroll", (e) => {
			// updateCanvas();
			if (_currentlyScrollingEditor !== null || _preventScrollSync) {
				return;
			}

			_lastScrolledEditor = _currentlyScrollingEditor = editor;
			if (_syncEditor) {
				syncScrollPosition(editor);
			}

			if (_resetCurrentlyScrollingEditorId) {
				cancelAnimationFrame(_resetCurrentlyScrollingEditorId);
			}
			_resetCurrentlyScrollingEditorId = requestAnimationFrame(() => {
				_currentlyScrollingEditor = null;
			});
			// updateHighlightCanvas();
		});

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
				const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2;
				editor.wrapper.scrollTop += delta;
				e.preventDefault();
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

	// 무식하게 큰 함수
	// 찝찝한데... 재미 없는 부분이라...
	function postProcess(diffContext: DiffContext) {
		let prevEntry: DiffEntry | null = null;
		// const leftText = diffContext.leftText!;
		// const rightText = diffContext.rightText!;
		const leftTokens = diffContext.leftTokens!;
		const rightTokens = diffContext.rightTokens!;
		const rawEntries = diffContext.rawEntries!;

		const diffs: DiffEntry[] = [];
		const anchors: Anchor[] = [];
		const sectionHeadings: SectionHeading[] = [];
		const headingStack: SectionHeading[] = [];
		const MAX_ANCHOR_SKIP = 5;
		let anchorSkipCount = 0;

		for (let i = 0; i < rawEntries.length; i++) {
			const entry = rawEntries[i];
			if (entry.type) {
				// diff entry
				if (prevEntry) {
					console.assert(prevEntry.left.pos + prevEntry.left.len === entry.left.pos, prevEntry, entry);
					console.assert(prevEntry.right.pos + prevEntry.right.len === entry.right.pos, prevEntry, entry);
					prevEntry.type |= entry.type;
					prevEntry.left.len += entry.left.len;
					prevEntry.right.len += entry.right.len;
				} else {
					prevEntry = { left: { ...entry.left }, right: { ...entry.right }, type: entry.type };
					//prevEntry = entry;
				}
			} else {
				// common entry
				if (prevEntry) {
					addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
					// mappings.push(prevEntry);
				}
				prevEntry = null;

				const leftToken = leftTokens[entry.left.pos];
				const rightToken = rightTokens[entry.right.pos];
				if (leftToken.flags & rightToken.flags & LINE_START) {
					// 앵커 추가
					addAnchor("before", leftToken.pos, rightToken.pos, null);

					if (leftToken.flags & rightToken.flags & SECTION_HEADING_MASK) {
						addHeading(i);
					}
				}
				// mappings.push(entry);
			}
		}
		//addAnchor("before", leftText.length, -1, rightText.length, -1, null);

		if (prevEntry) {
			addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
			// mappings.push(prevEntry);
		}

		function addHeading(entryIndex: number) {
			if (true) {
				return;
			}

			// const entry = rawEntries[entryIndex];
			// if (entry.type !== 0) {
			// 	console.warn("uncommon entry", entry.type, entry);
			// 	return;
			// }

			// const leftToken = leftTokens[entry.left.pos];
			// const rightToken = rightTokens[entry.right.pos];
			// const type = leftToken.flags & SECTION_HEADING_MASK;
			// // console.debug("addHeading", { entryIndex, entry, leftToken, rightToken });

			// // 지금은 일치되는 토큰으로부터 헤딩을 추출하므로 타입도 당연히 같겠지만
			// // 나중에 일치되지 않는 토큰으로부터 헤딩을 추출하게 될 수도 있으니 마음이 편하게 여기서 한번 더 확인.
			// if (!type || (rightToken.flags & SECTION_HEADING_MASK) !== type) {
			// 	console.warn("type mismatch", entry.type, entry);
			// 	return;
			// }

			// const ordinalText = leftToken.text;
			// const ordinalNum = parseOrdinalNumber(ordinalText);
			// if (Number.isNaN(ordinalNum)) {
			// 	console.warn("Invalid ordinal number", ordinalText);
			// 	return;
			// }

			// // 헤딩 줄 끝 찾기
			// // 이 값들은 텍스트 내의 문자위치가 아니라 토큰 배열 안의 토큰 인덱스와 개수임!
			// let hasDiff = false;
			// let leftTokenCount = 0;
			// let rightTokenCount = 0;

			// for (let j = entryIndex; j < rawEntries.length; j++) {
			// 	const entry2 = rawEntries[j];
			// 	leftTokenCount += entry2.left.len;
			// 	if (!hasDiff && entry2.type === 0) {
			// 		rightTokenCount += entry2.right.len;
			// 	} else {
			// 		hasDiff = true;
			// 	}
			// 	if (leftTokens[entry2.left.pos + entry2.left.len - 1].flags & LAST_OF_LINE) {
			// 		break;
			// 	}
			// }

			// if (leftTokenCount < 2) {
			// 	console.warn("Invalid heading", leftTokenCount, rightTokenCount, entry);
			// 	return;
			// }

			// const lefTokenEnd = entry.left.pos + leftTokenCount;
			// const title = leftText.slice(leftTokens[entry.left.pos + 1].pos, leftTokens[lefTokenEnd - 1].pos + leftTokens[lefTokenEnd - 1].len);

			// let prevSibling: SectionHeading | null = null;
			// let parent: SectionHeading | null = null;
			// for (let i = headingStack.length - 1; i >= 0; i--) {
			// 	const candidate = headingStack[i];
			// 	if (candidate.type === type) {
			// 		prevSibling = candidate;
			// 		headingStack.length = i;
			// 		break;
			// 	}
			// }

			// if (!prevSibling) {
			// 	parent = headingStack[headingStack.length - 1] ?? null;
			// } else {
			// 	parent = prevSibling.parent;
			// }

			// const current: SectionHeading = {
			// 	ordinalText,
			// 	ordinalNum,
			// 	title,
			// 	type,
			// 	left: {
			// 		pos: leftTokens[entry.left.pos].pos,
			// 		len: leftTokens[lefTokenEnd - 1].pos + leftTokens[lefTokenEnd - 1].len - leftTokens[entry.left.pos].pos,
			// 	},
			// 	right: {
			// 		pos: rightTokens[entry.right.pos].pos,
			// 		len:
			// 			rightTokens[entry.right.pos + rightTokenCount - 1].pos +
			// 			rightTokens[entry.right.pos + rightTokenCount - 1].len -
			// 			rightTokens[entry.right.pos].pos,
			// 		// len: rightTokens[rightEndPos - 1].pos + rightTokens[rightEndPos - 1].len - rightTokens[entry.right.pos].pos,
			// 	},
			// 	parent,
			// 	firstChild: null,
			// 	nextSibling: null,
			// 	level: headingStack.length + 1,
			// 	outOfOrder: false,
			// 	hasDiff,
			// };

			// if (prevSibling) {
			// 	prevSibling.nextSibling = current;
			// 	if (current.ordinalNum <= prevSibling.ordinalNum) {
			// 		current.outOfOrder = true;
			// 	}
			// } else if (parent) {
			// 	parent.firstChild = current;
			// }

			// headingStack.push(current);
			// sectionHeadings.push(current);
		}

		function addAnchor(type: "before" | "after", leftPos: number, rightPos: number, diffIndex: number | null) {
			if (leftPos === undefined || rightPos === undefined) {
				console.error("addAnchor", { type, leftPos, rightPos, diffIndex });
			}
			if (true) {
				return;
			}

			//앵커가 너무 많아지는 걸 방지! section heading인 경우 스킵하면 안되고 그걸 판단하려면 token이 필요함... 귀찮아
			// if (diffIndex === null && anchorSkipCount < MAX_ANCHOR_SKIP && anchors.length > 0) {
			// 	const lastAnchor = anchors[anchors.length - 1];
			// 	if (lastAnchor.type === type && lastAnchor.diffIndex === null && leftLine - lastAnchor.leftLine <= 1 && rightLine - lastAnchor.rightLine <= 1) {
			// 		anchorSkipCount++;
			// 		return;
			// 	}
			// }
			// anchorSkipCount = 0;

			// if (type === "before") {
			// 	// before 앵커는 항상 줄의 시작위치일 때만 추가하므로 줄바꿈 문자만 확인하면 된다!
			// 	while (leftPos > 0 && leftText[leftPos - 1] !== "\n") {
			// 		leftPos--;
			// 	}
			// 	while (rightPos > 0 && rightText[rightPos - 1] !== "\n") {
			// 		rightPos--;
			// 	}
			// } else if (type === "after") {
			// 	// empty diff의 after앵커는 이후에 다른 토큰이 존재할 수 있음.
			// 	// 공백이 아닌 문자가 나오면 멈추고 기본 위치 사용.
			// 	let p;
			// 	p = leftPos;
			// 	while (p < leftText.length) {
			// 		const ch = leftText[p++];
			// 		if (ch === "\n") {
			// 			leftPos = p - 1;
			// 			break;
			// 		} else if (!spaceChars[ch]) {
			// 			break;
			// 		}
			// 	}
			// 	p = rightPos;
			// 	while (p < rightText.length) {
			// 		const ch = rightText[p++];
			// 		if (ch === "\n") {
			// 			rightPos = p - 1;
			// 			break;
			// 		} else if (!spaceChars[ch]) {
			// 			break;
			// 		}
			// 	}
			// }

			// if (anchors.length > 0) {
			// 	let lastAnchor = anchors[anchors.length - 1];
			// 	if (lastAnchor.left > leftPos || lastAnchor.right > rightPos) {
			// 		return;
			// 	}
			// 	if (lastAnchor.left === leftPos || lastAnchor.right === rightPos) {
			// 		if (type === lastAnchor.type || type === "before") {
			// 			return;
			// 		}
			// 	}
			// }

			// // anchors.push({ type, left: leftPos, leftLine, right: rightPos, rightLine, diffIndex });
			// anchors.push({ type, left: leftPos, right: rightPos, diffIndex });
		}

		function addDiff(leftIndex: number, leftCount: number, rightIndex: number, rightCount: number) {
			let leftPos, leftLen, rightPos, rightLen;
			let leftBeforeAnchorPos, rightBeforeAnchorPos, leftAfterAnchorPos, rightAfterAnchorPos, leftEmpty, rightEmpty;
			let type: DiffType;
			let asBlock = false;

			// 양쪽에 대응하는 토큰이 모두 존재하는 경우. 쉬운 케이스
			if (leftCount > 0 && rightCount > 0) {
				type = 3;
				let leftTokenStart = leftTokens[leftIndex];
				let leftTokenEnd = leftTokens[leftIndex + leftCount - 1];
				let rightTokenEnd = rightTokens[rightIndex + rightCount - 1];
				let rightTokenStart = rightTokens[rightIndex];

				leftPos = leftTokenStart.pos;
				leftLen = leftTokenEnd.pos + leftTokenEnd.len - leftPos;
				leftEmpty = false;
				rightPos = rightTokenStart.pos;
				rightLen = rightTokenEnd.pos + rightTokenEnd.len - rightPos;
				rightEmpty = false;

				// 생각: 한쪽만 줄의 첫 토큰일 때에도 앵커를 넣을까? 앵커에 display:block을 줘서 강제로 줄바꿈 시킨 후에에
				// 좌우 정렬을 할 수 있을 것 같기도 한데...
				if (leftTokenStart.flags & rightTokenStart.flags & LINE_START) {
					leftBeforeAnchorPos = leftPos;
					rightBeforeAnchorPos = rightPos;

					// while (leftBeforeAnchorPos > 0 && leftText[leftBeforeAnchorPos - 1] !== "\n") {
					// 	leftBeforeAnchorPos--;
					// }

					// while (rightBeforeAnchorPos > 0 && rightText[rightBeforeAnchorPos - 1] !== "\n") {
					// 	rightBeforeAnchorPos--;
					// }
					// // addAnchor("before", leftAnchorPos, rightAnchorPos, null);

					// if (leftTokenEnd.flags & rightTokenEnd.flags & LAST_OF_LINE) {
					// 	asBlock = true;
					// 	leftAfterAnchorPos = leftPos + leftLen;
					// 	rightAfterAnchorPos = rightPos + rightLen;
					// 	if (leftText[leftAfterAnchorPos] !== "\n") {
					// 		do {
					// 			leftAfterAnchorPos++;
					// 		} while (leftAfterAnchorPos < leftText.length && leftText[leftAfterAnchorPos] !== "\n");
					// 	}
					// 	if (rightText[rightAfterAnchorPos] !== "\n") {
					// 		do {
					// 			rightAfterAnchorPos++;
					// 		} while (rightAfterAnchorPos < rightText.length && rightText[rightAfterAnchorPos] !== "\n");
					// 	}

					// 	// while (leftAnchorPos + 1 < leftText.length && leftText[leftAnchorPos + 1] !== "\n") {
					// 	// 	leftAnchorPos++;
					// 	// }
					// 	// while (rightAnchorPos + 1 < rightText.length && rightText[rightAnchorPos + 1] !== "\n") {
					// 	// 	rightAnchorPos++;
					// 	// }
					// 	// addAnchor("after", leftBeforeAnchorPos, rightBeforeAnchorPos, null);
					// }
				}
			} else {
				// 한쪽이 비어있음.
				// 단순하게 토큰 사이에 위치시켜도 되지만 되도록이면 대응하는 쪽과 유사한 위치(줄시작/줄끝)에 위치시키기 위해...
				// 자꾸 이런저런 시도를 하다보니 난장판인데 만지기 싫음...
				let longSideText, shortSideText;
				let longSideIndex, longSideCount, longSideTokens;
				let shortSideIndex, shortSideTokens;
				let longSidePos, longSideLen;
				let shortSidePos, shortSideLen;
				let longSideBeforeAnchorPos, shortSideBeforeAnchorPos;
				let longSideAfterAnchorPos, shortSideAfterAnchorPos;
				let longSideTokenStart, longSideTokenEnd;
				let shortSideBeforeToken, shortSideAfterToken;

				if (leftCount > 0) {
					type = 1; // 1: left
					longSideTokens = leftTokens;
					longSideIndex = leftIndex;
					longSideCount = leftCount;
					shortSideTokens = rightTokens;
					shortSideIndex = rightIndex;
					leftEmpty = false;
					rightEmpty = true;
				} else {
					type = 2; // 2: right
					longSideTokens = rightTokens;
					longSideIndex = rightIndex;
					longSideCount = rightCount;
					shortSideTokens = leftTokens;
					shortSideIndex = leftIndex;
					leftEmpty = true;
					rightEmpty = false;
				}
				longSideTokenStart = longSideTokens[longSideIndex];
				longSideTokenEnd = longSideTokens[longSideIndex + longSideCount - 1];
				shortSideBeforeToken = shortSideTokens[shortSideIndex - 1];
				shortSideAfterToken = shortSideTokens[shortSideIndex];

				longSidePos = longSideTokenStart.pos;
				longSideLen = longSideTokenEnd.pos + longSideTokenEnd.len - longSidePos;
				shortSidePos = shortSideBeforeToken ? shortSideBeforeToken.pos + shortSideBeforeToken.len : 0;
				shortSideLen = 0;

				const longSideIsFirstWord = longSideTokenStart.flags & LINE_START;
				const longSideIsLastWord = longSideTokenEnd.flags & LINE_END;
				const shortSideIsOnLineEdge =
					shortSideTokens.length === 0 ||
					(shortSideBeforeToken && shortSideBeforeToken.flags & LINE_END) ||
					(shortSideAfterToken && shortSideAfterToken.flags & LINE_START);

				let shortSidePushedToNextLine = false;
				// base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
				if (shortSideIsOnLineEdge) {
					// 줄의 경계에 empty diff를 표시하는 경우 현재 줄의 끝이나 다음 줄의 시작 중 "적절하게" 선택. 현재 줄의 끝(이전 토큰의 뒤)에 위치 중임.
					if (longSideIsFirstWord) {
						// if (shortSidePos !== 0) {
						// 	// pos가 0이 아닌 경우는 이전 토큰의 뒤로 위치를 잡은 경우니까 다음 줄바꿈을 찾아서 그 줄바꿈 뒤로 밀어줌
						// 	// 주의: 현재 위치 이후에 줄바꿈이 있는지 없는지 확인하기보다는 원본 텍스트의 마지막에 줄바꿈이 없는 경우 강제로 줄바꿈을 붙여주는게 편함.
						// 	// 잊지말고 꼭 원본텍스트의 끝에 줄바꿈 하나 붙일 것.
						// 	// const maxPos = shortSideAfterToken ? shortSideAfterToken.pos - 1 : shortSideText.length - 1;
						// 	// while (shortSidePos < maxPos && shortSideText[shortSidePos++] !== "\n");
						// 	while (shortSideText[shortSidePos++] !== "\n");
						// 	shortSidePushedToNextLine = true;
						// }

						// 양쪽 모두 줄의 시작 부분에 위치하므로 앵커 추가.
						// 빈 diff가 줄 시작이나 줄 끝 위치에 있다면 하나의 줄로 표시되게 할 수 있음(css 사용)
						longSideBeforeAnchorPos = longSidePos;
						shortSideBeforeAnchorPos = shortSidePos;
					}
					if (
						longSideIsLastWord
						// && !shortSideAfterToken || (shortSideBeforeToken && shortSideAfterToken.lineNum - shortSideBeforeToken.lineNum > 1)
					) {
						asBlock = !!longSideIsFirstWord;
						longSideAfterAnchorPos = longSidePos + longSideLen;
						shortSideAfterAnchorPos = shortSidePos;
					}
				}

				if (leftCount > 0) {
					leftPos = longSidePos;
					leftLen = longSideLen;
					leftEmpty = false;
					leftBeforeAnchorPos = longSideBeforeAnchorPos;
					leftAfterAnchorPos = longSideAfterAnchorPos;
					rightPos = shortSidePos;
					rightLen = shortSideLen;
					rightEmpty = true;
					rightBeforeAnchorPos = shortSideBeforeAnchorPos;
					rightAfterAnchorPos = shortSideAfterAnchorPos;
				} else {
					leftPos = shortSidePos;
					leftLen = shortSideLen;
					leftEmpty = true;
					leftBeforeAnchorPos = shortSideBeforeAnchorPos;
					leftAfterAnchorPos = shortSideAfterAnchorPos;
					rightPos = longSidePos;
					rightLen = longSideLen;
					rightEmpty = false;
					rightBeforeAnchorPos = longSideBeforeAnchorPos;
					rightAfterAnchorPos = longSideAfterAnchorPos;
				}
			}

			if (leftBeforeAnchorPos !== undefined && rightBeforeAnchorPos !== undefined) {
				addAnchor("before", leftBeforeAnchorPos, rightBeforeAnchorPos, diffs.length);
			}
			if (leftAfterAnchorPos !== undefined && rightAfterAnchorPos !== undefined) {
				addAnchor("after", leftAfterAnchorPos, rightAfterAnchorPos, diffs.length);
			}

			const newEntry: DiffEntry = {
				type: type,
				left: {
					pos: leftPos,
					len: leftLen,
					// empty: leftEmpty,
				},
				right: {
					pos: rightPos,
					len: rightLen,
					// empty: rightEmpty,
				},
				asBlock,
			};
			diffs.push(newEntry);
		}

		diffContext.diffs = diffs;
		diffContext.anchors = anchors;
		diffContext.headings = sectionHeadings;
		// return { diffs, anchors, leftTokenCount: leftTokens.length, rightTokenCount: rightTokens.length, sectionHeadings };
	}

	_diffContext = {
		reqId: 0,
		// leftText: leftEditor.text,
		// rightText: rightEditor.text,
		diffOptions: { ..._diffOptions },
		done: false,
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

		compute: computeDiff,

		diffOptions: _diffOptions,

		get outputOptions() {
			return _outputOptions;
		},
	};
})();
