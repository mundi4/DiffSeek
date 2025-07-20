// atoms
// 이렇게까지 하게 될지는 몰랐는데 ui요소마다 콜백을 넘기고 또 그걸 또 감싸서 자식으로 넘기고... 귀찮잖아...

const hoveredDiffIndexAtom = createAtom<number | null>("highlightedDiffIndex", null);
const diffItemClickedEvent = createEventAtom<number>("diffItemClickedEvent");
const syncModeAtom = createAtom<boolean>("syncMode", false);
const whitespaceHandlingAtom = createAtom<WhitespaceHandling>("whitespaceHandling", "onlyAtEdge");
const sidebarExpandedAtom = createAtom<boolean>("sidebarExpanded", true);
const peepviewEnabledAtom = createAtom<boolean>("peepviewEnabled", true);

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
	editorPairer: EditorPairer;
	//#computeFunc = initializeWorker((result) => this.#onWorkerMessage(result)).compute;
	#worker = initializeWorker((msg) => this.#onWorkerMessage(msg));
	#fullDiffReqId: number | null = null;
	#sliceDiffReqId: number | null = null;
	#sliceDiffContext: { leftText: string, rightText: string, diffs: RawDiff[] | null, options: DiffOptions, reqId: number } | null = null;
	#editorContentsChanged: Record<EditorName, boolean> = {
		left: false,
		right: false,
	};

	#computeDiffCallbackId: number | null = null;
	// #diffComputedCallbackId: number | null = null;
	#fetishSelector = new FetishSelector(document.querySelector("#fetish-selector")!);
	#progress: HTMLElement;
	#diffProcessor: DiffPostProcessor | null = null;
	#peepView = new PeepView();

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
		this.#leftEditor = new Editor(mainContainer, "left", editorCallbacks);
		this.#rightEditor = new Editor(mainContainer, "right", editorCallbacks);
		this.#editorContentsChanged = { left: true, right: true };
		this.editorPairer = new EditorPairer(this.#leftEditor, this.#rightEditor);

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
		peepviewEnabledAtom.subscribe((enabled) => {
			this.#updateTextSelection();
		});

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

	// #initializeWorker() {
	// 	const worker = (() => {
	// 		let workerURL;
	// 		const scriptElement = document.getElementById("worker.js") as HTMLScriptElement;
	// 		const workerCode = scriptElement.textContent;
	// 		if (workerCode!.length < 10) {
	// 			workerURL = scriptElement.src; // "./dist/worker.js";
	// 		} else {
	// 			const blob = new Blob([workerCode!], { type: "application/javascript" });
	// 			workerURL = URL.createObjectURL(blob);
	// 		}
	// 		return new Worker(workerURL);
	// 	})();

	// 	worker.onmessage = (e: MessageEvent) => {
	// 		const data = e.data;
	// 		if (data.type === "diff") {
	// 			if (this.#diffContext?.reqId === data.reqId) {
	// 				// console.debug("Diff result received for reqId", data);
	// 				this.#diffContext!.rawDiffs = data.diffs;
	// 				this.#diffContext!.processTime = data.processTime;
	// 				this.#finalizeDiffResult(this.#diffContext!);
	// 			}
	// 		}
	// 	};

	// 	return worker;
	// }

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
			this.alignAnchors();
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
					// } else if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
					// 	e.preventDefault();
					// 	const editor = e.key === "1" ? this.#leftEditor : this.#rightEditor;
					// 	editor.focus();
					// 	return;
				} else if (e.key === "F9") {
					e.preventDefault();
					sidebarExpandedAtom.set(!sidebarExpandedAtom.get());
				} else if (e.key === "F3") {
					e.preventDefault();
					peepviewEnabledAtom.set(!peepviewEnabledAtom.get());
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

				if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
					e.preventDefault();
					console.debug("Ctrl+1 or Ctrl+2 pressed, focusing editor:", e.key);
					const editor = e.key === "1" ? this.#leftEditor : this.#rightEditor;
					editor.selectAll();
					navigator.clipboard.read().then((items) => {
						if (items.length > 0) {
							const orderedTypes = ["text/html", "text/plain"];
							for (const type of orderedTypes) {
								if (items[0].types.includes(type)) {
									items[0].getType(type).then((blob) => {
										blob.text().then((text) => {
											console.debug(`Clipboard ${type}:`, text);
											editor.setContent(text);
										});
									});
									break;
								}
							}
						}
					});
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
		this.showMessage("Tokenizing…");
		this.#peepView.hide();
		this.#reset();
	}

	#onEditorContentChanged(editor: Editor) {
		this.showMessage("Computing…");
		this.#editorContentsChanged[editor.name] = true;
		this.#runFullDiff();
	}

	#export(e: Event): boolean {
		if (!this.#diffContext) {
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
				leftSpan = { index: left.index, count: left.count };
				rightSpan = { index: right.index, count: right.count };
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
		if (!this.#diffContext) {
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

	#getSelectionTokenRange(): { left: Span; right: Span; sourceEditor: "left" | "right"; sourceRange: Range } | null {
		if (this.#diffContext) {
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
					console.log("Selection token indices:", startTokenIndex, endTokenIndex);
					if (startTokenIndex >= 0 && endTokenIndex >= startTokenIndex) {
						let otherStartTokenIndex: number;
						let otherEndTokenIndex: number;
						const otherEntries = editor === this.#leftEditor ? this.#diffContext.leftEntries : this.#diffContext.rightEntries;
						console.log("otherEntries:", otherEntries, editor.name);
						const otherSpanKey = editor === this.#leftEditor ? "right" : "left";
						otherStartTokenIndex = otherEntries[startTokenIndex][otherSpanKey].index;
						if (endTokenIndex > 0) {
							otherEndTokenIndex = otherEntries[endTokenIndex - 1][otherSpanKey].index + otherEntries[endTokenIndex - 1][otherSpanKey].count
						} else {
							otherEndTokenIndex = otherEntries[startTokenIndex][otherSpanKey].index + otherEntries[startTokenIndex][otherSpanKey].count;
						}

						// const [otherStartTokenIndex, otherEndTokenIndex, hasDiff] = mapTokenRangeToOtherSide(
						// 	this.#diffContext.rawDiffs,
						// 	editor === this.#leftEditor ? "left" : "right",
						// 	startTokenIndex,
						// 	endTokenIndex
						// );
						if (otherStartTokenIndex >= 0) {
							const sourceTokenSpan = { index: startTokenIndex, count: endTokenIndex - startTokenIndex };
							const targetTokenSpan = { index: otherStartTokenIndex, count: otherEndTokenIndex - otherStartTokenIndex };
							return {
								left: editor === this.#leftEditor ? sourceTokenSpan : targetTokenSpan,
								right: editor === this.#leftEditor ? targetTokenSpan : sourceTokenSpan,
								sourceEditor: editor.name,
								sourceRange: range,
								// hasDiff,
							};
						}
					}
				}
			}
		}

		return null;
	}

	#updateTextSelection() {
		if (!this.#diffContext) {
			return;
		}

		const selection = this.#getSelectionTokenRange();
		let targetEditor: Editor | null = null;
		let sourceRange: Range | null = null;
		let targetRange: Range | null = null;
		let leftSpan: Span | undefined = undefined;
		let rightSpan: Span | undefined = undefined;
		let selectedSpan: Span | undefined = undefined;

		if (selection) {
			({ left: leftSpan, right: rightSpan, sourceRange } = selection);

			let otherStartTokenIndex: number;
			let otherEndTokenIndex: number;
			if (selection.sourceEditor === "left") {
				selectedSpan = leftSpan;
				targetEditor = this.#rightEditor;
				otherStartTokenIndex = rightSpan.index;
				otherEndTokenIndex = rightSpan.index + rightSpan.count;
			} else {
				selectedSpan = rightSpan;
				targetEditor = this.#leftEditor;
				otherStartTokenIndex = leftSpan.index;
				otherEndTokenIndex = leftSpan.index + leftSpan.count;
			}

			targetEditor = selection.sourceEditor === "left" ? this.#rightEditor : this.#leftEditor;

			if (otherStartTokenIndex >= 0) {
				//targetEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
				const otherStartToken = targetEditor.tokens[otherStartTokenIndex];
				const otherEndToken = targetEditor.tokens[otherEndTokenIndex - 1];
				if (otherStartToken && otherEndToken) {
					targetRange = document.createRange();
					targetRange.setStart(otherStartToken.range.startContainer, otherStartToken.range.startOffset);
					targetRange.setEnd(otherEndToken.range.endContainer, otherEndToken.range.endOffset);
				}
			}
		}

		if (peepviewEnabledAtom.get() && ((leftSpan && leftSpan.count > 0) || (rightSpan && rightSpan.count > 0))) {
			if (leftSpan || rightSpan) {
				const MAX_TOKEN_COUNT = 200;
				if ((!leftSpan || leftSpan.count <= MAX_TOKEN_COUNT) && (!rightSpan || rightSpan.count <= MAX_TOKEN_COUNT)) {
					let leftText;
					let rightText;
					if (leftSpan && leftSpan.count > 0) {
						leftText = this.#leftEditor.getTokenRange(leftSpan.index, leftSpan.count).toString();
					} else {
						leftText = "";
					}
					if (rightSpan && rightSpan.count > 0) {
						rightText = this.#rightEditor.getTokenRange(rightSpan.index, rightSpan.count).toString();
					} else {
						rightText = "";
					}
					const leftTrail = leftSpan ? getSectionTrail(this.#diffContext.leftSectionHeadings, leftSpan.index) : [];
					const rightTrail = rightSpan ? getSectionTrail(this.#diffContext.rightSectionHeadings, rightSpan.index) : [];
					this.#peepView.show(
						leftText,
						rightText,
						leftTrail,
						rightTrail
					);
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

		// const selection = window.getSelection();
		// let editor: Editor | null = null;
		// let targetEditor: Editor | null = null;
		// let targetRange: Range | null = null;

		// if (selection && selection.rangeCount > 0) {
		// 	const range = selection.getRangeAt(0);

		// 	if (this.#leftEditor.contains(range)) {
		// 		editor = this.#leftEditor;
		// 	} else if (this.#rightEditor.contains(range)) {
		// 		editor = this.#rightEditor;
		// 	}

		// 	if (editor) {
		// 		// onContentChanging에서 diffContext를 null로 설정하므로 이 시점에서 에디터는 유효한 토큰 배열을 가지고 있다고 볼 수 있다.
		// 		const [startTokenIndex, endTokenIndex] = editor.findTokenOverlapIndices(range);

		// 		if (startTokenIndex >= 0 && endTokenIndex >= startTokenIndex) {
		// 			let otherStartTokenIndex: number;
		// 			let otherEndTokenIndex: number;
		// 			if (editor === this.#leftEditor) {
		// 				otherStartTokenIndex = this.#diffContext.leftEntries[startTokenIndex].right.index;
		// 				otherEndTokenIndex = this.#diffContext.leftEntries[endTokenIndex - 1].right.index + this.#diffContext.leftEntries[endTokenIndex - 1].right.count
		// 			} else {
		// 				otherStartTokenIndex = this.#diffContext.rightEntries[startTokenIndex].left.index;
		// 				otherEndTokenIndex = this.#diffContext.rightEntries[endTokenIndex - 1].left.index + this.#diffContext.rightEntries[endTokenIndex - 1].left.count;
		// 			}
		// 			// const [otherStartTokenIndex, otherEndTokenIndex] = mapTokenRangeToOtherSide(
		// 			// 	this.#diffContext.rawDiffs,
		// 			// 	editor === this.#leftEditor ? "left" : "right",
		// 			// 	startTokenIndex,
		// 			// 	endTokenIndex
		// 			// );

		// 			if (otherStartTokenIndex >= 0) {
		// 				targetEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
		// 				const otherStartToken = targetEditor.tokens[otherStartTokenIndex];
		// 				const otherEndToken = targetEditor.tokens[otherEndTokenIndex - 1];
		// 				if (otherStartToken && otherEndToken) {
		// 					targetRange = document.createRange();
		// 					targetRange.setStart(otherStartToken.range.startContainer, otherStartToken.range.startOffset);
		// 					targetRange.setEnd(otherEndToken.range.endContainer, otherEndToken.range.endOffset);
		// 				}
		// 			}
		// 		}
		// 	}
		// }

		// if (this.#textSelectionRange === targetRange) {
		// 	return;
		// }

		// if (this.#textSelectionRange && targetRange) {
		// 	if (
		// 		targetRange.startContainer === this.#textSelectionRange.startContainer &&
		// 		targetRange.startOffset === this.#textSelectionRange.startOffset &&
		// 		targetRange.endContainer === this.#textSelectionRange.endContainer &&
		// 		targetRange.endOffset === this.#textSelectionRange.endOffset
		// 	) {
		// 		return;
		// 	}
		// }

		// this.#textSelectionRange = targetRange;
		// this.#renderer.setSelectionHighlight(targetEditor === this.#leftEditor ? "left" : "right", targetRange);
	}

	#runFullDiff() {
		this.#cancelAllCallbacks();
		this.#diffProcessor?.cancel();
		this.#diffProcessor = null;
		this.#diffContext = null;

		const leftRichTokens = this.#leftEditor.tokens;
		const rightRichTokens = this.#rightEditor.tokens;
		const options = { ...this.#diffOptions };

		this.#computeDiffCallbackId = requestIdleCallback(
			(idleDeadline) => {
				this.#computeDiffCallbackId = null;

				const leftTokens = this.#editorContentsChanged.left ? buildTokenArray(leftRichTokens) : null;
				const rightTokens = this.#editorContentsChanged.right ? buildTokenArray(rightRichTokens) : null;
				this.#fullDiffReqId = this.#worker.fullDiff(leftTokens, rightTokens, options);
			},
			{ timeout: COMPUTE_DIFF_TIMEOUT }
		);
	}

	#runSliceDiff(leftText: string, rightText: string) {
		const options: DiffOptions = { ...this.#diffOptions, algorithm: "lcs", tokenization: "char" };
		const reqId = this.#fullDiffReqId = this.#worker.sliceDiff(
			leftText,
			rightText,
			options
		);
		this.#sliceDiffContext = {
			leftText,
			rightText,
			options,
			reqId,
			diffs: null
		}
	}

	#onWorkerMessage(msg: WorkerMessage) {
		console.log("worker message:", msg);
		if (msg.type === "diff") {
			if (this.#fullDiffReqId !== msg.reqId) {
				return;
			}

			this.#diffProcessor?.cancel();
			this.#diffProcessor = new DiffPostProcessor(
				this.#leftEditor,
				this.#rightEditor,
				this.editorPairer,
				msg.options,
				msg.diffs
			);
			this.#diffProcessor.process((diffContext) => this.#onDiffPostProcessed(diffContext));
		} else if (msg.type === "slice") {
			if (this.#sliceDiffContext && this.#sliceDiffContext.reqId === msg.reqId) {
				if (msg.accepted) {
					this.#sliceDiffContext.diffs = msg.diffs;
					const html = renderUnifiedDiffHTML(
						this.#sliceDiffContext.leftText,
						this.#sliceDiffContext.rightText,
						this.#sliceDiffContext.diffs
					);
					//this.#peepView.show(`<div class="diff-view">${html}</div>`);
					console.log(html)
				} else {
					console.warn("Slice diff was not accepted by the worker:", msg);
				}
			} else {
				console.warn("Received slice diff message with unknown reqId:", msg.reqId, "expected:", this.#sliceDiffContext?.reqId);
			}
		}
	}

	#onDiffPostProcessed(diffContext: DiffContext) {
		console.log("Diff post-processed:", diffContext);
		this.showMessage(null);
		this.#diffContext = diffContext;
		this.#diffProcessor = null;

		this.#renderer.setDiffs(diffContext.diffs);
		this.#sideView.setDiffs(diffContext.diffs);
		this.#updateTextSelection();
	}

	syncScroll(primaryEditor: Editor) {
		const followingEditor = primaryEditor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
		followingEditor.scrollTo(primaryEditor.scrollTop, { behavior: "instant" });
	}

	alignAnchors() {
		if (!this.#syncMode || !this.#diffContext) {
			return;
		}

		const primaryEditor = this.#lastScrolledEditor ?? this.#lastActiveEditor ?? this.#rightEditor;
		const leftEditor = this.#leftEditor;
		const rightEditor = this.#rightEditor;

		this.editorPairer.alignAnchorsGently(() => {
			leftEditor.forceReflow();
			rightEditor.forceReflow();

			let editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
			leftEditor.height = editorHeight;
			rightEditor.height = editorHeight;
			//this.#renderer.invalidateScroll();
			//void this.#mainContainer.offsetHeight;
			this.#renderer.invalidateGeometries();
			this.syncScroll(primaryEditor);
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

	showMessage(message: string | null) {
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

const progressMessages = {
	tokenize: [
		"Tokenizing... ✂️",
	],
	compute: [
		"Computing... 🧠",
	],
};

function getRandomMessage(key: keyof typeof progressMessages): string {
	const messages = progressMessages[key];
	return messages[Math.floor(Math.random() * messages.length)];
}