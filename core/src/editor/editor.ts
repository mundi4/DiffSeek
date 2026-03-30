import { ABORT_REASON_CANCELLED, BLOCK_ELEMENTS, MANUAL_ANCHOR_TAG_NAME } from "../constants";
import { sanitizeHTML } from "../sanitize/sanitize";
import type { ContainerInfo, LineBoundaryInfo, Token, TokenizerOptions } from "../tokenization";
import { tokenize } from "../tokenization/tokenize";
import type { SectionHeadingInfo } from "../tokenization/types";
import type { Span } from "../types";
import { findAdjacentTextNode } from "../utils/find-adjacent-text-node";
import { TOKEN_FLAGS_STRUCTURAL_CLOSE, TOKEN_FLAGS_STRUCTURAL_OPEN } from "../tokenization";
import { createRangeFromTokenRange, setEndBeforeToken, setEndFromTokenRange, setStartAfterToken, SetStartEndFromTokenRange, setStartFromTokenRange } from "./helpers";
import { paragraphizePlainText } from "./paragraphize-plain-text";
import type { EditorContext, EditorName, EditorOptions } from "./types";

const MAX_LENGTH_FOR_EXECCOMMAND_PASTE = 200_000 as const;
const TOKENIZE_DEBOUNCE_DELAY_MS = 200 as const;

export type EditorCallbacks = {
    contentChanging?: (editor: Editor) => void;
    contentChanged?: (editor: Editor) => void;
    scroll?: (editor: Editor) => void;
    scrollEnd?: (editor: Editor) => void;
    resize?: (editor: Editor) => void;
    focus?: (editor: Editor) => void;
    blur?: (editor: Editor) => void;
    click?: (editor: Editor, event: MouseEvent) => void;
    copy?: (editor: Editor, event: ClipboardEvent) => void;
    mouseMove?: (editor: Editor, e: MouseEvent) => void;
    mouseLeave?: (editor: Editor, e: MouseEvent) => void;
    keyDown?: (editor: Editor, event: KeyboardEvent) => void;
};

const INITIAL_CONTENT_HTML = document.createElement("P");
INITIAL_CONTENT_HTML.appendChild(document.createElement("BR"));

const DEFAULT_EDITOR_OPTIONS: EditorOptions = {
    lineHeight: 1.5,
    altArrowScrollLines: 3,
};

export type TokenSnapshot = {
    wholeText: string;
    tokens: readonly Token[];
    lineBoundaries: readonly LineBoundaryInfo[];
    sectionHeadings: readonly SectionHeadingInfo[];
    containers: readonly ContainerInfo[];
    elapsedTime: number;
}

const NULL_TOKEN_SNAPSHOT: TokenSnapshot = {
    wholeText: "",
    tokens: [],
    lineBoundaries: [],
    sectionHeadings: [],
    containers: [],
    elapsedTime: 0,
} as const;

export class Editor implements EditorContext {
    readonly name: EditorName;
    readonly rootElement: HTMLElement;
    readonly contentElement: HTMLElement;
    readonly heightBoostElement: HTMLElement;
    readonly minimapElement: HTMLElement;

    wholeText: string = "";
    tokens: readonly Token[] = [];
    lineBoundaries: readonly LineBoundaryInfo[] = [];
    sectionHeadings: readonly SectionHeadingInfo[] = [];
    containers: readonly ContainerInfo[] = [];

    options: EditorOptions;
    mutationObserver: MutationObserver;
    callbacks: EditorCallbacks = {};
    _isReadOnly: boolean = false;
    // mountHelper: ReturnType<typeof mountHelper>;
    resizeObserver = new ResizeObserver(() => this.onResize());
    // tokenizer: Tokenizer = new Tokenizer();
    tokenizeAbortController: AbortController | null = null;
    tokenizeOptions: TokenizerOptions = {};

    private savedScroll: { ref: HTMLElement; targetTop: number } | null = null;
    private _hasPendingPromise: boolean = false;
    private _tokenizingPromise: Promise<Readonly<TokenSnapshot>> = Promise.resolve(NULL_TOKEN_SNAPSHOT);
    private _tokenizingPromiseResolver: ((snapshot: TokenSnapshot) => void) = () => { };
    private _tokenizingPromiseRejecter: ((err: any) => void) = () => { };
    private tokenizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(name: EditorName, options: Partial<EditorOptions> = {}) {
        this.name = name;
        this.options = {
            ...DEFAULT_EDITOR_OPTIONS,
            ...options,
        };

        this.rootElement = document.createElement("div");
        this.rootElement.classList.add("ds-editor", `ds-editor-${name}`);

        this.contentElement = document.createElement("div");
        this.contentElement.contentEditable = "true";
        this.contentElement.spellcheck = false;
        this.contentElement.id = `diffseek-editor-content-${name}`;
        this.contentElement.classList.add("ds-editor-content", `ds-editor-content-${name}`);
        this.contentElement.appendChild(INITIAL_CONTENT_HTML.cloneNode(true));
        this.rootElement.appendChild(this.contentElement);

        this.heightBoostElement = document.createElement("div");
        this.heightBoostElement.classList.add("ds-editor-height-boost");
        this.rootElement.appendChild(this.heightBoostElement);

        this.minimapElement = document.createElement("div");
        this.minimapElement.classList.add("ds-editor-minimap");
        this.rootElement.appendChild(this.minimapElement);

        this.mutationObserver = new MutationObserver((mutations) => this.onMutation(mutations));
        this.observeMutation();

        this.rootElement.addEventListener("scroll", this.onContainerScroll);
        this.rootElement.addEventListener("scrollend", this.onContainerScrollEnd);
        this.rootElement.addEventListener("mousemove", this.onContainerMouseMove);
        this.rootElement.addEventListener("mouseleave", this.onContainerMouseLeave);

        this.contentElement.addEventListener("copy", (e) => this.onCopy(e));
        this.contentElement.addEventListener("paste", (e) => this.onPaste(e));
        this.contentElement.addEventListener("input", () => this.handleContentChangedInternal());
        this.contentElement.addEventListener("click", (e) => {
            this.callbacks.click?.(this, e);
        });
        this.contentElement.addEventListener("keydown", (e) => this.onKeyDown(e));
        this.contentElement.addEventListener("focus", () => {
            this.callbacks.focus?.(this);
        });
        this.contentElement.addEventListener("blur", () => {
            this.callbacks.blur?.(this);
        });

        this.resizeObserver.observe(this.rootElement);

        this.contentElement.innerHTML = "<P><BR></P>";
        this.handleContentChangedInternal();
    }

    setCallbacks(callbacks: Partial<EditorCallbacks>) {
        Object.assign(this.callbacks, callbacks);
    }

    private onContainerScroll = () => {
        this.callbacks.scroll?.(this);
    };

    private onContainerScrollEnd = () => {
        this.callbacks.scrollEnd?.(this);
    };

    private onContainerMouseMove = (e: MouseEvent) => {
        this.callbacks.mouseMove?.(this, e);
    };

    private onContainerMouseLeave = (e: MouseEvent) => {
        this.callbacks.mouseLeave?.(this, e);
    };

    private onResize() {
        this.callbacks.resize?.(this);
    }

    private onKeyDown(e: KeyboardEvent) {
        // if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        //     // vscode같은 코드에디터에서 흔하게 사용하는 단축키.
        //     // 마우스에 손대지 않고 한두줄 정도 스크롤하고 싶은데 커서를 화면 경계까지 옮기다가 손가락에 굳은살이 생길까 염려되는 경우
        //     e.preventDefault();
        //     this.scrollNudge(e.key === "ArrowUp" ? "up" : "down");
        //     return;
        // }

        // if (e.altKey && (e.key === "2" || e.key === "3")) {
        //     e.preventDefault();
        //     this.insertManualAnchor(e.key === "2" ? "A" : "B");
        // }
    }

    scrollNudge(direction: "up" | "down", lines: number = this.options.altArrowScrollLines) {
        const fontSize = parseFloat(getComputedStyle(this.contentElement).fontSize);
        const delta = (direction === "up" ? -this.options.lineHeight : this.options.lineHeight) * lines * fontSize;
        this.rootElement.scrollBy({
            top: delta,
            behavior: "instant",
        });
    }

    insertManualAnchor(type: "A" | "B") {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        if (!this.contentElement.contains(range.commonAncestorContainer)) {
            return;
        }

        if (!range.collapsed) {
            // for safety
            return;
        }

        const manualAnchor = document.createElement(MANUAL_ANCHOR_TAG_NAME);
        manualAnchor.dataset.manualAnchor = type;
        manualAnchor.classList.add("manual-anchor");
        const html = manualAnchor.outerHTML;
        document.execCommand("insertHTML", false, html);
    }

    get isReadOnly(): boolean {
        return this._isReadOnly;
    }

    set isReadOnly(value: boolean) {
        if (this._isReadOnly === value) {
            return;
        }
        this._isReadOnly = value;
        this.contentElement.contentEditable = value ? "false" : "true";
    }

    waitForTokens(signal?: AbortSignal): Promise<TokenSnapshot> {
        if (!signal) {
            return this._tokenizingPromise;
        }

        if (signal.aborted) {
            return Promise.reject(signal.reason ?? ABORT_REASON_CANCELLED);
        }

        return new Promise<TokenSnapshot>((resolve, reject) => {
            const onAbort = () => {
                reject(signal.reason ?? ABORT_REASON_CANCELLED);
            };

            signal.addEventListener("abort", onAbort, { once: true });

            this._tokenizingPromise.then(
                (snapshot) => {
                    signal.removeEventListener("abort", onAbort);
                    resolve(snapshot);
                },
                (err) => {
                    signal.removeEventListener("abort", onAbort);
                    reject(err);
                }
            );
        });
    }

    scheduleRetokenize() {
        this.handleContentChangedInternal();
    }

    private async handleContentChangedInternal() {
        // 머리 좀 아픔... 차근차근

        // 목표:
        // 1. waitForTokens()이 항상 최신의 토큰을 기다릴 수 있도록 하는 것(중간에 tokenize가 여러번 실행되더라도 끊김 없이 항상 마지막 tokenize 결과를 기다릴 수 있도록)
        // 2. 실제로 바쁜 경우에만 debounce 적용하고 그렇지 않으면 즉시 실행.

        // 지금 바쁜지 안바쁜지...
        let isBusy = false;

        // 기존 작업이 있다면 즉시 취소.
        if (this.tokenizeAbortController) {
            this.tokenizeAbortController.abort(ABORT_REASON_CANCELLED);
            this.tokenizeAbortController = null;
            isBusy = true;
        }

        // 예약된 debounce가 있다면 역시 취소.
        if (this.tokenizeDebounceTimer) {
            clearTimeout(this.tokenizeDebounceTimer);
            this.tokenizeDebounceTimer = null;
            isBusy = true;
        }

        // 아직 resolve/reject 되지 않은 pending promise가 없다면 새로운 promise를 만들고 resolver/rejecter 보관...
        // 호출하는 쪽에서 waitForTokens로 항상 최신의 토큰을 await 할 수 있도록.
        if (!this._hasPendingPromise) {
            this._tokenizingPromise = new Promise((resolve, reject) => {
                this._tokenizingPromiseResolver = resolve;
                this._tokenizingPromiseRejecter = reject;
            });
            this._hasPendingPromise = true;
        }

        // 내용이 바뀌었으므로 기존의 내용은 이미 잘못된 내용을 가르키고 있을 확률이 높다.
        // 더이상 잘못된 값을 참조하지 못하도록...
        this.wholeText = NULL_TOKEN_SNAPSHOT.wholeText;
        this.tokens = NULL_TOKEN_SNAPSHOT.tokens;
        this.lineBoundaries = NULL_TOKEN_SNAPSHOT.lineBoundaries;
        this.sectionHeadings = NULL_TOKEN_SNAPSHOT.sectionHeadings;

        // engine이 workflow를 시작할 수 있도록 이벤트를 발생시킴.
        this.callbacks.contentChanging?.(this);

        if (isBusy) {
            this.tokenizeDebounceTimer = setTimeout(() => {
                this.executeTokenization();
            }, TOKENIZE_DEBOUNCE_DELAY_MS);
        } else {
            this.executeTokenization();
        }
    }

    private executeTokenization() {
        if (this.tokenizeAbortController) {
            this.tokenizeAbortController.abort(ABORT_REASON_CANCELLED);
            this.tokenizeAbortController = null;
        }

        if (this.tokenizeDebounceTimer) {
            clearTimeout(this.tokenizeDebounceTimer);
            this.tokenizeDebounceTimer = null;
        }

        const controller = new AbortController();
        this.tokenizeAbortController = controller;

        tokenize(this.contentElement, controller.signal, this.tokenizeOptions)
            .then(({ wholeText, tokens, lineBoundaries, sectionHeadings, containers, elapsed }) => {
                if (this.tokenizeAbortController === controller) {
                    this.wholeText = wholeText;
                    this.tokens = tokens;
                    this.lineBoundaries = lineBoundaries;
                    this.sectionHeadings = sectionHeadings;
                    this.containers = containers;
                    this._hasPendingPromise = false;

                    this._tokenizingPromiseResolver?.({
                        wholeText: wholeText,
                        tokens: tokens,
                        lineBoundaries: lineBoundaries,
                        sectionHeadings: sectionHeadings,
                        containers: containers,
                        elapsedTime: elapsed,
                    });

                    this.callbacks.contentChanged?.(this);
                }
            }).catch((err) => {
                if (this.tokenizeAbortController === controller) {
                    // console.error(this.name, "Tokenization error:", err);
                    this._tokenizingPromiseRejecter?.(err);
                }
            }).finally(() => {
                if (this.tokenizeAbortController === controller) {
                    this.tokenizeAbortController = null;
                    this._hasPendingPromise = false;
                }
            });
    }

    private onMutation(_mutations: MutationRecord[]) {
        if (this.contentElement.childNodes.length === 0) {
            this.contentElement.appendChild(INITIAL_CONTENT_HTML.cloneNode(true));
        }
    }

    private observeMutation() {
        this.mutationObserver.observe(this.contentElement, {
            childList: true,
            // subtree: true,
        });
    }

    private unobserveMutation() {
        this.mutationObserver.disconnect();
    }

    private onCopy(e: ClipboardEvent) {
        this.callbacks.copy?.(this, e);
    }

    // 사용자가 붙여넣기를 하는 순간 실행되어야 하고
    // 붙여넣기 직후에 추가 입력을 할 수도 있기 때문에 동기로 처리
    private onPaste(e: ClipboardEvent) {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        if (!this.contentElement.contains(range.commonAncestorContainer)) {
            return;
        }

        e.preventDefault();

        let isHTML = true;
        let data = e.clipboardData?.getData("text/html") ?? "";
        if (!data) {
            isHTML = false;
            data = e.clipboardData?.getData("text/plain") ?? "";
        }

        this.setContent({
            text: data,
            asHTML: isHTML,
            targetRange: range,
            allowLegacyExecCommand: data.length <= MAX_LENGTH_FOR_EXECCOMMAND_PASTE,
        });
    }

    getSelectionRange(): Range | null {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (this.contentElement.contains(range.startContainer) && this.contentElement.contains(range.endContainer)) {
            return range;
        }
        return null;
    }

    async pasteBomb(plaintextOnly: boolean = false) {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            console.warn("Clipboard API is not available in this browser");
            return;
        }

        const startTime = performance.now();

        try {
            const items = await navigator.clipboard.read();
            let foundItem: ClipboardItem | null = null;
            let foundType: string | null = null;

            if (!plaintextOnly) {
                for (const item of items) {
                    if (item.types.includes("text/html")) {
                        foundItem = item;
                        foundType = "text/html";
                        break;
                    }
                }
            }
            if (!foundItem) {
                for (const item of items) {
                    if (item.types.includes("text/plain")) {
                        foundItem = item;
                        foundType = "text/plain";
                        break;
                    }
                }
            }

            if (!foundItem) {
                return false;
            }

            const text = await (await foundItem.getType(foundType!)).text();
            this.setContent({
                text,
                asHTML: foundType === "text/html",
                targetRange: undefined, // 전체 내용 교체
                allowLegacyExecCommand: false, // bomb투하 이전으로 돌아가는건 허용 안함.
            });

            const endTime = performance.now();
            console.debug(this.name, "Paste bomb operation took", endTime - startTime, "ms");
            return true;
        } finally {
            this.contentElement.classList.remove("busy");
        }
    }

    setContent({
        text,
        asHTML = true,
        targetRange = undefined,
        allowLegacyExecCommand = true,
    }: {
        text: string;
        asHTML?: boolean;
        targetRange?: Range;
        allowLegacyExecCommand?: boolean;
    }) {
        let sanitized: Node;

        if (asHTML) {
            sanitized = sanitizeHTML(text);
        } else {
            sanitized = paragraphizePlainText(text);
        }

        try {
            this.unobserveMutation();
            if (targetRange === undefined) {
                this.contentElement.innerHTML = "";
                this.contentElement.appendChild(sanitized);
                this.handleContentChangedInternal();
            } else if (this.contentElement.contains(targetRange.startContainer) && this.contentElement.contains(targetRange.endContainer)) {
                if (allowLegacyExecCommand && text.length <= MAX_LENGTH_FOR_EXECCOMMAND_PASTE) {
                    // 이정도 길이면 execCommand("insertHTML", ...)를 써도 참을만 하지 않을까?
                    // execCommand("insertHTML", ...)는 느리다. 100배 느리다. undo/redo는 포기하고 싶지 않지만 포기하고 싶을정도로 느리다.
                    // undo/redo는 단순히 내용만 stack에 쌓는다고 해결될 문제가 아니다. 커서의 위치와 선택범위, 트랜잭션, 스크롤 위치, ... 이걸 다 해야된다면 아예 아무것도 안하는 것이...
                    const div = document.createElement("DIV");
                    div.appendChild(sanitized);
                    const sanitizedHTML = div.innerHTML;
                    document.execCommand("insertHTML", false, sanitizedHTML);
                } else {
                    // 이 경우는 range를 사용해서 직접 삽입함.
                    targetRange.deleteContents();
                    let hasBlockElements = false;
                    for (const child of sanitized.childNodes) {
                        if (BLOCK_ELEMENTS[child.nodeName]) {
                            hasBlockElements = true;
                            break;
                        }
                    }

                    if (hasBlockElements) {
                        targetRange = this.ensureInsertableRange(targetRange, true);
                    }

                    targetRange.insertNode(sanitized);
                    targetRange.collapse(false);
                    this.handleContentChangedInternal();
                }
            } else {
                throw new Error("Target range is not within the editor");
            }
        } finally {
            this.observeMutation();
        }
    }

    selectAll() {
        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(this.contentElement);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        }
        return false;
    }

    /**
     * 주어진 range에 해당하는 토큰 인덱스를 [start, end)로 반환.
     * collapsed인 경우 right-sticking: 커서 오른쪽에 닿은 토큰만 포함.
     * 겹치는 토큰이 없으면 빈 span {i, i} 반환 (커서/선택이 갭에 있는 경우).
     * range가 contentElement 밖에 있으면 null 반환.
     *
     * @param range DOM Range
     * @returns 토큰 구간 [start, end), 또는 contentElement 밖이면 null.
     */
    getTokenSpanForRange(range: Range): Span | null {
        const el = this.contentElement;
        if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
            return null;
        }

        const tokens = this.tokens;
        const n = tokens.length;

        // A|B 경계 보정: caret이 텍스트 노드 끝이면 다음 텍스트 시작으로 이동 (collapsed 유지)
        let r = range;
        if (r.collapsed && r.endContainer.nodeType === 3 && r.endOffset === (r.endContainer.nodeValue?.length ?? 0)) {
            const adj = findAdjacentTextNode(r.endContainer, true);
            if (adj) {
                const clone = document.createRange();
                clone.setStart(adj, 0);
                clone.setEnd(adj, 0);
                r = clone;
            }
        }

        // tokenRange: 이진탐색 재사용 스크래치 range.
        // START_TO_END 비교(token.end vs r.start)에서는 end만, END_TO_START 비교(token.start vs r.end)에서는 start만 업데이트.
        const tokenRange = document.createRange();
        tokenRange.setStart(el, 0);
        tokenRange.setEnd(el, 0);

        // collapsed
        if (r.collapsed) {
            // i = token.end > caret 인 첫 토큰 (START_TO_END: tokenRange.end vs r.start)
            let i = n;
            {
                let lo = 0, hi = n - 1;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    setEndFromTokenRange(tokenRange, tokens[mid]);
                    const cmp = tokenRange.compareBoundaryPoints(Range.START_TO_END, r);
                    if (cmp > 0) { i = mid; hi = mid - 1; }
                    else lo = mid + 1;
                }
            }

            if (i === n) return { start: n, end: n };

            // token.start <= caret 이면 { i, i+1 }, 아니면 { i, i }
            SetStartEndFromTokenRange(tokenRange, tokens[i]);
            const cmpStart = tokenRange.compareBoundaryPoints(Range.END_TO_START, r);
            return cmpStart <= 0 ? { start: i, end: i + 1 } : { start: i, end: i };
        }

        // non-collapsed
        // start = token.end > r.start 인 첫 토큰 (START_TO_END: tokenRange.end만 업데이트)
        let start = n;
        {
            let lo = 0, hi = n - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                setEndFromTokenRange(tokenRange, tokens[mid]);
                const cmp = tokenRange.compareBoundaryPoints(Range.START_TO_END, r);
                if (cmp > 0) { start = mid; hi = mid - 1; }
                else lo = mid + 1;
            }
        }

        // end = token.start >= r.end 인 첫 토큰 (END_TO_START: tokenRange.start만 업데이트)
        // end 앵커를 마지막 토큰 끝으로 재설정해서 start 업데이트 시 유효성 유지
        if (n > 0) setEndFromTokenRange(tokenRange, tokens[n - 1]);
        let end = n;
        {
            let lo = start, hi = n - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                setStartFromTokenRange(tokenRange, tokens[mid]);
                const cmp = tokenRange.compareBoundaryPoints(Range.END_TO_START, r);
                if (cmp >= 0) { end = mid; hi = mid - 1; }
                else lo = mid + 1;
            }
        }

        return { start, end };
    }

    getTokenRange(index: number, end: number = index + 1, trimStructural = true): Range {
        if (trimStructural) {
            while (index < end && (this.tokens[index]?.flags & TOKEN_FLAGS_STRUCTURAL_OPEN)) index++;
            while (end > index && (this.tokens[end - 1]?.flags & TOKEN_FLAGS_STRUCTURAL_CLOSE)) end--;
        }

        const count = end - index;

        if (count === 1 && index >= 0 && index < this.tokens.length) {
            const token = this.tokens[index];
            return createRangeFromTokenRange(token);
        }

        const range = document.createRange();
        if (count > 0) {
            const startToken = this.tokens[index];
            const endToken = this.tokens[index + count - 1];
            if (startToken) {
                setStartFromTokenRange(range, startToken);
            } else {
                if (import.meta.env.DEV) {
                    console.warn(this.name, "getTokenRange: start token not found for index", index);
                }
                range.setStart(this.contentElement, 0);
            }
            if (endToken) {
                setEndFromTokenRange(range, endToken);
            } else {
                if (import.meta.env.DEV) {
                    console.warn(this.name, "getTokenRange: end token not found for index", index + count - 1);
                }
                range.setEnd(this.contentElement, this.contentElement.childNodes.length);
            }
        } else {
            const prevToken = this.tokens[index - 1];
            if (prevToken) {
                setStartAfterToken(range, prevToken);
            } else {
                range.setStart(this.contentElement, 0);
            }

            const nextToken = this.tokens[index];
            if (nextToken) {
                setEndBeforeToken(range, nextToken);
                // setEndFromTokenRange(range, nextToken.range);
            } else {
                range.setEnd(this.contentElement, this.contentElement.childNodes.length);
            }
        }
        return range;
    }

    scrollTo(offset: number, options?: ScrollOptions) {
        if (this.rootElement && this.rootElement.scrollTop !== offset) {
            this.rootElement.scrollTo({
                top: offset,
                behavior: options?.behavior,
            });
        }
    }

    focus() {
        this.contentElement.focus();
    }

    contains(range: Range): boolean {
        if (!range || !this.contentElement.contains(range.startContainer) || !this.contentElement.contains(range.endContainer)) {
            return false;
        }
        return true;
    }

    get contentHeight(): number {
        return this.contentElement.offsetHeight;
    }

    get scrollHeight(): number {
        return this.rootElement?.scrollHeight ?? 0;
    }

    set height(value: number) {
        const editorHeight = this.contentElement.offsetHeight;
        const delta = value - editorHeight;
        if (delta < 0) {
            console.warn("WTF? The taller the better", this.name, value, editorHeight);
            return;
        }
        if (delta > 0) {
            this.heightBoostElement.style.setProperty("--height-boost", delta + "px");
        } else {
            this.heightBoostElement.style.removeProperty("--height-boost");
        }
    }

    forceReflow() {
        void this.rootElement.offsetHeight; // force reflow
    }

    // 텍스트노드, 인라인노드, P태그 안에는 블럭요소를 집어넣으면 안되지만 contenteditable 안에서 브라우저는 그런걸 제어해주지 않음.
    // 몇번 붙여넣기 하다보면 <SPAN> 태그 안에 <P>, <DIV>, <TABLE>들이 들어가 있는 광경을 보게 된다.
    // 따라서 붙여넣기 하기 전에 insertion point를 확인하고 텍스트노드이거나 인라인요소 사이를 반으로 쪼개야 한다.
    // 그리고 이 작업은 부모를 거슬러올라가면서 계속... 해야함.
    ensureInsertableRange(range: Range, forBlock: boolean, allowSplitting: boolean = false): Range {
        if (range.startContainer.nodeType !== 1 && range.startContainer.nodeType !== 3) {
            throw new Error("Range start container is not a text node or an element");
        }

        if (!this.contentElement.contains(range.startContainer)) {
            throw new Error("Range start container is not within the editor");
        }

        if (forBlock) {
            let container = range.startContainer;
            let offset = range.startOffset;

            if (container.nodeType === 3) {
                if (offset === 0) {
                    // 텍스트노드의 시작부분. 텍스트노드를 쪼갤 필요 없이 텍스트 노드 앞으로 삽입하면 됨.
                    offset = Array.prototype.indexOf.call(container.parentNode!.childNodes, container);
                    range.setStartBefore(container);
                } else if (offset === container.nodeValue!.length) {
                    // 텍스트노드의 끝부분. 텍스트노드를 쪼갤 필요 없이 텍스트 노드 뒤로... 삽입 +_+
                    offset = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
                    range.setStartAfter(container);
                } else {
                    // 블럭요소가 들어갈 수 있도록 벌려야함 +_+
                    const prevText = document.createTextNode(container.nodeValue!.slice(0, offset));
                    container.nodeValue = container.nodeValue!.slice(offset);
                    container.parentNode!.insertBefore(prevText, container);
                    offset = Array.prototype.indexOf.call(container.parentNode!.childNodes, container);
                    range.setStartAfter(prevText);
                }
                container = range.startContainer;
            }

            // void 요소나 textless 요소(tr,...)등을 고려해야할까?
            // 정상적인 상황이라면 그런 일은 절대로 나오지... 않음.
            let adjusted = false;
            while (
                container !== this.contentElement &&
                container.nodeName !== "TD" &&
                container.nodeName !== "TH" &&
                (container.nodeName === "P" || !BLOCK_ELEMENTS[container.nodeName]) // 블럭요소는 쪼갤 필요 없지만 P는 쪼개야함
            ) {
                const parentNode = container.parentNode!;
                if (offset === 0) {
                    offset = Array.prototype.indexOf.call(parentNode!.childNodes, container);
                    container = parentNode;
                } else if (offset === container.childNodes.length) {
                    offset = Array.prototype.indexOf.call(parentNode!.childNodes, container) + 1;
                    container = parentNode;
                } else {
                    const clone = container.cloneNode(false);
                    for (let i = 0; i < offset; i++) {
                        clone.appendChild(container.firstChild!);
                    }
                    parentNode.insertBefore(clone, container);
                    offset = Array.prototype.indexOf.call(parentNode!.childNodes, container);
                }
                container = parentNode;
                adjusted = true;
            }

            if (adjusted) {
                range = range.cloneRange();
                range.setStart(container, offset);
                range.collapse(true);
            }
        }

        return range;
    }

    saveScrollPosition(): boolean {
        const root = this.rootElement;
        const content = this.contentElement;

        const rootRect = root.getBoundingClientRect();

        let ref: HTMLElement | null = null;

        const probeY = rootRect.top + 20;
        const steps = Math.max(4, Math.floor(rootRect.width / 80));

        for (let i = 0; i <= steps; i++) {
            const x = rootRect.left + (rootRect.width * i) / steps;
            const stack = document.elementsFromPoint(x, probeY);
            const hit = stack.find(e => e !== content && content.contains(e)) as HTMLElement | undefined;
            if (hit) {
                ref = hit;
                break;
            }
        }

        if (!ref) {
            const walker = document.createTreeWalker(
                content,
                NodeFilter.SHOW_ELEMENT,
                null
            );

            let node = walker.nextNode() as HTMLElement | null;

            while (node) {
                const rect = node.getBoundingClientRect();

                const verticallyVisible =
                    rect.bottom > rootRect.top &&
                    rect.top < rootRect.bottom;

                const hasBox = rect.height > 0;

                if (verticallyVisible && hasBox) {
                    ref = node;
                    break;
                }

                node = walker.nextNode() as HTMLElement | null;
            }
        }

        if (!ref) {
            return false;
        }

        const refRect = ref.getBoundingClientRect();
        const targetTop = refRect.top - rootRect.top;

        this.savedScroll = {
            ref,
            targetTop
        };

        return true;
    }

    restoreScrollPosition(): boolean {
        const saved = this.savedScroll;
        if (!saved) return false;

        const { ref, targetTop } = saved;
        if (ref.isConnected) {
            const root = this.rootElement;
            const rootRect = root.getBoundingClientRect();
            const refRect = ref.getBoundingClientRect();

            const currentTop = refRect.top - rootRect.top;
            const delta = currentTop - targetTop;

            root.scrollTop += delta;
        }

        this.savedScroll = null;
        return true;
    }
}
