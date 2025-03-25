"use strict";

const ANCHOR = "ANCHOR";
const CHARS = "CHARS";
const DIFF = "DIFF";
const DIFF_END = "DIFF_END";
const LINEBREAK = "LINEBREAK";
const END_OF_STRING = "END_OF_STRING";

function createEditor(container, name, callbacks) {
	const { onTextChanged, onMirrorUpdated } = callbacks;
	const _lineElements = [];
	const _diffElements = [];
	const _anchorElements = [];
	const _visibleAnchors = new Set();
	let _text = "";
	let _savedCaret = null;
	let _observingAnchors = false;

	const wrapper = document.createElement("div");
	wrapper.id = name + "EditorWrapper";
	wrapper.classList.add("editor-wrapper");

	const mirror = document.createElement("div");
	mirror.id = name + "Mirror";
	mirror.classList.add("mirror");

	const editor = document.createElement("div");
	editor.id = name + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "plaintext-only";
	editor.spellcheck = false;

	editor.appendChild(document.createTextNode(""));

	wrapper.appendChild(mirror);
	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	function updateText() {
		_text = editor.textContent;
		let p = _text.length - 1;
		let endsWithNewline = false;
		while (p >= 0) {
			if (!/\s/.test(_text[p])) {
				break;
			}
			if (_text[p] === "\n") {
				endsWithNewline = true;
				break;
			}
			p--;
		}
		if (!endsWithNewline) {
			_text += "\n";
		}
		onTextChanged(_text);
	}

	editor.addEventListener("input", updateText);
	editor.addEventListener("focus", callbacks.onFocus);
	editor.addEventListener("blur", callbacks.onBlur);
	wrapper.addEventListener("scroll", callbacks.onScroll);
	wrapper.addEventListener("mouseenter", callbacks.onEnter);
	wrapper.addEventListener("mouseleave", callbacks.onLeave);

	const anchorIntersectionObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					_visibleAnchors.add(entry.target);
				} else {
					_visibleAnchors.delete(entry.target);
				}
			}
		},

		{ threshold: 1, root: document.getElementById("main") }
	);

	function saveCaret() {
		const sel = window.getSelection();
		if (sel.rangeCount > 0) {
			const range = sel.getRangeAt(0);
			if (editor.contains(range.commonAncestorContainer)) {
				_savedCaret = range.cloneRange();
			}
		}
	}

	function restoreCaret() {
		if (_savedCaret && editor.contains(_savedCaret.commonAncestorContainer)) {
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(_savedCaret);
		}
		_savedCaret = null;
	}

	function getVisibleAnchors() {
		return Array.from(_visibleAnchors).sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos));
	}

	let mouseX;
	let mouseY;
	document.addEventListener("mousemove", (event) => {
		mouseX = event.clientX;
		mouseY = event.clientY;
	});

	const EDITOR_PADDING = 9; // FIXME constant에서 설정하고 그 값으로 css를 만들기
	function getNearestAnchorToCaret() {
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
			y = EDITOR_PADDING + wrapper.scrollTop;
		} else {
			y = rect.top + wrapper.scrollTop;
		}

		let nearestAnchor = null;
		let minDistance = Number.MAX_SAFE_INTEGER;
		for (const anchor of _visibleAnchors) {
			const distance = Math.abs(Number(anchor.dataset.pos) - y);
			if (distance < minDistance) {
				minDistance = distance;
				nearestAnchor = anchor;
				if (distance < LINE_HEIGHT / 2) {
					break;
				}
			}
		}
		return nearestAnchor;
	}

	function getFirstVisibleLineElementInEditor() {
		const lineEls = _lineElements;
		// 이진 검색으로 현재 화면에 보이는 줄 엘러먼트 중 첫번째 찾기
		// 모든 픽셀이 화면에 다 보이는 경우만! 윗부분 1px만 짤려도 가차 없다.
		let low = 0;
		let high = lineEls.length - 1;
		let mid;
		let lineEl = null;
		let lineTop = null;
		while (low <= high) {
			mid = (low + high) >>> 1;
			const top = lineEls[mid].getBoundingClientRect().top;
			if (top >= 0) {
				lineEl = lineEls[mid];
				if (top < 10) {
					// 이정도면 안전하게 "찾았다"라고 말할 수 있지 않을까?
					// 변태같이 화면 스케일을 1/2로 줄이지 않는 이상...
					break;
				}
				lineTop = top;
				high = mid - 1;
			} else {
				low = mid + 1;
			}
		}
		return [lineEl, lineTop];
	}

	// 현재 화면에 보이는 editor의 문자 인덱스를 찾음.
	function getFirstVisiblePosInEditor() {
		const rect = editor.getBoundingClientRect();
		let x = rect.left + 10;
		let y = rect.top + 10;
		let parentEl = editor.parentElement;
		while (parentEl) {
			x += parentEl.scrollLeft;
			y += parentEl.scrollTop;
			parentEl = parentEl.parentElement;
		}

		const caretPos = document.caretPositionFromPoint(x, y);
		if (caretPos !== null) {
			const offsetNode = caretPos.offsetNode;
			let offset = caretPos.offset;
			if (offsetNode.nodeType === 3 && editor.contains(offsetNode)) {
				// 찾았다. 그대로 리턴... 하면 인생 참 편하지?
				// editor 안에 여러개의 text node가 있을 수 있기 때문에 offsetNode보다 앞에 위치한 text node들의 text length를 모두 더해야함.
				// previous sibling으로 찾으면 훨씬 간단하고 빠를테지만 나중에 editor를 구조를 바꿀지도 모르니 일단 안정빵으로
				const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
				let node;
				while ((node = walker.nextNode())) {
					if (node === offsetNode) {
						return offset;
					}
					offset += node.nodeValue.length;
				}
			}
		}

		return null;
	}

	function scrollToDiff(diffIndex) {
		_diffElements[diffIndex][0].scrollIntoView({});
	}

	function scrollToLine(lineNum, offset = 0) {
		const lineEl = _lineElements[lineNum - 1];
		if (lineEl) {
			// 아! 1px이 왜 어긋나는지 몰겠는데... 나 바쁜 사람이야
			wrapper.scrollTop = lineEl.offsetTop;
		}
	}

	function scrollToTextPosition(pos) {
		if (window.getComputedStyle(editor).display === "none") {
			for (let i = 0; i < _lineElements.length; i++) {
				const linePos = Number(_lineElements[i].dataset.pos);
				if (linePos > pos) {
					if (i > 0) {
						_lineElements[i - 1].scrollIntoView();
					} else {
						mirror.scrollHeight = 0;
					}
					break;
				}
			}
		} else {
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
			let node;
			while ((node = walker.nextNode())) {
				const nodeLen = node.nodeValue.length;
				if (pos < nodeLen) {
					// TODO
					// const range = document.createRange();
					// const sel = window.getSelection();
					// range.setStart(node, pos);
					// range.setEnd(node, pos);
					// sel.removeAllRanges();
					// sel.addRange(range);
					break;
				}
				pos -= nodeLen;
			}
		}
	}

	function update({ diffs, anchors }) {
		if (!diffs) {
			return;
		}
		console.debug("update");

		_lineElements.length = 0;
		_diffElements.length = 0;
		_anchorElements.length = 0;
		untrackVisibleAnchors();

		// editor.style.removeProperty("min-height");
		// mirror.style.removeProperty("min-height");
		// wrapper.style.removeProperty("min-height");

		const text = _text;
		const view = mirror;
		const textruns = textrunGenerator(name, text, diffs, anchors);
		let lineEl = null;
		let inlineNode = null;
		let currentDiffIndex = null;
		let lineNum = 1;
		let unwrittenDiff = false;
		let lineHasNonSpaceChar = false;
		let lineHasNonSpaceNonDiffChar = false;
		let diffAnchorIndex = null;
		let _pos = 0;

		function appendAnchor(pos, anchorIndex, diffIndex = null) {
			const anchor = anchors[anchorIndex];
			if (inlineNode === null || inlineNode.nodeName !== ANCHOR_TAG) {
				const el = document.createElement(ANCHOR_TAG);
				lineEl.insertBefore(el, inlineNode);
				inlineNode = el;
			}
			inlineNode.id = `${name}Anchor${anchorIndex}-${anchor.type}`;
			inlineNode.dataset.anchor = anchorIndex;
			inlineNode.dataset.type = anchor.type;
			inlineNode.dataset.pos = pos;
			if (diffIndex !== null) {
				inlineNode.dataset.diff = diffIndex;
			} else {
				delete inlineNode.dataset.diff;
			}
			_anchorElements.push(inlineNode);
			inlineNode = inlineNode.nextSibling;
		}

		function appendChars(chars, hasNonSpaceChar) {
			if (currentDiffIndex !== null) {
				const diff = diffs[currentDiffIndex];
				if (inlineNode === null || inlineNode.nodeName !== DIFF_ELEMENT_NAME) {
					const el = document.createElement(DIFF_ELEMENT_NAME);
					el.textContent = chars;
					lineEl.insertBefore(el, inlineNode);
					inlineNode = el;
				} else {
					if (inlineNode.textContent !== chars) {
						inlineNode.textContent = chars;
					}
				}
				inlineNode.dataset.diff = currentDiffIndex;
				inlineNode.className = "diff-color" + ((currentDiffIndex % NUM_DIFF_COLORS) + 1);
				//inlineNode.classList.toggle("block", diff.align && diff[name].empty);
				_diffElements[currentDiffIndex] = _diffElements[currentDiffIndex] || [];
				_diffElements[currentDiffIndex].push(inlineNode);
				unwrittenDiff = false;
			} else {
				if (inlineNode === null || inlineNode.nodeName !== "SPAN") {
					//console.log("new text node");
					const el = document.createElement("SPAN");
					el.textContent = chars;
					lineEl.insertBefore(el, inlineNode);
					inlineNode = el;
				} else {
					if (inlineNode.textContent !== chars) {
						inlineNode.textContent = chars;
					}
				}
			}
			inlineNode = inlineNode.nextSibling;
		}

		let textRunResult;

		lineEl = view.firstElementChild;

		do {
			lineHasNonSpaceChar = false;
			lineHasNonSpaceNonDiffChar = false;
			if (currentDiffIndex !== null) {
				unwrittenDiff = true;
			}
			if (lineEl === null) {
				lineEl = document.createElement(LINE_TAG);
				view.appendChild(lineEl);
				lineEl.dataset.lineNum = lineNum;
				lineEl.dataset.pos = _pos;
			}
			_lineElements[lineNum - 1] = lineEl;
			inlineNode = lineEl.firstChild;

			while (!(textRunResult = textruns.next()).done) {
				const { type, pos, len, diffIndex, anchorIndex, hasNonSpaceChar } = textRunResult.value;
				// if (name === "right") {
				// 	console.log(lineNum, { type, pos, len, diffIndex, anchorIndex, hasNonSpaceChar });
				// }
				_pos = pos;
				if (type === DIFF) {
					currentDiffIndex = diffIndex;
					unwrittenDiff = true;
				} else if (type === DIFF_END) {
					if (unwrittenDiff) {
						appendChars("", hasNonSpaceChar);
					}
					currentDiffIndex = null;
				} else if (type === CHARS) {
					lineHasNonSpaceChar = lineHasNonSpaceChar || hasNonSpaceChar;
					if (currentDiffIndex === null) {
						lineHasNonSpaceNonDiffChar = lineHasNonSpaceNonDiffChar || hasNonSpaceChar;
					}
					appendChars(text.substring(pos, pos + len), hasNonSpaceChar);
				} else if (type === LINEBREAK || type === END_OF_STRING) {
					//console.log("linebreak", { type, pos, len });
					break;
				} else if (type === ANCHOR) {
					appendAnchor(pos, anchorIndex, diffIndex);
				}
			}

			if (unwrittenDiff) {
				appendChars("", false);
			}

			while (inlineNode) {
				const nextInlineNode = inlineNode.nextSibling;
				inlineNode.remove();
				inlineNode = nextInlineNode;
			}

			lineEl = lineEl.nextElementSibling;
			if (textRunResult.value.type === END_OF_STRING) {
				break;
			}
			lineNum++;
		} while (!textRunResult.done);

		_lineElements.length = lineNum;

		while (lineEl) {
			const nextLineEl = lineEl.nextElementSibling;
			lineEl.remove();
			lineEl = nextLineEl;
		}

		requestAnimationFrame(() => {
			// const height = view.scrollHeight;
			// editor.style.minHeight = height + "px";
			// mirror.style.minHeight = height + "px";
			// wrapper.style.minHeight = height + "px";
		});
		console.debug("update done");
		trackVisibleAnchors();
		onMirrorUpdated();
	}

	function trackVisibleAnchors() {
		if (!_observingAnchors) {
			for (const anchor of _anchorElements) {
				//if (!anchor.id.endsWith("-after")) {
				anchorIntersectionObserver.observe(anchor);
				//}
			}
			_observingAnchors = true;
		}
	}

	function untrackVisibleAnchors() {
		_observingAnchors = false;
		_visibleAnchors.clear();
		anchorIntersectionObserver.disconnect();
	}

	function getFirstVisibleAnchor() {
		let firstAnchor = null;
		let firstPos = null;
		for (const anchor of _visibleAnchors) {
			if (firstAnchor === null) {
				firstAnchor = anchor;
				firstPos = Number(anchor.dataset.pos);
			} else {
				const pos = Number(anchor.dataset.pos);
				if (pos < firstPos) {
					firstAnchor = anchor;
					firstPos = pos;
				}
			}
		}
		return firstAnchor;
	}

	function setEditMode(editMode) {
		// editmode인 경우 mirror와 editor를 둘 다 보여주고 높이도 동기화 해야한다.
		// 둘의 높이는 무조건 같다. 왜냐면 editor에 따라 wrapper 크기가 결정되고 wrapper에 따라 mirror크기 결정되니까.
		// 자바스크립트 쓸 필요가 없어야 한다.
	}

	updateText();

	return {
		name: name,
		wrapper,
		editor,
		mirror,
		update,
		getFirstVisiblePosInEditor,
		scrollToDiff,
		scrollToTextPosition,
		saveCaret,
		restoreCaret,
		getVisibleAnchors,
		trackVisibleAnchors,
		untrackVisibleAnchors,
		getFirstVisibleAnchor,
		scrollToLine,
		getFirstVisibleLineElementInEditor,
		getNearestAnchorToCaret,
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
	};
}

// 최적화의 여지가 많음
// textrun 배열을 만들면 나중에 변경된 부분만 업데이트 하거나 특정 줄만 업데이트 하기 수월함.
// mirror를 안쓰고 editor 자체를 dom으로 만들 경우 현재 커서가 있는 줄을 수정하는 게 상당히 거슬리는데(특히 한글 입력 중이면)
// 특정 줄만 업데이트를 미뤄둘 수 있으면 그런 상황에서 특정 줄만 업데이트 미뤄두고 상황 봐서 나중에 그 줄만 업데이트 할 수 있음.
function* textrunGenerator(textKey, text, diffs, anchors) {
	const _textLen = text.length;
	let _pos = 0;
	let _textPos = 0;
	let _diffIndex = -1;
	let _anchorIndex = -1;
	let _anchorPos;
	let _diffPos;
	let _inDiff = false;
	let _diffEnd;
	let _hasNonSpaceChar = false;
	let _lineNum = 1;

	let nextEventPos = Number.MAX_SAFE_INTEGER;

	const current = {
		pos: 0,
		len: 0,
		diffIndex: null,
		anchorIndex: null,
		hasNonSpaceChar: false,
	};

	// anchor위치는 diff의 시작위치
	// diff 범위 밖일때는 어디에서든 올 수 있다

	function nextAnchor() {
		_anchorIndex++;
		if (_anchorIndex < anchors.length) {
			const data = anchors[_anchorIndex];
			_anchorPos = data[textKey];
			if (_anchorPos < _pos) {
				console.warn("Anchor skipped", { anchor: data, anchorIndex: _anchorIndex, pos: _pos, anchorPos: _anchorPos });
				nextAnchor();
			}
		} else {
			_anchorIndex = anchors.length;
			_anchorPos = Number.MAX_SAFE_INTEGER;
		}
	}

	function nextDiff() {
		_diffIndex++;
		if (_diffIndex < diffs.length) {
			const data = diffs[_diffIndex][textKey];
			_diffPos = data.pos;
			_diffEnd = data.pos + data.len;
		} else {
			_diffIndex = diffs.length;
			_diffPos = Number.MAX_SAFE_INTEGER;
			_diffEnd = Number.MAX_SAFE_INTEGER;
		}
	}

	// 일단 줄번호++
	// 해당 줄번호에 해당하는 ling mapping를 찾아서 그 index를 _lineMapIndex로 저장.
	// 못찾으면 그 이후 maping index에 ~를 씌운 값
	//
	nextDiff();
	nextAnchor();

	function chars() {
		current.type = CHARS;
		current.pos = _textPos;
		current.len = _pos - _textPos;
		current.diffIndex = _inDiff ? _diffIndex : null;
		current.hasNonSpaceChar = _hasNonSpaceChar;
		_hasNonSpaceChar = false;
		_textPos = _pos;
		return current;
	}

	// 주의:
	// 같은 pos를 가진 anchor가 두개가 있을 수 있다. 길이가 0인 diff에 대한 anchor와 그 위치에 시작되는 common anchor
	// 반대의 순서는 없음.

	while (true) {
		if (_pos === _anchorPos) {
			let anchor = anchors[_anchorIndex];
			if (anchor.type === "before") {
				current.type = ANCHOR;
				current.pos = _pos;
				current.len = 0;
				current.diffIndex = _diffIndex;
				current.anchorIndex = _anchorIndex;
				yield current;
				nextAnchor();
			}
			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (_pos === _diffPos) {
			// 현재 위치 이전까지의 문자열들.
			if (_textPos < _pos) {
				yield chars();
			}
			_inDiff = true;
			_diffPos = Number.MAX_SAFE_INTEGER;
			current.type = DIFF;
			current.pos = _pos;
			current.len = 0;
			current.diffIndex = _diffIndex;
			yield current;
		}

		while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
			_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
			_pos++;
		}
		if (_textPos < _pos) {
			yield chars();
		}

		if (_pos === _diffEnd) {
			current.type = DIFF_END;
			current.pos = _pos;
			current.len = 0;
			current.diffIndex = _diffIndex;
			yield current;
			_inDiff = false;
			nextDiff();
			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (_pos === _anchorPos) {
			const anchor = anchors[_anchorIndex];
			if (anchor.type === "after") {
				current.type = ANCHOR;
				current.pos = _pos;
				current.len = 0;
				current.diffIndex = _diffIndex;
				current.anchorIndex = _anchorIndex;
				yield current;
				nextAnchor();
			}
			// type이 after가 아니더라도 이미 이 시점에서는 before 타입 앵커를 리턴할 수 없다.

			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (text[_pos] === "\n") {
			current.type = LINEBREAK;
			current.pos = _pos;
			current.len = 1;
			current.diffIndex = _inDiff ? _diffIndex : null;
			yield current;
			_lineNum++;
			_textPos = ++_pos;

			while (_anchorPos < _pos) {
				console.warn("Anchor skipped", { anchor: anchors[_anchorIndex], anchorIndex: _anchorIndex, pos: _pos, anchorPos: _anchorPos });
				nextAnchor();
			}

			continue;
		}

		if (_pos >= _textLen) {
			current.type = END_OF_STRING;
			current.pos = _textLen;
			current.len = 0;
			current.diffIndex = null;
			return current;
		}
	}

	// current.type = END_OF_STRING;
	// current.pos = _textLen;
	// current.len = 0;
	// current.diffIndex = null;
	// yield current;
	//yield [END_OF_STRING, _textLen, 0, null];
}
