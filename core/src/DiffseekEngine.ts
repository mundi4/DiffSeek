import { ABORT_REASON_CANCELLED, DIFF_TAG_NAME } from "./constants";
import { DiffProcessor } from "./DiffProcessor";
import { initializeDiffWorker, type DiffWorkerStatusEvent } from "./diff-worker/initializeDiffWorker";
import { Editor, type EditorCallbacks } from "./editor/Editor";
import { Renderer } from "./renderer/Renderer";
import type { DiffContext, DiffOptions, AnchorPair, EditorName, Span, DiffVisibilityChangeEntry, DiffseekEventMap, DiffseekInterface, SerializedToken } from "./types";
import { Scheduler } from "./scheduler";
import { getDefaultDiffOptions } from "./diff-worker/getDefaultDiffOptions";
import { createEvent } from "./utils/createEvent";
import { resolveMatchingSpanPair } from "./helpers/resolveMatchingSpanPair";

/**
 * DiffController - Diff 비교 워크플로우를 관리하는 컨트롤러
 * 
 * 역할:
 * 1. 2개 Editor의 콘텐츠 감시
 * 2. 변경 감지 시 DiffWorker에 요청
 * 3. 결과 post-processing
 * 4. Renderer 업데이트
 */

const MIN_DELTA = 1;
const MIN_STRIPED_DELTA = 1;

const defaultOptions: DiffseekOptions = {
    diffPalette: [
        30, // 주황?
        180, // cyan
        300, // 핑크?
        120, // 초록
        240, // 파랑
        60, // 노랑
        270, // 보라?
    ],
    editorMinimapWidth: 15,
}

export type DiffseekOptions = {
    diffPalette: number[];
    editorMinimapWidth: number;
}

export type DiffPipelineState = {
    status: "tokenizing" | "diffing" | "processing";
    progress: number;
}

export type InternalDiffseekEventMap = DiffseekEventMap & {

    "diffContextChanged": DiffContext | null;
};

export class DiffseekEngine implements DiffseekInterface {
    readonly workspaceEl: HTMLElement;
    readonly deckEl: HTMLElement;
    readonly leftEditor: Editor;
    readonly rightEditor: Editor;
    readonly renderer: Renderer;

    options: DiffseekOptions = { ...defaultOptions };
    diffWorker = initializeDiffWorker();
    private _diffOptions = getDefaultDiffOptions();
    diffContext: DiffContext | null = null;

    diffProcessor: DiffProcessor;
    // diffPresentation: DiffPresentation;
    private _syncMode: boolean = false;
    scrollingEditor: Editor | null = null;
    lastScrolledEditor: Editor | null = null;
    focusedEditor: Editor | null = null;
    diffAbortController: AbortController | null = null;
    alignAnchorsAbortController: AbortController | null = null;
    contentChanging: { left: boolean; right: boolean } = { left: false, right: false };
    programmaticScrollInProgress = 0;
    visibleDiffs: Record<EditorName, Set<number>> = {
        left: new Set(),
        right: new Set(),
    };
    diffState: DiffPipelineState | null = null;

    readonly syncModeChanged = createEvent<{ syncMode: boolean }>();
    readonly diffContextChanged = createEvent<DiffContext | null>();
    readonly statusChanged = createEvent<{ phase: 'idle' | 'tokenizing' | 'diffing' | 'processing'; progress?: number }>();
    readonly diffVisibilityChanged = createEvent<{ left: DiffVisibilityChangeEntry[]; right: DiffVisibilityChangeEntry[] }>();
    readonly diffOptionsChanged = createEvent<Readonly<DiffOptions>>();
    readonly diffHoveredIndexChanged = createEvent<number | null>();

    private _eventRegistry: Record<keyof InternalDiffseekEventMap, ReturnType<typeof createEvent<any>>> = {
        "syncModeChanged": this.syncModeChanged,
        "statusChanged": this.statusChanged,
        "diffContextChanged": this.diffContextChanged,
        "diffVisibilityChanged": this.diffVisibilityChanged,
        "diffOptionsChanged": this.diffOptionsChanged,
        "hoveredDiffIndexChanged": this.diffHoveredIndexChanged,
        "mount": createEvent<{ el: HTMLElement }>(),
        "unmount": createEvent<void>(),
    };

    on<K extends keyof InternalDiffseekEventMap>(event: K, handler: (data: InternalDiffseekEventMap[K]) => void) {
        this._eventRegistry[event]?.on(handler);
        return () => this.off(event, handler);
    }

    off<K extends keyof InternalDiffseekEventMap>(event: K, handler: (data: InternalDiffseekEventMap[K]) => void) {
        this._eventRegistry[event]?.off(handler);
    }

    constructor(
        options: Partial<DiffseekOptions>
    ) {
        this.setOptions(options);

        const workspaceEl = this.workspaceEl = document.createElement("div");
        workspaceEl.classList.add("ds-workspace");



        this.deckEl = document.createElement("div");
        this.deckEl.className = "ds-deck";
        workspaceEl.appendChild(this.deckEl);

        // const leftEditorHost = document.createElement("div");
        // leftEditorHost.className = "ds-editor-host ds-editor-host-left";
        // this.deckEl.appendChild(leftEditorHost);

        // const rightEditorHost = document.createElement("div");
        // rightEditorHost.className = "ds-editor-host ds-editor-host-right";
        // this.deckEl.appendChild(rightEditorHost);



        this.leftEditor = new Editor("left");
        this.rightEditor = new Editor("right");

        this.deckEl.appendChild(this.leftEditor.rootElement);
        this.deckEl.appendChild(this.rightEditor.rootElement);

        this.renderer = new Renderer(this.leftEditor, this.rightEditor);
        this.workspaceEl.appendChild(this.renderer.rootElement);

        this.diffProcessor = new DiffProcessor(this.leftEditor, this.rightEditor);
        this.setupCallbacks();
    }

    setOptions(newOptions: Partial<DiffseekOptions> | null) {
        if (newOptions) {
            this.options = { ...defaultOptions, ...newOptions };
        } else {
            this.options = structuredClone(defaultOptions);
        }
    }

    get diffOptions(): Readonly<DiffOptions> {
        return this._diffOptions;
    }

    /**
     * Diff 옵션 업데이트
     */
    updateDiffOptions(newOptions: Partial<DiffOptions>) {
        console.log("Updating diff options:", newOptions);
        // 실제로 변경된 값일 때만 적용
        const keys = Object.keys(newOptions) as (keyof DiffOptions)[];
        let newDiffOptions: DiffOptions | undefined = undefined;
        for (const key of keys) {
            if (this._diffOptions[key] !== newOptions[key]) {
                if (!newDiffOptions) {
                    newDiffOptions = { ...this._diffOptions };
                }
                (newDiffOptions as any)[key] = newOptions[key]!;
            }
        }

        if (newDiffOptions) {
            this._diffOptions = newDiffOptions;
            this.diffAbortController?.abort(ABORT_REASON_CANCELLED);
            this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
            this.startDiffWorkflow();
            this.diffOptionsChanged.emit(this._diffOptions);
        }

        // this.diffOptions = { ...this.diffOptions, ...newOptions };
        // this.diffAbortController?.abort(ABORT_REASON_CANCELLED);
        // this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        // this.startDiffWorkflow();
    }

    /**
     * 통채로 새 옵션으로 교체. 
     * 지정되지 않은 필드는 기본값으로 설정됨.
     * @param newOptions 
     */
    replaceDiffOptions(newOptions: Partial<DiffOptions> | null) {
        newOptions = { ...getDefaultDiffOptions(), ...newOptions };
        this.updateDiffOptions(newOptions);
    }

    //
    // region Callbacks
    //
    setupCallbacks() {
        const callbacks: Partial<EditorCallbacks> = {
            scroll: (editor) => this.handleEditorScroll(editor),
            scrollEnd: (editor) => this.handleEditorScrollEnd(editor),
            resize: (editor) => this.handleEditorResize(editor),
            contentChanging: (editor) => this.handleEditorContentChanging(editor),
            contentChanged: (editor) => this.handleEditorContentChanged(editor),
            mouseMove: (editor, e) => this.handleEditorMouseMove(editor, e),
            mouseLeave: (editor, e) => this.handleEditorMouseLeave(editor, e),
            focus: (editor) => {
                this.focusedEditor = editor;
            },
            blur: (editor) => {
                if (this.focusedEditor === editor) {
                    this.focusedEditor = null;
                }
            },
        };

        this.leftEditor.setCallbacks(callbacks);
        this.rightEditor.setCallbacks(callbacks);

        this.renderer.setCallbacks({
            diffVisibilityChanged: this.handleRendererDiffVisibilityChanged.bind(this),
            hoveredDiffIndexChanged: this.handleRendererHoveredDiffIndexChanged.bind(this),
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "F2") {
                this.syncMode = !this._syncMode;
            }
        });

        document.addEventListener("selectionchange", this.handleSelectionChange.bind(this));

        this.deckEl.addEventListener("scroll", () => {
            this.renderer.invalidateScroll();
        });
    }

    handleSelectionChange() {
        if (!this.diffContext) {
            return;
        }

        const selection = this.getEditorSelectionRangePair();

        if (selection) {
            let sourceEditor: Editor, targetEditor: Editor;
            let sourceSpan: Span, targetSpan: Span;
            let sourceRange: Range, targetRange: Range;

            if (selection.sourceEditor === "left") {
                sourceEditor = this.leftEditor, targetEditor = this.rightEditor;
                sourceSpan = selection.left, targetSpan = selection.right;
                sourceRange = selection.sourceRange;
            } else {
                sourceEditor = this.rightEditor, targetEditor = this.leftEditor;
                sourceSpan = selection.right, targetSpan = selection.left;
                sourceRange = selection.sourceRange;
            }

            if (targetSpan.end >= targetSpan.start) {
                targetRange = targetEditor.getTokenRange(targetSpan.start, targetSpan.end);
                this.renderer.setSelectionHighlight(targetEditor.name, targetRange);
            } else {
                this.renderer.setSelectionHighlight(targetEditor.name, null);
            }
        } else {
            // 지금 API가 좀 이상해보이지만 한쪽만 null로 만들면 됨!
            this.renderer.setSelectionHighlight("left", null);
        }
    }

    handleEditorContentChanging(editor: Editor) {
        this.cancelOngoingOperations();
        this.renderer.suspendRendering();
        this.setDiffContext(null);

        if (!this.contentChanging[editor.name]) {
            this.contentChanging[editor.name] = true;
            this.statusChanged.emit({ phase: 'tokenizing' });
        }
    }

    handleEditorContentChanged(editor: Editor) {
        if (this.contentChanging[editor.name]) {
            this.contentChanging[editor.name] = false;
            if (this.contentChanging.left || this.contentChanging.right) {
                return;
            }
            this.cancelOngoingOperations();
            this.startDiffWorkflow();
        }
    }

    handleEditorScroll(editor: Editor) {
        this.renderer.invalidateScroll(editor.name);

        if (!this.scrollingEditor) {
            this.scrollingEditor = editor;
        }

        if (this.scrollingEditor === editor) {
        }
        if (this._syncMode) {
            const otherEditor = editor === this.leftEditor ? this.rightEditor : this.leftEditor;
            const scrollTop = editor.scrollTop;
            const otherScrollTop = otherEditor.scrollTop;
            if (Math.abs(scrollTop - otherScrollTop) >= 1) {
                if (!this.programmaticScrollInProgress) {
                    this.programmaticScrollInProgress++;
                    otherEditor.scrollTo(scrollTop, { behavior: "instant" });
                    this.programmaticScrollInProgress--;
                }
            }
        }
    }

    handleEditorScrollEnd(editor: Editor) {
        if (this.scrollingEditor === editor) {
            this.scrollingEditor = null;
        }
    }

    handleEditorResize(editor: Editor) {
        this.renderer.invalidateAll();
    }

    handleEditorMouseMove(_editor: Editor, e: MouseEvent) {
        this.renderer.updateMousePosition(e.clientX, e.clientY);
    }

    handleEditorMouseLeave(_editor: Editor, _e: MouseEvent) {
    }

    handleDiffWorkerStatus = (e: DiffWorkerStatusEvent) => {
        if (e.type === "progress") {
            this.diffState = { status: "diffing", progress: e.progress! };
            this.statusChanged.emit({ phase: 'diffing', progress: e.progress });
        }
    }

    handleRendererDiffVisibilityChanged = (changes: Record<EditorName, DiffVisibilityChangeEntry[]>) => {
        this.diffVisibilityChanged.emit(changes);
    }

    handleRendererHoveredDiffIndexChanged = (diffIndex: number | null) => {
        this.diffHoveredIndexChanged.emit(diffIndex);
    }

    // endregion
    getVisibleDiffs(side: EditorName): number[] {
        return Array.from(this.renderer.visibleDiffIndices[side]);
    }

    get syncMode(): boolean {
        return this._syncMode;
    }

    set syncMode(value: boolean) {
        if (value === this._syncMode) {
            return;
        }

        this._syncMode = value;
        this.leftEditor.isSyncMode = value;
        this.rightEditor.isSyncMode = value;
        this.renderer.isSyncMode = value;
        this.workspaceEl.classList.toggle("sync-mode", value);

        if (value) {
            const scrollTop = Math.min(this.leftEditor.scrollTop, this.rightEditor.scrollTop);
            this.deckEl.scrollTop = scrollTop;
            requestAnimationFrame(() => {
                this.renderer.invalidateAll();
                this.alignAnchors().then(() => {
                    // 예약된 렌더가 있다면 취소
                    this.renderer.cancelRender();

                    // 전체 새로 그리기
                    this.renderer.invalidateAll();
                });
            });
        } else {
            requestAnimationFrame(() => {
                this.renderer.invalidateAll();
            });
        }

        this.syncModeChanged.emit({ syncMode: value });
    }

    scrollToDiff(diffIndex: number, side?: EditorName, options?: ScrollIntoViewOptions) {
        const sides: EditorName[] = side ? [side] : this._syncMode ? ["left"] : ["left", "right"];
        console.log("Scrolling to diff", diffIndex, side, "sides:", sides, "options:", options);
        for (const s of sides) {
            const rect = this.renderer.getDiffRect(s, diffIndex);
            if (rect) {
                const editor = s === "left" ? this.leftEditor : this.rightEditor;
                this.programmaticScrollInProgress++;
                editor.scrollTo(rect.y, options);
                this.programmaticScrollInProgress--;
            }
        }
    }

    setHoveredDiff(diffIndex: number | null) {
        this.renderer.setHoveredDiffIndex(diffIndex);
    }

    getEditorSelectionRange(): { editor: EditorName; range: Range } | null {
        const selection = window.getSelection();
        let editor: Editor | null = null;
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.leftEditor.contains(range)) {
                editor = this.leftEditor;
            } else if (this.rightEditor.contains(range)) {
                editor = this.rightEditor;
            }
            if (editor) {
                return { editor: editor.name, range };
            }
        }
        return null;
    }

    getEditorSelectionRangePair(): { left: Span; right: Span; sourceEditor: EditorName; sourceSpan: Span; sourceRange: Range } | null {
        if (this.diffContext) {
            const selection = this.getEditorSelectionRange();
            if (selection) {
                const editor = selection.editor === "left" ? this.leftEditor : this.rightEditor;
                let sourceSpan = editor.getTokenSpanForRange(selection.range);
                if (sourceSpan) {
                    if (sourceSpan.end === sourceSpan.start) {
                        //sourceSpan.end += 1;
                    }
                    const matchingPair = resolveMatchingSpanPair(this.diffContext, editor.name, sourceSpan);
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
        }

        return null;
    }

    private cancelOngoingOperations() {
        this.renderer.cancelRender();
        this.diffAbortController?.abort(ABORT_REASON_CANCELLED);
        this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        this.diffAbortController = null;
        this.alignAnchorsAbortController = null;
    }

    runDiffWorkflow() {
        this.cancelOngoingOperations();
        this.startDiffWorkflow();
    }

    //
    // region Diff Workflow
    private async startDiffWorkflow() {
        this.diffAbortController = new AbortController();

        const scheduler = new Scheduler({ signal: this.diffAbortController.signal });
        try {
            this.diffState = { status: "diffing", progress: 0 };
            this.statusChanged.emit({ phase: 'diffing', progress: 0 });

            const leftWholeText = this.leftEditor.wholeText;
            const rightWholeText = this.rightEditor.wholeText;

            const leftTokens = this.leftEditor.tokens.map(t => ({
                textOffset: t.textOffset,
                textLength: t.textLength,
                flags: t.flags,
            } satisfies SerializedToken));

            const rightTokens = this.rightEditor.tokens.map(t => ({
                textOffset: t.textOffset,
                textLength: t.textLength,
                flags: t.flags,
            } satisfies SerializedToken));

            const diffOptions = this._diffOptions;
            const workerResult = await this.diffWorker.run({
                leftWholeText,
                rightWholeText,
                leftTokens,
                rightTokens,
                options: diffOptions,
                abortSignal: scheduler.signal,
                onStatus: this.handleDiffWorkerStatus.bind(this),
            });
            scheduler.throwIfAborted();

            // Post-processing & 변환
            const diffContext = await this.diffProcessor.process({
                entries: workerResult.diffs,
                diffOptions,
                scheduler,
                diffPalette: this.options.diffPalette,
            });

            this.diffState = { ...this.diffState, status: "processing" };
            this.statusChanged.emit({ phase: 'processing' });

            await scheduler.yield();

            //this.handleSelectionChange();
            this.renderer.resumeRendering();
            this.renderer.setDiffs(diffContext.diffs);
            this.renderer.invalidateAll();

            this.setDiffContext(diffContext);
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                console.debug("Diff workflow cancelled");
            } else {
                console.error("Diff workflow error:", err);
            }
        } finally {
            this.statusChanged.emit({ phase: 'idle' });
        }
    }

    // endregion
    //
    // Anchor Alignment
    //
    private async alignAnchors(): Promise<void> {
        requestAnimationFrame(() => {

            if (!this.diffContext) {
                return;
            }

            const anchorPairs = this.diffContext.anchorPairs;


            const startTime = performance.now();
            const leftEditor = this.leftEditor;
            const rightEditor = this.rightEditor;

            for (const pair of anchorPairs) {
                pair.delta = 0;
                if (pair.leftEl) {
                    pair.leftEl.classList.remove("padded");
                    pair.leftEl.style.removeProperty("--anchor-adjust");
                }
                if (pair.rightEl) {
                    pair.rightEl.classList.remove("padded");
                    pair.rightEl.style.removeProperty("--anchor-adjust");
                }
            }


            leftEditor.forceReflow();
            rightEditor.forceReflow();

            let leftScrollTop = leftEditor.scrollTop;
            let rightScrollTop = rightEditor.scrollTop;
            let leftEditorTop = leftEditor.getBoundingClientRect().y;
            let rightEditorTop = rightEditor.getBoundingClientRect().y;


            for (let i = 0; i < anchorPairs.length; i++) {
                const pair = anchorPairs[i];
                const { leftEl, rightEl } = pair;
                // 낙관적으로 --anchor-adjust 속성을 제거하기 전에 leftY/rightY를 계산하고 두 값이 같다면 그냥 정렬된 것으로 간주하고 넘어가기

                let leftY;
                let rightY;
                leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
                rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;

                let delta = Math.round(leftY - rightY);
                if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                    if (pair.delta > 0) {
                        rightEl.classList.remove("padded");
                        rightEl.style.removeProperty("--anchor-adjust");
                        void rightEl.offsetHeight; // force reflow
                        rightEditorTop = rightEditor.getBoundingClientRect().y;
                        rightScrollTop = rightEditor.scrollTop;
                    } else if (pair.delta < 0) {
                        leftEl.classList.remove("padded");
                        leftEl.style.removeProperty("--anchor-adjust");
                        void leftEl.offsetHeight; // force reflow
                        leftEditorTop = leftEditor.getBoundingClientRect().y;
                        leftScrollTop = leftEditor.scrollTop;
                    }

                    leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
                    rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
                    delta = Math.round(leftY - rightY);

                    if (delta < -MIN_DELTA || delta > MIN_DELTA) {
                        if (this.applyDeltaToPair(pair, delta, true)) {
                            leftScrollTop = leftEditor.scrollTop;
                            rightScrollTop = rightEditor.scrollTop;
                        }
                    }
                }


            }

            leftEditor.forceReflow();
            rightEditor.forceReflow();

            const leftContentHeight = leftEditor.contentElement.offsetHeight;
            const rightContentHeight = rightEditor.contentElement.offsetHeight;
            if (leftContentHeight > rightContentHeight) {
                leftEditor.heightBoostElement.style.height = `0px`;
                rightEditor.heightBoostElement.style.height = `${leftContentHeight - rightContentHeight}px`;
            } else if (rightContentHeight > leftContentHeight) {
                leftEditor.heightBoostElement.style.height = `${rightContentHeight - leftContentHeight}px`;
                rightEditor.heightBoostElement.style.height = `0px`;
            } else {
                leftEditor.heightBoostElement.style.height = `0px`;
                rightEditor.heightBoostElement.style.height = `0px`;
            }

            const elpased = performance.now() - startTime;
            console.log(`Anchors aligned in ${elpased.toFixed(1)}ms`);
        });

    }

    private applyDeltaToPair(pair: AnchorPair, delta: number, reflow: boolean) {
        let changed = false;
        if (delta < -MIN_DELTA || delta > MIN_DELTA) {
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
            theEl.classList.add("padded");
            if (theEl.nodeName !== DIFF_TAG_NAME) {
                theEl.classList.toggle("striped", delta >= MIN_STRIPED_DELTA);
            }
            if (reflow) {
                void theEl.offsetHeight; // force reflow
            }
        }
        return changed;
    }

    private setDiffContext(diffContext: DiffContext | null) {
        if (this.diffContext !== diffContext) {
            if (this.diffContext) {
                this.diffContext.isValid = false;
            }
            this.diffContext = diffContext;
            this.diffContextChanged.emit(diffContext);
        }
    }

    terminate() {
        this.cancelOngoingOperations();
        this.diffWorker.terminate();
    }
}
