import { DiffProcessor } from "./DiffProcessor";
import { initializeDiffWorker } from "@/core/worker/initializeDiffWorker";
import type { RichToken } from "@/core/tokenization/TokenizeContext";
import { createEvent } from "../utils/createEvent";
import type { DiffContext } from "./DiffContext";
import type { EditorName } from "./types";
import type { Editor, EditorCallbacks } from "@/core/Editor";
import type { Renderer, RendererCallbacks } from "@/core/Renderer";
import { EDITOR_SCROLL_MARGIN } from "@/core/constants/index";
import { EditorPairer } from "./EditorPairer";
import { TokenFlags } from "./tokenization/TokenFlags";

export type DiffResult = {
	diffs: DiffEntry[];
	options: DiffOptions;
	processTime: number;
};

// const defaultDiffOptions: DiffOptions = {
// 	algorithm: "histogram",
// 	tokenization: "word",
// 	ignoreWhitespace: "ignore",
// 	greedyMatch: false,
// 	useLengthBias: true,
// 	maxGram: 4,
// 	lengthBiasFactor: 0.7,
// 	containerStartMultiplier: 1 / 0.85,
// 	containerEndMultiplier: 1 / 0.9,
// 	sectionHeadingMultiplier: 1 / 0.75,
// 	lineStartMultiplier: 1 / 0.9,
// 	lineEndMultiplier: 1 / 0.95,
// 	uniqueMultiplier: 1 / 0.6667,
// };

// export function getDefaultDiffOptions(): DiffOptions {
// 	return structuredClone(defaultDiffOptions);
// }

const SCROLL_TIMEOUT = 100;

export type DiffInitEvent = {
	leftEditorChanged: boolean;
	rightEditorChanged: boolean;
};

export type DiffStartEvent = {
	leftTokenCount: number;
	rightTokenCount: number;
};

export type TextSelectionEvent = {
	selection: EditorTextSelection | null;
};

export type EditorTextSelection = {
	sourceEditor: EditorName;
	sourceSpan: Span;
	sourceRange: Range;
	leftTokenSpan: Span;
	rightTokenSpan: Span;
	leftTokenRange: Range;
	rightTokenRange: Range;
};

export class DiffController {
	#diffWorker;
	#leftEditor: Editor;
	#rightEditor: Editor;
	#renderer: Renderer;
	#editorPairer: EditorPairer;
	// #editorPairer: EditorPairer;
	#postProcessor: DiffProcessor | null = null;
	#diffOptions;
	diffContext: DiffContext | null = null;
	#syncMode = false;

	// Event emitters
	#syncModeChangeEvent = createEvent<boolean>();
	#hoveredDiffIndexChangeEvent = createEvent<number | null>();
	#diffVisibilityChangeEvent = createEvent<Record<EditorName, VisibilityChangeEntry[]>>();
	#diffWorkflowStartEvent = createEvent();
	#diffComputingEvent = createEvent<DiffStartEvent>();
	#diffWorkflowDone = createEvent<DiffContext>();
	#textSelectionEvent = createEvent<TextSelectionEvent>();

	#editorContentsChanged: Record<EditorName, boolean> = {
		left: false,
		right: false,
	};
	#scrollingEditor: Editor | null = null;
	#lastScrolledEditor: Editor | null = null;
	#focusedEditor: Editor | null = null;
	#lastFocusedEditor: Editor | null = null;
	#scrollTimeoutId: NodeJS.Timeout | null = null;
	#preventScrollEvent = false;
	#alignEditorsRequestId: number | null = null;
	#invalidateGeometriesRequestId: number | null = null;
	#visibleDiffs: Record<EditorName, Set<number>> = {
		left: new Set(),
		right: new Set(),
	};
	#lastTextSelectionRange: Range | null = null;

	constructor(leftEditor: Editor, rightEditor: Editor, renderer: Renderer, diffOptions: DiffOptions) {
		this.#leftEditor = leftEditor;
		this.#rightEditor = rightEditor;
		this.#renderer = renderer;
		this.#diffOptions = diffOptions;
		this.#editorPairer = new EditorPairer(leftEditor, rightEditor);

		// this.#setupEditorCallbacks(leftEditor);
		// this.#setupEditorCallbacks(rightEditor);
		// this.#setupRendererCallbacks(renderer);
		this.#setupEventListeners();
		this.#diffWorker = initializeDiffWorker(this.#onDiffCompleted.bind(this));

		this.#diffWorker.run([], [], this.#diffOptions);
		renderer.guideLineEnabled = this.#syncMode;

		const editorCallbacks: Partial<EditorCallbacks> = {
			contentChanged: this.#handleEditorContentChanged.bind(this),
			contentChanging: this.#handleEditorContentChanging.bind(this),
			scroll: this.#handleEditorScroll.bind(this),
			scrollEnd: this.#handleEditorScrollEnd.bind(this),
			resize: this.#handleEditorResize.bind(this),
			focus: this.#handleEditorFocus.bind(this),
			blur: this.#handleEditorBlur.bind(this),
			click: this.#handleEditorClick.bind(this),
			copy: this.#handleEditorCopy.bind(this),
			mouseMove: this.#handleEditorMouseMove.bind(this),
			mouseLeave: this.#handleEditorMouseLeave.bind(this),
		};
		leftEditor.setCallbacks(editorCallbacks);
		rightEditor.setCallbacks(editorCallbacks);

		renderer.setCallbacks({
			prepare: this.#handleRendererPrepare.bind(this),
			draw: this.#handleRendererDraw.bind(this),
			diffVisibilityChanged: this.#handleRendererDiffVisibilityChanged.bind(this),
			hoveredDiffIndexChanged: this.#handleHoveredDiffIndexChanged.bind(this),
		} as Partial<RendererCallbacks>);

		// renderer.onPrepare(this.#handleRendererPrepare.bind(this));
		// renderer.onDraw(this.#handleRendererDraw.bind(this));
		// renderer.onDiffVisibilityChanged(this.#handleRendererDiffVisibilityChanged.bind(this));
		// renderer.onHoveredDiffIndexChanged(this.#handleHoveredDiffIndexChanged.bind(this));
	}

	getDiffOptions(): DiffOptions {
		return { ...this.#diffOptions };
	}

	updateDiffOptions(newOptions: Partial<DiffOptions>) {
		this.#diffOptions = { ...this.#diffOptions, ...newOptions };
	}

	get leftEditor() {
		return this.#leftEditor;
	}

	get rightEditor() {
		return this.#rightEditor;
	}

	get renderer() {
		return this.#renderer;
	}

	get syncMode() {
		return this.#syncMode;
	}

	set syncMode(value: boolean) {
		value = !!value;
		if (this.#syncMode === value) return;

		this.#syncMode = value;

		this.#leftEditor.readonly = value;
		this.#rightEditor.readonly = value;
		this.#renderer.guideLineEnabled = value;

		if (value) {
			document.body.classList.add("sync-mode");
			this.alignEditors(true);
		} else {
			document.body.classList.remove("sync-mode");
			this.#renderer.invalidateAll();
			this.#restoreSelection();
		}

		this.#syncModeChangeEvent.emit(value);
	}

	#setupEventListeners() {
		document.addEventListener("selectionchange", this.#handleSelectionChange.bind(this));
	}

	alignEditors(reset = false) {
		this.#preventScrollEvent = true;
		this.#editorPairer.alignAnchorsGently(() => {
			this.#leftEditor.forceReflow();
			this.#rightEditor.forceReflow();
			//this.#renderer.invalidateGeometries();
			// console.log("last scrolled editor:", this.#lastScrolledEditor?.name, "last focused editor:", this.#lastFocusedEditor?.name);
			const primaryEditor = this.#lastScrolledEditor ?? this.#lastFocusedEditor ?? this.#rightEditor;
			// const secondaryEditor = primaryEditor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
			this.#preventScrollEvent = false;
			// console.log("primaryEditor:", primaryEditor.name, "secondaryEditor:", secondaryEditor.name);
			if (this.#scrollingEditor) {
				this.#handleEditorScrollEnd(this.#scrollingEditor);
			}
			this.#handleEditorScroll(primaryEditor, true);
			// secondaryEditor.scrollTo(primaryEditor.scrollTop);

			if (this.#invalidateGeometriesRequestId) {
				cancelAnimationFrame(this.#invalidateGeometriesRequestId);
				this.#invalidateGeometriesRequestId = null;
			}
			this.#invalidateGeometriesRequestId = requestAnimationFrame(() => {
				this.#renderer.invalidateGeometries();
			});
			// setTimeout(() => {
			// 	console.log(
			// 		"scrolling editor:",
			// 		this.#scrollingEditor?.name,
			// 		"last scrolled editor:",
			// 		this.#lastScrolledEditor?.name,
			// 		"last focused editor:",
			// 		this.#lastFocusedEditor?.name
			// 	);
			// }, 100);
		}, reset);
	}

	#handleSelectionChange() {
		if (!this.diffContext) {
			return;
		}

		const selection = this.resolveSelectionSpanPair();

		let sourceRange: Range | null = null;
		let targetRange: Range | null = null;
		let leftSpan: Span | undefined = undefined;
		let rightSpan: Span | undefined = undefined;
		let selectedSpan: Span | undefined = undefined;
		let sourceEditor: Editor | null = null;
		let targetEditor: Editor | null = null;
		if (selection) {
			({ left: leftSpan, right: rightSpan, sourceRange } = selection);
			if (selection.sourceEditor === "left") {
				sourceEditor = this.#leftEditor;
				targetEditor = this.#rightEditor;
			} else {
				sourceEditor = this.#rightEditor;
				targetEditor = this.#leftEditor;
			}

			if (leftSpan && leftSpan.end >= leftSpan.start && rightSpan && rightSpan.end >= rightSpan.start) {
				let otherStartTokenIndex: number;
				let otherEndTokenIndex: number;
				if (selection.sourceEditor === "left") {
					selectedSpan = leftSpan;
					targetEditor = this.#rightEditor;
					otherStartTokenIndex = rightSpan.start;
					otherEndTokenIndex = rightSpan.end;
				} else {
					selectedSpan = rightSpan;
					targetEditor = this.#leftEditor;
					otherStartTokenIndex = leftSpan.start;
					otherEndTokenIndex = leftSpan.end;
				}

				sourceRange = sourceEditor.getTokenRange(selectedSpan.start, selectedSpan.end);
				targetRange = targetEditor.getTokenRange(otherStartTokenIndex, otherEndTokenIndex);
			}
		}

		this.#renderer.setSelectionHighlight(targetEditor === this.#leftEditor ? "left" : "right", targetRange);

		if (selection) {
			this.#textSelectionEvent.emit({
				selection: {
					sourceEditor: selection.sourceEditor,
					sourceSpan: selection.sourceSpan,
					sourceRange: selection.sourceEditor === "left" ? sourceRange! : targetRange!,
					leftTokenSpan: leftSpan!,
					rightTokenSpan: rightSpan!,
					leftTokenRange: selection.sourceEditor === "left" ? sourceRange! : targetRange!,
					rightTokenRange: selection.sourceEditor === "right" ? sourceRange! : targetRange!,
				},
			});
		} else {
			this.#textSelectionEvent.emit({ selection: null });
		}

		this.#lastTextSelectionRange = selection?.sourceRange ?? null;
		// let textSelectionEvent: TextSelectionEvent | null = null;
		// if (sourceRange && targetRange) {
		// 	textSelectionEvent = {
		// 		sourceEditor: selection!.source,
		// 		leftTokenSpan: leftSpan!,
		// 		rightTokenSpan: rightSpan!,
		// 		leftTokenRange: selection!.source === "left" ? sourceRange : targetRange,
		// 		rightTokenRange: selection!.source === "right" ? sourceRange : targetRange,
		// 	};
		// }
		// this.#textSelectionEvent.emit(textSelectionEvent);
	}

	#restoreSelection() {
		if (this.#lastTextSelectionRange && this.#lastTextSelectionRange.collapsed) {
			const selection = window.getSelection();
			if (selection) {
				selection.removeAllRanges();
				selection.addRange(this.#lastTextSelectionRange);
			}
		}
	}

	#onDiffCompleted(result: DiffResult) {
		if (this.#postProcessor) {
			this.#postProcessor.cancel();
		}
		this.#postProcessor = new DiffProcessor(this.#leftEditor, this.#rightEditor, this.#editorPairer, result.diffs, result.options);
		this.#postProcessor.process(this.#handleDiffContextReady);
	}

	#handleEditorContentChanging() {
		this.diffContext = null;
		this.#postProcessor?.cancel();
		this.#editorPairer.cancelAnchorAligning();

		if (this.#alignEditorsRequestId) {
			cancelAnimationFrame(this.#alignEditorsRequestId);
			this.#alignEditorsRequestId = null;
		}
		if (this.#invalidateGeometriesRequestId) {
			cancelAnimationFrame(this.#invalidateGeometriesRequestId);
			this.#invalidateGeometriesRequestId = null;
		}
		this.#diffWorkflowStartEvent.emit({});

		// this.#editorContentsChanged[editor] = true;
		// this.#diffInitEvent.emit({
		// 	leftEditorChanged: this.#editorContentsChanged.left,
		// 	rightEditorChanged: this.#editorContentsChanged.right,
		// });
	}

	#handleEditorContentChanged() {
		this.computeDiff();
	}

	computeDiff() {
		const leftTokens = buildTokenArray(this.#leftEditor.tokens);
		const rightTokens = buildTokenArray(this.#rightEditor.tokens);
		this.#diffWorker.run(leftTokens, rightTokens, this.#diffOptions);
		this.#diffComputingEvent.emit({
			leftTokenCount: this.#leftEditor.tokens.length,
			rightTokenCount: this.#rightEditor.tokens.length,
		});

		this.#editorContentsChanged.left = false;
		this.#editorContentsChanged.right = false;
	}

	#handleEditorScroll(editor: Editor, skipEndCheck = false) {
		if (this.#preventScrollEvent) {
			return;
		}

		this.#renderer.invalidateScroll(editor.name);

		if (!this.#scrollingEditor) {
			this.#lastScrolledEditor = this.#scrollingEditor = editor;
		}

		if (this.#scrollingEditor === editor) {
			if (this.#scrollTimeoutId) {
				clearTimeout(this.#scrollTimeoutId);
				this.#scrollTimeoutId = null;
			}

			if (!skipEndCheck) {
				this.#scrollTimeoutId = setTimeout(() => this.#handleEditorScrollEnd(editor), SCROLL_TIMEOUT);
			}

			if (this.#syncMode) {
				const otherEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
				otherEditor.scrollTo(editor.scrollTop, { behavior: "instant" });
			}
		}
	}

	#handleEditorScrollEnd(_editor: Editor) {
		// if (this.#scrollingEditor !== editor) {
		// 	return;
		// }
		if (this.#scrollTimeoutId) {
			clearTimeout(this.#scrollTimeoutId);
			this.#scrollTimeoutId = null;
		}
		this.#scrollingEditor = null;
	}

	#handleEditorResize(_editor: Editor) {
		if (this.#syncMode) {
			this.alignEditors(true);
		}
		//this.#renderer.invalidateLayout();
	}

	#handleEditorFocus(_editor: Editor) {
		this.#lastFocusedEditor = this.#focusedEditor = _editor;
	}

	#handleEditorBlur(_editor: Editor) {
		this.#focusedEditor = null;
	}

	#handleEditorClick(_editor: Editor, _e: MouseEvent) {
		this.#lastFocusedEditor = this.#focusedEditor = _editor;
	}

	#handleEditorCopy(_editor: Editor, _e: ClipboardEvent) {
		// console.log("📋 Copied something in", editor.name);
	}

	#handleEditorMouseMove(_editor: Editor, e: MouseEvent) {
		// console.log("🖱️ Mouse moved in", editor.name, "at", e.clientX, e.clientY);
		this.#renderer.updateMousePosition(e.clientX, e.clientY);
	}

	#handleEditorMouseLeave(_editor: Editor, _e: MouseEvent) {
		// console.log("👋 Mouse left", editor.name, "at", e.clientX, e.clientY);
	}

	#handleRendererPrepare(_time: number) {
		// console.log("🔧 Preparing renderer at", time);
	}

	#handleRendererDraw(_time: number) {
		// console.log("🎨 Renderer is rendering at", time);
	}

	#handleRendererDiffVisibilityChanged(changes: Record<EditorName, VisibilityChangeEntry[]>) {
		for (const region of ["left", "right"]) {
			for (const entry of changes[region as EditorName]) {
				const diffIndex = entry.item as number;
				if (entry.isVisible) {
					this.#visibleDiffs[region as EditorName].add(diffIndex);
				} else {
					this.#visibleDiffs[region as EditorName].delete(diffIndex);
				}
			}
		}
		this.#diffVisibilityChangeEvent.emit(changes);
	}

	#handleHoveredDiffIndexChanged(diffIndex: number | null) {
		this.#hoveredDiffIndexChangeEvent.emit(diffIndex);
	}

	#handleDiffContextReady = (diffContext: DiffContext) => {
		this.diffContext = diffContext;
		this.#renderer.setDiffs(diffContext.diffs);
		this.#diffWorkflowDone.emit(diffContext);
		this.#handleSelectionChange();
		if (this.#syncMode) {
			if (this.#alignEditorsRequestId) {
				cancelAnimationFrame(this.#alignEditorsRequestId);
				this.#alignEditorsRequestId = null;
			}
			this.#alignEditorsRequestId = requestAnimationFrame(() => {
				this.alignEditors(true);
			});
		}
	};

	setScrollingEditor(editor: Editor | null) {
		this.#lastScrolledEditor = this.#scrollingEditor = editor;
	}

	clearScrollingEditor() {
		if (this.#scrollTimeoutId) {
			clearTimeout(this.#scrollTimeoutId);
			this.#scrollTimeoutId = null;
		}
		this.#scrollingEditor = null;
	}

	onSyncModeChange(callback: (syncMode: boolean) => void) {
		return this.#syncModeChangeEvent.on(callback);
	}

	onHoveredDiffIndexChange(callback: (diffIndex: number | null) => void) {
		return this.#hoveredDiffIndexChangeEvent.on(callback);
	}

	onDiffVisibilityChanged(callback: (changes: Record<EditorName, VisibilityChangeEntry[]>) => void) {
		return this.#diffVisibilityChangeEvent.on(callback);
	}

	onDiffWorkflowStart(callback: () => void) {
		return this.#diffWorkflowStartEvent.on(callback);
	}

	onDiffComputing(callback: (e: DiffStartEvent) => void) {
		return this.#diffComputingEvent.on(callback);
	}

	onDiffWorkflowDone(callback: (diffContext: DiffContext) => void) {
		return this.#diffWorkflowDone.on(callback);
	}

	onTextSelection(callback: (e: TextSelectionEvent) => void) {
		return this.#textSelectionEvent.on(callback);
	}

	getVisibleDiffs(): Record<EditorName, ReadonlySet<number>> {
		return {
			left: this.#visibleDiffs.left,
			right: this.#visibleDiffs.right,
		};
	}

	getEditorSelectionRange(): { editor: EditorName; range: Range } | null {
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
				return { editor: editor.name, range };
			}
		}
		return null;
	}

	resolveSelectionSpanPair(): { left: Span; right: Span; sourceEditor: EditorName; sourceSpan: Span; sourceRange: Range } | null {
		if (!this.diffContext) {
			return null;
		}

		const selection = this.getEditorSelectionRange();

		if (selection) {
			const editor = selection.editor === "left" ? this.#leftEditor : this.#rightEditor;
			let sourceSpan = editor.getTokenSpanForRange(selection.range);
			if (sourceSpan) {
				if (sourceSpan.end === sourceSpan.start) {
					//sourceSpan.end += 1;
				}
				const matchingPair = this.diffContext.resolveMatchingSpanPair(editor.name, sourceSpan);
				if (matchingPair) {
					return {
						left: matchingPair.left,
						right: matchingPair.right,
						sourceEditor: editor.name,
						sourceSpan,
						sourceRange: selection.range,
					};
				}
			}
		}

		return null;
	}

	scrollToDiff(diffIndex: number, { primary, toEnd = false }: { primary?: EditorName; toEnd?: boolean } = {}) {
		const leftRect = this.#renderer.getDiffRect("left", diffIndex);
		const rightRect = this.#renderer.getDiffRect("right", diffIndex);
		if (!leftRect || !rightRect) {
			return;
		}

		if (this.#syncMode) {
			const primaryEditor = primary === "left" ? this.#leftEditor : this.#rightEditor;
			const rect = primary === "left" ? leftRect : rightRect;

			let scrollTop;
			if (toEnd) {
				scrollTop = rect.y + rect.height - EDITOR_SCROLL_MARGIN;
			} else {
				scrollTop = rect.y - EDITOR_SCROLL_MARGIN;
			}
			primaryEditor.scrollTo(scrollTop, { behavior: "smooth" });
		} else {
			const leftScrollTop = Math.min(leftRect.y - EDITOR_SCROLL_MARGIN);
			const rightScrollTop = Math.min(rightRect.y - EDITOR_SCROLL_MARGIN);
			this.#leftEditor.scrollTo(leftScrollTop, { behavior: "smooth" });
			this.#rightEditor.scrollTo(rightScrollTop, { behavior: "smooth" });
		}
	}

	scrollToTokenIndex(side: EditorName, tokenIndex: number) {
		if (!this.diffContext) {
			return;
		}

		const tokens = side === "left" ? this.#leftEditor.tokens : this.#rightEditor.tokens;
		const token = tokens[tokenIndex];
		if (!token) {
			return;
		}

		let raw = token.range;
		let range: Range;
		if (raw instanceof Range) {
			range = raw;
		} else {
			range = document.createRange();
			range.setStart(raw.startContainer, raw.startOffset);
			range.setEnd(raw.endContainer, raw.endOffset);
		}

		if (!range.startContainer.isConnected || !range.endContainer.isConnected) {
			return;
		}

		const rect = range.getBoundingClientRect();
		if (rect.y === 0 && rect.x === 0 && rect.height === 0 && rect.width === 0) {
			return 0;
		}

		const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
		let top = rect.y - EDITOR_SCROLL_MARGIN + editor.scrollTop;
		editor.scrollTo(top, { behavior: "smooth" });
	}

	setHoveredDiffIndex(diffIndex: number | null) {
		this.#renderer.setHoveredDiffIndex(diffIndex);
	}
}

function buildTokenArray(richTokens: readonly RichToken[]): Token[] {
	const result: Token[] = new Array(richTokens.length);
	for (let i = 0; i < richTokens.length; i++) {
		const richToken = richTokens[i];
		result[i] = {
			text: richToken.text,
			flags: richToken.flags,
		};
		if (richToken.flags & TokenFlags.IMAGE && richToken.width && richToken.height && richToken.data) {
			result[i].width = richToken.width;
			result[i].height = richToken.height;
			result[i].data = richToken.data.buffer;
		}
	}
	return result;
}
