type EditorName = "left" | "right";

type EditorCallbacks = {
	// tokens are being generated.
	onContentChanging: (editor: Editor) => void;

	// tokens are ready to be used.
	onContentChanged: (editor: Editor) => void;
	onScroll: (editor: Editor, scrollTop: number, scrollLeft: number) => void;
	onScrollEnd: (editor: Editor) => void;
	onResize: (editor: Editor) => void;
	onFocus: (editor: Editor) => void;
	onBlur: (editor: Editor) => void;
};

type AnchorInsertionPoint = {
	container: Node;
	offset: number;
	flags: number;
	existingAnchor: HTMLElement | null;
	depth: number;
};

const enum InsertionPointFlags {
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
	#tokenizeCallbackId: number | null = null;
	#callbacks: EditorCallbacks;
	#bottomPaddingElement: HTMLElement = document.createElement("div");

	constructor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
		this.#editorName = editorName;
		this.#container = container;
		this.#callbacks = callbacks;

		this.#editor.id = editorName + "Editor";
		this.#editor.classList.add("editor");
		this.#editor.contentEditable = "true";
		this.#editor.spellcheck = false;
		this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));

		this.#wrapper.id = editorName + "EditorWrapper";
		this.#wrapper.classList.add("editor-wrapper");
		this.#wrapper.appendChild(this.#editor);

		this.#bottomPaddingElement.className = "maybe-170cm-wasnt-enough";
		this.#bottomPaddingElement.addEventListener("click", (e) => {
			const sel = window.getSelection();
			const range = document.createRange();
			range.setStart(this.#editor, this.#editor.childNodes.length);
			range.collapse(true);
			sel?.removeAllRanges();
			sel?.addRange(range);
			this.#editor.focus();
		});

		this.#wrapper.appendChild(this.#bottomPaddingElement);

		this.#container.appendChild(this.#wrapper);

		this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
		this.#observeMutation();

		this.#wrapper.addEventListener("scroll", (e) => {
			this.#onScroll(e);
		});
		this.#wrapper.addEventListener("scrollend", () => {
			callbacks.onScrollEnd(this);
		});

		this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
		this.#editor.addEventListener("input", () => this.#onInput());
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

	get wrapper() {
		return this.#wrapper;
	}

	get editor() {
		return this.#editor;
	}

	get tokens(): readonly RichToken[] {
		return this.#tokens;
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
	}

	#onScroll(e: Event) {
		this.#callbacks.onScroll(this, this.#wrapper.scrollTop, this.#wrapper.scrollLeft);
	}

	#onInput() {
		this.#callbacks.onContentChanging(this);
		this.#tokenize();
	}

	#onResize() {
		this.#callbacks.onResize(this);
	}

	#onMutation(mutations: MutationRecord[]) {
		if (this.#editor.childNodes.length === 0) {
			this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
		}
	}

	#observeMutation() {
		this.#mutationObserver.observe(this.#wrapper, {
			childList: true,
			subtree: true,
			//attributes: true,
			//characterData: true,
		});
	}

	#unobserveMutation() {
		this.#mutationObserver.disconnect();
	}

	#onPaste(e: ClipboardEvent) {
		const selection = document.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return;
		}

		const range = selection.getRangeAt(0);
		if (!this.#editor.contains(range.commonAncestorContainer)) {
			return;
		}

		console.time("paste");
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 사용자가 붙여넣기 이후 바로 추가 입력을 하는 경우 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		e.preventDefault();
		this.#unobserveMutation();

		let rawHTML = e.clipboardData?.getData("text/html") ?? "";
		let sanitized: Node;
		if (rawHTML) {
			console.time("paste sanitizeHTML");
			sanitized = sanitizeHTML(rawHTML);
			console.timeEnd("paste sanitizeHTML");
		} else {
			sanitized = formatPlaintext(e.clipboardData?.getData("text/plain") ?? "");
		}

		// 후...
		// document.execCommand("insertHTML", ...)를 undo/redo 히스토리가 제대로 업데이트 되지만
		// 느리다. 미친게 아닌가 싶을 정도로 느리다. 100배 느리다. undo/redo는 포기하고 싶지 않지만 포기하고 싶을정도로 느리다.
		// undo/redo는 단순히 내용만 stack에 쌓는다고 해결될 문제가 아니다. 커서의 위치와 선택범위, 트랜잭션, 스크롤 위치, ... 이걸 다 해야된다면 아예 아무것도 안하는 것이...

		// 이정도 길이면 execCommand("insertHTML", ...)를 써도 참을만 하지 않을까?
		if (rawHTML.length <= 200_000) {
			console.time("paste execCommand");
			const div = document.createElement("DIV");
			div.appendChild(sanitized);
			const sanitizedHTML = div.innerHTML;
			document.execCommand("insertHTML", false, sanitizedHTML);
			console.timeEnd("paste execCommand");
		} else {
			console.time("paste replaceRange");
			range.deleteContents();
			range.insertNode(sanitized);
			range.collapse(false);
			this.#onInput();
			console.timeEnd("paste replaceRange");
		}

		this.#observeMutation();
		console.timeEnd("paste");
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
			const prevToken = this.#tokens[index - 1];
			if (prevToken) {
				range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
				range.setEnd(prevToken.range.endContainer, prevToken.range.endOffset);
				return range;
			}
			const nextToken = this.#tokens[index];
			if (nextToken) {
				range.setStart(nextToken.range.startContainer, 0);
				range.setEnd(nextToken.range.startContainer, 0);
			}
		}
		return range;
	}

	#tokenize() {
		const _TIMEOUT = 200;

		if (this.#tokenizeCallbackId !== null) {
			// 아직 실행되지 않고 대기 중인 콜백 취소
			cancelIdleCallback(this.#tokenizeCallbackId);
			this.#tokenizeCallbackId = null;
		}

		if (this.#tokenizeContext) {
			// 이미 콜백이 실행 중이라면 다음 step에서 취소처리해야하므로...
			this.#tokenizeContext.cancelled = true;
		}

		const startTime = performance.now();
		const ctx: TokenizeContext = {
			cancelled: false,
			content: this.#editor,
		};
		this.#tokenizeContext = ctx;

		// 여기서 바로 generator를 생성을 해버리면 idleDeadline을 바로 넘겨줄 수가 없다.
		// generator 내부에서 idleDeadline을 획득하려면 "성급하게" yield를 한번 하고 외부에서 next(idleDeadline)으로 넘겨줘야하는데
		// 그러면 황금같은 유휴시간을 한번 낭비하게 됨. 그래서 generator 생성은 콜백 안에서...
		let generator: ReturnType<typeof tokenizer> | null = null;

		const step = (idleDeadline: IdleDeadline) => {
			this.#tokenizeCallbackId = null;

			if (ctx.cancelled) {
				// 어차피 단일쓰레드 환경이므로 콜백이 실행되는 도중에는 cancelled 값이 바뀔 가능성은 0이기 때문에
				// 취소확인은 next()를 호출하기 전에나 한번씩 해주면 됨.
				// generator 내부에서 yield를 해주지 않으면 함수 종료시까지 cancelled=true가 실행될 기회가 생기지 않음.
				console.debug(this.#editorName, "tokenize cancelled");
				return;
			}

			if (generator === null) {
				generator = tokenizer(ctx, idleDeadline);
			}

			const { done, value } = generator.next(idleDeadline);
			if (done && !ctx.cancelled) {
				const endTime = performance.now();
				this.#tokens = value.tokens;
				console.debug(this.#editorName, "tokenize done", Math.ceil(endTime - startTime) + "ms", value);
				if (!ctx.cancelled) {
					this.#onTokenizeDone();
				}
			} else if (!ctx.cancelled) {
				this.#tokenizeCallbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
			}
		};
		this.#tokenizeCallbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
	}

	#onTokenizeDone() {
		this.#callbacks.onContentChanged(this);
	}

	getAnchorInsertionPoint(tokenIndex: number, flags: AnchorFlags): Range | null {
		const token = this.#tokens[tokenIndex];
		if (!token) {
			console.warn(this.#editorName, "getAnchorInsertionPoint", "No token found for index", tokenIndex);
			return null;
		}

		let container: Node = token.range.startContainer;
		let insertPoint: Node;
		if (container.nodeType === 3) {
			insertPoint = container;
			container = container.parentElement!;
		} else {
			container = token.range.startContainer.parentNode!;
			insertPoint = token.range.startContainer;
		}

		const insertionRange: Range = document.createRange();
		const editor = this.#editor;
		function pinpointWhereToSlideItIn(flags: AnchorFlags, container: Node, insertPoint: Node): boolean {
			if (flags & AnchorFlags.TABLE_START) {
				if (insertPoint.nodeName === "TABLE") {
					insertionRange.setStartBefore(insertPoint);
					return true;
				}
			} else if (flags & AnchorFlags.TABLECELL_START) {
				if (container.nodeName === "TD" || container.nodeName === "TH") {
					insertionRange.setStart(container, 0);
					return true;
				}
			} else if (flags & AnchorFlags.CONTAINER_START) {
				if (container === editor || TEXT_FLOW_CONTAINERS[container.nodeName]) {
					insertionRange.setStart(container, 0);
					return true;
				}
			} else if (BLOCK_ELEMENTS[container.nodeName]) {
				insertionRange.setStart(container, 0);
				return true;
			}
			return false;
		}

		function wrapBeforeInsertIfNecessary(range: Range): Range | null {
			const container = range.startContainer;
			let offset = range.startOffset;
			let node = container.childNodes[offset] as HTMLElement | null;

			while (node && node.nodeName === "A") {
				if (node.classList.contains("anchor")) {
					// Found valid anchor; keep range as-is
					break;
				}

				if (node.classList.contains("diff")) {
					// Skip this diff anchor
					offset += 1;
					node = container.childNodes[offset] as HTMLElement | null;
					continue;
				}

				// Unknown <a>, probably junk — bail
				return null;
			}

			// Adjust range only if we skipped something
			if (offset !== range.startOffset) {
				range.setStart(container, offset);
			}

			range.collapse(true);
			return range;
		}

		do {
			if (pinpointWhereToSlideItIn(flags, container, insertPoint)) {
				const rangeWithSafetyOn = wrapBeforeInsertIfNecessary(insertionRange);
				return rangeWithSafetyOn;
			}
			if (container === editor) {
				break;
			}
			insertPoint = container;
			container = container.parentNode!;
		} while (container);

		console.warn(this.#editorName, "getAnchorInsertionPoint", "No suitable insertion point found for anchor", {
			tokenIndex,
			token,
			flags,
			beforeNode: insertPoint,
			container,
		});
		// if (firstContainer && firstBeforeNode) {
		// 	return this.#getExistingOrCreateAnchor(firstContainer as HTMLElement, firstBeforeNode);
		// }
		return null;
	}

	*yieldDiffAnchorPointsInRange(tokenIndex: number) {
		const prevToken = this.#tokens[tokenIndex - 1];
		const nextToken = this.#tokens[tokenIndex];
		const root = this.#editor;

		let container: Node;
		let childIndex: number;
		let endContainer: Node;
		let endOffset: number;

		if (prevToken) {
			container = prevToken.range.endContainer;
			childIndex = prevToken.range.endOffset;
			if (container.nodeType === 3) {
				if (nextToken && nextToken.range.startContainer === container) {
					// 하나의 텍스트노드에 걸쳐져있는 경우
					// 텍스트노드를 쪼갤 수는 없으므로(쪼갤 수는 있지만 굳이 그렇게까지...?)
					return;
				}
				childIndex = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
				container = container.parentNode!;
			}
		} else {
			container = this.#editor;
			childIndex = 0;
		}

		if (nextToken) {
			endContainer = nextToken.range.startContainer;
			endOffset = nextToken.range.startOffset;
			if (endContainer.nodeType === 3) {
				endOffset = Array.prototype.indexOf.call(endContainer.parentNode!.childNodes, endContainer);
				endContainer = endContainer.parentNode!;
			}
		} else {
			endContainer = this.#editor;
			endOffset = this.#editor.childNodes.length;
		}

		const indexStack: number[] = [];

		// sanity check
		if (comparePoint(container, childIndex, endContainer, endOffset) > 0) {
			return;
		}

		while (container) {
			if (!TEXTLESS_ELEMENTS[container.nodeName]) {
				yield* createPoint(container, childIndex);
			}

			if (container === endContainer && childIndex >= endOffset) {
				break;
			}

			let current: Node = container.childNodes[childIndex];

			// childIndex에 해당하는 노드가 없는 경우 - container의 마지막 자식까지 처리를 한 상황. 부모로 거슬러 올라가서 sibling node 방향으로 탐색.
			if (!current) {
				current = container;
				container = container.parentNode!;
				if (indexStack.length > 0) {
					childIndex = indexStack.pop()!;
				} else {
					childIndex = Array.prototype.indexOf.call(container.childNodes, current);
				}
				childIndex++;
				continue;
			}

			if (current.nodeName === "A") {
				// sanitize 단계에서 A태그는 다 걸러내므로 이건 마커용 앵커태그임 => 자식노드로 파고들 필요 없음. 자식노드 자체가 없어야 정상.
			} else {
				if (current.nodeType === 1 && !VOID_ELEMENTS[current.nodeName]) {
					// current의 자식 방향으로 탐색.
					indexStack.push(childIndex);
					container = current;
					childIndex = 0;
					continue;
				}
			}

			childIndex++;
		}

		function* createPoint(container: Node, offset: number, flags: number = 0) {
			if (container.nodeType !== 1) {
				return;
			}

			const nodeName = container.nodeName;
			const childNodes = container.childNodes;
			let existingAnchor: HTMLElement | null = (childNodes[offset] as HTMLElement) || null;
			if (existingAnchor && (existingAnchor.nodeName !== "A" || !existingAnchor.classList.contains("diff"))) {
				existingAnchor = null;
			}

			if (
				offset === 0 ||
				!prevToken ||
				!(container.compareDocumentPosition(prevToken.range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) //이전 토큰이 현재 컨테이너에 포함되어 있지 않음
			) {
				if (BLOCK_ELEMENTS[nodeName]) {
					flags |= InsertionPointFlags.BLOCK_START;
				}
				if (TEXT_FLOW_CONTAINERS[nodeName] || container === root) {
					flags |= InsertionPointFlags.CONTAINER_START;
				}
				if (nodeName === "TD" || nodeName === "TH") {
					flags |= InsertionPointFlags.TABLECELL_START;
					const tr = container.parentNode as HTMLElement;
					if (tr.firstElementChild === container) {
						flags |= InsertionPointFlags.TABLEROW_START;
						if (!tr.previousElementSibling || tr.previousElementSibling.nodeName !== "TR") {
							flags |= InsertionPointFlags.TABLE_START;
						}
					}
				}
			}

			if (
				offset === childNodes.length ||
				!nextToken ||
				!(container.compareDocumentPosition(nextToken.range.startContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) //다음 토큰이 현재 컨테이너에 포함되어 있지 않음
			) {
				if (BLOCK_ELEMENTS[nodeName]) {
					flags |= InsertionPointFlags.BLOCK_END;
				}
				if (TEXT_FLOW_CONTAINERS[nodeName] || container === root) {
					flags |= InsertionPointFlags.CONTAINER_END;
				}
				if (nodeName === "TD" || nodeName === "TH") {
					flags |= InsertionPointFlags.TABLECELL_END;
					const tr = container.parentNode as HTMLElement;
					if (tr.lastElementChild === container) {
						flags |= InsertionPointFlags.TABLEROW_END;
						if (!tr.nextElementSibling || tr.nextElementSibling.nodeName !== "TR") {
							flags |= InsertionPointFlags.TABLE_END;
						}
					}
				}
			}

			let prevEl: Node | null = childNodes[offset - 1];
			while (prevEl && prevEl.nodeType !== 1) {
				prevEl = prevEl.previousSibling;
			}
			if (prevEl && prevEl.nodeName === "TABLE") {
				flags |= InsertionPointFlags.AFTER_TABLE;
			}

			let nextEl: Node | null = childNodes[offset];
			while (nextEl && nextEl.nodeType !== 1) {
				nextEl = nextEl.nextSibling;
			}
			if (nextEl && nextEl.nodeName === "TABLE") {
				flags |= InsertionPointFlags.BEFORE_TABLE;
			}

			let depth = 0;
			let temp = container;
			while (temp && temp !== root) {
				depth++;
				temp = temp.parentNode!;
			}

			yield { container: container, offset, flags, existingAnchor, depth };
		}
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
		return this.#editor.scrollHeight;
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

	// 디버깅 전용
	setContent(rawHTML: string) {
		this.#unobserveMutation();
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 사용자가 붙여넣기 이후 바로 추가 입력을 하는 경우 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		let sanitized: Node = sanitizeHTML(rawHTML);
		this.#editor.innerHTML = "";
		this.#editor.appendChild(sanitized);
		this.#observeMutation();
		this.#onInput();
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
}

type EditorRegionInfo = {
	getBoundingClientRect: () => DOMRect;
	scrollTop: number;
};
