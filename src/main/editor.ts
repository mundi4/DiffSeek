type EditorCallbacks = {
	onDiffVisibilityChanged: (entries: VisibilityChangeEntry[]) => void;
	onTextChanged: () => void;
};

type VisibilityChangeEntry = {
	item: number | string;
	isVisible: boolean;
};

type EditorNodeHint = {
	node: ChildNode;
	pos: number;
	len: number;
};

const TEXT_SELECTION_HIGHLIGHT_FILL_STYLE = "hsl(210 100% 40%)";

function createEditor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
	const { onDiffVisibilityChanged, onTextChanged } = callbacks;
	const _lineElements: HTMLElement[] = [];
	const _diffElements: HTMLElement[][] = [];
	const _anchorElements: HTMLElement[] = [];
	const _lineHints: LineHint[] = [];
	const _visibleAnchors = new Set<HTMLElement>();
	const _visibleDiffIndices = new Set<number>();

	const _diffRanges: Range[][] = [];
	const _diffRects: DiffRectSet[] = [];
	const _diffLineRects: Rect[] = [];
	const _tokens: Token[] = [];
	const _ranges: Range[] = [];
	const _anchors: Map<number, HTMLElement> = new Map();

	let _textSelectionHighlight: TextSelectionHighlight | null = null;
	// let _textHighlightItems: RenderItem[] | null = null;
	let _diffHighlightItems: RenderItem[] | null = null;
	let _renderPending = false;

	const _renderLayers: RenderLayer[] = [
		{ index: 0, dirty: true }, // static canvas
		{ index: 1, dirty: true }, // highlight canvas
	];
	const DIFF_LAYER = 0;
	const HIGHLIGHT_LAYER = 1;

	let _diffRectsDirty = true;
	let _hasRenderedAny = false;
	let _editMode = false;
	let _canvasWidth = 0;
	let _canvasHeight = 0;

	const wrapper = document.createElement("div");
	wrapper.id = editorName + "EditorWrapper";
	wrapper.classList.add("editor-wrapper");

	const staticCanvas = document.createElement("canvas");
	staticCanvas.id = editorName + "Canvas";
	staticCanvas.classList.add("canvas");
	const staticCanvasCtx = staticCanvas.getContext("2d")!;

	const highlightCanvas = document.createElement("canvas");
	highlightCanvas.id = editorName + "HighlightCanvas";
	highlightCanvas.classList.add("canvas");
	highlightCanvas.classList.add("highlight");
	const highlightCanvasCtx = highlightCanvas.getContext("2d")!;

	const INITIAL_EDITOR_HTML = "<DIV><BR/></DIV>";
	const editor = document.createElement("div");
	editor.id = editorName + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "true";
	editor.spellcheck = false;
	editor.innerHTML = `<table><tbody><tr><td><p>하나 은행</p></td><td><p>국민 은행</p></td><td><p>신한 은행</p></td></tr><tr><td><p>산업 은행</p></td><td><p>카카오 뱅크</p></td><td rowspan="2"><p>케이 뱅크</p></td></tr><tr><td><p>우리 은행</p></td><td><p>우체국</p></td></tr></tbody></table><p>hello</p>`;

	wrapper.appendChild(staticCanvas);
	wrapper.appendChild(highlightCanvas);
	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	const resizeObserver = new ResizeObserver(() => {
		const rect = wrapper.getBoundingClientRect();
		staticCanvas.width = highlightCanvas.width = _canvasWidth = rect.width;
		staticCanvas.height = highlightCanvas.height = _canvasHeight = rect.height;
		_diffRectsDirty = true;

		if (_textSelectionHighlight) {
			_textSelectionHighlight.renderItem = undefined;
		}

		renderAll();
	});
	resizeObserver.observe(wrapper);

	// *** HTML 붙여넣기를 허용할 때만 사용할 코드 ***
	// 지금은 관련 코드를 다 지워버렸고 복구하려면 깃허브에서 이전 코드를 뒤져야함...
	const { observeEditor, unobserveEditor } = (() => {
		const mutationObserver = new MutationObserver((mutations) => {
			if (editor.childNodes.length === 0) {
				editor.innerHTML = INITIAL_EDITOR_HTML;
			}
		});

		function observeEditor() {
			mutationObserver.observe(editor, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			});
		}

		function unobserveEditor() {
			mutationObserver.disconnect();
		}

		return { observeEditor, unobserveEditor };
	})();
	observeEditor();

	function formatPlaintext(plaintext: string) {
		const lines = plaintext.split("\n");

		const fragment = document.createDocumentFragment();
		for (const line of lines) {
			const p = document.createElement("p");
			p.textContent = line;
			fragment.appendChild(p);
		}

		return fragment;
	}

	editor.addEventListener("paste", (e) => {
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 붙여넣기 이후 바로 추가 입력 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		console.time("paste");
		e.preventDefault();

		let rawHTML = e.clipboardData?.getData("text/html");
		let sanitized: Node;
		if (rawHTML) {
			const START_TAG = "<!--StartFragment-->";
			const END_TAG = "<!--EndFragment-->";
			const startIndex = rawHTML.indexOf(START_TAG);
			if (startIndex >= 0) {
				const endIndex = rawHTML.lastIndexOf(END_TAG);
				if (endIndex >= 0) {
					rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
				} else {
					rawHTML = rawHTML.slice(startIndex + START_TAG.length);
				}
			}
			sanitized = sanitizeHTML(rawHTML);
		} else {
			sanitized = formatPlaintext(e.clipboardData?.getData("text/plain") || "");
		}

		// 자존심 상하지만 document.execCommand("insertHTML",...)를 써야한다.
		// 1. 브라우저가 undo/redo 히스토리 관리를 할 수 있음.
		// 2. 필요한 경우 브라우저가 알아서 DOM을 수정해 줌.
		// 	예: 인라인 엘러먼트 안에 블럭 엘러먼트를 붙여넣는 경우 브라우저가 알아서 인라인 요소를 반으로 갈라서 블럭 엘러먼트를 밖으로 꺼내준다.
		const div = document.createElement("DIV");
		div.appendChild(sanitized);
		document.execCommand("insertHTML", false, div.innerHTML);
		console.log("insertHTML", div.innerHTML);
		console.timeEnd("paste");
	});

	editor.addEventListener("input", onChange);

	wrapper.addEventListener("scroll", () => {
		renderAll();
	});

	function onChange() {
		tokenize();
	}

	function onTokenizeDone() {
		onTextChanged();
	}

	function getVisibleAnchors() {
		return Array.from(_visibleAnchors).sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos));
	}

	// caret(텍스트커서 '|')가 있는 위치에 가장 가까운 앵커를 가져옴.
	// edit 모드가 아닌 경우에는 null 리턴
	function getClosestAnchorToCaret() {
		if (!_editMode) {
			return null;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}

		let range = selection.getRangeAt(0);
		if (!editor.contains(range.startContainer)) {
			return null;
		}

		let rect = range.getBoundingClientRect();
		let y;
		if (rect.left === 0 && rect.top === 0) {
			y = EDITOR_PADDING + TOPBAR_HEIGHT;
		} else {
			y = rect.top;
		}

		let closestAnchor = null;
		let minDistance = Number.MAX_SAFE_INTEGER;
		for (const anchor of _visibleAnchors) {
			const rect = anchor.getBoundingClientRect();
			const distance = Math.abs(rect.top - y);
			if (distance < minDistance) {
				minDistance = distance;
				closestAnchor = anchor;
			}
		}
		return closestAnchor;
	}

	function getFirstVisibleLineElement(): [HTMLElement, number] | [null, null] {
		const lineEls = _lineElements;
		let low = 0;
		let high = lineEls.length - 1;
		let mid;
		let lineEl = null;
		let distance = null;
		while (low <= high) {
			mid = (low + high) >>> 1;
			const thisDistance = lineEls[mid].getBoundingClientRect().top - TOPBAR_HEIGHT;
			if (thisDistance >= -LINE_HEIGHT) {
				lineEl = lineEls[mid];
				distance = thisDistance;
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return [lineEl!, distance!];
	}

	function scrollToDiff(diffIndex: number) {
		const diffRects = _diffRects[diffIndex];
		if (!diffRects) {
			return;
		}
		const diffRect = diffRects.rects[0];
		if (!diffRect) {
			return;
		}
		wrapper.scrollTop = diffRect.y - SCROLL_MARGIN;
	}

	function scrollToHeading(headingIndex: number) {
		const id = `${editorName}Heading${headingIndex}`;
		const el = document.getElementById(id);
		if (el) {
			const offsetTop = el.offsetTop - wrapper.clientTop;
			wrapper.scrollTop = offsetTop - SCROLL_MARGIN;
		}
	}

	// 내가 머리가 나쁘다는 걸 확실하게 알게 해주는 함수
	function scrollToLine(lineNum: number, margin = 0) {
		const lineEl = _lineElements[lineNum - 1];
		if (lineEl) {
			const scrollTop = lineEl.offsetTop - margin;
			wrapper.scrollTop = scrollTop;
		}
	}

	function getFirstVisibleAnchor() {
		let firstAnchor: HTMLElement | null = null;
		let firstPos: number | null = null;
		for (const anchor of _visibleAnchors) {
			if (firstAnchor === null) {
				firstAnchor = anchor;
				firstPos = Number(anchor.dataset.pos);
			} else {
				const pos = Number(anchor.dataset.pos);
				if (pos < firstPos!) {
					firstAnchor = anchor;
					firstPos = pos;
				}
			}
		}
		return firstAnchor;
	}

	function setEditMode(editMode: boolean) {
		_editMode = !!editMode;
	}

	// #region
	function getTextOffset(root: HTMLElement, node: Node, offset: number): number {
		let result;
		if (node.nodeType === 1) {
			let container = editor;
			let offsetBase = 0;

			if (node.childNodes.length === offset) {
				// return Number((node as HTMLElement).dataset.endOffset);
				// offset이 node.childNode 배열 크기를 넘는 경우(정확히는 offset === childNode.length)
				// 이 경우 범위의 시작(또는 끝)은 node의 끝에 있다는 의미.
				// 현재 노드의 끝 위치를 계산해도 되지만 다음 노드의 시작 위치를 계산해도 될 것 같음.
				const nextNode = findFirstNodeAfter(root, node);
				if (nextNode === null) {
					return -1;
				}
			} else {
				// node.childNodes[offset]의 시작부분에 범위의 시작(또는 끝)이 위치함.
				node = node.childNodes[offset];
			}

			let pos = getTextOffsetOfNode(container, node);
			result = offsetBase + pos;
		} else {
			console.assert(node.nodeType === 3, "nodeType is not text node");
			// 맨 처음부터 텍스트노드 길이 누적...
			result = getTextOffsetOfNode(root, node) + offset;
		}
		return result;
	}

	function getTextRangeRects(startOffset: number, endOffset: number): Rect[] {
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
		let currentPos = 0;
		let currentNode: Node | null;
		let result: Rect[] = [];
		// console.log(editorName, "getTextRangeRects", { startOffset, endOffset });

		if (startOffset === 0 && endOffset === 0) {
			let firstTextNode = walker.nextNode();
			let created = false;
			if (!firstTextNode || firstTextNode.nodeValue!.length === 0) {
				firstTextNode = document.createTextNode("\u200b");
				editor.insertBefore(firstTextNode, editor.firstChild);
				created = true;
			}
			const range = document.createRange();
			range.setStart(firstTextNode, 0);
			range.setEnd(firstTextNode, 0);
			const rects = range.getClientRects();
			for (const rect of rects) {
				result.push({
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height,
				});
			}
			if (created) {
				(firstTextNode as ChildNode).remove();
			}
		} else {
			let startNode: Text | null = null;
			let startNodeOffset = 0;
			let endNode: Text | null = null;
			let endNodeOffset = 0;

			function emit(startText: Text, startTextOffset: number, endText: Text, endTextOffset: number) {
				const range = document.createRange();
				range.setStart(startText, startTextOffset);
				range.setEnd(endText, endTextOffset);
				const rects = range.getClientRects();
				for (const rect of rects) {
					// if (result.length > 0) {
					// 	const prevRect = result[result.length - 1];
					// 	if (prevRect.height === rect.height && prevRect.x + prevRect.width === rect.x) {
					// 		prevRect.width += rect.width;
					// 		continue;
					// 	}
					// }
					result.push({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					});
				}
			}

			while ((currentNode = walker.nextNode())) {
				const nodeLen = currentNode.nodeValue!.length;
				const nodeEnd = currentPos + nodeLen;
				if (currentPos >= endOffset) {
					break;
				}

				if (endOffset >= currentPos && startOffset <= nodeEnd) {
					let start = 0;
					let end = nodeLen;

					if (currentPos < startOffset) {
						start = startOffset - currentPos;
					}
					if (nodeEnd > endOffset) {
						end = endOffset - currentPos;
					}

					if (startNode && (startNode as ChildNode).parentNode !== currentNode.parentNode) {
						emit(startNode, startNodeOffset, endNode!, endNodeOffset);
						startNode = endNode = null;
						startNodeOffset = endNodeOffset = 0;
					}

					if (startNode === null) {
						startNode = currentNode as Text;
						startNodeOffset = start;
					}
					endNode = currentNode as Text;
					endNodeOffset = end;

					// if (start <= end) {
					// 	let range = document.createRange();
					// 	range.setStart(currentNode, start);
					// 	range.setEnd(currentNode, end);
					// 	// console.log("currentNode:", { text: currentNode.nodeValue, start, end });
					// 	// console.log("range:", range);
					// 	const rects = range.getClientRects();
					// 	for (const rect of rects) {
					// 		if (result.length > 0) {
					// 			const prevRect = result[result.length - 1];
					// 			if (prevRect.height === rect.height && prevRect.x + prevRect.width === rect.x) {
					// 				prevRect.width += rect.width;
					// 				continue;
					// 			}
					// 		}
					// 		result.push({
					// 			x: rect.x,
					// 			y: rect.y,
					// 			width: rect.width,
					// 			height: rect.height,
					// 		});
					// 	}
					// }
					if (nodeEnd >= endOffset) {
						break;
					}
				}

				currentPos = nodeEnd;
			}

			if (startNode && endNode) {
				emit(startNode, startNodeOffset, endNode, endNodeOffset);
			}
		}

		if (result.length > 0) {
			// if (result[result.length - 1].width === 0) {
			// 	result.length--;
			// }
			// if (result.length > 0 && result[0].width === 0) {
			// 	result.shift();
			// }
		}

		return result;
	}

	function getTextSelectionRange(): [startOffset: number, endOffset: number] | [null, null] {
		const selection = window.getSelection();
		if (!selection || !selection.rangeCount) {
			// console.debug("no selection or range count is 0");
			return [null, null];
		}

		const range = selection.getRangeAt(0);
		const root = editor.contains(range.commonAncestorContainer) ? editor : null;
		if (!root) {
			//console.debug(editorName, "no root found", { commonAncestorContainer: range.commonAncestorContainer, startContainer: range.startContainer, endContainer: range.endContainer });
			return [null, null];
		}
		// console.debug(editorName, "range", {
		// 	commonAncestorContainer: range.commonAncestorContainer,
		// 	startContainer: range.startContainer,
		// 	endContainer: range.endContainer,
		// 	startOffset: range.startOffset,
		// 	endOffset: range.endOffset,
		// });

		let startOffset = getTextOffset(root, range.startContainer, range.startOffset);
		let endOffset = getTextOffset(root, range.endContainer, range.endOffset);
		// console.debug(editorName, "startOffset, endOffset", { startOffset, endOffset });
		if (isNaN(startOffset) || isNaN(endOffset)) {
			//	console.debug(editorName, "no start or end offset found", { startOffset, endOffset });
			return [null, null];
		}

		// if (startOffset === -1 || startOffset >= _text.length) {
		// 	startOffset = _text.length - 1;
		// }
		// if (endOffset === -1 || endOffset >= _text.length) {
		// 	endOffset = _text.length - 1;
		// }

		// if (startOffset > endOffset) {
		// 	[startOffset, endOffset] = [endOffset, startOffset];
		// }

		// console.debug(editorName, "getTextSelectionRange", { startOffset, endOffset });
		return [startOffset, endOffset];
	}

	// 문자 오프셋만으로는 브라우저에서 텍스트를 드래그하듯 완전한 범위 선택을 할 수 없다.
	// 텍스트노드 자체가 없는데 마우스로 긁으면 선택이 되는 경우가 있다. <br><br><br> 이걸 마우스로 긁거나 CTRL-A를 누르면 3줄이 선택되지만
	// 문자 오프셋으로는 이걸 표현할 수가 없다. GREEDY하게 할지 LAZY하게 할지 전혀 선택하지 않을지 하나만 선택하게 할지 가장 먼저 나타나는 것을 선택할지 가장 마지막을 선택할지
	// 사용 시나리오를 살펴봐야한다.
	// 1. 텍스트를 긁었을 때 반대쪽 에디터에서 RANGE를 만들어서 하이라이팅
	// 이 경우 처음부터 길이가 0이라면 아무것도 선택하지 않고 리턴(NULL??)
	// 그렇지 않으면 범위의 시작과 끝 부분에 있는 길이가 0인 텍스트노드는 다 무시해야한다. 중간에 있는 것들은 포함
	// 2. DIFF 범위 하이라이팅
	// 이 경우 길이가 0인 경우가 문제가 된다.
	//
	function createTextRange(startOffset: number, endOffset: number) {
		const range = document.createRange();

		let pos = 0;
		let startSet = false,
			endSet = false;

		// 실패하는 경우는 endOffset과 그 이후에 텍스트노드가 없는 경우임.

		let skipLeadingEmptyTextNodes = endOffset > startOffset;
		let skipTrailingEmptyTextNodes = endOffset > startOffset;

		function walk(node: Node) {
			if (node.nodeType === 3) {
				const text = node.nodeValue!;
				const textLen = text.length;
				const endPos = pos + textLen;
				if (!startSet && startOffset >= pos && startOffset < endPos && (!skipLeadingEmptyTextNodes || textLen > startOffset - pos)) {
					range.setStart(node, startOffset - pos);
					startSet = true;
				}
				if (startSet && endOffset >= pos && endOffset <= endPos && (!skipTrailingEmptyTextNodes || endOffset > pos)) {
					range.setEnd(node, endOffset - pos);
					endSet = true;
					return;
				}
				pos = endPos;
			} else if (node.nodeType === 1) {
				const childNodes = node.childNodes;
				if (childNodes.length > 0) {
					for (let i = 0; i < childNodes.length; i++) {
						walk(childNodes[i]);
						if (startSet && endSet) {
							return;
						}
					}
				} else {
					pos += node.textContent!.length;
				}
			}
		}

		walk(editor);
		if (!startSet) {
			let node: Node = editor;
			while (node && node.firstChild) {
				node = node.firstChild;
			}
			range.setStart(node, 0);
			// while (node && node.firstChild) {
			// 	node = node.firstChild;
			// }
			// range.setStartBefore(node);
		}
		if (!endSet) {
			let node: Node = editor;
			while (node && node.lastChild) {
				node = node.lastChild;
			}
			range.setEnd(node, 0);
		}
		// const sel = window.getSelection()!;
		// sel.removeAllRanges();
		// sel.addRange(range);
		return range;
	}

	function _createTextRange(startOffset: number, endOffset: number, startNode: Node = editor, startPos = 0) {
		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}

		const range = document.createRange();

		let startSet = false,
			endSet = false;
		let pos = startPos;

		// 실패하는 경우는 endOffset과 그 이후에 텍스트노드가 없는 경우임.

		function walk(node: Node) {
			if (node.nodeType === 3) {
				const text = node.nodeValue!;
				const textLen = text.length;
				const endPos = pos + textLen;
				if (!startSet && startOffset >= pos && startOffset < endPos) {
					range.setStart(node, startOffset - pos);
					startSet = true;
				} else if (!startSet) {
					console.log("start not set", node, startOffset, pos);
				}
				if (endOffset >= pos && endOffset <= endPos) {
					range.setEnd(node, endOffset - pos);
					console.log("found end", node, endOffset - pos, endOffset, pos);
					endSet = true;
					return;
				} else if (startSet && !endSet) {
					console.log("end not set", node, startOffset, pos);
				}
				pos = endPos;
			} else if (node.nodeType === 1) {
				const childNodes = node.childNodes;
				if (childNodes.length > 0) {
					for (let i = 0; i < childNodes.length; i++) {
						walk(childNodes[i]);
						if (startSet && endSet) {
							return;
						}
					}
				} else {
					pos += node.textContent!.length;
				}
			}
		}

		walk(startNode || editor);

		if (!startSet) {
			let node: Node = editor;
			while (node && node.firstChild) {
				node = node.firstChild;
			}
			range.setStart(node, 0);
			// while (node && node.firstChild) {
			// 	node = node.firstChild;
			// }
			// range.setStartBefore(node);
			console.log("start fallback", node);
		}
		if (!endSet) {
			let node: Node = editor;
			while (node && node.lastChild) {
				node = node.lastChild;
			}
			range.setEnd(node, 0);
			console.log("end fallback", node);
		}
		// const sel = window.getSelection()!;
		// sel.removeAllRanges();
		// sel.addRange(range);
		return range;
	}

	function createTextRange2(startOffset: number, endOffset: number): Range | null {
		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}

		const range = document.createRange();
		let startSet = false;
		let endSet = false;
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
		if (startOffset === 0 && endOffset === 0) {
			const firstChild = editor.firstChild;
			if (firstChild) {
				range.setStart(firstChild, 0);

				return range;
			}

			const firstTextNode = walker.nextNode();
			if (firstTextNode) {
				range.setStart(firstTextNode, 0);
				range.setEnd(firstTextNode, 0);
				return range;
			} else {
				return null;
			}
		}

		let currentNode;
		let pos = 0;
		while (!endSet && (currentNode = walker.nextNode())) {
			if (!startSet && pos + currentNode.nodeValue!.length >= startOffset) {
				range.setStart(currentNode, startOffset - pos);
				startSet = true;
			}
			if (!endSet && pos + currentNode.nodeValue!.length >= endOffset) {
				range.setEnd(currentNode, endOffset - pos);
				endSet = true;
			}
			pos += currentNode.nodeValue!.length;
		}

		if (startSet && endSet) {
			return range;
		} else {
			return null;
		}
	}

	function selectTextRange(startOffset: number, endOffset: number) {
		const range = createTextRange(startOffset, endOffset);
		if (range) {
			const sel = window.getSelection()!;
			sel.removeAllRanges();
			sel.addRange(range);
			return true;
		}
		return false;
	}
	// #endregion
	// =============================================================

	function mergeRects(rects: Rect[]): DiffRectSet {
		rects.sort((a, b) => a.y + a.height - (b.y + b.height));

		const merged: Rect[] = [];
		const used = new Array(rects.length).fill(false);

		let minX = Number.MAX_SAFE_INTEGER;
		let minY = Number.MAX_SAFE_INTEGER;
		let maxX = 0;
		let maxY = 0;
		for (let i = 0; i < rects.length; i++) {
			if (used[i]) continue;
			let base = rects[i];

			for (let j = i + 1; j < rects.length; j++) {
				if (used[j]) continue;
				const compare = rects[j];

				// 조기 종료: compare.y > base.y + base.height 이면 더 이상 겹칠 수 없음
				if (compare.y > base.y + base.height) break;

				// 완전 포함: base가 compare를 완전히 포함하는 경우
				if (
					base.x <= compare.x &&
					base.x + base.width >= compare.x + compare.width &&
					base.y <= compare.y &&
					base.y + base.height >= compare.y + compare.height
				) {
					used[j] = true;
					continue;
				}

				// 완전 포함: compare가 base를 완전히 포함하는 경우
				if (
					compare.x <= base.x &&
					compare.x + compare.width >= base.x + base.width &&
					compare.y <= base.y &&
					compare.y + compare.height >= base.y + base.height
				) {
					base = compare;
					used[j] = true;
					continue;
				}

				// y축 거의 같고, x축 겹치면 병합 (좌우 확장)
				const sameY = Math.abs(base.y - compare.y) < 1 && Math.abs(base.height - compare.height) < 1;
				const xOverlap = base.x <= compare.x + compare.width && compare.x <= base.x + base.width;

				if (sameY && xOverlap) {
					// 새 병합 사각형 계산
					const newX = Math.min(base.x, compare.x);
					const newWidth = Math.max(base.x + base.width, compare.x + compare.width) - newX;

					base = {
						x: newX,
						y: base.y,
						width: newWidth,
						height: base.height,
					};
					used[j] = true;
				}
			}
			merged.push(base);
			minX = Math.min(minX, base.x);
			minY = Math.min(minY, base.y);
			maxX = Math.max(maxX, base.x + base.width);
			maxY = Math.max(maxY, base.y + base.height);
			used[i] = true;
		}

		if (minX === Number.MAX_SAFE_INTEGER) {
			minX = 0;
		}
		if (minY === Number.MAX_SAFE_INTEGER) {
			minY = 0;
		}

		merged.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

		return {
			minX,
			minY,
			maxX,
			maxY,
			rects: merged,
		};
	}

	function getTextRects(startOffset: number, endOffset: number): Rect[] {
		const range = createTextRange(startOffset, endOffset);
		let result: Rect[] = [];
		if (range) {
			let { x: baseX, y: baseY } = wrapper.getBoundingClientRect();
			baseX = -baseX + wrapper.scrollLeft;
			baseY = -baseY + wrapper.scrollTop;
			const rects = range.getClientRects();
			for (const rect of rects) {
				if (rect) {
					rect.x += baseX;
					rect.y += baseY;
					result.push(rect);
				}
			}
		}

		if (result.length > 0) {
			let firstNonZero = -1;
			let lastNonZero = -1;
			for (let i = 0; i < result.length; i++) {
				if (result[i].width > 0) {
					if (firstNonZero === -1) {
						firstNonZero = i;
					}
					lastNonZero = i;
				}
			}
			if (firstNonZero !== -1 && lastNonZero !== -1) {
				result = result.slice(firstNonZero, lastNonZero + 1);
			} else if (result.length > 1) {
				result.length = 1;
			}
		}

		return result;
	}

	function calculateDiffRects() {
		const diffExpandX = 1;
		const diffExpandY = 0;
		let { x: baseX, y: baseY } = wrapper.getBoundingClientRect();
		baseX = -baseX;
		baseX += wrapper.scrollLeft;
		baseY += wrapper.scrollTop;
		_diffRects.length = 0;
		const temp: Rect[] = [];
		const allRects: Rect[] = [];
		const heightMultiplier = 1;
		for (let diffIndex = 0; diffIndex < _diffRanges.length; diffIndex++) {
			const ranges = _diffRanges[diffIndex];
			for (const range of ranges) {
				const rects = range.getClientRects();
				for (const rect of rects) {
					if (rect) {
						const newHeight = rect.height * heightMultiplier;
						const heightDelta = newHeight - rect.height;
						rect.x += baseX - diffExpandX;
						rect.y += baseY - heightDelta / 2 - diffExpandY;
						rect.width += diffExpandX * 2;
						rect.height = newHeight + diffExpandY * 2;
					}
					temp.push(rect);
					allRects.push(rect);
				}
			}
			_diffRects[diffIndex] = mergeRects(temp);
			// console.log(editorName, diffIndex, "beforeMerge", Array.from(temp), "afterMerge", _diffRects[diffIndex]);
			temp.length = 0;
		}

		_diffLineRects.length = 0;

		const canvasWidth = staticCanvas.width;
		allRects.sort((a, b) => a.y - b.y);

		let lineRect: Rect | null = null;
		const lineExpandY = 4;
		const lineHeightMultiplier = 1.1;
		for (const rect of allRects) {
			const y = rect.y - lineExpandY;
			const height = rect.height * lineHeightMultiplier + lineExpandY * 2;
			//const height = rect.height + lineExpand * 2;
			if (lineRect === null || y > lineRect.y + lineRect.height) {
				lineRect = {
					x: 0,
					y: y,
					width: canvasWidth,
					height: height,
				};
				_diffLineRects.push(lineRect);
			} else {
				lineRect.height = y + height - lineRect.y;
			}
		}
	}

	function renderAll() {
		_renderLayers[DIFF_LAYER].dirty = true;
		_renderLayers[HIGHLIGHT_LAYER].dirty = true;
		render();
	}

	function render(imediate = false) {
		if (!imediate) {
			if (_renderPending) {
				return;
			}
			_renderPending = true;
			requestAnimationFrame(() => {
				render(true);
				_renderPending = false;
			});
			return;
		}

		if (_renderLayers[DIFF_LAYER].dirty) {
			renderDiffLayer();
			_renderLayers[DIFF_LAYER].dirty = false;
		}
		if (_renderLayers[HIGHLIGHT_LAYER].dirty) {
			renderHighlightLayer();
			_renderLayers[HIGHLIGHT_LAYER].dirty = false;
		}
	}

	function renderDiffLayer() {
		if (_diffRectsDirty) {
			calculateDiffRects();
			_diffRectsDirty = false;
		}

		const visibilityChangeEntries: VisibilityChangeEntry[] = [];

		const ctx = staticCanvasCtx;
		const canvasWidth = staticCanvas.width,
			canvasHeight = staticCanvas.height;

		if (_hasRenderedAny) {
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);
			_hasRenderedAny = false;
		}

		const scrollTop = wrapper.scrollTop;
		const scrollLeft = wrapper.scrollLeft;

		ctx.fillStyle = "hsl(0 100% 95%)";
		for (const rect of _diffLineRects) {
			const x = Math.floor(rect.x - scrollLeft),
				y = Math.floor(rect.y - scrollTop),
				width = Math.ceil(rect.width),
				height = Math.ceil(rect.height);

			if (y + height < 0 || y > canvasHeight) continue;
			if (x + width < 0 || x > canvasWidth) continue;
			ctx.fillRect(x, y, width, height);
			_hasRenderedAny = true;
		}

		for (let diffIndex = 0; diffIndex < _diffRects.length; diffIndex++) {
			const diffRectSet = _diffRects[diffIndex];

			let previouslyVisible = _visibleDiffIndices.has(diffIndex);
			let isVisible =
				!(diffRectSet.maxY - scrollTop < 0 || diffRectSet.minY - scrollTop > canvasHeight) &&
				!(diffRectSet.maxX - scrollLeft < 0 || diffRectSet.minX - scrollLeft > canvasWidth);

			if (isVisible !== previouslyVisible) {
				if (isVisible) {
					_visibleDiffIndices.add(diffIndex);
				} else {
					_visibleDiffIndices.delete(diffIndex);
				}
				visibilityChangeEntries.push({
					item: diffIndex,
					isVisible,
				});
			}

			if (!isVisible) {
				continue;
			}

			const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];
			ctx.fillStyle = `hsl(${hue} 100% 80%)`;
			ctx.strokeStyle = `hsl(${hue} 100% 40% / 0.5)`;
			for (const rect of diffRectSet.rects) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0 || y > canvasHeight) continue;
				if (x + width < 0 || x > canvasWidth) continue;

				ctx.strokeRect(x, y, width, height);
				ctx.fillRect(x, y, width, height);
				_hasRenderedAny = true;
			}
		}

		if (visibilityChangeEntries.length > 0) {
			onDiffVisibilityChanged(visibilityChangeEntries);
		}
	}

	// function doRenderRects(ctx: CanvasRenderingContext2D, rects: Rect[], fillColor: string, strokeColor?: string) {
	// 	const scrollTop = wrapper.scrollTop;
	// 	const scrollLeft = wrapper.scrollLeft;
	// 	ctx.fillStyle = fillColor;
	// 	if (strokeColor) {
	// 		ctx.strokeStyle = strokeColor;
	// 	}

	// 	for (const rect of rects) {
	// 		const x = Math.floor(rect.x - scrollLeft),
	// 			y = Math.floor(rect.y - scrollTop),
	// 			width = Math.ceil(rect.width),
	// 			height = Math.ceil(rect.height);

	// 		if (y + height < 0 || y > _canvasHeight) continue;
	// 		if (x + width < 0 || x > _canvasWidth) continue;
	// 		if (fillColor) {
	// 			ctx.fillRect(x, y, width, height);
	// 		}
	// 		if (strokeColor) {
	// 			ctx.strokeRect(x, y, width, height);
	// 		}
	// 	}
	// }

	// len이 0인 span이 들어있을 수 있다.
	function getTextRanges(spans: Span[]) {
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
		let currentNode: Node | null = walker.nextNode();
		let pos = 0;
		const result: Range[] = new Array(spans.length);

		function create(startOffset: number, endOffset: number) {
			const range = document.createRange();
			if (currentNode) {
				let startSet = false;
				do {
					const nodeText = currentNode!.nodeValue!;
					const nodeStart = pos;
					const nodeEnd = pos + nodeText.length;

					if (!startSet && startOffset >= nodeStart && startOffset < nodeEnd) {
						range.setStart(currentNode!, startOffset - nodeStart);
						startSet = true;
					}

					if (startSet && endOffset <= nodeEnd) {
						range.setEnd(currentNode!, endOffset - nodeStart);
						break;
					}
					pos = nodeEnd;
				} while ((currentNode = walker.nextNode()));
			}
			return range;
		}

		for (let i = 0; i < spans.length; i++) {
			const span = spans[i];
			if (span.len > 0) {
				const startOffset = span.pos;
				const endOffset = span.pos + span.len;
				const range = create(startOffset, endOffset);
				if (range.startContainer === document || range.endContainer === document) {
					throw new Error("range is not valid");
				}
				result[i] = range;
			}
		}

		for (let i = 0; i < spans.length; i++) {
			if (!result[i]) {
				const range = document.createRange();
				if (i > 0) {
					range.setStart(range.endContainer, range.endOffset);
				} else {
					range.setStart(editor, 0);
				}
				range.setEnd(editor, editor.childNodes.length);
			}
		}

		return result;
	}

	function renderHighlightLayer() {
		const ctx = highlightCanvasCtx;
		const canvasWidth = _canvasWidth,
			canvasHeight = _canvasHeight;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const scrollTop = wrapper.scrollTop;
		const scrollLeft = wrapper.scrollLeft;

		if (_textSelectionHighlight) {
			let item = _textSelectionHighlight.renderItem;
			if (!item) {
				const rects = getTextRects(_textSelectionHighlight.startOffset, _textSelectionHighlight.endOffset);
				const merged = mergeRects(rects);
				item = _textSelectionHighlight.renderItem = {
					rects: merged.rects,
					minX: merged.minX,
					minY: merged.minY,
					maxX: merged.maxX,
					maxY: merged.maxY,
				};
			}

			if (isRectVisible(item.minY, item.maxY, item.minX, item.maxX, scrollTop, scrollLeft, canvasWidth, canvasHeight)) {
				ctx.fillStyle = TEXT_SELECTION_HIGHLIGHT_FILL_STYLE;

				for (const rect of item.rects) {
					const x = Math.floor(rect.x - scrollLeft),
						y = Math.floor(rect.y - scrollTop),
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y + height < 0 || y > _canvasHeight) continue;
					if (x + width < 0 || x > _canvasWidth) continue;
					ctx.fillRect(x, y, width, height);
				}
			}
		}

		function doRender(items: RenderItem[]) {
			for (const item of items) {
				const x = Math.floor(item.x - scrollLeft),
					y = Math.floor(item.y - scrollTop),
					width = Math.ceil(item.w),
					height = Math.ceil(item.h);

				if (y + height < 0 || y > canvasHeight) continue;
				if (x + width < 0 || x > canvasWidth) continue;

				if (item.fillStyle) {
					ctx.fillStyle = item.fillStyle;
					ctx.fillRect(x, y, width, height);
				}
				if (item.strokeStyle) {
					ctx.strokeStyle = item.strokeStyle;
					ctx.strokeRect(x, y, width, height);
				}
			}
		}

		if (_diffHighlightItems && _diffHighlightItems.length > 0) {
			ctx.save();
			ctx.lineWidth = 2; // 선 굵기 조절

			// 글로우 효과 설정
			ctx.shadowColor = "hsl(0 100% 80%)"; // 그림자 색깔 = 빛나는 색깔
			ctx.shadowBlur = 15; // 얼마나 퍼질지

			doRender(_diffHighlightItems);

			ctx.restore();
		}

		// if (_textHighlightItems && _textHighlightItems.length > 0) {
		// 	doRender(_textHighlightItems);
		// 	// for (const item of _textHighlightItems) {
		// 	// 	const x = Math.floor(item.x - scrollLeft),
		// 	// 		y = Math.floor(item.y - scrollTop),
		// 	// 		width = Math.ceil(item.w),
		// 	// 		height = Math.ceil(item.h);

		// 	// 	if (y + height < 0 || y > canvasHeight) continue;
		// 	// 	if (x + width < 0 || x > canvasWidth) continue;

		// 	// 	ctx.fillStyle = item.fillStyle || "hsl(210 100% 80%)";
		// 	// 	ctx.fillRect(x, y, width, height);
		// 	// 	console.log("highlight", { x, y, width, height });
		// 	// }
		// }
	}

	function sliceText(startOffset: number, endOffset: number): string {
		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
		let currentNode;
		let pos = 0;
		let result = "";
		while ((currentNode = walker.nextNode())) {
			const nodeLen = currentNode.nodeValue!.length;
			const nodeEnd = pos + nodeLen;
			if (nodeEnd >= startOffset && pos <= endOffset) {
				let start = 0;
				let end = nodeLen;

				if (pos < startOffset) {
					start = startOffset - pos;
				}
				if (nodeEnd > endOffset) {
					end = endOffset - pos;
				}

				result += currentNode.nodeValue!.slice(start, end);
				if (nodeEnd >= endOffset) {
					break;
				}
			}
			pos = nodeEnd;
		}
		return result;
	}

	function update(ctx: DiffContext) {
		if (!ctx.done) {
			return;
		}

		const started = performance.now();
		_diffRanges.length = 0;
		_diffRects.length = 0;
		_diffLineRects.length = 0;
		_visibleDiffIndices.clear();

		let pos = 0; // 전체 텍스트 위치 누적
		let diffPos: number;
		let diffEndPos: number;

		const diffs = ctx.diffs!;

		let currentNode = editor.firstChild;
		function advance(skipChildren = false): boolean {
			if (!currentNode || currentNode === editor) {
				return false;
			}

			if (!skipChildren && currentNode.firstChild) {
				currentNode = currentNode.firstChild;
				return true;
			}

			let node: Node | null = currentNode;
			while (node && node !== editor) {
				if (node.nextSibling) {
					currentNode = node.nextSibling;
					return true;
				}
				node = node.parentNode;
			}

			currentNode = null;
			return false;
		}

		function collectRanges(): Range[] {
			if (!currentNode) {
				throw new Error("currentNode is null");
			}

			const ranges: Range[] = [];
			while (currentNode) {
				if (currentNode.nodeType === 3) {
					const text = currentNode.nodeValue!;
					const nodeStart = pos;
					let nodeEnd = nodeStart + text.length;

					if (diffEndPos < nodeStart) {
						break;
					}

					if (diffPos <= nodeEnd) {
						const startOffset = Math.max(0, diffPos - nodeStart);
						const endOffset = Math.min(text.length, diffEndPos - nodeStart);
						const range = document.createRange();
						range.setStart(currentNode, startOffset);
						range.setEnd(currentNode, endOffset);
						ranges.push(range);
					}
					if (diffEndPos < nodeEnd) {
						// done this diff
						// console.log(2, editorName, "diffEndPos <= nodeEnd", { diffEndPos, nodeEnd });
						break;
					}
					pos = nodeEnd;
					advance();
				} else if (currentNode.nodeType === 1) {
					const nodeStart = Number((currentNode as HTMLElement).dataset.startOffset);
					const nodeEnd = Number((currentNode as HTMLElement).dataset.endOffset);
					if (!isNaN(nodeStart) && !isNaN(nodeEnd)) {
						if (nodeStart >= diffPos && nodeEnd <= diffEndPos) {
							// console.log(3, editorName, "nodeStart, nodeEnd", { currentNode, nodeStart, nodeEnd });
							if (currentNode.nodeName === "P" || INLINE_ELEMENTS[currentNode.nodeName]) {
								const range = document.createRange();
								range.selectNodeContents(currentNode);
								ranges.push(range);

								pos = nodeEnd;
								advance(true);
								if (diffEndPos <= pos) {
									// done this diff
									break;
								}
								continue;
							}
						}
						if (diffPos > nodeEnd) {
							// console.log(4, editorName, "diffPos >= nodeEnd", { diffPos, nodeEnd });
							pos = nodeEnd;
							advance(true);
							continue;
						}
					}
					// console.log(editorName, "children", Array.from(currentNode.childNodes));
					// console.log(5, editorName, "advance", { currentNode });
					advance();
					continue;
				} else {
					console.warn(editorName, "unknown node type", { currentNode });
					advance();
					continue;
				}
			}

			return ranges;
		}

		const result: Range[][] = [];
		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			const diff = diffs[diffIndex];
			const span = diff[editorName];
			diffPos = span.pos;
			diffEndPos = span.pos + span.len;
			const ranges = collectRanges();
			result[diffIndex] = ranges;
			_diffRanges[diffIndex] = ranges;
		}

		const end = performance.now();
		console.log(editorName, "update", end - started);

		_diffRectsDirty = true;
		renderAll();
	}

	function setLayerDirty(layerIndex: number) {
		_renderLayers[layerIndex].dirty = true;
		render();
	}

	function applyTextSelectionHighlight(startOffset: number, endOffset: number) {
		if (_textSelectionHighlight?.startOffset === startOffset && _textSelectionHighlight?.endOffset === endOffset) {
			return;
		}

		_textSelectionHighlight = {
			startOffset,
			endOffset,
		};

		// let { x: baseX, y: baseY } = wrapper.getBoundingClientRect();
		// baseX = -baseX;
		// baseX += wrapper.scrollLeft;
		// baseY += wrapper.scrollTop;

		setLayerDirty(HIGHLIGHT_LAYER);
		renderHighlightLayer();
	}

	function clearTextSelectionHighlight() {
		_textSelectionHighlight = null;
		renderHighlightLayer();
	}

	let _highlightedDiffIndex: number | null = null;
	function applyDiffHighlight(diffIndex: number) {
		if (diffIndex === _highlightedDiffIndex) {
			return;
		}
		_highlightedDiffIndex = diffIndex;

		if (diffIndex >= 0 && diffIndex < _diffRects.length) {
			const rectSet = _diffRects[diffIndex];
			_diffHighlightItems = rectSet.rects.map((rect) => {
				return {
					x: rect.x,
					y: rect.y,
					w: rect.width,
					h: rect.height,
					strokeStyle: "hsl(0 100% 50%)",
					type: "diffhighlight",
				};
			});
		}

		renderHighlightLayer();
	}

	function clearDiffHighlight() {
		_highlightedDiffIndex = null;
		_diffHighlightItems = null;
		renderHighlightLayer();
	}

	// temp
	setTimeout(onChange, 0);

	// 앵커를 어떤식으로 추가할지
	// 1. classList에 넣고 anchor:before
	// 2. <a> 태그를 넣는다

	function insertAnchorBefore(tokenIndex: number): HTMLElement | null {
		const token = _tokens[tokenIndex];
		const range = _ranges[tokenIndex];
		// console.log("insertAnchorBefore", tokenIndex, token, range);
		let el: Node | null = null;
		// if (token.flags & TABLE_START) {
		// 	// console.log("insertAnchorBefore: TABLE_START", tokenIndex, token);
		// 	el = (range.startContainer.parentNode as HTMLElement).closest("table");
		// }

		if (!el) {
			el = range.startContainer;
			if (el.nodeType === 3) {
				//console.assert(range.startOffset === 0);
			} else if (el.nodeType === 1) {
				console.assert(range.startOffset < range.startContainer.childNodes.length);
				el = el.childNodes[range.startOffset];
			}
		}

		if (!el) return null;

		if (el.previousSibling && el.previousSibling.nodeName === "A") {
			return el.previousSibling as HTMLElement;
		}

		const anchorEl = document.createElement("A");
		anchorEl.classList.add("anchor");
		el.parentNode!.insertBefore(anchorEl, el);

		// (el as HTMLElement).dataset.anchor = String(_anchorElements.length);
		// (el as HTMLElement).classList.add("anchor");
		// _anchorElements.push(el as HTMLElement);
		return anchorEl;
	}

	function insertAnchorAfter(tokenIndex: number): HTMLElement | null {
		const token = _tokens[tokenIndex];
		if (!token) {
			return null;
		}

		const range = _ranges[tokenIndex];
		// console.log("insertAnchorAfter", tokenIndex, token, range);
		let el: Node | null = null;
		// if (token.flags & TABLE_START) {
		// 	// console.log("insertAnchorAfter: TABLE_START", tokenIndex, token);
		// 	el = (range.startContainer.parentNode as HTMLElement).closest("table");
		// }

		console.log("insertAnchorAfter", tokenIndex, token, range);
		let parent: Node;
		let before: Node | null = null;
		if (range.endContainer.nodeType === 3) {
			parent = range.endContainer.parentNode!;
			before = range.endContainer.nextSibling;
		} else if (range.endContainer.nodeType === 1) {
			parent = range.endContainer;
			before = range.endContainer.childNodes[range.endOffset]?.nextSibling || null;
		} else {
			console.warn("Unexpected node type in range.endContainer", range.endContainer);
			return null;
		}
		
		if (before && before.nodeName === "A") {
			return before as HTMLElement;
		}

		const anchorEl = document.createElement("A");
		anchorEl.classList.add("anchor");
		parent.insertBefore(anchorEl, before);

		return anchorEl;
	}

	function findAnchorTargetElement(tokenIndex: number): HTMLElement | null {
		const token = _tokens[tokenIndex];
		const range = _ranges[tokenIndex];
		// let parent: HTMLElement | null = null;
		// let childIndex = 0;
		// if (token.flags & TABLE_START) {
		// 	[parent, childIndex] = findClosestTable(range.startContainer);
		// }

		let el = range.startContainer;

		// 찾을 수 있는 가장 상위 요소를 찾는데
		// 1. TEXT_FLOW_CONTAINER의 자식이면서

		while (!BLOCK_ELEMENTS[el.nodeName]) {
			el = el.parentNode!;
			if (!el || el === editor) {
				console.warn("couldn't find appropriate element for anchor");
				return null;
			}
		}

		// (el as HTMLElement).dataset.anchor = String(_anchorElements.length);
		// (el as HTMLElement).classList.add("anchor");
		// _anchorElements.push(el as HTMLElement);
		return el as HTMLElement;
	}

	const { tokenize } = (function () {
		const TIMEOUT = 200;

		let _contextId = 0;
		let _callbackId: number | null = null;
		let _startTime = 0;

		type TokinizeContext = {
			id: number;
		};

		function* tokenizeGenerator(ctx: TokinizeContext) {
			let idleDeadline: IdleDeadline = yield;
			let nodeCounter = 0;

			// console.log("BEFORE!", editorName, "tokenize", editor.textContent);
			const startTime = performance.now();
			let textPos = 0;
			let tokenIndex = 0;

			let currentToken: Token | null = null;
			let currentRange: Range | null = null;

			// function processToken(str: string, start: number, length: number) {
			// 	if (currentToken) {
			// 		currentToken.text += str;
			// 		currentToken.len = textPos - currentToken.pos;
			// 	} else {
			// 		currentToken = {
			// 			text: str,
			// 			pos: start,
			// 			len: length,
			// 			flags: 0,
			// 			lineNum: 0,
			// 		};
			// 	}
			// }

			function processToken2(text: Text, startOffset: number, endOffset: number) {
				if (currentToken) {
					currentToken.text += text.nodeValue!.slice(startOffset, endOffset);
					currentToken.len += endOffset - startOffset;
					currentRange!.setEnd(text, endOffset);
				} else {
					currentToken = {
						text: text.nodeValue!.slice(startOffset, endOffset),
						pos: textPos + startOffset,
						len: endOffset - startOffset,
						flags: 0,
						lineNum: 0,
					};
					currentRange = document.createRange();
					currentRange.setStart(text, startOffset);
					currentRange.setEnd(text, endOffset);
				}
			}

			function finalizeToken(flags: number = 0) {
				if (currentToken) {
					currentToken.flags |= flags;
					_tokens[tokenIndex] = currentToken;
					_ranges[tokenIndex] = currentRange!;
					currentToken = null;
					tokenIndex++;
					return 1;
				}
				return 0;
			}

			function* traverse(node: Node): Generator<unknown, void, IdleDeadline> {
				if (ctx.id !== _contextId) {
					throw new Error("cancelled");
				}

				if ((++nodeCounter & 31) === 0) {
					if (idleDeadline.timeRemaining() < 1) {
						idleDeadline = yield;
					}
				}

				let currentStart = -1;
				if (node.nodeType === 3) {
					const text = node.nodeValue!;
					if (text.length === 0) return;

					for (let i = 0; i < text.length; i++) {
						const char = text[i];
						if (spaceChars[char]) {
							if (currentStart >= 0) {
								processToken2(node as Text, currentStart, i);
								currentStart = -1;
							}
							finalizeToken();
						} else {
							if (currentStart < 0) {
								currentStart = i;
							}
						}
					}

					if (currentStart >= 0) {
						processToken2(node as Text, currentStart, text.length);
					}
					textPos += text.length;
				} else if (node.nodeType === 1) {
					if (node.nodeName === "BR") {
						finalizeToken(LINE_END);
						return;
					}

					if ((node as HTMLElement).className === "img") {
						finalizeToken();
						currentToken = {
							text: (node as HTMLElement).dataset.src || (node as HTMLImageElement).src || "🖼️",
							pos: textPos,
							len: node.textContent!.length,
							lineNum: 0,
							flags: IMAGE | NO_JOIN,
						};
						currentRange = document.createRange();
						currentRange.setStart(node, 0);
						currentRange.setEnd(node, node.childNodes.length);
						finalizeToken();
						textPos += node.textContent!.length; // 아마도 0이겠지
						return;
					}

					(node as HTMLElement).dataset.startOffset = String(textPos);

					if (TEXT_FLOW_CONTAINERS[node.nodeName]) {
						finalizeToken(CONTAINER_END | LINE_END);
					}

					const isTextFlowContainer = TEXT_FLOW_CONTAINERS[node.nodeName];
					const numTokensBefore = tokenIndex;

					for (const child of node.childNodes) {
						yield* traverse(child);
					}

					if (BLOCK_ELEMENTS[node.nodeName]) {
						finalizeToken();
					}

					const firstToken = _tokens[numTokensBefore];
					const lastToken = _tokens[tokenIndex - 1];
					if (isTextFlowContainer) {
						if (firstToken) {
							firstToken.flags |= CONTAINER_START | LINE_START;
						}
						if (lastToken) {
							lastToken.flags |= CONTAINER_END | LINE_END;
						}
					}
					if (node.nodeName === "P") {
						if (firstToken) {
							firstToken.flags |= LINE_START;
						}
						if (lastToken) {
							lastToken.flags |= LINE_END;
						}
					}
					if (node.nodeName === "TR") {
						if (firstToken) {
							firstToken.flags |= TABLEROW_START;
						}
						if (lastToken) {
							lastToken.flags |= TABLEROW_END;
						}
					}
					if (node.nodeName === "TD" || node.nodeName === "TH") {
						if (firstToken) {
							firstToken.flags |= TABLECELL_START;
						}
						if (lastToken) {
							lastToken.flags |= TABLECELL_END;
						}
					}

					if (node.nodeName === "TABLE") {
						if (firstToken) {
							firstToken.flags |= TABLE_START;
						}
						if (lastToken) {
							lastToken.flags |= TABLE_END;
						}
					}

					(node as HTMLElement).dataset.endOffset = String(textPos);

					// currentContainer = containerStack.pop()!;
				}
			}

			yield* traverse(editor);
			finalizeToken();
			_tokens.length = tokenIndex;
			_ranges.length = tokenIndex;
			const endTime = performance.now();
			console.log(editorName, "tokenize", Math.ceil(endTime - startTime) + "ms", { _tokens, _ranges });
		}

		function tokenize() {
			_startTime = performance.now();

			const ctx: TokinizeContext = {
				id: ++_contextId,
			};
			const generator = tokenizeGenerator(ctx);
			const step = (idleDeadline: IdleDeadline) => {
				_callbackId = null;
				try {
					const { done } = generator.next(idleDeadline);
					if (done) {
						const endTime = performance.now();
						console.log(editorName, "tokenize done", Math.ceil(endTime - _startTime) + "ms", { _tokens, _ranges });
						onTokenizeDone();
					} else {
						if (ctx.id === _contextId) {
							_callbackId = requestIdleCallback(step, { timeout: TIMEOUT });
						} else {
							console.log(editorName, "tokenize cancelled");
						}
					}
				} catch (e) {
					if ((e as Error).message === "cancelled") {
						console.log(editorName, "tokenize cancelled");
					} else {
						console.error(editorName, "tokenize error", e);
					}
				}
			};
			_callbackId = requestIdleCallback(step, { timeout: TIMEOUT });
		}

		return { tokenize };
	})();

	return {
		insertAnchorBefore,
		insertAnchorAfter,
		findAnchorTargetElement,
		createTextRange2,
		update,
		sliceText,
		name: editorName,
		wrapper,
		editor,
		// updateText,
		// setText,
		scrollToDiff,
		scrollToHeading,
		// saveCaret,
		// restoreCaret,
		getVisibleAnchors,
		getFirstVisibleAnchor,
		scrollToLine,
		getFirstVisibleLineElement,
		getClosestAnchorToCaret: getClosestAnchorToCaret,
		setEditMode,
		getTextSelectionRange,
		selectTextRange,
		createTextRange,
		getTextRects,
		applyTextHighlight: applyTextSelectionHighlight,
		clearTextHighlight: clearTextSelectionHighlight,
		applyDiffHighlight,
		clearDiffHighlight,
		getRangeForToken,
		// 그냥 states 객체를 하나 만들어서 리턴할까...
		// get text() {
		// 	return _text;
		// },
		get lineElements() {
			return _lineElements;
		},
		get diffElements() {
			return _diffElements;
		},
		get visibleAnchors() {
			return _visibleAnchors;
		},
		get anchorElements() {
			return _anchorElements;
		},
		get visibleDiffIndices() {
			return _visibleDiffIndices;
		},
		get tokens() {
			return _tokens;
		},
		get ranges() {
			return _ranges;
		},
	};

	function getRangeForToken(index: number, count: number = 1) {
		const ranges = _ranges;
		const range = document.createRange();
		if (count === 1) {
			return ranges[index];
		}

		if (count > 1) {
			range.setStart(ranges[index].startContainer, ranges[index].startOffset);
			range.setEnd(ranges[index + count - 1].endContainer, ranges[index + count - 1].endOffset);
			return range;
		}

		if (index > 0) {
			const prevRange = ranges[index - 1];
			range.setStart(prevRange.endContainer, prevRange.endOffset);
		} else {
			range.setStart(editor, 0);
		}

		if (index < ranges.length) {
			const nextRange = ranges[index];
			console.log("next range", nextRange);
			range.setEnd(nextRange.startContainer, nextRange.startOffset);
		} else {
			range.setEnd(editor, editor.childNodes.length);
		}
		return range;
	}
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];
