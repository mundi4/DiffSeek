import { ABORT_REASON_CANCELLED } from "../constants";
import { initializeDiffWorker, type DiffWorkerStatusEvent } from "../diff-worker/initialize-diff-worker";
import { Editor, type EditorCallbacks } from "../editor/editor";
import { Renderer } from "../renderer/renderer";
import { getDefaultDiffOptions } from "../diff/get-default-diff-options";
import { createEvent } from "../utils/createEvent";
import { resolveMatchingSpanPair } from "./resolve-matching-span-pair";
import { AnchorManager } from "./anchor-manager";
import { DiffPipeline } from "./diff-pipeline";
import type { DiffContext, DiffseekEventMap, DiffVisibilityChangeEntry, DiffWorkflowStatus } from "./types";
import type { EditorName } from "../editor";
import type { DiffOptions } from "../diff/types";
import type { Span } from "../types";

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
}

export type DiffseekOptions = {
    diffPalette: number[];
}

export type InternalDiffseekEventMap = DiffseekEventMap & {
    "diffContextChanged": DiffContext | null;
};

export class DiffseekEngine {
    readonly workspaceEl: HTMLElement;
    readonly deckEl: HTMLElement;
    readonly leftEditor: Editor;
    readonly rightEditor: Editor;
    readonly renderer: Renderer;
    readonly anchorManager: AnchorManager;

    options: DiffseekOptions = { ...defaultOptions };
    private diffWorker = initializeDiffWorker();
    private _diffOptions = getDefaultDiffOptions();
    diffContext: DiffContext | null = null;
    private diffPipeline: DiffPipeline;
    private _syncMode: boolean = false;

    focusedEditor: Editor | null = null;
    private lastActiveEditor: Editor | null = null;
    private scrollingEditor: Editor | null = null;
    private programmaticScrollInProgress = 0;

    private alignAnchorsAbortController: AbortController | null = null;

    visibleDiffs: Record<EditorName, Set<number>> = {
        left: new Set(),
        right: new Set(),
    };

    readonly syncModeChanged = createEvent<{ syncMode: boolean }>();
    readonly diffContextChanged = createEvent<DiffContext | null>();
    readonly statusChanged = createEvent<DiffWorkflowStatus>();
    readonly diffVisibilityChanged = createEvent<{ left: DiffVisibilityChangeEntry[]; right: DiffVisibilityChangeEntry[] }>();
    readonly diffOptionsChanged = createEvent<Readonly<DiffOptions>>();
    readonly diffHoveredIndexChanged = createEvent<number | null>();
    readonly progressChanged = createEvent<{ progress: number }>();

    private _eventRegistry: Record<keyof InternalDiffseekEventMap, ReturnType<typeof createEvent<any>>> = {
        "syncModeChanged": this.syncModeChanged,
        "statusChanged": this.statusChanged,
        "diffContextChanged": this.diffContextChanged,
        "diffVisibilityChanged": this.diffVisibilityChanged,
        "diffOptionsChanged": this.diffOptionsChanged,
        "hoveredDiffIndexChanged": this.diffHoveredIndexChanged,
        "mount": createEvent<{ el: HTMLElement }>(),
        "unmount": createEvent<void>(),
        "progress": this.progressChanged,
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

        this.leftEditor = new Editor("left");
        this.rightEditor = new Editor("right");

        this.deckEl.appendChild(this.leftEditor.rootElement);
        this.deckEl.appendChild(this.rightEditor.rootElement);

        this.renderer = new Renderer(this.leftEditor, this.rightEditor);
        this.workspaceEl.appendChild(this.renderer.rootElement);
        this.anchorManager = new AnchorManager(this.leftEditor, this.rightEditor);
        this.diffPipeline = new DiffPipeline(this.diffWorker, this.leftEditor, this.rightEditor, this.anchorManager, this.handleDiffPipelineStatusChanged.bind(this));
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
    updateDiffOptions(newOptions: Partial<DiffOptions>, runWorkflow: boolean = true) {
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
            this.diffOptionsChanged.emit(this._diffOptions);

            if (runWorkflow) {
                this.cancelOngoingOperations();
                this.startDiffWorkflow();
            }
        }

        // this.diffOptions = { ...this.diffOptions, ...newOptions };
        // this.diffAbortController?.abort(ABORT_REASON_CANCELLED);
        // this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        // this.startDiffWorkflow();
    }

    replaceDiffOptions(newOptions: Partial<DiffOptions> | null) {
        newOptions = { ...getDefaultDiffOptions(), ...newOptions };
        this.updateDiffOptions(newOptions || {});
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
                this.lastActiveEditor = editor;
                console.log("Editor focused:", editor.name);
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
        queueMicrotask(() => {
            this.startDiffWorkflow();
        });


        // if (!this.contentChanging[editor.name]) {
        //     this.contentChanging[editor.name] = true;
        //     this.statusChanged.emit({ phase: 'tokenizing' });
        // }
    }

    handleEditorContentChanged(editor: Editor) {
        // this.contentChanging[editor.name] = false;
        // if (this.contentChanging.left || this.contentChanging.right) {
        //     return;
        // }
    }

    handleEditorScroll(editor: Editor) {
        this.renderer.invalidateScroll(editor.name);

        if (!this.scrollingEditor) {
            this.scrollingEditor = editor;
        }

        if (this._syncMode) {
            const otherEditor = editor === this.leftEditor ? this.rightEditor : this.leftEditor;
            const scrollTop = editor.rootElement.scrollTop;
            const otherScrollTop = otherEditor.rootElement.scrollTop;

            if (Math.abs(scrollTop - otherScrollTop) >= 1) {
                if (!this.programmaticScrollInProgress) {
                    this.programmaticScrollInProgress++;
                    this.lastActiveEditor = editor;
                    otherEditor.scrollTo(scrollTop, { behavior: "instant" });
                    this.programmaticScrollInProgress--;
                }
            }
        } else {
            if (!this.programmaticScrollInProgress) {
                this.lastActiveEditor = editor;
            }
        }
    }

    handleEditorScrollEnd(editor: Editor) {
        // if (this.scrollingEditor === editor) {
        //     this.scrollingEditor = null;
        // }
    }

    private lastEditorWidth = { left: 0, right: 0 };

    handleEditorResize(editor: Editor) {
        this.renderer.invalidateAll();
        const width = editor.rootElement.getBoundingClientRect().width;
        if (this.lastEditorWidth[editor.name] !== width) {
            this.lastEditorWidth[editor.name] = width;
            if (this._syncMode) {
                console.log("Editor resized, realigning anchors...");
                this.alignAnchors();
            }
        }
    }

    handleEditorMouseMove(_editor: Editor, e: MouseEvent) {
        this.renderer.updateMousePosition(e.clientX, e.clientY);
    }

    handleEditorMouseLeave(_editor: Editor, _e: MouseEvent) {
    }

    handleDiffWorkerStatus = (e: DiffWorkerStatusEvent) => {
        if (e.type === "progress") {
            this.statusChanged.emit({ phase: 'diffing', progress: e.progress });
        }
    }

    handleRendererDiffVisibilityChanged = (changes: Record<EditorName, DiffVisibilityChangeEntry[]>) => {
        this.diffVisibilityChanged.emit(changes);
    }

    handleRendererHoveredDiffIndexChanged = (diffIndex: number | null) => {
        this.diffHoveredIndexChanged.emit(diffIndex);
    }

    handleDiffPipelineStatusChanged = (status: DiffWorkflowStatus) => {
        this.statusChanged.emit(status);
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

        if (value) {
            this.lastActiveEditor?.saveScrollPosition();
        } else {
            this.leftEditor.saveScrollPosition();
            this.rightEditor.saveScrollPosition();
        }

        this._syncMode = value;
        this.leftEditor.isSyncMode = value;
        this.rightEditor.isSyncMode = value;
        this.renderer.isSyncMode = value;
        this.workspaceEl.classList.toggle("sync-mode", value);

        if (value) {
            // const scrollTop = Math.min(this.leftEditor.scrollTop, this.rightEditor.scrollTop);
            // this.deckEl.scrollTop = scrollTop;
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
                this.programmaticScrollInProgress++;
                this.leftEditor.restoreScrollPosition();
                this.rightEditor.restoreScrollPosition();
                this.programmaticScrollInProgress--;
            });
        }

        this.syncModeChanged.emit({ syncMode: value });
    }

    scrollNudge(editorName: EditorName | "current", direction: "up" | "down", lines?: number) {
        const editor = editorName === "current" ? this.focusedEditor : editorName === "left" ? this.leftEditor : this.rightEditor;
        if (editor) {
            editor.scrollNudge(direction, lines);
        }
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

    pasteBomb(editorName: EditorName, plaintextOnly: boolean = false) {
        const editor = editorName === "left" ? this.leftEditor : this.rightEditor;
        editor.pasteBomb(plaintextOnly);
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
        this.diffPipeline.cancel();
        this.renderer.cancelRender();
        this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        this.alignAnchorsAbortController = null;
    }

    //
    // region Diff Workflow
    private async startDiffWorkflow() {
        this.renderer.suspendRendering();
        try {
            const diffContext = await this.diffPipeline.run({
                options: this.options,
                diffOptions: this._diffOptions,
            });

            this.renderer.setDiffs(diffContext.diffs);

            this.renderer.resumeRendering();
            this.renderer.invalidateAll();

            this.setDiffContext(diffContext);
            this.statusChanged.emit({ phase: 'idle' });
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                console.debug("Diff workflow cancelled");
            } else {
                console.error("Diff workflow error:", err);
            }
        }
    }

    //
    // Anchor Alignment
    //
    private async alignAnchors(): Promise<void> {
        this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        const controller = this.alignAnchorsAbortController = new AbortController();
        try {
            this.programmaticScrollInProgress++;
            await this.anchorManager.alignAnchors(controller.signal);
            this.renderer.invalidateGeometries();

            const lastEditor = this.lastActiveEditor;
            if (lastEditor) {
                const otherEditor = lastEditor === this.leftEditor ? this.rightEditor : this.leftEditor;
                lastEditor.restoreScrollPosition();
                otherEditor.rootElement.scrollTop = lastEditor.rootElement.scrollTop;
            }
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                // 무시
            } else {
                console.error("Anchor alignment error:", err);
            }
        } finally {
            this.programmaticScrollInProgress--;
            if (controller === this.alignAnchorsAbortController) {
                this.alignAnchorsAbortController = null;
            }
        }
    }

    private setDiffContext(diffContext: DiffContext | null) {
        if (this.diffContext !== diffContext) {
            console.log("Diff context changed:", diffContext);
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
