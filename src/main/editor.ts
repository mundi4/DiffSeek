type EditorName = "left" | "right";

type EditorCallbacks = {
	onDiffVisibilityChanged: (editor: Editor, entries: VisibilityChangeEntry[]) => void;
	onContentChanging: (editor: Editor) => void;
	onContentChanged: (editor: Editor) => void;
	onScroll: (editor: Editor, scrollTop: number, scrollLeft: number) => void;
	onScrollEnd: (editor: Editor) => void;
	onRender: (editor: Editor) => void;
	onHoverDiff: (editor: Editor, diffIndex: number | null) => void;
	onRenderInvalidated: (editor: Editor, flags: RenderFlags) => void;
	onResize: (editor: Editor) => void;
	onFocus: (editor: Editor) => void;
	onBlur: (editor: Editor) => void;
};

type VisibilityChangeEntry = {
	item: number | string;
	isVisible: boolean;
};

type InsertionPoint = {
	container: Node;
	offset: number;
	flags: number;
	existingAnchor: HTMLElement | null;
};

type EditorAnchor = {
	tokenIndex: number;
	flags: number;
};

const INITIAL_EDITOR_HTML = document.createElement("P");
INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));

// 만약 renderer를 Editor 인스턴스가 갖지 않고 외부로 빼낸다면...
// 그리고 Editor는 diff에 대해서 전혀 알지 못하게 한다면...?
// diff anchor도 외부에서 만들어야함
// hit test도 외부에서
// scroll to diff X
// scrollTo, scrollBy 만 제공
// 외부에서는 diffComputed 때 diff 범위 계산(getTokenRange 이용...)
// renderer에 range와 셋팅된 DiffRenderItem[]을 넘겨줌

class Editor {
	#editorName: EditorName;
	#container: HTMLElement;
	#wrapper = document.createElement("div");
	#editor = document.createElement("div");
	#mutationObserver: MutationObserver;
	#anchors: HTMLElement[] = [];
	#tokens: RichToken[] = [];
	#tokenizeContext: TokinizeContext | null = null;
	#tokenizeCallbackId: number | null = null;
	#callbacks: EditorCallbacks;
	#renderer: Renderer;
	#hoveredDiffIndex: number | null = null;
	#aligning: boolean = false;

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

		this.#container.appendChild(this.#wrapper);

		this.#renderer = new Renderer(this, this.#wrapper, { diffVisibilityChanged: (e) => this.onDiffVisibilityChanged(e) });

		this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
		this.#observeMutation();

		this.#wrapper.addEventListener("scroll", (e) => {
			this.onScroll(e);
		});
		this.#wrapper.addEventListener("scrollend", () => {
			callbacks.onScrollEnd(this);
		});

		this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
		this.#editor.addEventListener("input", () => this.onInput());
		this.#editor.addEventListener("keydown", (e) => this.onKeyDown(e));
		this.#editor.addEventListener("focus", () => {
			callbacks.onFocus(this);
		});
		this.#editor.addEventListener("blur", () => {
			callbacks.onBlur(this);
		});
		//setTimeout(() => this.tokenize(), 0);

		this.#wrapper.addEventListener("mousemove", (e) => this.onMouseMove(e));
		this.#wrapper.addEventListener("mouseleave", () => {
			if (this.#hoveredDiffIndex !== null) {
				this.#hoveredDiffIndex = null;
				this.#callbacks.onHoverDiff(this, null);
				this.#callbacks.onRenderInvalidated(this, RenderFlags.HIGHLIGHT);
			}
		});

		const resizeObserver = new ResizeObserver(() => this.#onResize());
		resizeObserver.observe(this.#editor);
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

	scrollToOffset(offset: number) {
		this.#wrapper.scrollTop = offset;
	}

	scrollByOffset(offset: number) {
		this.#wrapper.scrollTop += offset;
	}

	private onMouseMove(e: MouseEvent) {
		const rect = this.#wrapper.getBoundingClientRect();
		let x = e.clientX - rect.x + this.#wrapper.scrollLeft;
		let y = e.clientY - rect.y + this.#wrapper.scrollTop;

		const diffIndex = this.#renderer.getDiffAtPoint(x, y);
		if (diffIndex !== this.#hoveredDiffIndex) {
			this.#hoveredDiffIndex = diffIndex;
			this.#callbacks.onHoverDiff(this, diffIndex);
		}
	}

	private onDiffVisibilityChanged(entries: VisibilityChangeEntry[]) {
		this.#callbacks.onDiffVisibilityChanged(this, entries);
	}

	private onKeyDown(e: KeyboardEvent) {
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

	private onScroll(e: Event) {
		this.#renderer.markDirty(RenderFlags.SCROLL);
		this.#callbacks.onScroll(this, this.#wrapper.scrollTop, this.#wrapper.scrollLeft);
	}

	private onInput() {
		this.#renderer.markDirty(RenderFlags.ALL);
		this.#callbacks.onContentChanging(this);
		this.tokenize();
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
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 사용자가 붙여넣기 이후 바로 추가 입력을 하는 경우 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		console.time("paste");
		e.preventDefault();
		this.#unobserveMutation();

		console.time("paste getData");
		let rawHTML = e.clipboardData?.getData("text/html") ?? "";
		console.timeEnd("paste getData");

		console.time("paste sanitizeHTML");
		let sanitized: Node;
		if (rawHTML) {
			sanitized = sanitizeHTML(rawHTML);
		} else {
			sanitized = formatPlaintext(e.clipboardData?.getData("text/plain") ?? "");
		}
		const div = document.createElement("DIV");
		div.appendChild(sanitized);
		const sanitizedHTML = div.innerHTML;
		console.timeEnd("paste sanitizeHTML");

		// document.execCommand("insertHTML",...)는 미친게 아닌가 싶을 정도로 오래 걸린다. 농담 아님.
		// BUT 직접 노드를 삽입하면 undo/redo 히스토리가 깨지기 때문에 자존심 상해도 어쩔 수 없이 써야함.
		console.time("paste execCommand");
		document.execCommand("insertHTML", false, sanitizedHTML);
		console.timeEnd("paste execCommand");
		console.timeEnd("paste");
		this.#observeMutation();
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

	private tokenize() {
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
		const ctx: TokinizeContext = {
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
				// generator 내부에서 yield를 해주지 않으면 함수 종료시까지 cancelled=true가 실행될 기화가 생기지 않음.
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

	#getOrInsertStartAnchor(tokenIndex: number, flags: AnchorFlags): HTMLElement | null {
		const token = this.#tokens[tokenIndex];
		if (!token) {
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

		let found = false;
		let lastAnchor = this.#anchors[this.#anchors.length - 1];

		do {
			if (!lastAnchor || lastAnchor.compareDocumentPosition(insertPoint) & Node.DOCUMENT_POSITION_FOLLOWING) {
				if (flags & AnchorFlags.PREFER_TABLE_START) {
					if (insertPoint.nodeName === "TABLE") {
						found = true;
						break;
						// return this.#getExistingOrCreateAnchor(container as HTMLElement, beforeNode as HTMLElement);
					}
				} else if (flags & (AnchorFlags.PREFER_TABLECELL_START | AnchorFlags.PREFER_TABLEROW_START)) {
					if (container.nodeName === "TD" || container.nodeName === "TH") {
						found = true;
						break;
						// return this.#getExistingOrCreateAnchor(container as HTMLElement, beforeNode as HTMLElement);
					}
				} else if (flags & AnchorFlags.PREFER_BLOCK_START) {
					if (BLOCK_ELEMENTS[container.nodeName]) {
						found = true;
						break;
						// return this.#getExistingOrCreateAnchor(container as HTMLElement, beforeNode as HTMLElement);
					}
				} else {
					if (BLOCK_ELEMENTS[container.nodeName]) {
						found = true;
						break;
					}
				}
			}

			// if (BLOCK_ELEMENTS[container.nodeName]) {
			// 	firstContainer = container;
			// 	firstBeforeNode = beforeNode;
			// }

			if (container === this.#editor) {
				break;
			}
			insertPoint = container;
			container = container.parentNode!;
		} while (container);

		if (found) {
			while (insertPoint.previousSibling) {
				let prev = insertPoint.previousSibling;
				if (prev.nodeName === "BR" || BLOCK_ELEMENTS[prev.nodeName]) {
					break;
				}

				if (prev.nodeType === 3 && prev.nodeValue!.trim() === "") {
					// 빈 텍스트노드는 무시
					insertPoint = prev!;
					continue;
				}
				break;
			}

			if (insertPoint && insertPoint.nodeName === "A" && (insertPoint as HTMLElement).classList.contains("diff")) {
				insertPoint = insertPoint.nextSibling!;
			}
			return this.#getExistingOrCreateAnchor(container as HTMLElement, insertPoint as HTMLElement);
		}

		console.warn(this.#editorName, "getOrInsertStartAnchor", "No suitable container found for anchor", {
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

	#getExistingOrCreateAnchor(container: HTMLElement, beforeNode: Node): HTMLElement | null {
		if (beforeNode && beforeNode.nodeName === "A" && (beforeNode as HTMLElement).classList.contains("anchor")) {
			return beforeNode as HTMLElement;
		}
		let anchor = document.createElement("A");
		anchor.classList.add("anchor");
		container.insertBefore(anchor, beforeNode);
		return anchor;
	}

	// #getDiffRange(diff: EditorDiff): [Range, HTMLElement | null] {
	// 	let range: Range | null = null;
	// 	let anchorEl: HTMLElement | null = null;
	// 	if (diff.tokenCount === 0) {
	// 		let bestInsertionPoint: InsertionPoint | null = null;
	// 		let bestScore = -1;
	// 		for (const point of this.#yieldDiffAnchorPointsInRange(diff.tokenIndex)) {
	// 			let score = 0;
	// 			if (diff.preferBlockStart && point.flags & InsertionPointFlags.BLOCK_START) {
	// 				score += 1;
	// 			}
	// 			// if (diff.preferBlockEnd && point.flags & InsertionPointFlags.BlockEnd) {
	// 			// 	score += 1;
	// 			// }
	// 			if (bestInsertionPoint === null || score > bestScore) {
	// 				bestInsertionPoint = point;
	// 				bestScore = score;
	// 			}
	// 			console.debug(this.#editorName, "yieldAnchorPointsInRange", diff, point, score);
	// 		}
	// 		if (bestInsertionPoint) {
	// 			console.debug(this.#editorName, "best", bestInsertionPoint);
	// 			[range, anchorEl] = this.#getDiffAnchor(bestInsertionPoint);
	// 		}
	// 	}

	// 	if (!range) {
	// 		range = this.getTokenRange(diff.tokenIndex, diff.tokenCount);
	// 	}
	// 	return [range, anchorEl];
	// }

	*#yieldDiffAnchorPointsInRange(tokenIndex: number) {
		const prevToken = this.#tokens[tokenIndex - 1];
		const nextToken = this.#tokens[tokenIndex];
		let lastAnchorRange: Range | null = null;
		if (this.#anchors.length > 0) {
			lastAnchorRange = document.createRange();
			lastAnchorRange.selectNode(this.#anchors[this.#anchors.length - 1]);
		}

		let endContainer: Node;
		let endOffset: number;
		// let endNode: Node;
		let lastYielded: InsertionPoint | null = null;
		// console.log(editorName, "generateInsertionPointsInRange", { tokenIndex, prevToken, nextToken });

		let container: Node;
		let childIndex: number;
		const indexStack: number[] = [];

		if (prevToken && nextToken && prevToken.range.endContainer === nextToken.range.startContainer && prevToken.range.endContainer.nodeType === 3) {
			yield* createPoint(prevToken.range.endContainer, prevToken.range.endOffset!);
			return;
		}

		if (prevToken) {
			container = prevToken.range.endContainer;
			childIndex = prevToken.range.endOffset;
			if (container.nodeType === 3) {
				// 텍스트노드는 컨테이너로 지정되지 않음!
				//yield* createPoint(container, childIndex);
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
		} else {
			endContainer = this.#editor;
			endOffset = this.#editor.childNodes.length;
		}

		if (container === endContainer) {
			if (container.nodeType === 3) {
				yield* createPoint(container, childIndex);
				return;
			}
		}

		while (container) {
			if (!TEXTLESS_ELEMENTS[container.nodeName]) {
				yield* createPoint(container, childIndex);
			}

			if (container === endContainer && childIndex >= endOffset) {
				break;
			}

			let current: Node = container.childNodes[childIndex];
			if (!current) {
				current = container;
				container = container.parentNode!;
				if (indexStack.length > 0) {
					childIndex = indexStack.pop()!;
				} else {
					if (!container || !container.childNodes) {
						console.warn(this.#editorName, "No childNodes in container", current, container, prevToken, nextToken);
					}
					childIndex = Array.prototype.indexOf.call(container.childNodes, current);
				}
				childIndex++;
				continue;
			}

			if (current.nodeName === "A") {
			} else {
				if (current.nodeType === 1 && !VOID_ELEMENTS[current.nodeName]) {
					// 주어진 childIndex에 해당하는 자식으로 들어가기
					if (current.firstChild) {
						indexStack.push(childIndex);
						container = current;
						childIndex = 0;
						continue;
					} else {
						// 자식이 없더라도 요소 안에 하나의 point는 만들어야함.
						// firstChild 조건 체크 없이 container=current, childIndex=0으로 설정해두고 continue 해버려도 되지만
						// 일단 그냥 여기서 처리하고 루프 한바퀴 건너뛰자.
						if (!TEXTLESS_ELEMENTS[current.nodeName]) {
							yield* createPoint(current, 0);
						}
					}
				} else if (current.nodeType === 3) {
					if (current === endContainer) {
						yield* createPoint(current, endOffset);
						break;
					}
				}
			}

			childIndex++;
		}

		function* createPoint(container: Node, offset: number, flags: number = 0) {
			if (lastYielded && lastYielded.container === container && lastYielded.offset === offset) {
				return;
			}
			if (lastAnchorRange && lastAnchorRange.comparePoint(container, offset) <= 0) {
				return;
			}

			let existingAnchor: HTMLElement | null = null;

			if (container.nodeType === 3) {
				return;
			} else {
				existingAnchor = (container.childNodes[offset] as HTMLElement) || null;
				if (existingAnchor && (existingAnchor.nodeName !== "A" || !existingAnchor.classList.contains("diff"))) {
					existingAnchor = null;
				}

				const comparePrev = prevToken ? container.compareDocumentPosition(prevToken.range.endContainer) : 0;
				const compareNext = nextToken ? container.compareDocumentPosition(nextToken.range.startContainer) : 0;

				if (offset === 0 || !(comparePrev & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
					if (TEXT_FLOW_CONTAINERS[container.nodeName]) {
						flags |= InsertionPointFlags.CONTAINER_START;
					}
					if (BLOCK_ELEMENTS[container.nodeName]) {
						flags |= InsertionPointFlags.BLOCK_START;
					}
					if (container.nodeName === "TD" || container.nodeName === "TH") {
						flags |= InsertionPointFlags.TABLECELL_START;
						const tr = container.parentNode as HTMLElement;
						if (tr.firstElementChild === container) {
							flags |= InsertionPointFlags.TABLEROW_START;
							if (!tr.previousElementSibling || tr.previousElementSibling.nodeName !== "TR") {
								flags |= InsertionPointFlags.TABLE_START;
							} else if (tr.parentNode!.firstElementChild === tr) {
								flags |= InsertionPointFlags.TABLE_START;
							}
						}
					}
				}

				if (offset === container.childNodes.length || !(compareNext & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
					if (TEXT_FLOW_CONTAINERS[container.nodeName]) {
						flags |= InsertionPointFlags.CONTAINER_END;
					}
					if (BLOCK_ELEMENTS[container.nodeName]) {
						flags |= InsertionPointFlags.BLOCK_END;
					}
					if (container.nodeName === "TD" || container.nodeName === "TH") {
						flags |= InsertionPointFlags.TABLECELL_END;
						const tr = container.parentNode as HTMLElement;
						if (tr.lastElementChild === container) {
							flags |= InsertionPointFlags.TABLEROW_END;
							if (!tr.nextElementSibling || tr.nextElementSibling.nodeName !== "TR") {
								flags |= InsertionPointFlags.TABLE_END;
							} else if (tr.parentNode!.lastElementChild === tr) {
								flags |= InsertionPointFlags.TABLE_END;
							}
						}
					}
				}
			}

			lastYielded = { container: container, offset, flags, existingAnchor };
			yield lastYielded;
		}
	}

	#getDiffAnchor(point: InsertionPoint): HTMLElement | null {
		const before = point.container.childNodes[point.offset] || null;
		if (before && before.nodeName === "A" && (before as HTMLElement).classList.contains("diff")) {
			return before as HTMLElement;
		}
		const anchorEl = document.createElement("A");
		anchorEl.classList.add("diff");
		point.container.insertBefore(anchorEl, before);
		return anchorEl;
	}

	withUpdate(updateFn: (helper: UpdateFuncs) => void) {
		const unusedAnchors = new Set<HTMLElement>(this.#anchors);
		this.#anchors.length = 0;

		const renderItems: DiffRenderItem[] = [];

		const setDiff: UpdateFuncs["setDiff"] = (range: Range, diff: EditorDiff) => {
			const renderItem: DiffRenderItem = {
				diffIndex: diff.diffIndex,
				range,
				hue: diff.hue,
				geometry: null,
			};
			renderItems[diff.diffIndex] = renderItem;
		};

		const getAnchor: UpdateFuncs["getAnchor"] = (tokenIndex: number, flags: number): HTMLElement | null => {
			const el = this.#getOrInsertStartAnchor(tokenIndex, flags);
			if (el) {
				this.#anchors.push(el);
			}
			return el;
		};

		const getDiffAnchor: UpdateFuncs["getDiffAnchor"] = (point: InsertionPoint): HTMLElement | null => {
			const el = this.#getDiffAnchor(point);
			if (el) {
				this.#anchors.push(el);
			}
			return el;
		};

		const getTokenRange: UpdateFuncs["getTokenRange"] = (index: number, count?: number) => {
			return this.getTokenRange(index, count);
		};

		const getDiffAnchorPointsInRange: UpdateFuncs["getDiffAnchorPointsInRange"] = (tokenIndex: number) => {
			return this.#yieldDiffAnchorPointsInRange(tokenIndex);
		};

		try {
			updateFn({
				setDiff,
				getTokenRange,
				getAnchor,
				getDiffAnchor,
				getDiffAnchorPointsInRange,
			});
		} finally {
			for (const anchor of this.#anchors) {
				unusedAnchors.delete(anchor);
			}
			for (const anchor of unusedAnchors) {
				anchor.remove();
			}
		}

		// console.log("diffs:", renderItems);
		this.#renderer.setDiffs(renderItems);
	}

	render() {
		this.#renderer.render();
	}

	setSelectionHighlight(range: Range | null) {
		return this.#renderer.setSelectionHighlight(range);
	}

	setDiffHighlight(diffIndex: number | null) {
		if (this.#hoveredDiffIndex !== diffIndex) {
			this.#hoveredDiffIndex = diffIndex;
		}
		return this.#renderer.setDiffHighlight(diffIndex);
	}

	scrollTo(offset: number, options?: ScrollOptions) {
		if (this.#wrapper.scrollTop !== offset) {
			this.#wrapper.scrollTo({
				top: offset,
				behavior: options?.behavior,
			});
		}
	}

	scrollToDiff(diffIndex: number, scrollMargin: number = SCROLL_MARGIN) {
		const y = this.#renderer.getDiffOffsetY(diffIndex);
		if (y !== undefined) {
			this.#wrapper.scrollTo({
				top: y - scrollMargin,
				behavior: "smooth",
			});
		}
	}

	getDiffRect(diffIndex: number): Rect | null {
		return this.#renderer.getDiffRect(diffIndex);
	}

	#onResize() {
		if (this.#aligning) {
			return;
		}
		this.#renderer.updateLayout();
		this.#callbacks.onResize(this);
	}

	get height(): number {
		return this.#wrapper.offsetHeight;
	}

	get scrollHeight(): number {
		return this.#wrapper.scrollHeight;
	}

}

type UpdateFuncs = {
	setDiff: (range: Range, diff: EditorDiff) => void;
	getTokenRange: (index: number, count?: number) => Range;
	getAnchor: (tokeinIndex: number, flags: number) => HTMLElement | null;
	getDiffAnchor: (point: InsertionPoint) => HTMLElement | null;
	getDiffAnchorPointsInRange: (tokenIndex: number) => Generator<InsertionPoint, void, void>;
};
