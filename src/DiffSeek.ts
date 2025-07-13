// atoms
// 이렇게까지 하게 될지는 몰랐는데 ui요소마다 콜백을 넘기고 또 그걸 또 감싸서 자식으로 넘기고... 귀찮잖아...

const hoveredDiffIndexAtom = createAtom<number | null>("highlightedDiffIndex", null);
const diffItemClickedEvent = createEventAtom<number>("diffItemClickedEvent");
const syncModeAtom = createAtom<boolean>("syncMode", false);
const whitespaceHandlingAtom = createAtom<WhitespaceHandling>("whitespaceHandling", "onlyAtEdge");
const sidebarExpandedAtom = createAtom<boolean>("sidebarExpanded", true);

const COMPUTE_DIFF_TIMEOUT = 500;

type WorkerContext = {
	resolve: (response: DiffResult) => void;
	reject: (error: Error) => void;
	request: DiffRequest;
};

class DiffSeek {
	#mainContainer: HTMLElement;
	#leftEditor: Editor;
	#rightEditor: Editor;
	#renderer: Renderer;

	#diffOptions: DiffOptions;
	#diffContext: DiffContext | null = null;
	#textSelectionRange: Range | null = null;

	#sideView: SideView;
	#syncMode = false;

	#scrollingEditor: Editor | null = null;
	#lastScrolledEditor: Editor | null = null;
	#activeEditor: Editor | null = null;
	#lastActiveEditor: Editor | null = null;
	#scrollEndTimeoutId: number | null = null;

	#lastScrolledToDiffIndex: number | null = null;
	#anchorManager: AnchorManager;
	#worker: Worker;
	#workerRequestId: number = 0;

	#editorContentsChanged: Record<EditorName, boolean> = {
		left: false,
		right: false,
	};

	#computeDiffCallbackId: number | null = null;
	// #diffComputedCallbackId: number | null = null;
	#fetishSelector = new FetishSelector(document.querySelector("#fetish-selector")!);
	#progress: HTMLElement;

	constructor(mainContainer: HTMLElement, sideViewContainer: HTMLElement) {
		this.#mainContainer = mainContainer;

		this.#diffOptions = {
			algorithm: "histogram",
			tokenization: "word",
			ignoreWhitespace: "ignore",
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
			onClick: (editor, event) => {
				this.#onEditorClick(editor, event);
			},
			onCopy: (editor, event) => {
				this.#onEditorCopy(editor, event);
			},
		};
		this.#worker = this.#initializeWorker();

		this.#leftEditor = new Editor(mainContainer, "left", editorCallbacks);
		this.#rightEditor = new Editor(mainContainer, "right", editorCallbacks);
		this.#editorContentsChanged = { left: true, right: true };
		this.#anchorManager = new AnchorManager(this.#leftEditor, this.#rightEditor);

		this.#sideView = new SideView(sideViewContainer);

		let lastContainerWidth: number = 0;
		const resizeObserver = new ResizeObserver(([entry]) => {
			const rect = {
				x: entry.contentRect.x,
				y: entry.contentRect.y,
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			};
			this.#renderer.invalidateLayout(rect);
			if (lastContainerWidth !== rect.width) {
				lastContainerWidth = rect.width;
				this.alignAnchors();
			}
		});
		resizeObserver.observe(mainContainer);

		const rendererCallbacks: RendererCallbacks = {
			onPrepare: (time: number) => this.#onRendererPrepare(time),
			onDraw: (time: number) => this.#onRendererDraw(time),
			onDiffVisibilityChanged: (region, entries) => this.#onDiffVisibilityChanged(region, entries),
		};

		this.#renderer = new Renderer(mainContainer, this.#leftEditor, this.#rightEditor, rendererCallbacks);

		syncModeAtom.set(this.#syncMode);
		whitespaceHandlingAtom.set(this.#diffOptions.ignoreWhitespace);
		sidebarExpandedAtom.set(true);

		this.#progress = document.createElement("div");
		this.#progress.id = "progress";
		document.body.appendChild(this.#progress);

		this.#setupEventListeners();

		syncModeAtom.subscribe((syncMode) => {
			if (syncMode !== this.syncMode) {
				this.syncMode = syncMode;
			}
		});

		whitespaceHandlingAtom.subscribe((whitespace) => {
			if (whitespace !== this.whitespace) {
				this.whitespace = whitespace;
			}
		});

		sidebarExpandedAtom.subscribe((expanded) => {
			document.body.classList.toggle("sidebar-collapsed", !expanded);
		});
	}

	#initializeWorker() {
		const worker = (() => {
			let workerURL;
			const scriptElement = document.getElementById("worker.js") as HTMLScriptElement;
			const workerCode = scriptElement.textContent;
			if (workerCode!.length < 10) {
				workerURL = scriptElement.src; // "./dist/worker.js";
			} else {
				const blob = new Blob([workerCode!], { type: "application/javascript" });
				workerURL = URL.createObjectURL(blob);
			}
			return new Worker(workerURL);
		})();

		worker.onmessage = (e: MessageEvent) => {
			const data = e.data;
			if (data.type === "diff") {
				if (this.#diffContext?.reqId === data.reqId) {
					// console.debug("Diff result received for reqId", data);
					this.#diffContext!.rawDiffs = data.diffs;
					this.#diffContext!.processTime = data.processTime;
					this.#finalizeDiffResult(this.#diffContext!);
				}
			}
		};

		return worker;
	}

	// #onContainerResize() {
	// 	console.warn("Container resized, invalidating layout.");
	// 	this.#renderer.invalidateLayout();
	// }

	#onRendererPrepare(time: number) {
		// if (this.syncMode) {
		// 	this.syncScroll(time, this.#scrollingEditor !== null);
		// }
	}

	#onRendererDraw(time: number) { }

	get syncMode() {
		return this.#syncMode;
	}

	set syncMode(value: boolean) {
		value = !!value;
		if (value === this.#syncMode) {
			return;
		}

		let currentSelectionRange: Range | null = null;
		if (!value) {
			// currently in sync mode
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				currentSelectionRange = selection.getRangeAt(0);
			}
		}

		this.#syncMode = value;
		syncModeAtom.set(value);

		this.#mainContainer.classList.toggle("pose-P9", value);

		this.#renderer.guideLineEnabled = value;
		this.#leftEditor.readonly = value;
		this.#rightEditor.readonly = value;

		if (value) {
			this.alignAnchors(true);
		} else {
			const activeEditor = this.#activeEditor ?? this.#lastActiveEditor;
			if (activeEditor) {
				activeEditor.focus();
			}
			if (currentSelectionRange) {
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
					selection.addRange(currentSelectionRange);
				}
			}
		}

		this.#renderer.invalidateGeometries();
	}

	get whitespace(): "ignore" | "normalize" | "onlyAtEdge" {
		return this.#diffOptions.ignoreWhitespace;
	}

	set whitespace(value: "ignore" | "normalize" | "onlyAtEdge") {
		if (value !== "ignore" && value !== "normalize" && value !== "onlyAtEdge") {
			throw new Error("Invalid whitespace option: " + value);
		}
		if (this.#diffOptions.ignoreWhitespace !== value) {
			this.#diffOptions.ignoreWhitespace = value;
			this.#onEditorContentChanged(this.#leftEditor);
			this.#onEditorContentChanged(this.#rightEditor);
			whitespaceHandlingAtom.set(value);
		}
	}

	#setupEventListeners() {
		document.addEventListener("selectionchange", () => {
			this.#updateTextSelection();
		});

		document.addEventListener("click", (e) => {
			if (e.target instanceof HTMLElement && e.target.closest(".diff-item")) {
				if (e.altKey) {
					this.#export(e);
				}
			}
		});

		document.addEventListener(
			"keydown",
			(e) => {
				if (e.key === "F2") {
					e.preventDefault();
					this.syncMode = !this.#syncMode;
				} else if (e.key === "F8") {
					e.preventDefault();
					this.whitespace = cycleWhitespace(this.whitespace);
				} else if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
					e.preventDefault();
					const editor = e.key === "1" ? this.#leftEditor : this.#rightEditor;
					editor.focus();
					return;
				} else if (e.key === "F9") {
					e.preventDefault();
					sidebarExpandedAtom.set(!sidebarExpandedAtom.get());
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

				if (e.shiftKey && e.ctrlKey && (e.key === "c" || e.key === "C")) {
					console.log("Copying selection to clipboard…");
					// this.#export(e);
				}
			},
			true
		);

		document.addEventListener("dragstart", (e) => {
			if (e.altKey) {
				this.#export(e);
			}
		});

		// this.#mainContainer.addEventListener("mousemove", (e) => {
		// 	const rect = this.#mainContainer.getBoundingClientRect();
		// 	let x = e.clientX - rect.x;
		// 	let y = e.clientY - rect.y;
		// 	this.#renderer.updateCursorPosition(x, y);
		// });

		// this.#mainContainer.addEventListener("mouseleave", () => {
		// 	this.#renderer.updateCursorPosition(NaN, NaN);
		// });

		hoveredDiffIndexAtom.subscribe((diffIndex) => this.#updateDiffIndicatorOverlay());

		diffItemClickedEvent.subscribe((diffIndex) => {
			this.#lastScrolledToDiffIndex = diffIndex;
			this.scrollToDiff(diffIndex);
		});
	}

	#onEditorContentChanging(editor: Editor) {
		this.showProgress("Tokenizing…");
		this.#reset();
	}

	#onEditorContentChanged(editor: Editor) {
		this.showProgress("Computing…");
		this.#editorContentsChanged[editor.name] = true;
		this.#computeDiff();
	}

	#export(e: Event): boolean {
		if (!this.#diffContext?.ready) {
			return false;
		}

		let target = e instanceof DragEvent ? e.dataTransfer : navigator.clipboard;
		let dragging = false;
		if (e instanceof DragEvent) {
			target = e.dataTransfer;
			dragging = true;
		} else {
			target = navigator.clipboard;
		}

		if (!target) {
			console.warn("No clipboard or dataTransfer available for copying selection.");
			return false;
		}


		let leftSpan: Span | undefined = undefined;
		let rightSpan: Span | undefined = undefined;

		console.log(e);
		if (e.target instanceof HTMLElement && e.target.matches(".diff-item")) {

			const diffIndex = parseInt(e.target.dataset.diffIndex!);
			const diff = this.#diffContext.diffs[diffIndex];
			leftSpan = diff.leftSpan;
			rightSpan = diff.rightSpan;
		} else {
			const selection = this.#getSelectionTokenRange();
			if (selection) {
				const { left, right } = selection;
				leftSpan = { index: left[0], count: left[1] - left[0] };
				rightSpan = { index: right[0], count: right[1] - right[0] };
			}
		}

		if (leftSpan && rightSpan) {
			const leftText = this.#leftEditor.getTokenRange(leftSpan.index, leftSpan.count).toString().trim();
			const rightText = this.#rightEditor.getTokenRange(rightSpan.index, rightSpan.count).toString().trim();
			const leftSectionLabel = getSectionTrailText(this.#diffContext.leftSectionHeadings, leftSpan.index);
			const rightSectionLabel = getSectionTrailText(this.#diffContext.rightSectionHeadings, rightSpan.index);
			const textArr = [leftSectionLabel, rightSectionLabel, leftText, rightText];
			this.#exportData(textArr, target);
			return true;
		}

		return false;
	}

	#exportData(data: string[], target: Clipboard | DataTransfer) {

		const tsvPayload = toTSV(data);
		if (target instanceof Clipboard) {
			target.writeText(tsvPayload).then(() => {
				console.debug("Copied to clipboard:", tsvPayload);
			}).catch((err) => {
				console.warn("Failed to copy TSV to clipboard:", err);
			});;
			// target.write([
			// 	new ClipboardItem({
			// 		"text/plain": new Blob([textPayload], { type: "text/plain" }),
			// 		"text/tab-separated-values": new Blob([tsvPayload], { type: "text/tab-separated-values" })
			// 	})
			// ]).catch((err) => {
			// 	console.error("Failed to copy TSV to clipboard:", err);
			// });
		} else if (target instanceof DataTransfer) {
			const textPayload = data.join("\r\n\r\n--------\r\n\r\n") + "\r\n\r\n";
			const tbl = document.createElement("TABLE");
			for (const line of data) {
				const tr = document.createElement("TR");
				const td = document.createElement("TD");
				td.textContent = line;
				tr.appendChild(td);
				tbl.appendChild(tr);
			}
			const htmlPayload = tbl.outerHTML;
			target.setData("text/plain", textPayload);
			target.setData("text/tab-separated-values", tsvPayload);
			target.setData("text/html", htmlPayload);
			console.debug("Copied to clipboard.", "plain:", textPayload, "tsv:", tsvPayload);
		}

		function escapeTSV(str: string) {
			return `"${str.replace(/"/g, '""')}"`
		}

		function toTSV(strings: string[]) {
			return strings.map(replaceTabsWithSingleSpace).map(escapeTSV).join('\r\n');
		}

		function replaceTabsWithSingleSpace(str: string) {
			return str.replace(/\t+/g, ' ');
		}
	}

	// 이건 나중에 renderer로 뺄까...? 하는 일이 비슷하잖아.
	#updateDiffIndicatorOverlay() {
		const diffIndex = hoveredDiffIndexAtom.get();
		this.#renderer.setDiffHighlight(diffIndex);

		let leftAbove = false,
			leftBelow = false,
			rightAbove = false,
			rightBelow = false;
		if (diffIndex !== null) {
			const leftRect = this.#renderer.getDiffRect("left", diffIndex);
			if (leftRect) {
				if (leftRect.y > this.#leftEditor.scrollTop + this.#leftEditor.height) {
					leftBelow = true;
				} else if (leftRect.y + leftRect.height < this.#leftEditor.scrollTop) {
					leftAbove = true;
				}
			}
			const rightRect = this.#renderer.getDiffRect("right", diffIndex);
			if (rightRect) {
				if (rightRect.y > this.#rightEditor.scrollTop + this.#rightEditor.height) {
					rightBelow = true;
				} else if (rightRect.y + rightRect.height < this.#rightEditor.scrollTop) {
					rightAbove = true;
				}
			}
		}
		this.#leftEditor.toggleDirectionalOverlays(leftAbove, leftBelow);
		this.#rightEditor.toggleDirectionalOverlays(rightAbove, rightBelow);
	}

	#onEditorClick(editor: Editor, event: MouseEvent) {
		if (this.syncMode) {
			this.#lastActiveEditor = this.#activeEditor = editor;
		}
		// console.debug("Editor clicked:", editor.name, event, this.#syncMode, event.altKey);
		if (event.altKey) {
			if (this.syncMode) {
				event.preventDefault();
				this.syncMode = false;
			}
		}
	}

	#onEditorCopy(editor: Editor, event: ClipboardEvent) {
		if (!this.#diffContext?.ready) {
			return;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return;
		}

		const targetEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
		const selectionRange = selection.getRangeAt(0);

		const [startTokenIndex, endTokenIndex] = editor.findTokenOverlapIndices(selectionRange);
		if (startTokenIndex >= 0 && endTokenIndex >= startTokenIndex) {
			let sourceRange = editor.getTokenRange(startTokenIndex, endTokenIndex - startTokenIndex);
			let targetRange: Range | null = null;

			const [otherStartTokenIndex, otherEndTokenIndex, hasDiff] = mapTokenRangeToOtherSide(
				this.#diffContext.rawDiffs,
				editor === this.#leftEditor ? "left" : "right",
				startTokenIndex,
				endTokenIndex
			);

			if (otherStartTokenIndex >= 0) {
				const otherStartToken = targetEditor.tokens[otherStartTokenIndex];
				const otherEndToken = targetEditor.tokens[otherEndTokenIndex - 1];
				if (otherStartToken && otherEndToken) {
					targetRange = document.createRange();
					targetRange.setStart(otherStartToken.range.startContainer, otherStartToken.range.startOffset);
					targetRange.setEnd(otherEndToken.range.endContainer, otherEndToken.range.endOffset);

					const data = {
						version: 1,
						source: editor.name,
						left: {
							text: sourceRange.toString(),
							startFlags: editor.tokens[startTokenIndex].flags,
						},
						right: {
							text: targetRange.toString(),
							startFlags: targetEditor.tokens[otherStartTokenIndex].flags,
						},
						hasDiff,
					};

					const tempContainer = document.createElement("div");
					tempContainer.appendChild(sourceRange.cloneContents());
					let html = tempContainer.innerHTML;

					let mimeType = "application/x-diffseek-json";
					mimeType = "text/html";
					const jsonString = JSON.stringify(data);

					html += "<!-- <DiffSeek JSON: " + jsonString + " / DiffSeek JSON> -->";

					event.clipboardData!.setData("text/plain", selectionRange.toString());
					event.clipboardData!.setData(mimeType, html);

					console.debug("Copied range to clipboard:", mimeType, data);

					if (mimeType === "text/plain" || mimeType === "text/html") {
						event.preventDefault();
					}
					console.log(
						"Copying range:",
						sourceRange,
						sourceRange.toString(),
						"to target editor:",
						targetEditor.name,
						"targetRange:",
						targetRange,
						targetRange?.toString()
					);
				}
			}
		}
	}

	#onEditorScroll(editor: Editor, scrollTop: number, scrollLeft: number) {
		this.#renderer.invalidateScroll(editor.name);

		if (this.#scrollingEditor === null) {
			this.#lastScrolledEditor = this.#scrollingEditor = editor;
			if (this.#scrollEndTimeoutId !== null) {
				clearTimeout(this.#scrollEndTimeoutId);
			}
			this.#scrollEndTimeoutId = setTimeout(() => {
				this.#onEditorScrollEnd(editor);
				this.#scrollEndTimeoutId = null;
			}, 100);
		}

		if (this.#syncMode && this.#scrollingEditor === editor) {
			this.syncScroll(editor);
		}
	}

	#onEditorScrollEnd(editor: Editor) {
		if (this.#scrollingEditor === editor) {
			if (this.#scrollEndTimeoutId !== null) {
				clearTimeout(this.#scrollEndTimeoutId);
				this.#scrollEndTimeoutId = null;
			}
			this.#scrollingEditor = null;
		}
	}

	#onEditorResize(editor: Editor) { }

	#onDiffVisibilityChanged(region: "left" | "right", entries: VisibilityChangeEntry[]) {
		this.#sideView.onDiffVisibilityChange(region, entries);
		this.#updateDiffIndicatorOverlay();
	}

	#getSelectionTokenRange(): { left: [number, number]; right: [number, number]; editor: "left" | "right"; hasDiff: boolean } | null {
		if (this.#diffContext?.ready) {
			const selection = window.getSelection();
			let editor: Editor | null = null;

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
						const [otherStartTokenIndex, otherEndTokenIndex, hasDiff] = mapTokenRangeToOtherSide(
							this.#diffContext.rawDiffs,
							editor === this.#leftEditor ? "left" : "right",
							startTokenIndex,
							endTokenIndex
						);
						if (otherStartTokenIndex >= 0) {
							const sourceTokenRange: [number, number] = [startTokenIndex, endTokenIndex];
							const targetTokenRange: [number, number] = [otherStartTokenIndex, otherEndTokenIndex];
							return {
								left: editor === this.#leftEditor ? sourceTokenRange : targetTokenRange,
								right: editor === this.#leftEditor ? targetTokenRange : sourceTokenRange,
								editor: editor.name,
								hasDiff,
							};
						}
					}
				}
			}
		}

		return null;
	}

	#updateTextSelection() {
		if (!this.#diffContext?.ready) {
			return;
		}

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
			reqId: ++this.#workerRequestId,
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

		this.#computeDiffCallbackId = requestIdleCallback(
			(idleDeadline) => {
				this.#computeDiffCallbackId = null;
				if (this.#diffContext !== diffContext) {
					return;
				}

				// worker에서 이전 토큰들을 캐시하고 있기 때문에 변경되지 않았으면 그냥 null을 보냄
				// const t1 = performance.now();
				const leftTokens = this.#editorContentsChanged.left ? buildTokenArray(leftRichTokens) : null;
				const rightTokens = this.#editorContentsChanged.right ? buildTokenArray(rightRichTokens) : null;
				// const t2 = performance.now();
				// console.debug("Token array built in", t2 - t1, "ms");

				const request: DiffRequest = {
					type: "diff",
					reqId: diffContext.reqId!,
					options: { ...options },
					leftTokens: leftTokens,
					rightTokens: rightTokens,
				};
				this.#worker.postMessage(request);

				// console.debug("Diff computed:", result.processTime, "ms", result);

				// if (this.#diffComputedCallbackId !== null) {
				// 	cancelIdleCallback(this.#diffComputedCallbackId);
				// 	this.#diffComputedCallbackId = null;
				// }

				//this.#finalizeDiffResult(diffContext, idleDeadline);
				// this.#computeDiffCallbackId = requestIdleCallback(
				// 	(idleDeadline) => {
				// 		this.#computeDiffCallbackId = null;
				// 		if (this.#diffContext !== diffContext) {
				// 			return;
				// 		}
				// 		// 행여나 이게 짜증날 정도로 오래 걸린다면 generator로 쪼개서 쬐끔씩 처리해야하는데 지금은 일단 그냥 둠.
				// 		// =====> 짜증날 정도로 오래 걸린다!!

				// 		// this.#onDiffComputed(diffContext);
				// 	},
				// 	{ timeout: COMPUTE_DIFF_TIMEOUT }
				// );
			},
			{ timeout: COMPUTE_DIFF_TIMEOUT }
		);
	}

	#finalizeDiffResult(diffContext: Partial<DiffContext>) {
		// console.log("Finalizing diff result", diffContext.rawDiffs?.length, "entries");
		let generator: Generator<void, void, IdleDeadline> | null = null;
		// const generator = this.#diffFinalizer(diffContext, idleDeadline);
		const step = (idleDeadline: IdleDeadline) => {
			if (this.#diffContext !== diffContext) {
				return;
			}
			if (generator === null) {
				generator = this.#diffFinalizer(diffContext, idleDeadline);
			}

			const { done } = generator.next(idleDeadline);
			if (this.#diffContext !== diffContext) {
				console.log("canceling diff finalization due to context change");
				return;
			}
			if (done) {
				this.showProgress(null);
				// done!
			} else {
				this.#computeDiffCallbackId = requestIdleCallback(step, {
					timeout: COMPUTE_DIFF_TIMEOUT,
				});
			}
		};

		this.#computeDiffCallbackId = requestIdleCallback(step, {
			timeout: COMPUTE_DIFF_TIMEOUT,
		});

		//let generator: ReturnType<typeof this.#diffFinalizer> | null = null;
	}

	*#diffFinalizer(diffContext: Partial<DiffContext>, idleDeadline: IdleDeadline): Generator<void, void, IdleDeadline> {
		const leftTokens = diffContext.leftTokens!;
		const rightTokens = diffContext.rightTokens!;
		const rawEntries = diffContext.rawDiffs!;

		const diffs: DiffItem[] = [];
		hoveredDiffIndexAtom.set(null);
		this.#lastScrolledToDiffIndex = null;

		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;
		const anchorManager = this.#anchorManager;

		// leftEditor.unobserveMutation();
		// rightEditor.unobserveMutation();
		anchorManager.beginUpdate();
		const ANCHOR_MIN_LINE_BREAKS = 0; // 앵커를 붙일 때 최소한의 줄바꿈 수.
		let forceStart = true;
		let currentDiff: RawDiff | null = null;

		const leftSectionHeadings = this.#buildSectionHeadingTree(leftEditor, leftTokens);
		const rightSectionHeadings = this.#buildSectionHeadingTree(rightEditor, rightTokens);

		for (let i = 0; i < rawEntries.length; i++) {
			if ((i & 0x1f) === 0) {
				if (idleDeadline.timeRemaining() < 5) {
					// console.log(diffContext.reqId, "Yielding to idle deadline at entry", i, "remaining:", idleDeadline.timeRemaining());
					// console.debug("Yielding to idle deadline at entry", i);
					idleDeadline = yield; // yield control to the event loop
					// console.debug("loop@%d, elapsed=%d", i,  idleDeadline.timeRemaining());
				} else {
					// console.debug("Processing entry", i, "of", rawEntries.length, "remaining:", idleDeadline.timeRemaining());
				}
			}

			const rawEntry = rawEntries[i];
			const left = rawEntry.left;
			const right = rawEntry.right;

			if (rawEntry.type) {
				if (currentDiff) {
					console.assert(currentDiff.left.index + currentDiff.left.count === rawEntry.left.index, currentDiff, rawEntry);
					console.assert(currentDiff.right.index + currentDiff.right.count === rawEntry.right.index, currentDiff, rawEntry);
					currentDiff.type |= rawEntry.type;
					currentDiff.left.count += rawEntry.left.count;
					currentDiff.right.count += rawEntry.right.count;
				} else {
					currentDiff = { left: { ...rawEntry.left }, right: { ...rawEntry.right }, type: rawEntry.type };
				}
			} else {
				// common entry
				if (currentDiff) {
					finalizeDiff();
				}

				const leftToken = leftTokens[left.index];
				const rightToken = rightTokens[right.index];

				const leftTokenFlags = leftToken.flags;
				const rightTokenFlags = rightToken.flags;
				const commonFlags = leftTokenFlags & rightTokenFlags;

				let anchorEligible = false;
				let leftAnchorFlags = AnchorFlags.None;
				let rightAnchorFlags = AnchorFlags.None;
				if (commonFlags & TokenFlags.MANUAL_ANCHOR) {
					anchorEligible = true;
					leftAnchorFlags = AnchorFlags.MANUAL_ANCHOR;
					rightAnchorFlags = AnchorFlags.MANUAL_ANCHOR;
					// const leftEl = leftToken.range.startContainer.childNodes[leftToken.range.startOffset] as HTMLElement;
					// const rightEl = rightToken.range.startContainer.childNodes[rightToken.range.startOffset] as HTMLElement;
					// amFn.addAnchorEls(leftEl, rightEl, AnchorFlags.LINE_START, AnchorFlags.LINE_START);
				} // else
				{
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
						anchorManager.addAnchorPair(left.index, leftAnchorFlags, right.index, rightAnchorFlags, null);
					}
				}
			}
		}
		if (currentDiff) {
			finalizeDiff();
		}

		function finalizeDiff() {
			const diffIndex = diffs.length;
			const leftIndex = currentDiff!.left.index;
			const rightIndex = currentDiff!.right.index;
			const leftTokenCount = currentDiff!.left.count;
			const rightTokenCount = currentDiff!.right.count;
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
					if (
						(emptyTokenIndex > 0 && emptyTokens[emptyTokenIndex - 1].flags & TokenFlags.LINE_END) ||
						(emptyTokenIndex + 1 < emptyTokens.length && emptyTokens[emptyTokenIndex + 1].flags & TokenFlags.LINE_START)
					) {
						filledAnchorFlags = translateTokenFlagsToAnchorFlags(filledStartFlags, filledEndFlags);
						emptyAnchorFlags = AnchorFlags.EMPTY_DIFF;
					}
				}

				if (leftTokenCount > 0) {
					leftAnchorFlags = filledAnchorFlags;
					rightAnchorFlags = emptyAnchorFlags;
				} else {
					rightAnchorFlags = filledAnchorFlags;
					leftAnchorFlags = emptyAnchorFlags;
				}
			}

			let anchorPair: AnchorPair | null = null;
			if (leftAnchorFlags && rightAnchorFlags) {
				anchorPair = anchorManager.addAnchorPair(leftIndex, leftAnchorFlags, rightIndex, rightAnchorFlags, null);
			}

			let leftRange: Range | null = null;
			let rightRange: Range | null = null;

			if (leftTokenCount === 0 && anchorPair) {
				leftRange = document.createRange();
				leftRange.selectNode(anchorPair.leftEl);
				if (rightTokens[rightIndex].flags & TokenFlags.LINE_START && rightTokens[rightIndex + rightTokenCount - 1].flags & TokenFlags.LINE_END) {
					// console.warn("Adding block class to left anchor element", anchorPair.leftEl);
					anchorPair.leftEl.classList.add("block");
				}
			}
			if (rightTokenCount === 0 && anchorPair) {
				rightRange = document.createRange();
				rightRange.selectNode(anchorPair.rightEl);
				if (leftTokens[leftIndex].flags & TokenFlags.LINE_START && leftTokens[leftIndex + leftTokenCount - 1].flags & TokenFlags.LINE_END) {
					// console.warn("Adding block class to right anchor element", anchorPair.rightEl);
					anchorPair.rightEl.classList.add("block");
				}
			}
			leftRange ??= leftEditor.getTokenRange(leftIndex, leftTokenCount);
			rightRange ??= rightEditor.getTokenRange(rightIndex, rightTokenCount);

			diffs.push({
				diffIndex,
				hue,
				leftRange,
				rightRange,
				leftSpan: { index: leftIndex, count: leftTokenCount },
				rightSpan: { index: rightIndex, count: rightTokenCount },
			});

			currentDiff = null;
			forceStart = true;
		}

		// if (idleDeadline.timeRemaining() < 10) {
		// 	// console.debug("Yielding to idle deadline at end of diff finalization");
		// 	idleDeadline = yield; // yield control to the event loop
		// }
		anchorManager.endUpdate();
		// leftEditor.observeMutation();
		// rightEditor.observeMutation();
		// 지옥으로 간다...

		diffContext.diffs = diffs;
		diffContext.leftSectionHeadings = leftSectionHeadings;
		diffContext.rightSectionHeadings = rightSectionHeadings;
		diffContext.ready = true;
		this.#renderer.setDiffs(diffs);
		this.#sideView.setDiffs(diffs);
		this.#updateTextSelection();
		console.debug("Diff finalization complete", diffContext);
	}

	#buildSectionHeadingTree(editor: Editor, tokens: readonly RichToken[]): SectionHeading[] {
		const rootHeadings: SectionHeading[] = [];
		const stack: SectionHeading[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const headingFlag = token.flags & TokenFlags.SECTION_HEADING_MASK;
			if (!headingFlag) continue;

			const level = getHeadingLevelFromFlag(headingFlag);
			const ordinalText = token.text;
			const ordinalNum = parseOrdinalNumber(ordinalText);

			let titleEndTokenIndex = i;
			while (titleEndTokenIndex < tokens.length && (tokens[titleEndTokenIndex++].flags & TokenFlags.LINE_END) === 0);

			const tokenRange = editor.getTokenRange(i, titleEndTokenIndex - i);
			const title = tokenRange.toString();

			const heading: SectionHeading = {
				type: headingFlag,
				level,
				ordinalText,
				ordinalNum,
				title,
				parent: null,
				firstChild: null,
				nextSibling: null,
				startTokenIndex: i,
				endTokenIndex: Number.MAX_SAFE_INTEGER, // temp
			};

			// 깊이 기반 스택 처리
			while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
				const closed = stack.pop()!;
				closed.endTokenIndex = heading.startTokenIndex;
			}

			if (stack.length === 0) {
				rootHeadings.push(heading);
			} else {
				const parent = stack[stack.length - 1];
				heading.parent = parent;
				if (!parent.firstChild) {
					parent.firstChild = heading;
				} else {
					let sibling = parent.firstChild;
					while (sibling.nextSibling) sibling = sibling.nextSibling;
					sibling.nextSibling = heading;
				}
			}

			stack.push(heading);
		}

		// 아직 닫히지 않은 것들은 문서 끝까지 범위로 간주
		for (const remaining of stack) {
			remaining.endTokenIndex = tokens.length;
		}

		return rootHeadings;
	}

	syncScroll(primaryEditor: Editor) {
		const followingEditor = primaryEditor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
		followingEditor.scrollTo(primaryEditor.scrollTop, { behavior: "instant" });
	}

	#anchorAligning = false;
	#alignAnchorCancelId: number | null = null;
	alignAnchors(instantly: boolean = false) {
		if (!this.#syncMode || !this.#diffContext?.ready) {
			return;
		}

		console.time("Aligning anchors");
		const primaryEditor = this.#lastScrolledEditor ?? this.#lastActiveEditor ?? this.#rightEditor;
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		this.#anchorAligning = true;
		this.#anchorManager.alignAnchorsGently(() => {
			leftEditor.forceReflow();
			rightEditor.forceReflow();

			let editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
			leftEditor.height = editorHeight;
			rightEditor.height = editorHeight;
			//this.#renderer.invalidateScroll();
			//void this.#mainContainer.offsetHeight;
			this.#renderer.invalidateGeometries();
			this.syncScroll(primaryEditor);
			this.#anchorAligning = false;
		});
		console.timeEnd("Aligning anchors");
	}

	#reset() {
		this.#diffContext = null;
		this.#textSelectionRange = null;
		this.#cancelAllCallbacks();
		this.#renderer.setSelectionHighlight("left", null);
		this.#renderer.setSelectionHighlight("right", null);
	}

	#cancelAllCallbacks() {
		if (this.#computeDiffCallbackId !== null) {
			// console.debug("Cancelling compute diff callback", this.#computeDiffCallbackId);
			cancelIdleCallback(this.#computeDiffCallbackId);
			this.#computeDiffCallbackId = null;
		}
		this.#renderer.cancelRender();
	}

	scrollToDiff(diffIndex: number) {
		const leftRect = this.#renderer.getDiffRect("left", diffIndex);
		const rightRect = this.#renderer.getDiffRect("right", diffIndex);
		if (!leftRect || !rightRect) {
			return;
		}

		if (this.#syncMode) {
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

	setContent(editorName: EditorName, contentHTML: string) {
		const editor = editorName === "left" ? this.#leftEditor : this.#rightEditor;
		editor.setContent(contentHTML);
	}

	showProgress(message: string | null) {
		let el = this.#progress;

		if (message === null) {
			// fade out
			el.classList.add("fade-out");
			el.classList.remove("show");
			el.addEventListener(
				"transitionend",
				() => {
					el.style.display = "none";
					el.classList.remove("fade-out");
				},
				{ once: true }
			);
		} else {
			el.textContent = message;
			el.style.display = "block"; // show before triggering transition
			requestAnimationFrame(() => {
				el.classList.add("show");
				el.classList.remove("fade-out");
			});
		}
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

function toRange(range: Range | LightRange) {
	if (range instanceof Range) {
		return range;
	} else {
		const newRange = document.createRange();
		newRange.setStart(range.startContainer, range.startOffset);
		newRange.setEnd(range.endContainer, range.endOffset);
		return newRange;
	}
}
