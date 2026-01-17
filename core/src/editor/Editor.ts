import { ABORT_REASON_CANCELLED, ANCHOR_TAG_NAME, BLOCK_ELEMENTS, CONTAINER_TAGS, DIFF_TAG_NAME, MANUAL_ANCHOR_TAG_NAME, VOID_ELEMENTS } from "../constants";
import { paragraphizePlainText } from "../helpers/paragraphizePlainText";
import { tokenize } from "../tokenization/tokenizer";
import { createRangeFromTokenRange, setEndBeforeToken, setEndFromTokenRange, setStartAfterToken, SetStartEndFromTokenRange, setStartFromTokenRange } from "../helpers/tokenRangeHelpers";
import type { EditorContext, EditorName, EditorSettings, LineStartPoint, Rect, Span, Token } from "../types";
import { findAdjacentTextNode } from "../utils/findAdjacentTextNode";
import { advanceNode } from "../utils/advanceNode";
import { findCommonAncestor } from "../utils/findCommonAncestor";
import { TokenFlags } from "../TokenFlags";
import { sanitizeHTML } from "../sanitize/sanitize";

const MAX_LENGTH_FOR_EXECCOMMAND_PASTE = 200_000;

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

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
    lineHeight: 1.5,
    altArrowScrollLines: 3
};

export class Editor implements EditorContext {
    readonly name: EditorName;
    readonly rootElement: HTMLElement;
    readonly contentElement: HTMLElement;
    readonly heightBoostElement: HTMLElement;
    readonly minimapElement: HTMLElement;

    wholeText: string = "";
    tokens: readonly Token[] = [];
    lineStartPoints: readonly LineStartPoint[] = [];
    settings: EditorSettings;
    mutationObserver: MutationObserver;
    callbacks: EditorCallbacks = {};
    _isSyncMode: boolean = false;
    // mountHelper: ReturnType<typeof mountHelper>;
    resizeObserver = new ResizeObserver(() => this.onResize());
    // tokenizer: Tokenizer = new Tokenizer();
    tokenizeAbortController: AbortController | null = null;

    constructor(name: EditorName, settings: Partial<EditorSettings> = {}) {
        this.name = name;
        this.settings = {
            ...DEFAULT_EDITOR_SETTINGS,
            ...settings,
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
        if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            // vscode같은 코드에디터에서 흔하게 사용하는 단축키.
            // 마우스에 손대지 않고 한두줄 정도 스크롤하고 싶은데 커서를 화면 경계까지 옮기다가 손가락에 굳은살이 생길까 염려되는 경우
            e.preventDefault();
            this.scrollNudge(e.key === "ArrowUp" ? "up" : "down");
            return;
        }

        if (e.altKey && (e.key === "2" || e.key === "3")) {
            e.preventDefault();
            this.insertManualAnchor(e.key === "2" ? "A" : "B");
        }
    }

    scrollNudge(direction: "up" | "down", lines: number = this.settings.altArrowScrollLines) {
        const fontSize = parseFloat(getComputedStyle(this.contentElement).fontSize);
        const delta = (direction === "up" ? -this.settings.lineHeight : this.settings.lineHeight) * lines * fontSize;
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

    get isSyncMode(): boolean {
        return this._isSyncMode;
    }

    set isSyncMode(value: boolean) {
        if (this._isSyncMode === value) {
            return;
        }
        this._isSyncMode = value;
        this.contentElement.contentEditable = value ? "false" : "true";
    }

    get container() {
        return this.rootElement;
    }

    get contentEditableElement(): HTMLElement {
        return this.contentElement;
    }

    get scrollTop(): number {
        return this.rootElement?.scrollTop ?? 0;
    }

    set scrollTop(value: number) {
        if (this.rootElement) {
            this.rootElement.scrollTop = value;
        }
    }

    get scrollLeft(): number {
        return this.rootElement?.scrollLeft ?? 0;
    }

    set scrollLeft(value: number) {
        if (this.rootElement) {
            this.rootElement.scrollLeft = value;
        }
    }




    private async handleContentChangedInternal() {
        this.callbacks.contentChanging?.(this);
        this.tokens = [];
        try {
            await this.doTokenize();
            //console.debug(this.editorName, "tokenize done", this.tokens);
            this.callbacks.contentChanged?.(this);
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                // console.debug(this.editorName, "Tokenization cancelled");
            } else {
                console.error(this.name, "Tokenization error:", err);
            }
        }
    }

    private onMutation(_mutations: MutationRecord[]) {
        if (this.contentElement.childNodes.length === 0) {
            this.contentElement.appendChild(INITIAL_CONTENT_HTML.cloneNode(true));
        }
        // console.log(mutations)
    }

    private observeMutation() {
        this.mutationObserver.observe(this.contentElement, {
            childList: true,
            subtree: true,
            //attributes: true,
            //characterData: true,
        });
    }

    private unobserveMutation() {
        this.mutationObserver.disconnect();
    }

    private async doTokenize() {
        if (this.tokenizeAbortController) {
            console.log("abort away!")
            this.tokenizeAbortController.abort(ABORT_REASON_CANCELLED);
        }
        this.tokenizeAbortController = new AbortController();
        try {
            const { wholeText, tokens, lineStartPoints, elapsed } = await tokenize(this.contentElement, {
                signal: this.tokenizeAbortController.signal,
            });
            // console.log("tokenization result:", { wholeText, tokens, lineStartPoints, elapsed });

            if (import.meta.env.DEV) {
                console.debug(this.name, `Tokenization completed in ${elapsed.toFixed(2)} ms, ${tokens.length} tokens found.`);
            }

            this.tokenizeAbortController = null;
            this.wholeText = wholeText;
            this.tokens = tokens;
            this.lineStartPoints = lineStartPoints;
        } catch (err) {
            if (err === ABORT_REASON_CANCELLED) {
                console.warn(this.name, "Tokenization cancelled");
                // swallow
            } else {
                throw err;
            }
        }
    }

    private onCopy(e: ClipboardEvent) {
        this.callbacks.copy?.(this, e);
    }

    // 사용자가 붙여넣기를 하는 순간 실행되어야 하고
    // 붙여넣기 직후에 추가 입력을 할 수도 있기 때문에 동기로 처리
    private onPaste(e: ClipboardEvent) {
        console.log("pasting...")
        const startTime = performance.now();

        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        if (!this.contentElement.contains(range.commonAncestorContainer)) {
            return;
        }

        e.preventDefault();

        // const items = e.clipboardData?.items;
        // if (items) {
        //     for (const item of items) {
        //         if (item.type.startsWith("image/")) {
        //             const file = item.getAsFile();
        //             if (file) {
        //                 // MS Office는 이미지 이름을 보통 이런 식으로 매김
        //                 console.log("Pasted image file:", file.name, file.type, file.size);
        //             }
        //         } else {
        //             console.log("Non-image clipboard item:", item.type);
        //         }
        //     }
        // } else {
        //     console.log("No clipboard items available");
        // }

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
        const endTime = performance.now();
        console.debug(this.name, "Paste operation took", endTime - startTime, "ms");
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

    /**
     * 폭탄 붙여넣기! 왜 bomb인가? 되돌릴 수 없기 때문. ctrl-z 안먹힘.
     * 전체 내용을 클립보드의 내용으로 교체함.
     * 또한 클립보드 액세스를 가능하게 하는 사용자의 동작 없이 실행이 되므로 브라우저에서 "허용" 여부를 묻는 경고창이 뜰 수 있음.
     */
    private async pasteBomb(plaintextOnly: boolean = false) {
        const startTime = performance.now();

        if (!navigator.clipboard || !navigator.clipboard.read) {
            throw new Error("Clipboard API is not available in this browser");
        }

        //this.editor.contentEditable = "false";
        this.contentElement.classList.add("busy");

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
            //this.editor.contentEditable = "true";
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
     * range가 collapsed인 경우 range와 오른쪽으로 붙어있는 토큰만 포함함.
     *
     * @param range DOM Range
     * @returns 겹치는 구간이 있으면 [start, end)를 객체로 반환, 없으면 null 반환.
     */
    getTokenSpanForRange(range: Range): Span | null {
        const tokens = this.tokens;
        const n = tokens.length;
        //if (n === 0) return null;

        // A|B 경계 보정: caret이 텍스트 노드 끝이면 다음 텍스트 시작으로 end 이동
        let r = range;
        if (r.collapsed && r.endContainer.nodeType === 3 && r.endOffset === (r.endContainer.nodeValue?.length ?? 0)) {
            const adj = findAdjacentTextNode(r.endContainer, true);
            if (adj) {
                const clone = r.cloneRange();
                clone.setEnd(adj, 0);
                r = clone;
            }
        }

        const tokenRange = document.createRange();

        // collapsed
        if (r.collapsed) {
            // i = token.end > caret 인 첫 토큰  (START_TO_END: this.end ? other.start)
            let i = n;
            {
                let lo = 0,
                    hi = n - 1;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    const t = tokens[mid];
                    SetStartEndFromTokenRange(tokenRange, t);
                    const cmp = tokenRange.compareBoundaryPoints(Range.START_TO_END, r);
                    if (cmp > 0) {
                        i = mid;
                        hi = mid - 1;
                    } else {
                        lo = mid + 1;
                    }
                }
            }

            if (i === n) return { start: n, end: n }; // 마지막 뒤

            // token.start <= caret 이면 { i, i+1 }, 아니면 { i, i }
            // END_TO_START: this.start ? other.end
            const t = tokens[i];
            SetStartEndFromTokenRange(tokenRange, t);
            const cmpStart = tokenRange.compareBoundaryPoints(Range.END_TO_START, r);
            return cmpStart <= 0 ? { start: i, end: i + 1 } : { start: i, end: i };
        }

        // non-collapsed
        // start = token.end > r.start 인 첫 토큰
        let start = n;
        {
            let lo = 0,
                hi = n - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                const t = tokens[mid];
                SetStartEndFromTokenRange(tokenRange, t);
                const cmp = tokenRange.compareBoundaryPoints(Range.START_TO_END, r); // token.end ? r.start
                if (cmp > 0) {
                    start = mid;
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
        }
        if (start === n) return null;

        // end = token.start >= r.end 인 첫 토큰
        let end = n;
        {
            let lo = start,
                hi = n - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                const t = tokens[mid];
                SetStartEndFromTokenRange(tokenRange, t);
                const cmp = tokenRange.compareBoundaryPoints(Range.END_TO_START, r); // token.start ? r.end
                if (cmp >= 0) {
                    end = mid;
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
        }

        if (end <= start) return null;

        return { start, end };
    }

    getTokenRange(index: number, end: number = index + 1): Range {
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
        if (!this.rootElement) {
            return;
        }

        if (this.rootElement.scrollTop !== offset) {
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
        // force reflow
        if (!this.rootElement) {
            return;
        }
        //this.wrapper.style.display = "none";
        void this.rootElement.offsetHeight; // force reflow
        //void this.editor.offsetHeight; // force reflow
        //this.wrapper.style.display = "";
    }

    getBoundingClientRect(): Rect {
        if (!this.rootElement) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return this.rootElement.getBoundingClientRect();
    }

    getScroll(): [x: number, y: number] {
        if (!this.rootElement) {
            return [0, 0];
        }
        return [this.rootElement.scrollLeft, this.rootElement.scrollTop];
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

    lastMarkerEl: Element | null = null;

    getOrInsertDiffElement(tokenIndex: number, hint: TokenFlags) {
        // 앞 방향으로 찾음.
        // 그냥 common ancestor를 찾고
        // 그 사이에 넣으면 되지 않나...
        // <div>hello></div>(here)<div>world</div>
        // <div>hello(here)<br>world</div>

        let which: Node | null = null;
        let where: InsertPosition | null = null;

        if (tokenIndex === 0) {
            which = this.contentElement;
            where = "afterbegin";
        } else {
            const prevToken = this.tokens[tokenIndex - 1];
            const nextToken = this.tokens[tokenIndex];
            const root = this.contentElement;

            let a: Node | null = prevToken.endNode;
            let b: Node | null = nextToken.startNode;

            let da = 0, db = 0;
            for (let n = a; n && n != root; n = n.parentNode!) da++;
            for (let n = b; n && n != root; n = n.parentNode!) db++;
            if (!a || !b) return null;

            let prevChild: Node | null = null;
            while (da > db && a) {
                prevChild = a;
                a = a.parentNode;
                da--;
            }
            while (db > da && b) {
                b = b.parentNode;
                db--;
            }

            while (a && b) {
                if (a === b) break;
                prevChild = a;
                a = a.parentNode;
                b = b.parentNode;
            }

            if (!a || !prevChild) return null;
            which = prevChild;
            where = "afterend";
        }

        if (!which || !where) {
            return null;
        }

        let el: HTMLElement | null = null;
        if (where === "afterend") {
            el = which.nextSibling as HTMLElement;
        } else {
            el = which.firstChild as HTMLElement;
        }

        if (!el || el.nodeName !== DIFF_TAG_NAME) {
            const insertBefore = el;
            el = document.createElement(DIFF_TAG_NAME);
            if (where === "afterend") {
                which.parentElement!.insertBefore(el, insertBefore);
            } else {
                (which as Element).insertAdjacentElement("afterbegin", el);
            }
        }

        return el;
    }

    getOrInsertAnchorElement(tokenIndex: number) {
        // 앞으로 쭉 거슬러 올라가면서 줄바꿈 경계를 찾음
        // <span>hello<br></span>world 같은 변태적인 상황을 고려하려면
        // 단순히 이전 형제와 부모로만 이동할 것이 아니라 형제의 자손 방향으로도 탐색해야 함.
        // 이전 형제로 시작
        // 자식이 있으면 마지막 자식(재귀)
        // 이전 형제가 없으면 현재 노드가 부모의 몇 번째 노드인지 확인한 후 부모로 이동
        // 부모 확인 후 부모의 이전 형제(자식은 이미 확인했음)
        // 아 존나 복잡하다
        // 토큰화 단계에서 이런 위치들을 미리 점 찍어 놓을 수 있지만... 책임이 과한 것 같아...
        // 

        if (import.meta.env.DEV) {
            console.assert(tokenIndex >= 0 && tokenIndex < this.tokens.length, `Invalid token index: ${tokenIndex}`);
        }

        let where: InsertPosition | null = null;
        let which: Node | null = null;

        if (this.tokens.length === 0) {
            where = "afterbegin";
            which = this.contentElement;
        } else {
            const token = this.tokens[tokenIndex];
            ({ which, where } = this.lineStartPoints[token.lineNumber - 1]);
        }

        if (!where || !which) {
            // console.warn(this.name, "getOrInsertAnchorElement: could not determine insertion point for token index", tokenIndex);
            return null;
        }
        // console.log("Inserting anchor at", this.name, { which, where });

        let anchorEl: HTMLElement | null = null;
        if (where === "afterend") {
            anchorEl = which.nextSibling as HTMLElement;
            if (!anchorEl || anchorEl.nodeName !== ANCHOR_TAG_NAME) {
                anchorEl = document.createElement(ANCHOR_TAG_NAME);
                which.parentElement!.insertBefore(anchorEl, which.nextSibling);
                //which.insertAdjacentElement("afterend", anchorEl);
            }
        } else if (where === "beforebegin") {
            anchorEl = which.previousSibling as HTMLElement;
            if (!anchorEl || anchorEl.nodeName !== ANCHOR_TAG_NAME) {
                anchorEl = document.createElement(ANCHOR_TAG_NAME);
                which.parentElement!.insertBefore(anchorEl, which);
                // which.insertAdjacentElement("beforebegin", anchorEl);
            }
        } else if (where === "afterbegin") {
            anchorEl = which.firstChild as HTMLElement;
            if (!anchorEl || anchorEl.nodeName !== ANCHOR_TAG_NAME) {
                anchorEl = document.createElement(ANCHOR_TAG_NAME);
                (which as Element).insertAdjacentElement("afterbegin", anchorEl);
            }
        } else if (where === "beforeend") {
            anchorEl = which.lastChild as HTMLElement;
            if (!anchorEl || anchorEl.nodeName !== ANCHOR_TAG_NAME) {
                anchorEl = document.createElement(ANCHOR_TAG_NAME);
                (which as Element).insertAdjacentElement("beforeend", anchorEl);
            }
        }

        this.lastMarkerEl = anchorEl;
        return anchorEl;
    }
}
