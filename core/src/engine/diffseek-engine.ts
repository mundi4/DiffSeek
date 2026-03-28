import { ABORT_REASON_CANCELLED } from "../constants";
import { initializeDiffWorker, type DiffWorkerStatusEvent } from "../diff-worker/initialize-diff-worker";
import { Editor, type EditorCallbacks } from "../editor/editor";
import { getDefaultDiffOptions } from "../diff/get-default-diff-options";
import { createEvent } from "../utils/create-event";
import { resolveMatchingSpanPair } from "./resolve-matching-span-pair";
import { AnchorManager } from "./anchor-manager";
import { DiffPipeline } from "./diff-pipeline";
import type { DiffContext, DiffseekEventMap, DiffVisibilityChangeEntry, DiffWorkflowStatus, SelectionChangeData } from "./types";
import type { EditorName } from "../editor";
import type { DiffOptions } from "../diff/types";
import type { Palette, Span } from "../types";
import { DEFAULT_PALETTE } from "../palette/default-palette";
import { Renderer } from "../renderer/renderer";

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

    private diffWorker = initializeDiffWorker();
    private _diffOptions = getDefaultDiffOptions();
    diffContext: DiffContext | null = null;
    private diffPipeline: DiffPipeline;
    private _syncMode: boolean = false;
    private _extensionEnabled: boolean = false;

    focusedEditor: Editor | null = null;
    private lastActiveEditor: Editor | null = null;
    private scrollingEditor: Editor | null = null;
    private programmaticScrollInProgress = 0;

    private alignAnchorsAbortController: AbortController | null = null;
    private workflowRunScheduled = false;
    private workflowRunInProgress = false;
    private workflowRerunRequested = false;

    visibleDiffs: Record<EditorName, Set<number>> = {
        left: new Set(),
        right: new Set(),
    };

    readonly syncModeChanged = createEvent<{ syncMode: boolean }>();
    readonly editableInSyncModeChanged = createEvent<{ editableInSyncMode: boolean }>();
    readonly diffContextChanged = createEvent<DiffContext | null>();
    readonly statusChanged = createEvent<DiffWorkflowStatus>();
    readonly diffVisibilityChanged = createEvent<{ left: DiffVisibilityChangeEntry[]; right: DiffVisibilityChangeEntry[] }>();
    readonly diffOptionsChanged = createEvent<Readonly<DiffOptions>>();
    readonly paletteChanged = createEvent<Readonly<Palette>>();
    readonly diffHoveredIndexChanged = createEvent<number | null>();
    readonly progressChanged = createEvent<{ progress: number }>();
    readonly selectionChanged = createEvent<SelectionChangeData>();

    private _eventRegistry: Record<keyof InternalDiffseekEventMap, ReturnType<typeof createEvent<any>>> = {
        "syncModeChanged": this.syncModeChanged,
        "editableInSyncModeChanged": this.editableInSyncModeChanged,
        "statusChanged": this.statusChanged,
        "diffContextChanged": this.diffContextChanged,
        "diffVisibilityChanged": this.diffVisibilityChanged,
        "diffOptionsChanged": this.diffOptionsChanged,
        "paletteChanged": this.paletteChanged,
        "hoveredDiffIndexChanged": this.diffHoveredIndexChanged,
        "mount": createEvent<{ el: HTMLElement }>(),
        "unmount": createEvent<void>(),
        "progress": this.progressChanged,
        "selectionChanged": this.selectionChanged,
    };

    on<K extends keyof InternalDiffseekEventMap>(event: K, handler: (data: InternalDiffseekEventMap[K]) => void) {
        this._eventRegistry[event]?.on(handler);
        return () => this.off(event, handler);
    }

    off<K extends keyof InternalDiffseekEventMap>(event: K, handler: (data: InternalDiffseekEventMap[K]) => void) {
        this._eventRegistry[event]?.off(handler);
    }

    constructor() {
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
        this.applyPaletteToRenderer(this._palette);
        this.anchorManager = new AnchorManager(this.leftEditor, this.rightEditor);
        this.diffPipeline = new DiffPipeline(this.diffWorker, this.leftEditor, this.rightEditor, this.anchorManager, this.handleDiffPipelineStatusChanged.bind(this));
        this.setupCallbacks();
    }

    get diffOptions(): Readonly<DiffOptions> {
        return this._diffOptions;
    }

    /**
     * Diff 옵션 업데이트
     */
    updateDiffOptions(newOptions: Partial<DiffOptions>, runWorkflow: boolean = true) {
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

            const tokOptions = {
                mergeNonWordLikeTokens: newDiffOptions.mergeNonWordTokens,
                mergeLetterNumberBoundary: newDiffOptions.mergeLetterNumberBoundary,
                allowStandaloneLawArticle: newDiffOptions.allowStandaloneLawArticle,
            };
            this.leftEditor.tokenizeOptions = tokOptions;
            this.rightEditor.tokenizeOptions = tokOptions;
            this.leftEditor.scheduleRetokenize();
            this.rightEditor.scheduleRetokenize();

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

    private leftSelectionSpan: Span | null = null;
    private rightSelectionSpan: Span | null = null;

    handleSelectionChange() {
        if (this.diffContext) {
            const { editor: selectedEditor, range: selectedRange } = this.getUserSelectionRange();
            if (selectedEditor) {
                // 해당 range가 품고 있는 token span을 구함.
                const sourceSpan = selectedEditor.getTokenSpanForRange(selectedRange);
                if (sourceSpan && sourceSpan.start !== sourceSpan.end) {
                    const { left, right } = resolveMatchingSpanPair(this.diffContext, selectedEditor.name, sourceSpan);
                    if (left && right) {
                        // left, right가 존재한다면 양쪽 모두 end > start인 유효한 범위임
                        if (this.leftSelectionSpan?.start !== left.start
                            || this.leftSelectionSpan?.end !== left.end
                            || this.rightSelectionSpan?.start !== right.start
                            || this.rightSelectionSpan?.end !== right.end) {
                            const targetSpan = selectedEditor.name === "left" ? right : left;
                            const targetEditor = selectedEditor.name === "left" ? this.rightEditor : this.leftEditor;
                            const targetRange = targetEditor.getTokenRange(targetSpan.start, targetSpan.end);
                            this.leftSelectionSpan = left;
                            this.rightSelectionSpan = right;
                            this.renderer.setSelectionHighlight(targetEditor.name, targetRange);
                            this.selectionChanged.emit({
                                left: left,
                                right: right,
                                selectedEditor: selectedEditor.name,
                            });
                        }
                        return;
                    }
                }
            }
        }

        if (this.leftSelectionSpan || this.rightSelectionSpan) {
            this.leftSelectionSpan = null;
            this.rightSelectionSpan = null;
            this.renderer.setSelectionHighlight("left", null); // 한쪽만 null로 만들면 됨!
            this.selectionChanged.emit({
                left: null,
                right: null,
                selectedEditor: null,
            });
        }
    }

    handleEditorContentChanging(editor: Editor) {
        this.cancelOngoingOperations();
        this.renderer.suspendRendering();
        this.setDiffContext(null);
        this.requestDiffWorkflowRun();
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

        if (!this.programmaticScrollInProgress) {
            this.lastActiveEditor = editor;
        }

        if (this._syncMode) {
            if (!this.programmaticScrollInProgress) {
                this._pendingSyncScrollPrimaryEditor = editor;
                if (!this._pendingSyncScrollTimer) {
                    this._pendingSyncScrollTimer = requestAnimationFrame(() => {
                        this._pendingSyncScrollTimer = null;
                        if (this._syncMode && this._pendingSyncScrollPrimaryEditor) {
                            this.syncScroll(this._pendingSyncScrollPrimaryEditor);
                        }
                    });
                }
            }
        }
    }

    handleEditorScrollEnd(editor: Editor) {
        // if (this.scrollingEditor === editor) {
        //     this.scrollingEditor = null;
        //     if (this._syncMode) {
        //         if (!this.programmaticScrollInProgress) {
        //             this._pendingSyncScrollPrimaryEditor = editor;
        //             if (!this._pendingSyncScrollTimer) {
        //                 this._pendingSyncScrollTimer = requestAnimationFrame(() => {
        //                     this._pendingSyncScrollTimer = null;
        //                     if (this._syncMode && this._pendingSyncScrollPrimaryEditor) {
        //                         this.syncScroll(this._pendingSyncScrollPrimaryEditor);
        //                     }
        //                 });
        //             }
        //         }
        //     }
        // }
    }

    private _pendingSyncScrollTimer: number | null = null;
    private _pendingSyncScrollPrimaryEditor: Editor | null = null;

    private syncScroll(primaryEditor: Editor) {
        const otherEditor = primaryEditor === this.leftEditor ? this.rightEditor : this.leftEditor;
        const scrollTop = primaryEditor.rootElement.scrollTop;
        const otherScrollTop = otherEditor.rootElement.scrollTop;
        if (Math.abs(otherScrollTop - scrollTop) >= 1) {
            this.programmaticScrollInProgress++;
            otherEditor.rootElement.scrollTop = scrollTop;
            this.programmaticScrollInProgress--;
        }
    }

    private lastEditorWidth = { left: 0, right: 0 };
    private _scrollbarWidth: number = 15;

    private syncScrollbarWidth() {
        const el = this.leftEditor.rootElement;
        const measured = el.offsetWidth - el.clientWidth;
        const width = measured > 0 ? measured : 15;
        if (width === this._scrollbarWidth) return;
        this._scrollbarWidth = width;
        this.workspaceEl.style.setProperty('--editor-minimap-width', `${width}px`);
        this.renderer.setOptions({ minimapWidth: width });
    }

    handleEditorResize(editor: Editor) {
        this.syncScrollbarWidth();
        this.renderer.invalidateAll();
        const width = editor.rootElement.getBoundingClientRect().width;
        if (this.lastEditorWidth[editor.name] !== width) {
            this.lastEditorWidth[editor.name] = width;
            if (this._syncMode) {
                this.alignAnchors();
            }
        }
    }

    handleEditorMouseMove(_editor: Editor, e: MouseEvent) {
        this.renderer.updateMousePosition(e.clientX, e.clientY);
    }

    handleEditorMouseLeave(_editor: Editor, _e: MouseEvent) {
    }

    handleDiffWorkerStatus = (_e: DiffWorkerStatusEvent) => {
        // progress는 pipeline이 emit하는 status에 포함됨
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
        value = !!value;

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
        this.leftEditor.isReadOnly = !this._editableInSyncMode && value;
        this.rightEditor.isReadOnly = !this._editableInSyncMode && value;
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
        for (const s of sides) {
            const rect = this.renderer.getDiffRect(s, diffIndex);
            if (rect) {
                const editor = s === "left" ? this.leftEditor : this.rightEditor;
                // this.programmaticScrollInProgress++;
                editor.scrollTo(rect.y, options);
                // this.programmaticScrollInProgress--;
            }
        }
    }

    pasteBomb(editorName: EditorName, plaintextOnly: boolean = false) {
        const editor = editorName === "left" ? this.leftEditor : this.rightEditor;
        editor.pasteBomb(plaintextOnly);
    }

    setContent(editorName: EditorName, text: string, asHTML: boolean = true) {
        const editor = editorName === "left" ? this.leftEditor : this.rightEditor;
        editor.setContent({ text, asHTML });
    }

    get extensionEnabled(): boolean {
        return this._extensionEnabled;
    }

    setExtensionEnabled(enabled: boolean) {
        this._extensionEnabled = enabled;
    }

    setHoveredDiff(diffIndex: number | null) {
        this.renderer.setHoveredDiffIndex(diffIndex);
    }

    getUserSelectionRange(): { editor: Editor; range: Range } | { editor: null; range: null } {
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
                return { editor, range };
            }
        }
        return { editor: null, range: null };
    }

    // getEditorSelectionTokenSpanPair()
    //     : { left: Span; right: Span; sourceEditor: EditorName } | null {
    //     if (this.diffContext) {
    //         const selection = this.getUserSelectionRange();

    //         if (selection && selection.editor) {
    //             const editor = selection.editor === "left" ? this.leftEditor : this.rightEditor;
    //             let sourceSpan = editor.getTokenSpanForRange(selection.range);
    //             if (sourceSpan) {

    //                 const { left, right } = resolveMatchingSpanPair(this.diffContext, editor.name, sourceSpan);
    //                 if (left && right) {
    //                     return {
    //                         left,
    //                         right,
    //                         sourceEditor: editor.name,
    //                     };
    //                 }
    //             }
    //         }
    //     }
    //     return null;
    // }



    private cancelOngoingOperations() {
        this.diffPipeline.cancel();
        this.renderer.cancelRender();
        this.alignAnchorsAbortController?.abort(ABORT_REASON_CANCELLED);
        this.alignAnchorsAbortController = null;
    }

    private requestDiffWorkflowRun() {
        this.workflowRerunRequested = true;
        if (this.workflowRunScheduled) {
            return;
        }

        this.workflowRunScheduled = true;
        queueMicrotask(() => {
            this.workflowRunScheduled = false;
            void this.drainDiffWorkflowRuns();
        });
    }

    private async drainDiffWorkflowRuns() {
        if (this.workflowRunInProgress) {
            return;
        }

        this.workflowRunInProgress = true;
        try {
            while (this.workflowRerunRequested) {
                this.workflowRerunRequested = false;
                await this.startDiffWorkflow();
            }
        } finally {
            this.workflowRunInProgress = false;
        }
    }

    //
    // region Diff Workflow
    private async startDiffWorkflow() {
        this.handleSelectionChange();
        this.renderer.suspendRendering();

        try {
            const diffContext = await this.diffPipeline.run({
                diffOptions: this._diffOptions,
            });

            this.renderer.setDiffs(diffContext.diffs);

            if (this._syncMode) {
                await this.alignAnchors();
            }

            this.setDiffContext(diffContext);
            this.handleSelectionChange();
            this.renderer.invalidateAll();
            this.renderer.resumeRendering();
            //this.statusChanged.emit({ phase: 'idle' });
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                if (import.meta.env.DEV) {
                    console.debug("Diff workflow cancelled");
                }
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

    private _palette: Palette = structuredClone(DEFAULT_PALETTE);

    private applyPaletteToRenderer(palette: Readonly<Palette>) {
        this.renderer.setOptions({
            palette: {
                diffHues: structuredClone(palette.diffHues),
                diffSaturation: palette.diffSaturation,
                diffLightness: palette.diffLightness,
                diffAlpha: palette.diffAlpha,
                diffLineColor: palette.diffLineColor,
                highlightedDiffColor: palette.highlightedDiffColor,
                selectionHighlightColor: palette.selectionHighlightColor,
                guidelineColor: palette.guidelineColor,
                minimapDiffColor: palette.minimapDiffColor,
            },
        });
        this.renderer.invalidateAll();
    }

    get palette(): Readonly<Palette> {
        return structuredClone(this._palette);
    }

    set palette(nextPalette: Readonly<Palette> | null) {
        const normalizedPalette: Palette = structuredClone(nextPalette ?? DEFAULT_PALETTE);
        if (normalizedPalette.diffHues.length === 0) {
            normalizedPalette.diffHues = structuredClone(DEFAULT_PALETTE.diffHues);
        }

        if (isPaletteEqual(this._palette, normalizedPalette)) {
            return;
        }

        const diffHuesChanged = !isNumberArrayEqual(this._palette.diffHues, normalizedPalette.diffHues);
        this._palette = normalizedPalette;
        this.applyPaletteToRenderer(this._palette);
        this.paletteChanged.emit(structuredClone(this._palette));

        if (diffHuesChanged) {
            this.cancelOngoingOperations();
            this.requestDiffWorkflowRun();
            return;
        }

        if (this.diffContext) {
            this.renderer.setDiffs(this.diffContext.diffs);
        }
        this.renderer.invalidateAll();
    }

    private _editableInSyncMode: boolean = true;

    get editableInSyncMode(): boolean {
        return this._editableInSyncMode;
    }

    set editableInSyncMode(value: boolean) {
        value = !!value;
        if (value === this._editableInSyncMode) {
            return;
        }
        this._editableInSyncMode = value;
        this.editableInSyncModeChanged.emit({ editableInSyncMode: value });
        if (this._syncMode) {
            this.leftEditor.isReadOnly = !value;
            this.rightEditor.isReadOnly = !value;
        }
    }
}

function isNumberArrayEqual(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function isPaletteEqual(a: Readonly<Palette>, b: Readonly<Palette>): boolean {
    return isNumberArrayEqual(a.diffHues, b.diffHues)
        && a.diffSaturation === b.diffSaturation
        && a.diffLightness === b.diffLightness
        && a.diffAlpha === b.diffAlpha
        && a.diffLineColor === b.diffLineColor
        && a.highlightedDiffColor === b.highlightedDiffColor
        && a.guidelineColor === b.guidelineColor
        && a.selectionHighlightColor === b.selectionHighlightColor
        && a.minimapDiffColor === b.minimapDiffColor;
}