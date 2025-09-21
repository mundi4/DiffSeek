import type { EditorName } from "@/core/types";
import { TokenizeContext, type RichToken, type TokenizeResult } from "@/core/tokenization/TokenizeContext";
import { BLOCK_ELEMENTS, LINE_HEIGHT, TEXT_FLOW_CONTAINERS } from "@/core/constants/index";
import { sanitizeHTML } from "@/core/sanitize";
import { createParagraphsFromText } from "@/utils/createParagraphsFromText";
import { findAdjacentTextNode } from "@/utils/findAdjacentTextNode";
import type { EditorContext } from "@/core/EditorContext";
import { mountHelper } from "@/utils/mountHelper";
import { createRangeFromTokenRange, setEndBeforeToken, setEndFromTokenRange, setStartAfterToken, SetStartEndFromTokenRange, setStartFromTokenRange } from "./utils/tokenRangeUtils";
import type { ImageLoadResult } from "./imageCache";

export type EditorCallbacks = {
	contentChanging: (editor: Editor) => void;
	contentChanged: (editor: Editor) => void;
	scroll: (editor: Editor) => void;
	scrollEnd: (editor: Editor) => void;
	resize: (editor: Editor) => void;
	focus: (editor: Editor) => void;
	blur: (editor: Editor) => void;
	click: (editor: Editor, event: MouseEvent) => void;
	copy: (editor: Editor, event: ClipboardEvent) => void;
	mouseMove: (editor: Editor, e: MouseEvent) => void;
	mouseLeave: (editor: Editor, e: MouseEvent) => void;
};

/**
 * 붙여넣기를 할때 `execCommand("paste", ...)`를 사용할 최대 길이
 */
const MAX_LENGTH_FOR_EXECCOMMAND_PASTE = 200_000;

const INITIAL_EDITOR_HTML = document.createElement("P");
INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));

/**
 * Editor
 *
 * Editor라 쓰고 contenteditable라 읽는다. 별다른 기능이 없다는 뜻...
 * 그냥 입력된 내용을 토큰화한 뒤 이벤트를 발생시켜서 알려주는 것이 주 역할임.
 *
 * 토큰화는 변경이 감지되면 상당히 일찍(100ms? ain't nobody got time for that) 수행되지만
 * 연속적인 변경이 감지되면 이전 작업은 취소되고 새로 작업이 시작됨.
 *
 * mount메서드로 DOM에 추가하고 unmount로 제거함. 이렇게 번거로운 방법을 쓰는 이유? React 컴포넌트에 붙이려고...
 */
export class Editor implements EditorContext {
	#wrapper: HTMLElement;
	#editorName: EditorName;
	#editor = document.createElement("div");
	#heightBoost: HTMLElement = document.createElement("div");
	// #wrapper: HTMLElement; // = document.createElement("div");
	#mutationObserver: MutationObserver;
	#tokens: RichToken[] = [];
	#imageMap: Map<RichToken, ImageLoadResult> = new Map();
	#tokenizeContext: TokenizeContext | null = null;
	#callbacks: Partial<EditorCallbacks> = {};
	#readonly: boolean = false;
	#mountHelper: ReturnType<typeof mountHelper>;
	#resizeObserver = new ResizeObserver(() => this.#onResize());

	constructor(editorName: EditorName) {
		this.#editorName = editorName;

		this.#editor.contentEditable = "true";
		this.#editor.spellcheck = false;
		this.#editor.id = `diffseek-editor-${editorName}`;
		this.#editor.classList.add("editor", `editor-${editorName}`);
		this.#editor.dataset.editorName = editorName;
		this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));

		this.#heightBoost.classList.add("editor-maybe-170cm-wasnt-enough");

		this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
		this.observeMutation();

		this.#editor.addEventListener("copy", (e) => this.#onCopy(e));
		this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
		this.#editor.addEventListener("input", () => this.#handleContentChangedInternal());
		this.#editor.addEventListener("click", (e) => {
			this.#callbacks.click?.(this, e);
		});
		this.#editor.addEventListener("keydown", (e) => this.#onKeyDown(e));
		this.#editor.addEventListener("focus", () => {
			this.#callbacks.focus?.(this);
		});
		this.#editor.addEventListener("blur", () => {
			this.#callbacks.blur?.(this);
		});

		this.#wrapper = document.createElement("div");
		this.#wrapper.appendChild(this.#editor);
		this.#wrapper.appendChild(this.#heightBoost);
		this.#wrapper.classList.add("editor-wrapper", `editor-wrapper-${editorName}`);
		this.#wrapper.addEventListener("scroll", this.#onContainerScroll);
		this.#wrapper.addEventListener("scrollend", this.#onContainerScrollEnd);
		this.#wrapper.addEventListener("mousemove", this.#onContainerMouseMove);
		this.#wrapper.addEventListener("mouseleave", this.#onContainerMouseLeave);

		this.#mountHelper = mountHelper(this.#wrapper);
		this.#resizeObserver.observe(this.#wrapper);
	}

	/**
	 * 대상 노드에 편집기(정확히는 `wrapper` 엘러먼트)를 집어넣음.
	 * 넣었다 뺐다를 잘못하면 인생이 아작나는 수가 있으니 신중할 것.
	 *
	 * @param target 마운트 대상 노드
	 */
	mount(target: HTMLElement) {
		this.#mountHelper.mount(target);
	}

	unmount() {
		this.#mountHelper.unmount();
	}

	setCallbacks(callbacks: Partial<EditorCallbacks>) {
		Object.assign(this.#callbacks, callbacks);
	}

	#onContainerScroll = () => {
		this.#callbacks.scroll?.(this);
	};

	#onContainerScrollEnd = () => {
		this.#callbacks.scrollEnd?.(this);
	};

	#onContainerMouseMove = (e: MouseEvent) => {
		this.#callbacks.mouseMove?.(this, e);
	};

	#onContainerMouseLeave = (e: MouseEvent) => {
		this.#callbacks.mouseLeave?.(this, e);
	};

	get name(): EditorName {
		return this.#editorName;
	}

	get readonly(): boolean {
		return this.#readonly;
	}

	set readonly(value: boolean) {
		if (this.#readonly === value) {
			return;
		}
		this.#readonly = value;
		this.#editor.contentEditable = value ? "false" : "true";
	}

	/**
	 * 절대 수정 금지. 읽기만.
	 */
	get tokens(): readonly RichToken[] {
		return this.#tokens;
	}

	get imageMap(): Map<RichToken, ImageLoadResult> {
		return this.#imageMap;
	}

	get container() {
		return this.#wrapper;
	}

	get contentEditableElement(): HTMLElement {
		return this.#editor;
	}

	get scrollTop(): number {
		return this.#wrapper?.scrollTop ?? 0;
	}

	set scrollTop(value: number) {
		if (this.#wrapper) {
			this.#wrapper.scrollTop = value;
		}
	}

	get scrollLeft(): number {
		return this.#wrapper?.scrollLeft ?? 0;
	}

	set scrollLeft(value: number) {
		if (this.#wrapper) {
			this.#wrapper.scrollLeft = value;
		}
	}

	get editorElement(): HTMLElement {
		return this.#editor;
	}

	#onResize() {
		this.#callbacks.resize?.(this);
	}

	#onKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			// vscode같은 코드에디터에서 흔하게 사용하는 단축키.
			// 마우스에 손대지 않고 한두줄 정도 스크롤하고 싶은데 커서를 화면 경계까지 옮기다가 손가락에 굳은살이 생길까 염려되는 경우
			if (this.#wrapper) {
				e.preventDefault();
				const fontSize = parseFloat(getComputedStyle(this.#editor).fontSize);
				const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2 * fontSize;
				this.#wrapper.scrollBy({
					top: delta,
					behavior: "instant",
				});
			}
		}

		if (e.altKey && (e.key === "2" || e.key === "3")) {
			const selection = document.getSelection();
			if (!selection || selection.rangeCount === 0) {
				return;
			}

			const range = selection.getRangeAt(0);
			if (!this.#editor.contains(range.commonAncestorContainer)) {
				return;
			}

			if (!range.collapsed) {
				// for safety
				return;
			}

			e.preventDefault();
			const html = e.key === "2" ? "<hr data-manual-anchor='A' class=\"manual-anchor\">" : "<hr data-manual-anchor='B' class=\"manual-anchor\">";
			document.execCommand("insertHTML", false, html);
		}
	}

	#handleContentChangedInternal() {
		this.#callbacks.contentChanging?.(this);
		this.#tokenize();
	}

	#onMutation(_mutations: MutationRecord[]) {
		if (this.#editor.childNodes.length === 0) {
			this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
		}
		// console.log(mutations)
	}

	observeMutation() {
		this.#mutationObserver.observe(this.#editor, {
			childList: true,
			subtree: true,
			//attributes: true,
			//characterData: true,
		});
	}

	unobserveMutation() {
		this.#mutationObserver.disconnect();
	}

	#tokenize() {
		if (this.#tokenizeContext) {
			this.#tokenizeContext.cancel();
		}

		this.#tokenizeContext = new TokenizeContext(this.#editor, this.#onTokenizeDone.bind(this));

		this.#tokenizeContext.start();
	}

	#onTokenizeDone({ tokens, imageMap }: TokenizeResult) {
		const current = this.#tokenizeContext;
		this.#tokens = tokens;
		this.#imageMap = imageMap;

		const awaitables: Promise<any>[] = [];

		for (const [_, props] of imageMap.entries()) {
			// const img = props.elem;
			// awaitables.push(props.ensureLoaded().then(({ dataUrl }) => {
			// 	if (img.complete && img.naturalWidth === 0 && dataUrl && img.src !== dataUrl) {
			// 		img.src = dataUrl;
			// 		return new Promise<void>((resolve, reject) => {
			// 			img.onload = () => resolve();
			// 			img.onerror = reject;
			// 		});
			// 	}
			// }));
		}

		Promise.allSettled(awaitables).then(() => {
			if (this.#tokenizeContext === current) {
				this.#tokenizeContext = null;
				this.#callbacks.contentChanged?.(this);
			}
		});
	}

	#onCopy(e: ClipboardEvent) {
		this.#callbacks.copy?.(this, e);
	}

	async #onPaste(e: ClipboardEvent) {
		const startTime = performance.now();

		const selection = document.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return;
		}

		const range = selection.getRangeAt(0);
		if (!this.#editor.contains(range.commonAncestorContainer)) {
			return;
		}

		// console.time("paste");
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 사용자가 붙여넣기 이후 바로 추가 입력을 하는 경우 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		e.preventDefault();

		let isHTML = true;
		let data = e.clipboardData?.getData("text/html") ?? "";
		if (!data) {
			isHTML = false;
			data = e.clipboardData?.getData("text/plain") ?? "";
		}

		await this.setContent({
			text: data,
			asHTML: isHTML,
			targetRange: range,
			allowLegacyExecCommand: data.length <= MAX_LENGTH_FOR_EXECCOMMAND_PASTE,
		});
		const endTime = performance.now();
		console.debug(this.#editorName, "Paste operation took", endTime - startTime, "ms");
	}

	getSelectionRange(): Range | null {
		const selection = document.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}
		const range = selection.getRangeAt(0);
		if (this.#editor.contains(range.startContainer) && this.#editor.contains(range.endContainer)) {
			return range;
		}
		return null;
	}

	/**
	 * 폭탄 붙여넣기! 왜 bomb인가? 되돌릴 수 없기 때문. ctrl-z 안먹힘.
	 * 전체 내용을 클립보드의 내용으로 교체함.
	 * 또한 클립보드 액세스를 가능하게 하는 사용자의 동작 없이 실행이 되므로 브라우저에서 "허용" 여부를 묻는 경고창이 뜰 수 있음.
	 */
	async pasteBomb(plaintextOnly: boolean = false) {
		const startTime = performance.now();

		if (!navigator.clipboard || !navigator.clipboard.read) {
			throw new Error("Clipboard API is not available in this browser");
		}

		//this.#editor.contentEditable = "false";
		this.#editor.classList.add("busy");

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
			await this.setContent({
				text,
				asHTML: foundType === "text/html",
				targetRange: undefined, // 전체 내용 교체
				allowLegacyExecCommand: false, // bomb투하 이전으로 돌아가는건 허용 안함.
			});

			const endTime = performance.now();
			console.debug(this.#editorName, "Paste bomb operation took", endTime - startTime, "ms");
			return true;
		} finally {
			this.#editor.classList.remove("busy");
			//this.#editor.contentEditable = "true";
		}
	}

	async setContent({
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
			sanitized = await sanitizeHTML(text);
		} else {
			sanitized = createParagraphsFromText(text);
		}

		try {
			this.unobserveMutation();
			if (targetRange === undefined) {
				this.#editor.innerHTML = "";
				this.#editor.appendChild(sanitized);
				this.#handleContentChangedInternal();
			} else if (this.#editor.contains(targetRange.startContainer) && this.#editor.contains(targetRange.endContainer)) {
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
					this.#handleContentChangedInternal();
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
			range.selectNodeContents(this.#editor);
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
		const tokens = this.#tokens;
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
					const t = tokens[mid].range;
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
			const t = tokens[i].range;
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
				const t = tokens[mid].range;
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
				const t = tokens[mid].range;
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
		if (count === 1 && index >= 0 && index < this.#tokens.length) {
			const token = this.#tokens[index];
			return createRangeFromTokenRange(token.range);
		}

		const range = document.createRange();
		if (count > 0) {
			const startToken = this.#tokens[index];
			const endToken = this.#tokens[index + count - 1];
			if (startToken) {
				setStartFromTokenRange(range, startToken.range);
			} else {
				range.setStart(this.#editor, 0);
			}
			if (endToken) {
				setEndFromTokenRange(range, endToken.range);
			} else {
				range.setEnd(this.#editor, this.#editor.childNodes.length);
			}
		} else {
			const prevToken = this.#tokens[index - 1];
			if (prevToken) {
				setStartAfterToken(range, prevToken.range);
			} else {
				range.setStart(this.#editor, 0);
			}

			const nextToken = this.#tokens[index];
			if (nextToken) {
				setEndBeforeToken(range, nextToken.range);
				// setEndFromTokenRange(range, nextToken.range);
			} else {
				range.setEnd(this.#editor, this.#editor.childNodes.length);
			}
		}
		return range;
	}

	scrollTo(offset: number, options?: ScrollOptions) {
		if (!this.#wrapper) {
			return;
		}

		if (this.#wrapper.scrollTop !== offset) {
			this.#wrapper.scrollTo({
				top: offset,
				behavior: options?.behavior,
			});
		}
	}

	get contentHeight(): number {
		return this.#editor.offsetHeight;
	}

	focus() {
		this.#editor.focus();
	}

	contains(range: Range): boolean {
		if (!range || !this.#editor.contains(range.startContainer) || !this.#editor.contains(range.endContainer)) {
			return false;
		}
		return true;
	}

	set height(value: number) {
		const editorHeight = this.#editor.offsetHeight;
		const delta = value - editorHeight;
		if (delta < 0) {
			console.warn("WTF? The taller the better", this.#editorName, value, editorHeight);
			return;
		}
		if (delta > 0) {
			this.#heightBoost.style.setProperty("--height-boost", delta + "px");
		} else {
			this.#heightBoost.style.removeProperty("--height-boost");
		}
	}

	forceReflow() {
		// force reflow
		if (!this.#wrapper) {
			return;
		}
		//this.#wrapper.style.display = "none";
		void this.#wrapper.offsetHeight; // force reflow
		//void this.#editor.offsetHeight; // force reflow
		//this.#wrapper.style.display = "";
	}

	getBoundingClientRect(): Rect {
		if (!this.#wrapper) {
			return { x: 0, y: 0, width: 0, height: 0 };
		}
		return this.#wrapper.getBoundingClientRect();
	}

	getScroll(): [x: number, y: number] {
		if (!this.#wrapper) {
			return [0, 0];
		}
		return [this.#wrapper.scrollLeft, this.#wrapper.scrollTop];
	}

	// 텍스트노드, 인라인노드, P태그 안에는 블럭요소를 집어넣으면 안되지만 contenteditable 안에서 브라우저는 그런걸 제어해주지 않음.
	// 몇번 붙여넣기 하다보면 <SPAN> 태그 안에 <P>, <DIV>, <TABLE>들이 들어가 있는 광경을 보게 된다.
	// 따라서 붙여넣기 하기 전에 insertion point를 확인하고 텍스트노드이거나 인라인요소 사이를 반으로 쪼개야 한다.
	// 그리고 이 작업은 부모를 거슬러올라가면서 계속... 해야함.
	ensureInsertableRange(range: Range, forBlock: boolean): Range {
		if (range.startContainer.nodeType !== 1 && range.startContainer.nodeType !== 3) {
			throw new Error("Range start container is not a text node or an element");
		}

		if (!this.#editor.contains(range.startContainer)) {
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
				container !== this.#editor &&
				!TEXT_FLOW_CONTAINERS[container.nodeName] && // editor루트나 TD, ...등은 더 이상 쪼개면 안됨
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
}
