type EditorCallbacks = {
	onDiffVisibilityChanged: (entries: VisibilityChangeEntry[]) => void;
	onTextChanged: () => void;
};

type VisibilityChangeEntry = {
	item: number | string;
	isVisible: boolean;
};

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
	const _diffLineRects: DiffRect[] = [];
	const _highlightItems: RenderItem[] = [];

	let _textHighlightItems: RenderItem[] | null = null;
	let _diffHighlightItems: RenderItem[] | null = null;
	let _updateStaticCanvasPending = false;

	let _diffRectsDirty = true;
	let _hasRenderedAny = false;
	let _editMode = false;

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

	const EDITOR_INNER_HTML = "<p><br></p>";
	const editor = document.createElement("div");
	editor.id = editorName + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "true";
	editor.spellcheck = false;
	editor.innerHTML = EDITOR_INNER_HTML;

	wrapper.appendChild(staticCanvas);
	wrapper.appendChild(highlightCanvas);
	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	const resizeObserver = new ResizeObserver(() => {
		const rect = wrapper.getBoundingClientRect();
		staticCanvas.width = rect.width;
		staticCanvas.height = rect.height;
		highlightCanvas.width = rect.width;
		highlightCanvas.height = rect.height;
		_diffRectsDirty = true;
		render();
	});
	resizeObserver.observe(wrapper);

	// *** HTML 붙여넣기를 허용할 때만 사용할 코드 ***
	// 지금은 관련 코드를 다 지워버렸고 복구하려면 깃허브에서 이전 코드를 뒤져야함...
	const { observeEditor, unobserveEditor } = (() => {
		const mutationObserver = new MutationObserver((mutations) => {
			// for (const mutation of mutations) {
			// 	if (mutation.type === "childList") {
			// 		for (const node of mutation.addedNodes) {
			// 			// 보통 브라우저는 span이나 font 태그를 입혀서 스타일을 넣어준다...
			// 			if (node.nodeName === "SPAN" || node.nodeName === "FONT") {
			// 				if (node.childNodes.length === 1 && node.firstChild?.nodeType === 3) {
			// 					node.parentNode?.replaceChild(node.firstChild, node);
			// 				}
			// 			}
			// 		}
			// 	}
			// 	// 기존 태그에 style을 바로 넣어주는 경우가 있는지는 모르겠지만 안전빵으로...
			// 	if (mutation.type === "attributes" && mutation.attributeName === "style") {
			// 		(mutation.target as HTMLElement).removeAttribute("style");
			// 	}
			// }

			if (editor.childNodes.length === 0) {
				console.log("WTF??");
				editor.innerHTML = EDITOR_INNER_HTML;
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

	let _pasteCounter = 0;
	let _sanitizeCallbackId: number | null = null;
	// function sanitize(rawHTML: string) {
	// 	const START_TAG = "<!--StartFragment-->";
	// 	const END_TAG = "<!--EndFragment-->";
	// 	const startIndex = rawHTML.indexOf(START_TAG);
	// 	if (startIndex >= 0) {
	// 		const endIndex = rawHTML.lastIndexOf(END_TAG);
	// 		if (endIndex >= 0) {
	// 			rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
	// 		} else {
	// 			rawHTML = rawHTML.slice(startIndex + START_TAG.length);
	// 		}
	// 	}

	// 	const func = sanitizer(rawHTML);
	// 	const counter = ++_pasteCounter;
	// 	const step = (idleDeadline: IdleDeadline) => {
	// 		_sanitizeCallbackId = null;
	// 		const { done, value } = func.next(idleDeadline);
	// 		if (!done && counter === _pasteCounter) {
	// 			_sanitizeCallbackId = requestIdleCallback(step, { timeout: 100 });
	// 		} else if (done) {
	// 			const selection = window.getSelection()!;
	// 			const range = selection.getRangeAt(0);
	// 			range.deleteContents();
	// 			console.log("deleted contents");
	// 			range.insertNode(value);
	// 			console.log("inserted node:", value);
	// 			// editor.replaceChildren(value);
	// 			onTextChanged();
	// 		}
	// 	};
	// 	_sanitizeCallbackId = requestIdleCallback(step, { timeout: 100 });
	// }

	function insertFragmentWithPSplit(fragment: DocumentFragment) {
		const selection = window.getSelection();
		if (!selection?.rangeCount) return;

		const range = selection.getRangeAt(0);

		// 1. 커서가 위치한 p 태그를 찾기
		let p = range.startContainer;
		while (p && p.nodeName !== "P") p = p.parentNode!;
		if (!p) {
			// p 안이 아니면 그냥 붙여넣기
			range.insertNode(fragment);
			return;
		}

		// 2. 텍스트 노드면 splitText 처리
		if (range.startContainer.nodeType === Node.TEXT_NODE) {
			const textNode = range.startContainer;
			const offset = range.startOffset;

			const beforeText = textNode.nodeValue!.slice(0, offset);
			const afterText = textNode.nodeValue!.slice(offset);

			const beforeNode = document.createTextNode(beforeText);
			const afterNode = document.createTextNode(afterText);

			const parent = textNode.parentNode!;
			parent.replaceChild(afterNode, textNode);
			parent.insertBefore(beforeNode, afterNode);

			range.setStartAfter(beforeNode);
			range.setEndAfter(beforeNode);
		}

		// 3. 앞부분 추출 (커서 이전)
		const beforeRange = range.cloneRange();
		beforeRange.setStartBefore(p);
		beforeRange.setEnd(range.startContainer, range.startOffset);
		const beforeFragment = beforeRange.cloneContents();

		// 4. 뒷부분 추출 (커서 이후)
		const afterRange = range.cloneRange();
		afterRange.setStart(range.startContainer, range.startOffset);
		afterRange.setEndAfter(p);
		const afterFragment = afterRange.cloneContents();

		// 5. 새로운 <p>들 생성
		const pBefore = document.createElement("p");
		pBefore.appendChild(beforeFragment);

		const pAfter = document.createElement("p");
		pAfter.appendChild(afterFragment);

		// 6. 원래 <p> 제거하고 새것들 삽입
		const parent = p.parentNode!;
		parent.insertBefore(pBefore, p);
		parent.insertBefore(fragment, p);
		parent.insertBefore(pAfter, p);
		parent.removeChild(p);

		// 7. 커서 이동 (optional)
		const newRange = document.createRange();
		newRange.setStartAfter(fragment.lastChild || fragment);
		newRange.collapse(true);
		selection.removeAllRanges();
		selection.addRange(newRange);
	}

	editor.addEventListener("paste", (e) => {
		let t1 = performance.now();
		let rawHTML = e.clipboardData?.getData("text/html");
		let t2 = performance.now();
		console.log("get html time:", t2 - t1);
		if (!rawHTML) {
			return;
		}

		e.preventDefault();

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

		const selection = window.getSelection()!;
		const range = selection.getRangeAt(0);
		range.deleteContents();
		const frag = range.createContextualFragment(rawHTML);
		const [sanitized, hasBlockElements] = sanitizeNode(frag);

		insertFragmentSmart(sanitized as DocumentFragment, hasBlockElements);
		// range.insertNode(sanitized);
		onTextChanged();

		// sanitize(rawHTML);

		// editor.contentEditable = "true";
		// t1 = performance.now();
		// const node = sanitizeHTML(html);
		// t2 = performance.now();
		// console.log("sanitizeHTML time:", t2 - t1);

		// t1 = performance.now();
		// editor.replaceChildren(node);
		// t2 = performance.now();
		// console.log("replaceChildren time:", t2 - t1);

		// t1 = performance.now();
		// onTextChanged();
		// t2 = performance.now();
		// console.log("onTextChanged time:", t2 - t1);
	});

	editor.addEventListener("input", () => {
		onTextChanged();
	});

	wrapper.addEventListener("scroll", () => {
		render();
	});

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

	function findLineIndexByPos(pos: number, low = 0, high = _lineHints.length - 1) {
		const lineHints = _lineHints;
		if (lineHints.length === 0) return -1;

		if (pos < 0) return -1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const hint = lineHints[mid];
			const start = hint.pos;
			const end = mid + 1 < lineHints.length ? lineHints[mid + 1].pos : Infinity;

			if (pos < start) {
				high = mid - 1;
			} else if (pos >= end) {
				low = mid + 1;
			} else {
				return mid;
			}
		}

		return -1; // pos가 마지막 줄 end를 넘어간 경우

		// let mid;
		// while (low <= high) {
		// 	mid = (low + high) >> 1;
		// 	const lineEl = _lineElements[mid];
		// 	const linePos = Number(lineEl.dataset.pos);
		// 	if (linePos === pos) {
		// 		return mid;
		// 	}
		// 	if (linePos > pos) {
		// 		high = mid - 1;
		// 	} else {
		// 		low = mid + 1;
		// 	}
		// }
		// return high;
	}

	// =============================================================
	// 텍스트 선택 영역 관련
	// 지저분하지만.. 섣불리 건들면 한시간 날아간다!
	// =============================================================
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

	function getTextRangeRects(startOffset: number, endOffset: number): DiffRect[] {
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
		let currentPos = 0;
		let currentNode: Node | null;
		let result: DiffRect[] = [];
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
				console.log("found rects:", rect);
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

		console.log(editorName, "getTextRangeRects", { startOffset, endOffset, result });
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

	function createTextRange(startOffset: number, endOffset: number, container: HTMLElement = editor): Range | null {
		// console.debug(editorName, "selectTextRange", { startOffset, endOffset });
		// startOffset = Math.max(0, Math.min(startOffset, _text.length - 1));
		// endOffset = Math.max(0, Math.min(endOffset, _text.length - 1));

		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}
		const range = document.createRange();

		let startSet = false;
		let endSet = false;

		if (container === editor) {
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
			if (startOffset === 0 && endOffset === 0) {
				const firstTextNode = walker.nextNode();
				if (firstTextNode) {
					range.setStart(firstTextNode, 0);
					range.setEnd(firstTextNode, 0);
					console.log("found rects:", range.getClientRects());
					return range;
				} else {
					console.warn("no text node found");
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
		} else {
			let startLineIndex = findLineIndexByPos(startOffset);
			let endLineIndex = findLineIndexByPos(endOffset, startLineIndex);
			let basePos = _lineHints[startLineIndex].pos;
			if (basePos === startOffset) {
				range.setStartBefore(_lineElements[startLineIndex]);
				startSet = true;
			} else {
				let walker = document.createTreeWalker(_lineElements[startLineIndex], NodeFilter.SHOW_TEXT, null);
				let pos = basePos;
				let currentNode;
				while ((currentNode = walker.nextNode())) {
					const nodeLen = currentNode.nodeValue!.length;
					if (pos + nodeLen >= startOffset) {
						range.setStart(currentNode, startOffset - pos);
						startSet = true;
						break;
					}
					pos += nodeLen;
				}
				if (!startSet) {
					range.setStartAfter(_lineElements[startLineIndex]);
					startSet = true;
				}
			}
			basePos = _lineHints[endLineIndex].pos;
			if (basePos === endOffset) {
				range.setEndBefore(_lineElements[endLineIndex]);
				endSet = true;
			} else {
				let walker = document.createTreeWalker(_lineElements[endLineIndex], NodeFilter.SHOW_TEXT, null);
				let pos = basePos;
				let currentNode;
				while ((currentNode = walker.nextNode())) {
					const nodeLen = currentNode.nodeValue!.length;
					if (pos + nodeLen >= endOffset) {
						range.setEnd(currentNode, endOffset - pos);
						endSet = true;
						break;
					}
					pos += nodeLen;
				}
				if (!endSet) {
					range.setEndAfter(_lineElements[endLineIndex]);
					endSet = true;
				}
			}
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

	function mergeRects(rects: DiffRect[]): DiffRectSet {
		rects.sort((a, b) => a.y + a.height - (b.y + b.height));

		const merged: DiffRect[] = [];
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

	function getTextRects(startOffset: number, endOffset: number): DiffRectSet | null {
		const range = createTextRange(startOffset, endOffset);
		if (range) {
			let { x: baseX, y: baseY } = wrapper.getBoundingClientRect();
			baseX = -baseX;
			baseX = wrapper.scrollLeft;
			baseY = wrapper.scrollTop;
			const diffExpandX = 1;
			const diffExpandY = 1;
			console.log(editorName, "base", { baseX, baseY });

			const rectsArr: DiffRect[] = [];
			const heightMultiplier = 1.2;
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
				rectsArr.push(rect);
			}
			return mergeRects(rectsArr);
		}
		return null;
	}

	function calculateDiffRects() {
		const diffExpandX = 1;
		const diffExpandY = 0;
		let { x: baseX, y: baseY } = wrapper.getBoundingClientRect();
		baseX = -baseX;
		baseX += wrapper.scrollLeft;
		baseY += wrapper.scrollTop;
		_diffRects.length = 0;
		const temp: DiffRect[] = [];
		const allRects: DiffRect[] = [];
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

		let lineRect: DiffRect | null = null;
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

	function render(imediate = false) {
		if (!imediate) {
			if (_updateStaticCanvasPending) {
				return;
			}
			_updateStaticCanvasPending = true;
			requestAnimationFrame(() => {
				render(true);
				_updateStaticCanvasPending = false;
			});
			return;
		}

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

		renderHighlights();
	}

	function renderHighlights() {
		const ctx = highlightCanvasCtx;
		const canvasWidth = highlightCanvas.width,
			canvasHeight = highlightCanvas.height;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const scrollTop = wrapper.scrollTop;
		const scrollLeft = wrapper.scrollLeft;

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

		if (_textHighlightItems && _textHighlightItems.length > 0) {
			doRender(_textHighlightItems);
			for (const item of _textHighlightItems) {
				const x = Math.floor(item.x - scrollLeft),
					y = Math.floor(item.y - scrollTop),
					width = Math.ceil(item.w),
					height = Math.ceil(item.h);

				if (y + height < 0 || y > canvasHeight) continue;
				if (x + width < 0 || x > canvasWidth) continue;

				ctx.fillStyle = item.fillStyle || "hsl(210 100% 80%)";
				ctx.fillRect(x, y, width, height);
			}
		}
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
			if (!currentNode) {
				currentNode = null;
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
						console.log(1, editorName, "diffEndPos < nodeStart", { diffEndPos, nodeStart });
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
						console.log(2, editorName, "diffEndPos <= nodeEnd", { diffEndPos, nodeEnd });
						break;
					}
					pos = nodeEnd;
					advance();
				} else if (currentNode.nodeType === 1) {
					const nodeStart = Number((currentNode as HTMLElement).dataset.startOffset);
					const nodeEnd = Number((currentNode as HTMLElement).dataset.endOffset);
					if (!isNaN(nodeStart) && !isNaN(nodeEnd)) {
						if (nodeStart >= diffPos && nodeEnd <= diffEndPos) {
							console.log(3, editorName, "nodeStart, nodeEnd", { currentNode, nodeStart, nodeEnd });
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
							console.log(4, editorName, "diffPos >= nodeEnd", { diffPos, nodeEnd });
							pos = nodeEnd;
							advance(true);
							continue;
						}
					}
					// console.log(editorName, "children", Array.from(currentNode.childNodes));
					console.log(5, editorName, "advance", { currentNode });
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
		render();
	}

	let _highlightedTextStart: number | null = null;
	let _highlightedTextEnd: number | null = null;

	function applyTextHighlight(startOffset: number, endOffset: number) {
		if (startOffset === _highlightedTextStart && endOffset === _highlightedTextEnd) {
			return;
		}
		_highlightedTextStart = startOffset;
		_highlightedTextEnd = endOffset;

		const rectSet = getTextRects(startOffset, endOffset);
		if (rectSet && rectSet.rects.length > 0) {
			_textHighlightItems = rectSet.rects.map((rect) => {
				return {
					x: rect.x,
					y: rect.y,
					w: rect.width,
					h: rect.height,
					fillStyle: "hsl(210 100% 80%)",
					type: "texthighlight",
				};
			});
		}

		renderHighlights();
	}

	function clearTextHighlight() {
		_highlightedTextStart = null;
		_highlightedTextEnd = null;
		_textHighlightItems = null;
		renderHighlights();
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

		renderHighlights();
	}

	function clearDiffHighlight() {
		_highlightedDiffIndex = null;
		_diffHighlightItems = null;
		renderHighlights();
	}

	return {
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
		applyTextHighlight,
		clearTextHighlight,
		applyDiffHighlight,
		clearDiffHighlight,
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
	};
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];
