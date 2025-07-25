type EditorName = "left" | "right";

type EditorCallbacks = {
	onContentChanging: (editor: Editor) => void;
	onContentChanged: (editor: Editor) => void;
	onScroll: (editor: Editor, scrollTop: number, scrollLeft: number) => void;
	onScrollEnd: (editor: Editor) => void;
	onResize: (editor: Editor) => void;
	onFocus: (editor: Editor) => void;
	onBlur: (editor: Editor) => void;
	onClick: (editor: Editor, event: MouseEvent) => void;
	onCopy: (editor: Editor, event: ClipboardEvent) => void;
};

type AnchorInsertionPoint = {
	container: HTMLElement;
	offset: number;
};

const enum InsertionPointFlags {
	None = 0,
	LINE_START = TokenFlags.LINE_START,
	LINE_END = TokenFlags.LINE_END,
	BLOCK_START = TokenFlags.BLOCK_START,
	BLOCK_END = TokenFlags.BLOCK_END,
	CONTAINER_START = TokenFlags.CONTAINER_START,
	CONTAINER_END = TokenFlags.CONTAINER_END,
	TABLE_START = TokenFlags.TABLE_START,
	TABLE_END = TokenFlags.TABLE_END,
	TABLEROW_START = TokenFlags.TABLEROW_START,
	TABLEROW_END = TokenFlags.TABLEROW_END,
	TABLECELL_START = TokenFlags.TABLECELL_START,
	TABLECELL_END = TokenFlags.TABLECELL_END,
	BEFORE_TABLE = TABLECELL_END << 1,
	AFTER_TABLE = TABLECELL_END << 2,
}

const INITIAL_EDITOR_HTML = document.createElement("P");
INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));

class Editor {
	#editorName: EditorName;
	#container: HTMLElement;
	#wrapper = document.createElement("div");
	#editor = document.createElement("div");
	#mutationObserver: MutationObserver;
	#tokens: RichToken[] = [];
	#tokenizeContext: TokenizeContext | null = null;
	#callbacks: EditorCallbacks;
	#bottomPaddingElement: HTMLElement = document.createElement("div");
	#prevWidth: number = 0;
	#readonly: boolean = false;
	#aboveOverlay: HTMLElement = document.createElement("div");
	#belowOverlay: HTMLElement = document.createElement("div");

	constructor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
		this.#editorName = editorName;
		this.#container = container;
		this.#callbacks = callbacks;

		this.#editor.id = editorName + "Editor";
		this.#editor.classList.add("editor");
		this.#editor.contentEditable = "true";
		this.#editor.spellcheck = false;
		//this.#editor.innerHTML = "<p></p><p></p><p></p>"

		// this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));

		this.#aboveOverlay.className = "eyes-up-here " + editorName;
		this.#aboveOverlay.style.opacity = "0";
		this.#belowOverlay.className = "eyes-down-here " + editorName;
		this.#belowOverlay.style.opacity = "0";

		this.#wrapper.id = editorName + "EditorWrapper";
		this.#wrapper.classList.add("editor-wrapper");
		this.#wrapper.appendChild(this.#editor);
		this.#wrapper.appendChild(this.#aboveOverlay);
		this.#wrapper.appendChild(this.#belowOverlay);

		this.#bottomPaddingElement.className = "maybe-170cm-wasnt-enough";
		this.#wrapper.appendChild(this.#bottomPaddingElement);

		this.#container.appendChild(this.#wrapper);

		this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
		this.observeMutation();

		this.#wrapper.addEventListener("scroll", (e) => {
			this.#onScroll(e);
		});
		this.#wrapper.addEventListener("scrollend", () => {
			callbacks.onScrollEnd(this);
		});

		this.#editor.addEventListener("copy", (e) => this.#onCopy(e));
		this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
		this.#editor.addEventListener("input", () => this.#onInput());
		this.#editor.addEventListener("click", (e) => {
			callbacks.onClick(this, e);
		});
		this.#editor.addEventListener("keydown", (e) => this.#onKeyDown(e));
		this.#editor.addEventListener("focus", () => {
			callbacks.onFocus(this);
		});
		this.#editor.addEventListener("blur", () => {
			callbacks.onBlur(this);
		});
		//setTimeout(() => this.tokenize(), 0);

		const resizeObserver = new ResizeObserver(() => this.#onResize());
		resizeObserver.observe(this.#editor);
		resizeObserver.observe(this.#wrapper);
	}

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

	get tokens(): readonly RichToken[] {
		return this.#tokens;
	}

	get wrapper() {
		return this.#wrapper;
	}

	get editor() {
		return this.#editor;
	}

	get scrollTop(): number {
		return this.#wrapper.scrollTop;
	}

	set scrollTop(value: number) {
		this.#wrapper.scrollTop = value;
	}

	get scrollLeft(): number {
		return this.#wrapper.scrollLeft;
	}

	set scrollLeft(value: number) {
		this.#wrapper.scrollLeft = value;
	}

	#onKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			// vscode나 기타 등등 코드에디터나 IDE에서 흔하게 사용하는 단축키.
			// 마우스에 손대지 않고 살짝 2-3줄 정도만 스크롤하고 싶은데 커서가 너무 멀리 있는 경우...
			e.preventDefault();
			const fontSize = parseFloat(getComputedStyle(this.#editor).fontSize);
			const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2 * fontSize;

			this.#wrapper.scrollBy({
				top: delta,
				behavior: "instant",
			});
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

			e.preventDefault();
			const html = e.key === "2" ? "<hr data-manual-anchor='A' class=\"manual-anchor\">" : "<hr data-manual-anchor='B' class=\"manual-anchor\">";
			document.execCommand("insertHTML", false, html); // 줄바꿈 추가
		}
	}

	#onScroll(e: Event) {
		this.#callbacks.onScroll(this, this.#wrapper.scrollTop, this.#wrapper.scrollLeft);
	}

	#onInput() {
		this.#callbacks.onContentChanging(this);
		this.#tokenize();
	}

	#onResize() {
		const rect = this.#editor.getBoundingClientRect();
		const newWidth = rect.width;

		if (this.#prevWidth !== newWidth) {
			this.#prevWidth = newWidth;
			this.#callbacks.onResize(this);

			this.#aboveOverlay.style.left = `${rect.left}px`;
			this.#belowOverlay.style.left = `${rect.left}px`;
			this.#aboveOverlay.style.width = `${this.#wrapper.clientWidth}px`;
			this.#belowOverlay.style.width = `${this.#wrapper.clientWidth}px`;
		}
	}

	#onMutation(mutations: MutationRecord[]) {
		// if (this.#editor.childNodes.length === 0) {
		// 	this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
		// }
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

	#onCopy(e: ClipboardEvent) {
		this.#callbacks.onCopy(this, e);
	}

	#onPaste(e: ClipboardEvent) {
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

		this.#setContents({
			contents: data,
			asHTML: isHTML,
			targetRange: range,
			allowLegacyExecCommand: data.length <= (isHTML ? 10_000 : 1_000),
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

		this.#editor.contentEditable = "false";
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
			this.#setContents({
				contents: text,
				asHTML: foundType === "text/html",
				targetRange: null,
				allowLegacyExecCommand: false,
			});

			const endTime = performance.now();
			console.debug(this.#editorName, "Paste bomb operation took", endTime - startTime, "ms");
			return true;
		} finally {
			this.#editor.classList.remove("busy");
			this.#editor.contentEditable = "true";
		}
	}

	#setContents({
		contents,
		asHTML = false,
		targetRange,
		allowLegacyExecCommand = false,
	}: {
		contents: string;
		asHTML?: boolean;
		targetRange: Range | null;
		allowLegacyExecCommand?: boolean;
	}) {
		let sanitized: Node;
		if (asHTML) {
			sanitized = sanitizeHTML(contents);
		} else {
			sanitized = createParagraphsFromText(contents);
		}

		try {
			this.unobserveMutation();
			if (targetRange === null) {
				this.#editor.innerHTML = "";
				this.#editor.appendChild(sanitized);
				this.#onInput();
			} else if (this.#editor.contains(targetRange.startContainer) && this.#editor.contains(targetRange.endContainer)) {
				if (allowLegacyExecCommand && contents.length <= 200_000) {
					// 이정도 길이면 execCommand("insertHTML", ...)를 써도 참을만 하지 않을까?
					const div = document.createElement("DIV");
					div.appendChild(sanitized);
					const sanitizedHTML = div.innerHTML;
					document.execCommand("insertHTML", false, sanitizedHTML);
				} else {
					// 이 경우는 range를 사용해서 직접 삽입함.
					// execCommand("insertHTML", ...)는 느리다. 100배 느리다. undo/redo는 포기하고 싶지 않지만 포기하고 싶을정도로 느리다.
					// undo/redo는 단순히 내용만 stack에 쌓는다고 해결될 문제가 아니다. 커서의 위치와 선택범위, 트랜잭션, 스크롤 위치, ... 이걸 다 해야된다면 아예 아무것도 안하는 것이...
					targetRange.deleteContents();
					targetRange.insertNode(sanitized);
					targetRange.collapse(false);
					this.#onInput();
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

	setContent(rawHTML: string) {
		this.unobserveMutation();

		let sanitized = sanitizeHTML(rawHTML);
		const range = document.createRange();
		range.selectNodeContents(this.#editor);
		range.deleteContents();
		range.insertNode(sanitized);
		range.collapse(false);
		this.#onInput();

		this.observeMutation();
	}

	findTokenOverlapIndices(range: Range): [number, number] {
		let low = 0;
		let high = this.#tokens.length - 1;
		let startIndex = -1;
		let endIndex = -1;

		// collapsed, 즉 범위 없이 텍스트커서만 있는 경우 커서가 토큰의 맨앞이나 맨뒤에 있어도 해당 토큰이 선택된 것으로 간주함.
		// 범위가 있는 경우는 범위 밖 토큰들이 같이 선택되면 안됨!
		const collapsed = range.collapsed;

		// range의 끝부분이 텍스트노드의 끝부분에 있고 비교대상 토큰의 시작부분은 인접한 텍스트노드의 시작점(0)에 있는 경우
		// 그 토큰의 범위에 커서가 걸쳐있다고 봐야 맞는데(단어 앞에 커서가 있는 경우 그 단어가 선택되었다고 판단)
		// 텍스트노드 사이에 커서가 있으면 경계가 intersecting되지 않는다고 판단하기 때문에 의도적으로 범위를 확장시켜줘야함.
		// 단순히 <textnode><textnode>의 경우는 쉽지만
		// <textnode><span><em>text</em></span><textnode>의 경우 span,em 안을 파고 들어가야함.
		if (range.endContainer.nodeType === 3 && range.endOffset === range.endContainer.nodeValue!.length) {
			let adjText = findAdjacentTextNode(range.endContainer, true);
			if (adjText) {
				range = range.cloneRange(); // 지금으로써는 clone까지는 필요는 없지만... 일단 뭐...
				range.setEnd(adjText, 0);
			}
		}

		// console.debug(editorName, "findTokenOverlapIndices", { range, text: range.toString() });
		const tokenRange = document.createRange();
		while (low <= high) {
			const mid = (low + high) >> 1;
			const token = this.#tokens[mid].range;
			tokenRange.setStart(token.startContainer, token.startOffset);
			tokenRange.setEnd(token.endContainer, token.endOffset);

			let c = range.compareBoundaryPoints(Range.END_TO_START, tokenRange);
			if (c < 0 || (collapsed && c === 0)) {
				// 토큰의 끝점이 range의 시작점보다 뒤에 있다. 이 토큰을 포함해서 왼쪽토큰들이 첫 토큰 후보.
				// 단, range의 끝점도 토큰의 시작점 이후에 있어야 intersecting이라고 볼 수 있음.
				// 단단, startIndex가 이미 -1이 아니라면 startIndex의 토큰보다 왼쪽의 토큰이므로 비교하지 않아도 됨(무조건 통과)
				if (startIndex !== -1 || (c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange)) > 0 || (collapsed && c === 0)) {
					startIndex = mid;
					// } else {
					// 	console.warn(this.#editorName, "NOT THIS TOKEN", mid, {
					// 		range,
					// 		tokenRange: tokenRange.cloneRange(),
					// 		c: tokenRange.compareBoundaryPoints(Range.END_TO_START, range),
					// 	});
				}
				high = mid - 1; // 왼쪽으로
			} else {
				low = mid + 1; // 오른쪽으로
			}
		}

		// console.debug("after 1st loop", "findTokenOverlapIndices",  startIndex);

		if (startIndex !== -1) {
			tokenRange.setStart(this.#tokens[startIndex].range.startContainer, this.#tokens[startIndex].range.startOffset);
			low = endIndex = startIndex;
			high = this.#tokens.length - 1;
			while (low <= high) {
				const mid = (low + high) >> 1;
				const token = this.#tokens[mid].range;
				tokenRange.setStart(token.startContainer, token.startOffset);
				tokenRange.setEnd(token.endContainer, token.endOffset);
				const c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange);
				if (c > 0) {
					endIndex = mid + 1;
					low = mid + 1; // 오른쪽으로
				} else {
					high = mid - 1; // 왼쪽으로
				}
			}
		}
		return [startIndex, endIndex];
	}

	getTokenRange(index: number, count: number = 1) {
		const range = document.createRange();

		if (count === 1 && index >= 0 && index < this.#tokens.length) {
			const token = this.#tokens[index];
			range.setStart(token.range.startContainer, token.range.startOffset);
			range.setEnd(token.range.endContainer, token.range.endOffset);
		} else if (count > 0) {
			const startToken = this.#tokens[index];
			const endToken = this.#tokens[index + count - 1];
			if (startToken) {
				range.setStart(startToken.range.startContainer, startToken.range.startOffset);
			} else {
				range.setStart(this.#editor, 0);
			}
			if (endToken) {
				range.setEnd(endToken.range.endContainer, endToken.range.endOffset);
			} else {
				range.setEnd(this.#editor, this.#editor.childNodes.length);
			}
		} else {
			// count === 0

			const prevToken = this.#tokens[index - 1];
			if (prevToken) {
				range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
			} else {
				range.setStart(this.#editor, 0);
			}

			const nextToken = this.#tokens[index];
			if (nextToken) {
				range.setEnd(nextToken.range.startContainer, nextToken.range.startOffset);
			} else {
				range.setEnd(this.#editor, this.#editor.childNodes.length);
			}
		}
		return range;
	}

	#tokenize() {
		if (this.#tokenizeContext) {
			this.#tokenizeContext.cancel();
		}

		this.#tokenizeContext = new TokenizeContext(this.#editor, (tokens) => {
			console.debug(this.#editorName, "Tokenization done", tokens);
			this.#tokens = tokens;
			this.#onTokenizeDone();
		});

		this.#tokenizeContext.start();
	}

	#onTokenizeDone() {
		this.#callbacks.onContentChanged(this);
	}

	scrollTo(offset: number, options?: ScrollOptions) {
		if (this.#wrapper.scrollTop !== offset) {
			this.#wrapper.scrollTo({
				top: offset,
				behavior: options?.behavior,
			});
		}
	}

	get height(): number {
		return this.#wrapper.offsetHeight;
	}

	get scrollHeight(): number {
		return this.#wrapper.scrollHeight;
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
		const editorHeight = this.#editor.scrollHeight;
		const lifting = value - editorHeight;

		if (lifting < 0) {
			console.warn("WTF? The taller the better", this.#editorName, value, editorHeight);
			return;
		}

		if (lifting > 0) {
			this.#bottomPaddingElement.style.setProperty("--height-boost", lifting + "px");
		} else {
			this.#bottomPaddingElement.style.removeProperty("--height-boost");
		}
	}

	getBoundingClientRect(): DOMRect {
		return this.#wrapper.getBoundingClientRect();
	}

	// 앵커를 에디터가 추적을 하긴 해야한다.
	// 그래야 앵커와 앵커 사이의 어떤 토큰들이 들어있는지 파악이 가능하다.
	// 그리고 그 토큰들을 사용해서 앵커와 앵커 사이에 어떤 diff가 있는지 파악 가능
	// 그리고 alignAnchors()가 되었을때 화면상 첫앵커와 끝앵커 사이의 diff geometries를 invalidate할 수 있다.
	// TODO
	removeDanglingAnchors() {}

	forceReflow() {
		// force reflow
		//this.#wrapper.style.display = "none";
		void this.#wrapper.offsetHeight; // force reflow
		//void this.#editor.offsetHeight; // force reflow
		//this.#wrapper.style.display = "";
	}

	toggleDirectionalOverlays(above: boolean, below: boolean) {
		this.#aboveOverlay.style.opacity = above ? "1" : "0";
		this.#belowOverlay.style.opacity = below ? "1" : "0";
	}

	getAnchorTargetForToken(range: Range | LightRange, flags: AnchorFlags = AnchorFlags.None): HTMLElement | null {
		let node = range.startContainer;
		if (node.nodeType === 1 && node === range.endContainer && range.startOffset + 1 === range.endOffset) {
			const theNode = node.childNodes[range.startOffset];
			if (theNode.nodeName === DIFF_ELEMENT_NAME) {
				return theNode as HTMLElement;
			}
		} else if (node.nodeType !== 3) {
			node = node.childNodes[range.startOffset];
			if (!node) {
				// 토큰화 단계에서 이런 경우를 잘 대비를 해야함.
				// 텍스트노드가 아닌 요소로 range를 설정하는 경우 반드시 selectNode로 선택할 것.
				console.warn(this.#editorName, "getAnchorTargetForToken", "No child node found at the specified offset", range);
				return null;
			}
		}

		const ANCHOR_ELIGIBLE_ELEMENTS: Record<string, boolean> = {
			DIV: true,
			P: true,
			LI: true,
		};

		// 부모로 거슬러 올라가면서 블럭요소를 찾음
		let target: HTMLElement | null = node as HTMLElement;
		while (target && !ANCHOR_ELIGIBLE_ELEMENTS[target.nodeName]) {
			target = target.parentNode as HTMLElement;
		}

		if (target === this.#editor) {
			return null;
		}

		return target;
	}
}

type EditorRegionInfo = {
	getBoundingClientRect: () => DOMRect;
	scrollTop: number;
};
