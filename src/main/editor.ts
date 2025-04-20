type EditorCallbacks = {
	onDiffVisibilityChanged: (diffIndex: number, isVisible: boolean) => void;
	onTextChanged: (text: string) => void;
	onMirrorUpdated: () => void;
};

function createEditor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
	const { onDiffVisibilityChanged, onTextChanged, onMirrorUpdated } = callbacks;
	const _lineElements: HTMLElement[] = [];
	const _diffElements: HTMLElement[][] = [];
	const _anchorElements: HTMLElement[] = [];
	const _lineHints: LineHint[] = [];
	const _visibleAnchors = new Set<HTMLElement>();
	const _visibleDiffIndices = new Set<number>();

	// 편집기 내에 약간의 html을 허용할지 말지.
	// 일단 금지. browser에서 계산하는 텍스트와 내가 만드는 텍스트를 완전히 일치시키기 힘들다. 한글자한글자 문자 인덱스까지 완전히 일치시켜야 됨...
	// 게다가 contenteditable 내에 브라우저가 뜸금없이 넣는 style(스타일 클래스가 지정된 텍스트를 지우고 바로 이어서 텍스트를 입력할 경우)이나 <br> 등등도 처리를 해줘야 하고
	// 여하튼 신경 쓸게 많음
	const _allowHTML = true;

	let _text: string = "";
	let _hasHTML = false;
	let _textProps: TextProperties[] = [];
	let _savedCaret = null;
	let _observingAnchors = false;
	let _editMode = false;
	let _textruns: TextRun[] = []; // 변경된 부분만 업데이트 가능하게 이전 textruns 보관???

	const wrapper = document.createElement("div");
	wrapper.id = editorName + "EditorWrapper";
	wrapper.classList.add("editor-wrapper");

	// 어쩔 수 없는 선택.
	// dom 업데이트가 텍스트 입력을 방해하는 건 원치 않고 undo,redo 히스토리를 망쳐버리는 것도 싫음
	// undo, redo를 어설프게 구현하느니 안하는 게 낫다. (커서위치, 스크롤 위치, 선택 범위, throttling 등등 생각할 게 많음)
	const mirror = document.createElement("div");
	mirror.id = editorName + "Mirror";
	mirror.classList.add("mirror");
	mirror.spellcheck = false;

	const editor = document.createElement("div");
	editor.id = editorName + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "plaintext-only";
	editor.spellcheck = false;
	editor.appendChild(document.createTextNode(""));

	wrapper.appendChild(mirror);
	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	const { observeEditor, unobserveEditor } = (() => {
		const mutationObserver = new MutationObserver((mutations) => {
			console.debug("mutations", mutations);
			for (const mutation of mutations) {
				if (mutation.type === "childList") {
					for (const node of mutation.addedNodes) {
						if (node.nodeName === "SPAN" || node.nodeName === "FONT") {
							if (node.childNodes.length === 1 && node.firstChild?.nodeType === 3) {
								node.parentNode?.replaceChild(node.firstChild, node);
							}
						}
					}
				}
				if (mutation.type === "attributes" && mutation.attributeName === "style") {
					(mutation.target as HTMLElement).removeAttribute("style");
				}
				if (mutation.type === "characterData") {
					console.log("characterData", mutation.target, mutation.oldValue, mutation.target.textContent);
				}
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

		// document.addEventListener("selectionchange", (e) => {
		// 	console.log(0);
		// 	const selection = window.getSelection();
		// 	if (!selection?.rangeCount || !selection.isCollapsed) return;
		// 	console.log(1);
		// 	const range = selection!.getRangeAt(0);
		// 	let container = range.commonAncestorContainer as HTMLElement;
		// 	if (editor.contains(container)) {
		// 		if (container.nodeType === 3) {
		// 			container = container.parentElement!;
		// 		}
		// 		console.log("container:", container);
		// 		if (container.nodeName === "SPAN" && (container as HTMLElement).className === "img") {
		// 			console.log("INSIDE IMG", range);
		// 			const newRange = document.createRange();
		// 			newRange.setStartAfter(container);
		// 			newRange.setEndAfter(container);
		// 			selection.removeAllRanges();
		// 			selection.addRange(newRange);
		// 			console.log("newRange", newRange, selection.rangeCount);

		// 		}
		// 	}
		// });

		return { observeEditor, unobserveEditor };
	})();

	// const mutationObserver = new MutationObserver((mutations) => {
	// 	for (const mutation of mutations) {
	// 		if (mutation.type === "childList") {
	// 			mutation.addedNodes.forEach((node) => {
	// 				if (node.nodeName === "FONT") {
	// 					if (node.childNodes.length === 1 && node.firstChild?.nodeType === 3) {
	// 						node.parentNode?.replaceChild(node.firstChild, node);
	// 					}
	// 				}
	// 			});
	// 		}
	// 		if (mutation.type === "attributes" && mutation.attributeName === "style") {
	// 			(mutation.target as HTMLElement).removeAttribute("style");
	// 		}
	// 	}
	// });

	// function observeEditor() {
	// 	mutationObserver.observe(editor, {
	// 		childList: true,
	// 		subtree: true,
	// 		attributes: true,
	// 	});
	// }

	// function unobserveEditor() {
	// 	mutationObserver.disconnect();
	// }

	function updateText() {
		if (_hasHTML) {
			const now = performance.now();
			const [text, textProps] = flattenHTML(editor);
			_text = text;
			_textProps = textProps;
			if (textProps.length <= 1) {
				_hasHTML = false;
			}
			console.debug("flattenHTML took", performance.now() - now, "ms");
		} else {
			_text = editor.textContent || "";
		}

		if (_text.length === 0 || _text[_text.length - 1] !== "\n") {
			_text += "\n"; // 텍스트의 끝은 항상 \n으로 끝나야 인생이 편해진다.
		}

		onTextChanged(_text);
		console.log("update text done");
	}

	editor.addEventListener("input", updateText);

	if (_allowHTML) {
		editor.addEventListener("paste", (e) => {
			const html = e.clipboardData?.getData("text/html");
			if (!html) return;
			_hasHTML = _hasHTML || true;
			e.preventDefault();
			unobserveEditor();
			const cleanedHTML = sanitizeHTML(html);
			editor.contentEditable = "true";
			// deprecated된 함수. 자존심 상하지만 직접 html을 삽입하는 경우 undo/redo가 안됨.
			document.execCommand("insertHTML", false, cleanedHTML);
			editor.contentEditable = "plaintext-only";
			updateText();
			observeEditor();
			console.log("paste done");
		});
	}

	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					if (entry.target.nodeName === ANCHOR_TAG) {
						_visibleAnchors.add(entry.target as HTMLElement);
					} else if (entry.target.nodeName === DIFF_ELEMENT_NAME) {
						const diffIndex = Number((entry.target as HTMLElement).dataset.diff);
						_visibleDiffIndices.add(diffIndex);
						onDiffVisibilityChanged(diffIndex, true);
					}
				} else {
					if (entry.target.nodeName === ANCHOR_TAG) {
						_visibleAnchors.delete(entry.target as HTMLElement);
					} else if (entry.target.nodeName === DIFF_ELEMENT_NAME) {
						const diffIndex = Number((entry.target as HTMLElement).dataset.diff);
						_visibleDiffIndices.delete(diffIndex);
						onDiffVisibilityChanged(diffIndex, false);
					}
				}
			}
		},

		{ threshold: 1, root: wrapper }
	);

	function getVisibleAnchors() {
		return Array.from(_visibleAnchors).sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos));
	}

	function getClosestAnchorToCaret() {
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
		return [lineEl!, distance!]; //null일 수도 있지만 의도적으로 느낌표 때려박음
	}

	function scrollToDiff(diffIndex: number) {
		const offsetTop = _diffElements[diffIndex][0].offsetTop - wrapper.clientTop;
		wrapper.scrollTop = offsetTop - SCROLL_MARGIN;
	}

	// 내가 머리가 나쁘다는 걸 확실하게 알게 해주는 함수
	function scrollToLine(lineNum: number, distance = 0) {
		const lineEl = _lineElements[lineNum - 1];
		if (lineEl) {
			const scrollTop = lineEl.offsetTop - distance;
			wrapper.scrollTop = scrollTop;
		}
	}

	// generator함수 사용. 왜? 그냥 써보려고!!
	let _renderId = 0;
	let _cancelRenderId: number | null = null;
	function update({ diffs, anchors }: { diffs: DiffEntry[]; anchors: Anchor[] }) {
		if (_cancelRenderId) {
			cancelIdleCallback(_cancelRenderId);
			_cancelRenderId = null;
		}

		if (_renderId === Number.MAX_SAFE_INTEGER) {
			// 그런일은... 절대로... 없을거라...
			// 솔직히 절대 없음
			_renderId = 0;
		}

		const startTime = performance.now();
		const renderId = ++_renderId;
		const generator = updateGenerator({ renderId, diffs, anchors });

		// 일단 start!
		generator.next();
		const step = (idleDeadline: IdleDeadline) => {
			_cancelRenderId = null;
			const { done } = generator.next(idleDeadline);
			if (!done) {
				if (renderId === _renderId) {
					_cancelRenderId = requestIdleCallback(step, { timeout: FORCE_RENDER_TIMEOUT });
				}
			} else {
				console.debug("[%s] update(#%d) took %d ms", editorName, renderId, performance.now() - startTime);
			}
		};
		_cancelRenderId = requestIdleCallback(step, { timeout: FORCE_RENDER_TIMEOUT });
	}

	function* updateGenerator({ renderId, diffs, anchors }: { renderId: number; diffs: DiffEntry[]; anchors: Anchor[] }) {
		if (!diffs) {
			return;
		}
		// const startTime = performance.now();
		console.debug("update", editorName, { renderId, diffs, anchors });

		untrackIntersections();
		_lineElements.length = 0;
		_lineHints.length = 0;
		_diffElements.length = 0;
		_anchorElements.length = 0; // anchors.length; 혹시 모르니 그냥 0으로 초기화 해서 기존 요소들을 지워버리는게 속편함.

		// 여기서 일단 한번 yield 해줘야 idleDeadline을 받을 수 있음.
		let idleDeadline: IdleDeadline = yield;

		const textruns = getTextRuns(editorName, _text, _textProps, diffs, anchors);
		console.debug(editorName, "textruns", textruns);
		const text = _text;
		const view = mirror;
		let lineEl: HTMLElement = null!;
		let nextInlineNode: ChildNode | null = null;

		let currentDiffIndex: number | null = null;
		let currentTextProps: TextProperties = { pos: 0, color: null, supsub: null, flags: 0 };
		let lineNum: number;
		let lineIsEmpty = true;
		let numConsecutiveBlankLines = 0;
		let textPos: number;
		let currentContainer: HTMLElement;
		const containerStack: HTMLElement[] = [];

		function appendAnchor(pos: number, anchorIndex: number) {
			// diff 범위 안 anchor를 허용하면 코드가 복잡해짐. diff를 닫고 lineEl이 currentContainer가 될때까지 pop한 후
			// anchor 넣고 다시 이전 container 스택을 새로 만들어줘야함.
			// 회사에서 사용하면서 이 메시지를 눈여겨 보고 발견 시 바로 해결할 것.
			console.assert(currentContainer === lineEl, "currentContainer should be lineEl when appending anchor");
			const anchor = anchors[anchorIndex];
			let anchorEl: HTMLElement;
			if (nextInlineNode === null || nextInlineNode.nodeName !== ANCHOR_TAG) {
				anchorEl = document.createElement(ANCHOR_TAG);
				anchorEl.contentEditable = "false"; // 만약에 mirror를 contentEditable로 만들경우에...
				currentContainer.insertBefore(anchorEl, nextInlineNode);
			} else {
				anchorEl = nextInlineNode as HTMLElement;
				nextInlineNode = anchorEl.nextSibling;
			}
			anchorEl.id = `${editorName}Anchor${anchorIndex}`;
			anchorEl.dataset.type = anchor.type;
			anchorEl.dataset.anchor = anchorIndex.toString();
			anchorEl.dataset.pos = pos.toString();
			if (anchor.diffIndex !== null) {
				anchorEl.dataset.diff = anchor.diffIndex.toString();
			} else {
				delete anchorEl.dataset.diff;
			}
			// push가 아닌 index로 넣는 이유는 textruns을 만들 때 앵커가 스킵될 수 있기 때문.
			// diff 계산 때 앵커위치를 잘못 잡은 경우인데 그쪽 코드를 찬찬히 뜯어볼 필요가 있다.
			_anchorElements[anchorIndex] = anchorEl;
		}

		function appendChars(chars: string) {
			let el: HTMLElement;
			const nodeName = currentTextProps.supsub ?? "SPAN";
			if (!nextInlineNode || nextInlineNode.nodeName !== nodeName) {
				el = document.createElement(nodeName);
				currentContainer!.insertBefore(el, nextInlineNode);
			} else {
				el = nextInlineNode as HTMLElement;
				nextInlineNode = el.nextSibling;
			}
			if (lineIsEmpty) {
				for (const ch of chars) {
					if (!SPACE_CHARS[ch]) {
						lineIsEmpty = false;
						break;
					}
				}
			}
			if (el.textContent !== chars) {
				el.textContent = chars;
			}
			el.className = currentTextProps.color || "";
		}

		// lineEl = view.firstElementChild as HTMLElement;
		// if (lineEl === null) {
		// 	lineEl = document.createElement(LINE_TAG);
		// 	view.appendChild(lineEl);
		// 	lineEl.dataset.lineNum = lineNum.toString();
		// 	lineEl.dataset.pos = textPos.toString();
		// 	lineNum++;
		// }
		// _lineElements.push(lineEl);
		// nextInlineNode = lineEl.firstChild;
		// console.log("textruns:", textruns);

		let diffEl: HTMLElement | null = null;
		function openDiff(diffIndex: number) {
			if (nextInlineNode === null || nextInlineNode.nodeName !== DIFF_ELEMENT_NAME) {
				diffEl = document.createElement(DIFF_ELEMENT_NAME);
				const parent = currentContainer ?? lineEl!;
				parent.insertBefore(diffEl, nextInlineNode);
				currentContainer = diffEl;
			} else {
				diffEl = currentContainer = nextInlineNode as HTMLElement;
			}
			nextInlineNode = diffEl.firstChild;
			diffEl.dataset.diff = diffIndex.toString();
			diffEl.className = `diff-color${(diffIndex % NUM_DIFF_COLORS) + 1}`;
			_diffElements[diffIndex] = _diffElements[diffIndex] || [];
			_diffElements[diffIndex].push(diffEl);
		}

		function closeDiff() {
			if (diffEl) {
				while (currentContainer !== diffEl) {
					popContainer();
				}
				popContainer();
			}
		}

		function popContainer() {
			while (nextInlineNode) {
				const nextnext = nextInlineNode.nextSibling;
				nextInlineNode.remove();
				nextInlineNode = nextnext;
			}

			if (containerStack.length > 0) {
				nextInlineNode = currentContainer!.nextSibling;
				currentContainer = containerStack.pop()!;
				return currentContainer;
			} else {
				if (currentContainer !== lineEl) {
					const ret = currentContainer;
					nextInlineNode = currentContainer!.nextSibling;
					currentContainer = lineEl;
					return ret;
				}
			}
			return null;
		}

		textPos = 0;
		lineNum = 1;
		lineEl = view.firstElementChild as HTMLElement;
		let textRunIndex = 0;
		let textrunBuffer: TextRun[] = [];
		let shouldUpdate = true;

		while (textRunIndex < textruns.length) {
			// 취소!
			if (renderId !== _renderId) {
				return;
			}

			if (idleDeadline && idleDeadline.timeRemaining() <= 0) {
				// console.warn("YIELDING", idleDeadline.timeRemaining(), textRunIndex, textruns.length);
				idleDeadline = yield;
			}

			textrunBuffer.length = 0;
			for (; textRunIndex < textruns.length; textRunIndex++) {
				const textrun = textruns[textRunIndex];
				textrunBuffer.push(textrun);
				// 이걸 사용해서 변경된 줄만 부분적으로 업데이트 하려면
				// diff를 추적해서 개수를 새고 diffElements의 어느 부분부터 시작하는지 계산해놔야함. 앵커도 마찬가지
				// 할 수는 있지만.. 해야할까 싶다.
				// if (!shouldUpdate) {
				// 	const oldRun = _textruns[textRunIndex];
				// 	if (
				// 		oldRun &&
				// 		oldRun.type === textrun.type &&
				// 		oldRun.pos === textrun.pos &&
				// 		oldRun.len === textrun.len &&
				// 		oldRun.diffIndex === textrun.diffIndex &&
				// 		oldRun.anchorIndex === textrun.anchorIndex
				// 	) {
				// 		if (oldRun.type === "MODIFIER") {
				// 			if (
				// 				oldRun.props!.pos !== textrun.props!.pos ||
				// 				oldRun.props!.color !== textrun.props!.color ||
				// 				oldRun.props!.supsub !== textrun.props!.supsub
				// 			) {
				// 				shouldUpdate = true;
				// 			}
				// 		}
				// 	} else {
				// 	}
				// }
				if (textrun.type === "LINEBREAK" || textrun.type === "END_OF_STRING") {
					textRunIndex++;
					break;
				}
			}

			let textrun: TextRun;
			const lineStartPos = textPos;
			lineIsEmpty = true;

			if (lineEl === null) {
				lineEl = document.createElement(LINE_TAG);
				view.appendChild(lineEl);
			}
			lineEl.dataset.lineNum = lineNum.toString();
			lineEl.dataset.pos = textPos.toString();
			_lineElements[lineNum - 1] = lineEl;

			if (shouldUpdate) {
				currentContainer = lineEl;
				nextInlineNode = currentContainer.firstChild;

				if (currentDiffIndex !== null) {
					openDiff(currentDiffIndex);
				}

				for (textrun of textrunBuffer) {
					const type = textrun.type;
					if (type === "CHARS") {
						const { pos, len } = textrun;
						appendChars(text.substring(pos, pos + len));
					} else if (type === "ANCHOR") {
						appendAnchor(textrun.pos, textrun.anchorIndex!);
					} else if (type === "MODIFIER") {
						// not implemented yet
						currentTextProps = textrun.props!;
					} else if (type === "DIFF") {
						currentDiffIndex = textrun.diffIndex!;
						openDiff(currentDiffIndex);
					} else if (type === "DIFF_END") {
						closeDiff();
						currentDiffIndex = null;
					}
				}

				while (popContainer());
			} else {
				textrun = textrunBuffer[textrunBuffer.length - 1];
			}

			lineEl = lineEl.nextElementSibling as HTMLElement;
			textPos = textrun!.pos + textrun!.len;
			if (lineIsEmpty) {
				numConsecutiveBlankLines++;
			} else {
				numConsecutiveBlankLines = 0;
			}
			_lineHints[lineNum - 1] = { pos: lineStartPos, len: textPos - lineStartPos, empty: false, numConsecutiveBlankLines };
			lineNum++;

			if (textrun!.type === "LINEBREAK") {
				//
			} else {
				// 안해도 textrunIndex === textruns.length가 되서 while문이 끝나긴 하지만... 나를 못믿겠어.
				break;
			}
		}

		// 남은 줄들은 모조리 제거
		// 생각해보기: elements들을 완전히 버리지말고 배열에 계속 저장해두고 lineNum-1로 재사용??
		while (lineEl) {
			const nextnext = lineEl.nextElementSibling as HTMLElement;
			lineEl.remove();
			lineEl = nextnext;
		}

		_textruns = textruns;

		trackIntersections();
		onMirrorUpdated();
	}

	function trackIntersections() {
		if (!_observingAnchors) {
			for (const anchor of _anchorElements) {
				if (anchor) intersectionObserver.observe(anchor);
			}
			for (const diff of _diffElements.flat()) {
				intersectionObserver.observe(diff);
			}
			_observingAnchors = true;
		}
	}

	function untrackIntersections() {
		_observingAnchors = false;
		_visibleAnchors.clear();
		_visibleDiffIndices.clear();
		intersectionObserver.disconnect();
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

	function getTextOffsetFromRoot(root: HTMLElement, textNode: Node, textNodeOffset: number) {
		let offset = 0;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			if (walker.currentNode === textNode) {
				return offset + textNodeOffset;
			}
			offset += walker.currentNode.nodeValue!.length;
		}
		return null;
	}

	function findLineIndexByPos(pos: number, low = 0, high = _lineElements.length - 1) {
		let mid;
		while (low <= high) {
			mid = (low + high) >>> 1;
			const lineEl = _lineElements[mid];
			const linePos = Number(lineEl.dataset.pos);
			if (linePos === pos) {
				return mid;
			}
			if (linePos > pos) {
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return high;
	}

	// selectTextRange, getTextSelectionRange 이 둘은 다음날 보면 다시 깜깜해진다.
	// 손대려면 정말 각 잡고 해야함.
	function selectTextRange(startOffset: number, endOffset: number) {
		if (startOffset >= _text.length) {
			startOffset = _text.length - 1;
		}
		if (endOffset >= _text.length) {
			endOffset = _text.length - 1;
		}
		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}

		const range = document.createRange();
		let startSet = false;
		let endSet = false;
		if (_editMode) {
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
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

			let currentNode;
			let walker = document.createTreeWalker(_lineElements[startLineIndex], NodeFilter.SHOW_TEXT, null);
			let pos = Number(_lineElements[startLineIndex].dataset.pos);
			while ((currentNode = walker.nextNode())) {
				const nodeLen = currentNode.nodeValue!.length;
				if (pos + nodeLen >= startOffset) {
					range.setStart(currentNode, startOffset - pos);
					startSet = true;
					break;
				}
				pos += nodeLen;
			}

			walker = document.createTreeWalker(_lineElements[endLineIndex], NodeFilter.SHOW_TEXT, null);
			pos = Number(_lineElements[endLineIndex].dataset.pos);
			while ((currentNode = walker.nextNode())) {
				const nodeLen = currentNode.nodeValue!.length;
				if (pos + nodeLen >= endOffset) {
					range.setEnd(currentNode, endOffset - pos);
					endSet = true;
					break;
				}
				pos += nodeLen;
			}
		}

		if (startSet && endSet) {
			const sel = window.getSelection()!;
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}

	function getTextSelectionRange(): [startOffset: number | null, endOffset: number | null] {
		const selection = window.getSelection()!;
		if (!selection.rangeCount) {
			return [null, null];
		}

		const range = selection.getRangeAt(0);
		if (!wrapper.contains(range.commonAncestorContainer)) {
			return [null, null];
		}

		let startOffset = Number.NaN;
		let endOffset = Number.NaN;
		if (_editMode) {
			// edit 모드에서 contenteditable은 그냥 textNode 집합임. textNode 하나가 한 줄일 수도 있고
			// 하나의 textNode에 여러줄이 들어가 있을 수도 있다. 고로 그냥 글자 수를 새어보는 수 밖에 없음.
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
			let currentNode;
			let pos = 0;
			while ((currentNode = walker.nextNode())) {
				if (currentNode === range.startContainer) {
					startOffset = pos + range.startOffset;
				}
				if (currentNode === range.endContainer) {
					endOffset = pos + range.endOffset;
					break;
				}
				pos += currentNode.textContent!.length;
			}
		} else {
			// aligned mode.
			// 이 경우 조금 최적화가 가능. 실제로 이게 얼마나 효율적인지는 테스트해 볼 필요가 있겠지만...
			// 몇 천 라인의 텍스트에 diff, anchor가 많은 경우 당연히 시작줄, 끝줄을 먼저 찾고 그 줄에 대해서만
			// offset을 계산하는 것이 더 빠르겠지!

			let startLineEl: HTMLElement | null = range.startContainer as HTMLElement; //사실 textNode일 수도 있는데 그런 경우 가까운 부모 엘러먼트로 교체
			if (startLineEl.nodeType === 3) {
				startLineEl = startLineEl.parentElement!.closest("div[data-pos]");
			} else {
				// startLineEl = startLineEl.closest("div[data-pos]") as HTMLElement;
				startOffset = Number(startLineEl.dataset.pos);
			}
			let endLineEl: HTMLElement | null = range.endContainer as HTMLElement;
			if (endLineEl.nodeType === 3) {
				endLineEl = endLineEl.parentElement!.closest("div[data-pos]");
			} else {
				// endLineEl = endLineEl.closest("div[data-pos]") as HTMLElement;
				endOffset = Number(endLineEl.dataset.pos) + endLineEl.textContent!.length;
			}

			if (isNaN(startOffset) || isNaN(endOffset)) {
				if (startLineEl && endLineEl) {
					if (isNaN(startOffset)) {
						startOffset = getTextOffsetFromRoot(startLineEl, range.startContainer, range.startOffset)! + Number(startLineEl.dataset.pos);
					}
					if (isNaN(endOffset)) {
						endOffset = getTextOffsetFromRoot(endLineEl, range.endContainer, range.endOffset)! + Number(endLineEl.dataset.pos);
					}
				} else {
					const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT, null);
					let currentNode;
					let pos = 0;
					while (isNaN(startOffset) && isNaN(endOffset) && (currentNode = walker.nextNode())) {
						if (currentNode === range.startContainer && isNaN(startOffset)) {
							startOffset = pos + range.startOffset;
						}
						if (currentNode === range.endContainer && isNaN(endOffset)) {
							endOffset = pos + range.endOffset;
							break;
						}
						pos += currentNode.textContent!.length;
					}
				}
			}
		}

		if (isNaN(startOffset) || isNaN(endOffset)) {
			return [null, null];
		}

		// 원본텍스트의 끝에 하나의 "\n"이 더 붙어있으니 원본텍스트 크기보다 offset이 더 커질 수 있음!!
		if (startOffset >= _text.length) {
			startOffset = _text.length - 1;
		}
		if (endOffset >= _text.length) {
			endOffset = _text.length - 1;
		}
		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}

		return [startOffset, endOffset];
	}

	//updateText();

	return {
		name: editorName,
		wrapper,
		editor,
		mirror,
		updateText,
		update,
		scrollToDiff,
		// saveCaret,
		// restoreCaret,
		getVisibleAnchors,
		trackIntersections,
		untrackIntersections,
		getFirstVisibleAnchor,
		scrollToLine,
		getFirstVisibleLineElement,
		getClosestAnchorToCaret: getClosestAnchorToCaret,
		setEditMode,
		getTextSelectionRange,
		selectTextRange,
		// 그냥 states 객체를 하나 만들어서 리턴할까...
		get text() {
			return _text;
		},
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
		get lineHints() {
			return _lineHints;
		}
	};
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];
