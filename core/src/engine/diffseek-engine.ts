import { ABORT_REASON_CANCELLED } from "../constants";
import { initializeDiffWorker } from "../diff-worker/initialize-diff-worker";
import { Editor, type EditorCallbacks } from "../editor/editor";
import { getDefaultDiffOptions } from "../diff/get-default-diff-options";
import { createEvent } from "../utils/create-event";
import { resolveMatchingSpanPair } from "./resolve-matching-span-pair";
import { alignAnchors as alignAnchorsImpl } from "./align-anchors";
import { processDiffElements, serializeTokens, cleanupUnusedMarkers } from "./process-diff-elements";
import type { DiffContext, DiffseekEventMap, DiffVisibilityChangeEntry, DiffWorkflowStatus, MarkerElementsMap, SelectionChangeData } from "./types";
import type { EditorName } from "../editor";
import type { DiffOptions } from "../diff/types";
import { TOKEN_BUFFER_STRIDE } from "../constants";
import type { DiffseekOptions, Palette, Span } from "../types";
import { DEFAULT_PALETTE } from "../palette/default-palette";
import { Renderer } from "../renderer/renderer";
import { createYieldIfNeeded } from "../utils/create-yield-if-needed";

export type InternalDiffseekEventMap = DiffseekEventMap & {
    "diffContextChanged": DiffContext | null;
};

export class DiffseekEngine {
    readonly workspaceEl: HTMLElement;
    readonly deckEl: HTMLElement;
    readonly leftEditor: Editor;
    readonly rightEditor: Editor;
    readonly renderer: Renderer;

    private diffWorker = initializeDiffWorker();
    private _diffOptions = getDefaultDiffOptions();
    diffContext: DiffContext | null = null;
    private _syncMode: boolean = false;

    private markerElements: MarkerElementsMap = new Map();
    private prevMarkerElements: MarkerElementsMap | null = null;
    private diffAbortController: AbortController | null = null;
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

    /**
     * DiffseekOptions 전체 적용 (초기화 시 사용).
     * workflow는 트리거하지 않음 — 아직 content가 없을 수 있으므로.
     */
    applyOptions(options: DiffseekOptions) {
        this.updateDiffOptions(options.diff, false);
        this.editableInSyncMode = options.editableInSyncMode;
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
            if (selectedEditor
                //&& !selectedRange.collapsed
            ) {
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

    setImageFetchFn(fn: ((url: string) => Promise<string | null>) | null) {
        const cachedFn = fn ? createCachedImageFetch(fn) : null;
        this.leftEditor.imageFetchFn = cachedFn;
        this.rightEditor.imageFetchFn = cachedFn;
    }

    setHoveredDiff(diffIndex: number | null) {
        this.renderer.setHoveredDiffIndex(diffIndex);
    }

    getTextForTokenSpan(side: EditorName, span: Span): string | null {
        if (!this.diffContext) return null;
        const tokens = side === "left" ? this.diffContext.leftTokens : this.diffContext.rightTokens;
        if (span.start < 0 || span.end > tokens.length || span.start >= span.end) return null;
        const editor = side === "left" ? this.leftEditor : this.rightEditor;
        const wholeText = editor.wholeText;
        let result = "";
        for (let i = span.start; i < span.end; i++) {
            const token = tokens[i];
            if (token.flags & 0x2 /* TOKEN_FLAGS_TYPE_IMAGE */) continue;
            const start = token.textOffset;
            const end = i + 1 < tokens.length
                ? tokens[i + 1].textOffset
                : token.textOffset + token.textLength;
            result += wholeText.slice(start, end);
        }
        return result;
    }

    /**
     * 좌우 매칭 span을 토큰 단위 최소 매칭 쌍으로 분쇄.
     * 입력은 resolveMatchingSpanPair의 결과(토큰 인덱스 span)여야 하지만 강제하지 않음.
     */
    segmentSpanPair(leftSpan: Span, rightSpan: Span): { left: Span | null; right: Span | null }[] {
        if (!this.diffContext) return [];
        const S = TOKEN_BUFFER_STRIDE;
        const lBuf = this.diffContext.leftTokenBuffer;
        const rBuf = this.diffContext.rightTokenBuffer;
        const segments: { left: Span | null; right: Span | null }[] = [];

        let li = leftSpan.start;
        let ri = rightSpan.start;

        while (li < leftSpan.end || ri < rightSpan.end) {
            if (li >= leftSpan.end) {
                // 좌측 소진 — 남은 우측을 하나의 segment로
                segments.push({ left: null, right: { start: ri, end: rightSpan.end } });
                break;
            }
            if (ri >= rightSpan.end) {
                // 우측 소진 — 남은 좌측을 하나의 segment로
                segments.push({ left: { start: li, end: leftSpan.end }, right: null });
                break;
            }

            // 현재 좌측 토큰의 반대편 매칭 범위
            const lOppStart = lBuf[li * S + 2];
            const lOppEnd = lBuf[li * S + 3];

            // 현재 우측 토큰의 반대편 매칭 범위
            const rOppStart = rBuf[ri * S + 2];
            const rOppEnd = rBuf[ri * S + 3];

            // 좌측 토큰이 우측 범위 밖을 가리킴 → 좌측만 있는 segment
            if (lOppStart >= rightSpan.end || lOppEnd <= ri) {
                const segStart = li;
                li++;
                while (li < leftSpan.end) {
                    const nextOppStart = lBuf[li * S + 2];
                    if (nextOppStart >= ri) break;
                    li++;
                }
                segments.push({ left: { start: segStart, end: li }, right: null });
                continue;
            }

            // 우측 토큰이 좌측 범위 밖을 가리킴 → 우측만 있는 segment
            if (rOppStart >= leftSpan.end || rOppEnd <= li) {
                const segStart = ri;
                ri++;
                while (ri < rightSpan.end) {
                    const nextOppStart = rBuf[ri * S + 2];
                    if (nextOppStart >= li) break;
                    ri++;
                }
                segments.push({ left: null, right: { start: segStart, end: ri } });
                continue;
            }

            // 양쪽 매칭 — 그룹 확장
            let lEnd = li + 1;
            let rEnd = Math.max(ri + 1, lOppEnd);

            // 우측 끝에 해당하는 좌측 범위가 더 넓을 수 있으므로 수렴할 때까지 반복
            let changed = true;
            while (changed) {
                changed = false;
                // 우측 끝까지의 좌측 범위 확장
                for (let r = ri; r < rEnd && r < rightSpan.end; r++) {
                    const oppEnd = rBuf[r * S + 3];
                    if (oppEnd > lEnd) { lEnd = oppEnd; changed = true; }
                }
                // 좌측 끝까지의 우측 범위 확장
                for (let l = li; l < lEnd && l < leftSpan.end; l++) {
                    const oppEnd = lBuf[l * S + 3];
                    if (oppEnd > rEnd) { rEnd = oppEnd; changed = true; }
                }
            }

            lEnd = Math.min(lEnd, leftSpan.end);
            rEnd = Math.min(rEnd, rightSpan.end);

            segments.push({
                left: { start: li, end: lEnd },
                right: { start: ri, end: rEnd },
            });

            li = lEnd;
            ri = rEnd;
        }

        return segments;
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
        if (this.diffAbortController) {
            this.diffAbortController.abort(ABORT_REASON_CANCELLED);
            this.diffAbortController = null;
        }
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

    // ── marker element lifecycle ─────────────────────────────────

    private beginMarkerUpdate() {
        if (this.prevMarkerElements !== null) {
            throw new Error("beginMarkerUpdate called while a previous update is still in progress");
        }
        this.prevMarkerElements = this.markerElements;
        this.markerElements = new Map();
    }

    private endMarkerUpdate() {
        if (this.prevMarkerElements === null) {
            throw new Error("endMarkerUpdate called without a corresponding beginMarkerUpdate");
        }
        cleanupUnusedMarkers(this.prevMarkerElements, this.markerElements);
        this.prevMarkerElements = null;
    }

    private emitStatusForRun(controller: AbortController, status: DiffWorkflowStatus) {
        if (this.diffAbortController === controller) {
            this.statusChanged.emit(status);
        }
    }

    //
    // region Diff Workflow
    private async startDiffWorkflow() {
        this.handleSelectionChange();
        this.renderer.suspendRendering();

        if (this.diffAbortController) {
            this.diffAbortController.abort(ABORT_REASON_CANCELLED);
            this.diffAbortController = null;
            await scheduler.yield();
        }

        if (this.prevMarkerElements) {
            throw new Error("DiffseekEngine: previous diff elements have not been cleaned up.");
        }

        const controller = new AbortController();
        this.diffAbortController = controller;
        const signal = controller.signal;
        const yieldIfNeeded = createYieldIfNeeded(signal);

        try {
            // 1. tokenize & serialize
            const t0 = performance.now();
            this.emitStatusForRun(controller, { phase: "tokenizing", startedAtMs: t0 });

            const leftTokenSnapshot = await this.leftEditor.waitForTokens(signal);
            signal.throwIfAborted();

            const rightTokenSnapshot = await this.rightEditor.waitForTokens(signal);
            signal.throwIfAborted();

            const leftTokensData = serializeTokens(leftTokenSnapshot.tokens);
            const rightTokensData = serializeTokens(rightTokenSnapshot.tokens);
            await yieldIfNeeded();

            const t1 = performance.now();

            // 2. run diff worker
            this.emitStatusForRun(controller, { phase: "diffing", startedAtMs: t1, tokenizingMs: t1 - t0 });

            const workerResult = await this.diffWorker.run({
                leftWholeText: leftTokenSnapshot.wholeText,
                rightWholeText: rightTokenSnapshot.wholeText,
                leftTokenBuffer: leftTokensData,
                rightTokenBuffer: rightTokensData,
                leftTokenCount: leftTokenSnapshot.tokens.length,
                rightTokenCount: rightTokenSnapshot.tokens.length,
                options: this._diffOptions,
                abortSignal: signal,
            });

            signal.throwIfAborted();

            const t2 = performance.now();

            // 3. post process
            this.emitStatusForRun(controller, { phase: "processing", startedAtMs: t2, tokenizingMs: t1 - t0, diffingMs: t2 - t1 });
            this.beginMarkerUpdate();

            try {
                const diffResult = await processDiffElements({
                    leftEditor: this.leftEditor,
                    rightEditor: this.rightEditor,
                    leftTokenSnapshot,
                    rightTokenSnapshot,
                    diffOptions: this._diffOptions,
                    result: workerResult,
                    markerElements: this.markerElements,
                    prevMarkerElements: this.prevMarkerElements,
                    signal,
                });
                signal.throwIfAborted();

                const t3 = performance.now();

                if (import.meta.env.DEV) {
                    console.debug(
                        `[pipeline] tokenizing=${(t1 - t0).toFixed(1)}ms  diffing=${(t2 - t1).toFixed(1)}ms (worker=${workerResult.elapsedTime.toFixed(1)}ms)  processing=${(t3 - t2).toFixed(1)}ms  total=${(t3 - t0).toFixed(1)}ms`
                    );
                }

                const diffContext: DiffContext = {
                    ...diffResult,
                    timing: {
                        tokenizingMs: t1 - t0,
                        diffingMs: t2 - t1,
                        processingMs: t3 - t2,
                        totalMs: t3 - t0,
                    },
                };

                this.renderer.setDiffs(diffContext.diffs);
                this.setDiffContext(diffContext);
            } finally {
                this.endMarkerUpdate();
            }

            if (this._syncMode) {
                await this.alignAnchors();
            }

            this.handleSelectionChange();
            this.renderer.invalidateAll();
            this.renderer.resumeRendering();
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                if (import.meta.env.DEV) {
                    console.debug("Diff workflow cancelled");
                }
            } else {
                console.error("Diff workflow error:", err);
                this.renderer.resumeRendering();
            }
        } finally {
            if (this.diffAbortController === controller) {
                this.statusChanged.emit({ phase: "idle" });
                this.diffAbortController = null;
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

            await alignAnchorsImpl({
                anchorPairs: this.diffContext?.anchorPairs ?? [],
                leftEditor: this.leftEditor,
                rightEditor: this.rightEditor,
                markerElements: this.markerElements,
                signal: controller.signal,
            });
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
            console.log("Diff context updated:", diffContext);
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
                minimapDiffColor: palette.minimapDiffColor,
                minimapHighlightColor: palette.minimapHighlightColor,
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
        && a.selectionHighlightColor === b.selectionHighlightColor
        && a.minimapDiffColor === b.minimapDiffColor;
}

type ImageFetchFn = (url: string) => Promise<string | null>;

function createCachedImageFetch(fn: ImageFetchFn): ImageFetchFn {
    const httpCache = new Map<string, Promise<string | null>>();
    return (url: string) => {
        if (/^https?:\/\//.test(url)) {
            let cached = httpCache.get(url);
            if (!cached) {
                cached = fn(url);
                httpCache.set(url, cached);
            }
            return cached;
        }
        return fn(url);
    };
}