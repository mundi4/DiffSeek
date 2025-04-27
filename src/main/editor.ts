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

	let _text: string = "";
	let _editMode = false;

	const wrapper = document.createElement("div");
	wrapper.id = editorName + "EditorWrapper";
	wrapper.classList.add("editor-wrapper");

	// 어쩔 수 없는 선택.
	// dom 업데이트가 텍스트 입력을 방해하는 건 원치 않고 undo,redo 히스토리를 망쳐버리는 것도 싫음
	// undo, redo를 어설프게 구현하느니 안하는 게 낫다. (커서위치, 스크롤 위치, 선택 범위, throttling 등등 생각할 게 많음)
	const mirror = document.createElement("div");
	mirror.id = editorName + "Mirror";
	mirror.classList.add("mirror");
	// mirror.spellcheck = false;

	const editor = document.createElement("div");
	editor.id = editorName + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "plaintext-only";
	editor.spellcheck = false;
	editor.appendChild(document.createTextNode(""));

	wrapper.appendChild(mirror);
	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	// *** HTML 붙여넣기를 허용할 때만 사용할 코드 ***
	// 지금은 관련 코드를 다 지워버렸고 복구하려면 깃허브에서 이전 코드를 뒤져야함...
	const { observeEditor, unobserveEditor } = (() => {
		// 복붙한 스타일이 들어있는 부분을 수정할 때(정확히는 스타일이 입혀진 텍스트를 지우고 바로 입력할 때)
		// 브라우저가 지워지기 전과 비슷한 스타일(font, span태그에 style을 입혀서)을 친히 넣어주신다!
		// 분에 넘치게 황공하오니 잽싸게 삭제해드려야함.
		const mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "childList") {
					for (const node of mutation.addedNodes) {
						// 보통 브라우저는 span이나 font 태그를 입혀서 스타일을 넣어준다...
						if (node.nodeName === "SPAN" || node.nodeName === "FONT") {
							if (node.childNodes.length === 1 && node.firstChild?.nodeType === 3) {
								node.parentNode?.replaceChild(node.firstChild, node);
							}
						}
					}
				}
				// 기존 태그에 style을 바로 넣어주는 경우가 있는지는 모르겠지만 안전빵으로...
				if (mutation.type === "attributes" && mutation.attributeName === "style") {
					(mutation.target as HTMLElement).removeAttribute("style");
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

		return { observeEditor, unobserveEditor };
	})();

	// 화면에 보이는 diff, anchor element들을 추적함.
	const { trackIntersections, untrackIntersections } = (() => {
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

			{ threshold: 0, root: wrapper, rootMargin: "-5px 0px -5px 0px" } // top, bottom, left, right
		);

		function trackIntersections() {
			for (const anchor of _anchorElements) {
				if (anchor) intersectionObserver.observe(anchor);
			}
			for (const diff of _diffElements.flat()) {
				intersectionObserver.observe(diff);
			}
		}

		function untrackIntersections() {
			_visibleAnchors.clear();
			_visibleDiffIndices.clear();
			intersectionObserver.disconnect();
		}

		return { trackIntersections, untrackIntersections };
	})();

	function updateText() {
		_text = editor.textContent || "";
		_text += "\n";
		onTextChanged(_text);
	}

	function setText(text: string) {
		_text = editor.textContent = text || "";
		updateText();
	}

	editor.addEventListener("input", updateText);

	// UI쓰레드 블럭을 최대한 피하면서 업데이트 시도함.
	// 15~20페이지 정도의 큰 업무매뉴얼은 흔하다. 버팀목 업무매뉴얼은 50페이지가 넘는다.
	const { update } = (() => {
		let _renderId = 0;
		let _cancelRenderId: number | null = null;

		function update({ diffs, anchors, headings }: { diffs: DiffEntry[]; anchors: Anchor[]; headings: SectionHeading[] }) {
			if (_cancelRenderId) {
				cancelIdleCallback(_cancelRenderId);
				_cancelRenderId = null;
			}

			if (_renderId === Number.MAX_SAFE_INTEGER) {
				// 그런 일은... 절대로... 없을거라...
				_renderId = 0;
			}

			const startTime = performance.now();
			const renderId = ++_renderId;
			const generator = updateGenerator({ renderId, diffs, anchors, headings });

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

		function* updateGenerator({
			renderId,
			diffs,
			anchors,
			headings,
		}: {
			renderId: number;
			diffs: DiffEntry[];
			anchors: Anchor[];
			headings?: SectionHeading[];
		}) {
			if (!diffs) {
				return;
			}

			untrackIntersections();
			_lineElements.length = 0;
			_lineHints.length = 0;
			_diffElements.length = 0;
			_anchorElements.length = 0;

			// 여기서 일단 한번 yield 해줘야 idleDeadline을 받을 수 있음.
			let idleDeadline: IdleDeadline = yield;

			const textruns = getTextRuns(editorName, _text, { diffs, anchors, headings });
			const text = _text;
			const view = mirror;
			let lineEl: HTMLElement = null!;
			let nextInlineNode: ChildNode | null = null;

			let currentDiffIndex: number | null = null;
			let currentHeadingIndex: number | null = null;
			let lineNum: number;
			let lineIsEmpty = true;
			let numConsecutiveBlankLines = 0;
			let textPos: number;
			let currentContainer: HTMLElement;
			let diffEl: HTMLElement | null = null;
			const containerStack: HTMLElement[] = [];

			function appendAnchor(pos: number, anchorIndex: number) {
				const anchor = anchors[anchorIndex];
				let anchorEl: HTMLElement;
				if (nextInlineNode === null || nextInlineNode.nodeName !== ANCHOR_TAG) {
					anchorEl = document.createElement(ANCHOR_TAG);
					//anchorEl.contentEditable = "false"; // 만약에 mirror를 contentEditable로 만들경우에...
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
				// push가 아닌 index로 삽입함!
				// textrun이 꼬이면 anchor가 스킵될 수도 있음.
				_anchorElements[anchorIndex] = anchorEl;
			}

			function appendChars(chars: string) {
				let el: HTMLElement;
				// 지금으로써는 heading은 common sequence 범위에서만 찾는다(diff영역에 걸쳐있으면 무시함)
				// 만약 diff영역과 오버랩되는 걸 허용하게 되면 이렇게 단순히 태그이름만 바꾸는 걸로는 불가능함.
				// heading의 목적은 단순히 시각적 강조 그뿐임. 원본문서의 구조가 엉망인 경우가 많기 때문에 이 이상으로 더 많은 걸 하기는 쉽지 않고 정확하지도 않음. 정확한 결과를 못 보여줄거면 안하는게 낫다...
				const nodeName = currentHeadingIndex !== null ? "H6" : "SPAN";
				if (!nextInlineNode || nextInlineNode.nodeName !== nodeName) {
					el = document.createElement(nodeName);
					currentContainer!.insertBefore(el, nextInlineNode);
				} else {
					el = nextInlineNode as HTMLElement;
					nextInlineNode = el.nextSibling;
				}
				if (currentHeadingIndex !== null) {
					el.id = `${editorName}Heading${currentHeadingIndex}`;
					el.dataset.heading = currentHeadingIndex.toString();
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
			}

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
				diffEl.classList.toggle("asBlock", diffs[diffIndex].asBlock);
				(_diffElements[diffIndex] ??= []).push(diffEl);
			}

			function closeDiff() {
				if (diffEl) {
					// diff 이후에 쌓인 container들을 poppoppop
					while (currentContainer !== diffEl) {
						popContainer();
					}
					// diff까지 pop
					popContainer();
				}
			}

			function popContainer() {
				// 현재 container에 남아있는 노드들 제거(이전 업데이트 때 쓰였지만 지금은 안쓰이는 노드들)
				while (nextInlineNode) {
					const nextnext = nextInlineNode.nextSibling;
					nextInlineNode.remove();
					nextInlineNode = nextnext;
				}

				if (containerStack.length > 0) {
					nextInlineNode = currentContainer!.nextSibling;
					currentContainer = containerStack.pop()!;
					return currentContainer;
				}

				if (currentContainer !== lineEl) {
					const ret = currentContainer;
					nextInlineNode = currentContainer!.nextSibling;
					currentContainer = lineEl;
					return ret;
				}

				return null;
			}

			textPos = 0;
			lineNum = 1;
			lineEl = view.firstElementChild as HTMLElement;
			let textRunIndex = 0;

			// 줄단위로 필요한 부분만 업데이트 할 수 있게 줄에 해당하는 textrun들만 모아두지만
			// 필요한 부분만(변경된 부분) 업데이트 하는 코드는 그냥 다 지워버림. 신경쓸 게 많고 얻는 건 그리 많지 않다.
			let textrunBuffer: TextRun[] = [];
			while (textRunIndex < textruns.length) {
				if (renderId !== _renderId) {
					// 새로운 렌더 요청이 들어옴.
					return;
				}

				// 32줄마다 타임오버 체크함
				if (idleDeadline && !(lineNum & 31) && idleDeadline.timeRemaining() <= 1) {
					// 삐~~
					idleDeadline = yield;
				}

				textrunBuffer.length = 0;
				for (; textRunIndex < textruns.length; textRunIndex++) {
					const textrun = textruns[textRunIndex];
					textrunBuffer.push(textrun);
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

				currentContainer = lineEl;
				nextInlineNode = currentContainer.firstChild;

				if (currentDiffIndex !== null) {
					openDiff(currentDiffIndex);
				}

				for (textrun of textrunBuffer) {
					const type = textrun.type;
					if (type === "CHARS") {
						const { pos, len } = textrun;
						appendChars(text.slice(pos, pos + len));
					} else if (type === "ANCHOR") {
						appendAnchor(textrun.pos, textrun.dataIndex!);
					} else if (type === "DIFF") {
						currentDiffIndex = textrun.dataIndex!;
						openDiff(currentDiffIndex);
					} else if (type === "DIFF_END") {
						closeDiff();
						currentDiffIndex = null;
					} else if (type === "HEADING") {
						currentHeadingIndex = textrun.dataIndex!;
					} else if (type === "HEADING_END") {
						currentHeadingIndex = null;
					}
				}

				// 남은 container들은 모조리리 pop pop pop
				while (popContainer());

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
			while (lineEl) {
				const nextnext = lineEl.nextElementSibling as HTMLElement;
				lineEl.remove();
				lineEl = nextnext;
			}

			trackIntersections();
			onMirrorUpdated();
		}

		return { update };
	})();

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
		const offsetTop = _diffElements[diffIndex][0].offsetTop - wrapper.clientTop;
		wrapper.scrollTop = offsetTop - SCROLL_MARGIN;
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
		// console.debug(editorName, "getTextOffset", { root, node, offset });

		let result;
		if (node.nodeType === 1) {
			// element 타입일 경우 신경쓸 것이 많다.

			if (node.childNodes.length === offset) {
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

			let container: HTMLElement;
			let offsetBase;
			if (root === mirror) {
				container = (node as HTMLElement).closest("div[data-pos]")! as HTMLElement;
				offsetBase = Number(container.dataset.pos);
				if (container === node) {
					return offsetBase;
				}
			} else {
				container = editor;
				offsetBase = 0;
			}
			let pos = getTextOffsetOfNode(container, node);
			result = offsetBase + pos;
		} else {
			console.assert(node.nodeType === 3, "nodeType is not text node");
			
			if (root === mirror) {
				// mirror인 경우 텍스트의 처음부터 계산할 필요 없이 line 엘러먼트를 찾고 거기서부터 누적시작.
				const container = (node as ChildNode).parentElement!.closest("div[data-pos]")! as HTMLElement;
				let offsetBase = Number(container.dataset.pos);
				let pos = getTextOffsetOfNode(container, node);
				result = offsetBase + pos + offset;
			} else {
				// 맨 처음부터 텍스트노드 길이 누적...
				result = getTextOffsetOfNode(root, node) + offset;
			}
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
		const root = editor.contains(range.commonAncestorContainer) ? editor : mirror.contains(range.commonAncestorContainer) ? mirror : null;
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

		if (startOffset === -1 || startOffset >= _text.length) {
			startOffset = _text.length - 1;
		}
		if (endOffset === -1 || endOffset >= _text.length) {
			endOffset = _text.length - 1;
		}

		if (startOffset > endOffset) {
			[startOffset, endOffset] = [endOffset, startOffset];
		}

		// console.debug(editorName, "getTextSelectionRange", { startOffset, endOffset });
		return [startOffset, endOffset];
	}

	function selectTextRange(startOffset: number, endOffset: number) {
		// console.debug(editorName, "selectTextRange", { startOffset, endOffset });
		startOffset = Math.max(0, Math.min(startOffset, _text.length - 1));
		endOffset = Math.max(0, Math.min(endOffset, _text.length - 1));

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
			const sel = window.getSelection()!;
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}
	// #endregion
	// =============================================================

	return {
		name: editorName,
		wrapper,
		editor,
		mirror,
		updateText,
		setText,
		update,
		scrollToDiff,
		scrollToHeading,
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
		},
	};
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];
