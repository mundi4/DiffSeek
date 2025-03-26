"use strict";



/*
코드 증말 더럽다... 
주말에 좀 정리하고:
	1. 성능에 너무 얽매이지 말고
	2. 필요할지 말지 애매하면 그냥 다 제거
그리고 이제 신경 끄자. 시간 아깝다. 언제 짤려서 쓸일 없어질지 모르는데 ㅋ
*/

let isAltPressed = false;
document.addEventListener("keydown", (event) => {
	if (event.key === "Alt") {
		isAltPressed = true;
	}
});
document.addEventListener("keyup", (event) => {
	if (event.key === "Alt") {
		isAltPressed = false;
	}
});

const DiffSeek = (function () {
	let _diffs = [];
	let _anchors = [];
	let _alignedMode = false;
	let _alignedDirty = false;
	let _updateTimeoutId = null;
	let _activeEditor = null;
	let _lastFocusedEditor = null;
	let _lastScrolledEditor = null;
	let _syncingScroll = false;
	let _syncingScrollTimeoutId = null;
	let _mousedOverEditor = null;
	let _currentDiffIndex = -1;
	let _alignTimeoutId = null;
	let _syncEditor = false;

	const container = document.getElementById("main");
	const leftEditor = createEditor(container, "left", getEditorCallbacks("left"));
	const rightEditor = createEditor(container, "right", getEditorCallbacks("right"));
	const diffList = document.getElementById("diffList");

	const recalculateAlignmentPaddingAndPositionsDebounced = debounce(recalculateAlignmentPaddingAndPositions, 200);

	function getEditorCallbacks(key) {
		return {
			onEnter: () => {
				_mousedOverEditor = key === "left" ? leftEditor : rightEditor;
			},
			onLeave: () => {
				_mousedOverEditor = null;
			},
			onFocus: () => {
				if (key === "left") {
					_activeEditor = _lastFocusedEditor = leftEditor;
				} else {
					_activeEditor = _lastFocusedEditor = rightEditor;
				}
			},
			onBlur: () => {
				_activeEditor = null;
			},
			onScroll: function () {
				// _lastScrolledEditor = key === "left" ? leftEditor : rightEditor;
				// if (!_syncingScroll && !_alignedMode) {
				// 	syncScrollPosition(_lastScrolledEditor);
				// }
			},
			onTextChanged: function () {
				if (_updateTimeoutId) {
					clearTimeout(_updateTimeoutId);
				}
				_diffs = null;
				_anchors = null;
				_currentDiffIndex = -1;
				_alignedDirty = true;
				_updateTimeoutId = setTimeout(() => {
					_updateTimeoutId = null;
					computeDiff();
				}, COMPUTE_DEBOUNCE_TIME);
			},
			onMirrorUpdated: function () {
				_alignedDirty = true;
				if (_alignedMode) {
					recalculateAlignmentPaddingAndPositions();
				}
			},
		};
	}

	// #region WORKER STUFF
	let workerURL;
	const workerCode = document.getElementById("worker.js").textContent;
	if (workerCode.trim().length === 0) {
		workerURL = "worker.js";
	} else {
		const blob = new Blob([workerCode], { type: "application/javascript" });
		workerURL = URL.createObjectURL(blob);
	}
	const worker = new Worker(workerURL);
	const encoder = new TextEncoder();
	let reqId = 0;
	function computeDiff() {
		progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
		document.querySelector("body").classList.add("computing");
		if (reqId === Number.MAX_SAFE_INTEGER) {
			reqId = 1;
		} else {
			reqId++;
		}
		worker.postMessage({
			type: "diff",
			reqId: reqId,
			left: encoder.encode(leftEditor.text),
			right: encoder.encode(rightEditor.text),
			method: 2,
		});
	}

	worker.onmessage = function (e) {
		const data = e.data;
		if (data.type === "diffs") {
			if (data.reqId === reqId) {
				//console.log("diffs computed", data);
				document.querySelector("body").classList.remove("computing");
				onDiffComputed(data);
			}
		}
	};

	function onDiffComputed({ diffs, anchors }) {
		console.debug("diffs computed", diffs, anchors);
		_diffs = diffs;
		_anchors = anchors;
		_alignedDirty = true;
		leftEditor.update({ diffs, anchors });
		rightEditor.update({ diffs, anchors });
		updateDiffList();
	}
	// #endregion

	function enableAlignedMode() {
		if (!_alignedMode) {
			const currentEditor = _mousedOverEditor || _activeEditor || _lastFocusedEditor || _lastScrolledEditor;
			let firstVisibleLine, firstVisibleLineTop;
			let caretPos;

			if (_activeEditor) {
				_activeEditor.saveCaret();
			}

			if (currentEditor) {
				// syncScrollPosition(currentEditor);
				[firstVisibleLine, firstVisibleLineTop] = currentEditor.getFirstVisibleLineElementInEditor();
			} else {
				console.log("no active editor");
			}

			_alignedMode = true;
			updateButtons();
			const body = document.querySelector("body");
			body.classList.remove("edit");
			body.classList.add("aligned");
			recalculateAlignmentPaddingAndPositions();

			// if (caretPos) {
			// 	currentEditor.scrollToTextPosition(caretPos);
			// }

			if (firstVisibleLine) {
				const top = firstVisibleLine.offsetTop + TOPBAR_HEIGHT;
				requestAnimationFrame(() => {
					container.scrollTop = top;
				});
			}
		}
	}

	function resolveSelectionRange(range) {
		let startLine = range.startContainer;
		while (startLine && startLine.tagName !== "DIV") {
			startLine = startLine.parentElement;
		}
		let endLine = range.endContainer;
		while (endLine && endLine.tagName !== "DIV") {
			endLine = endLine.parentElement;
		}
		let startOffset = range.startOffset;
		let prevSibling = range.startContainer.previousSibling;
		while (prevSibling) {
			startOffset += prevSibling.textContent.length;
			prevSibling = prevSibling.previousSibling;
		}

		let endOffset = range.endOffset;
		prevSibling = range.endContainer.previousSibling;
		while (prevSibling) {
			endOffset += prevSibling.textContent.length;
			prevSibling = prevSibling.previousSibling;
		}
	}

	window.addEventListener("resize", () => {
		_alignedDirty = true;
		if (_alignedMode) {
			recalculateAlignmentPaddingAndPositionsDebounced();
		}
	});

	// 아 귀찮아
	for (const editor of [leftEditor, rightEditor]) {
		editor.editor.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			if (_alignedMode) {
				disableAlignedMode(true);
			} else {
				enableAlignedMode();
			}
		});

		editor.mirror.addEventListener("contextmenu", (e) => {
			e.preventDefault();

			disableAlignedMode(true);
		});

		editor.mirror.addEventListener("click", (e) => {
			if (e.ctrlKey) {
				disableAlignedMode(true);
			}
		});

		editor.mirror.addEventListener("dblclick", (e) => {
			if (e.ctrlKey) {
				disableAlignedMode(true);
			}
		});

		editor.wrapper.addEventListener("scroll", (e) => {
			if (_syncingScroll) {
				return;
			}
			_lastScrolledEditor = editor;
			if (_syncEditor !== isAltPressed && !_syncingScroll && !_alignedMode) {
				syncScrollPosition(editor);
			}
		});
	}

	function selectText(range, editor, startLineNumber, startOffset, endLineNumber, endOffset) {
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
		let currentNode;
		let lineNum = 1;
		let startSet = false;

		while ((currentNode = walker.nextNode())) {
			const text = currentNode.textContent;
			let linePos = 0;
			if (!startSet) {
				if (lineNum < startLineNumber) {
					for (let i = linePos; i < text.length; i++) {
						if (text[i] === "\n") {
							lineNum++;
							if (lineNum === startLineNumber) {
								linePos = i + 1;
								break;
							}
						}
					}
				}
				if (lineNum !== startLineNumber) {
					continue;
				}
				range.setStart(currentNode, Math.min(linePos + startOffset, text.length));
				startSet = true;
			}

			if (lineNum !== endLineNumber) {
				for (let i = linePos; i < text.length; i++) {
					if (text[i] === "\n") {
						lineNum++;
						if (lineNum === endLineNumber) {
							linePos = i + 1;
							break;
						}
					}
				}
				if (lineNum !== endLineNumber) {
					continue;
				}
			}
			if (lineNum === endLineNumber) {
				range.setEnd(currentNode, Math.min(linePos + endOffset, text.length));
				return true;
			}
		}
		return false;
	}

	function getSelectionRange() {
		const selection = window.getSelection();
		const range = selection.rangeCount ? selection.getRangeAt(0) : null;
		let editor;
		if (range) {
			if (leftEditor.mirror.contains(range.commonAncestorContainer)) {
				editor = leftEditor.editor;
			} else if (rightEditor.mirror.contains(range.commonAncestorContainer)) {
				editor = rightEditor.editor;
			} else {
				return;
			}

			let startLineEl = range.startContainer;
			while (startLineEl && startLineEl.tagName !== "DIV") {
				startLineEl = startLineEl.parentElement;
			}
			let endLineEl = range.endContainer;
			while (endLineEl && endLineEl.tagName !== "DIV") {
				endLineEl = endLineEl.parentElement;
			}

			const startLineNumber = Number(startLineEl.dataset.lineNum);
			const endLineNumber = Number(endLineEl.dataset.lineNum);

			let currentNode;
			let startOffset = 0;
			let walker = document.createTreeWalker(startLineEl, NodeFilter.SHOW_TEXT, null, false);
			while ((currentNode = walker.nextNode())) {
				if (currentNode === range.startContainer) {
					startOffset += range.startOffset;
					break;
				} else {
					startOffset += currentNode.textContent.length;
				}
			}

			let endOffset = 0;
			walker = document.createTreeWalker(endLineEl, NodeFilter.SHOW_TEXT, null, false);
			while ((currentNode = walker.nextNode())) {
				if (currentNode === range.endContainer) {
					endOffset += range.endOffset;
					break;
				} else {
					endOffset += currentNode.textContent.length;
				}
			}

			console.log("selection", {
				editor,
				startLineNumber,
				startOffset,
				endLineNumber,
				endOffset,
			});
			return {
				editor,
				startLineNumber,
				startOffset,
				endLineNumber,
				endOffset,
			};
		}
		return null;
	}

	function disableAlignedMode(retainSelection = true) {
		const selectionRange = getSelectionRange();
		const [leftFirstLine, leftFirstLineDistance] = leftEditor.getFirstVisibleLineElementInEditor();
		const [rightFirstLine, rightFirstLineDistance] = rightEditor.getFirstVisibleLineElementInEditor();

		if (_lastFocusedEditor) {
			_lastFocusedEditor.saveCaret();
		}

		_alignedMode = false;
		updateButtons();
		const body = document.querySelector("body");
		body.classList.remove("aligned");
		body.classList.add("edit");

		_syncingScroll = true;

		requestAnimationFrame(() => {
			if (leftFirstLine) {
				leftEditor.scrollToLine(Number(leftFirstLine.dataset.lineNum), leftFirstLineDistance);
			}
			if (rightFirstLine) {
				rightEditor.scrollToLine(Number(rightFirstLine.dataset.lineNum), rightFirstLineDistance);
			}
			_syncingScroll = false;
		});

		if (_lastFocusedEditor) {
			_lastFocusedEditor.editor.focus();
			_lastFocusedEditor.restoreCaret();
		}

		// if (_lastFocusedEditor) {
		// 	console.log("restoring caret", _lastFocusedEditor.name);
		// 	_lastFocusedEditor.restoreCaret();
		// 	_lastFocusedEditor.editor.focus();
		// }

		if (selectionRange && retainSelection) {
			const range = document.createRange();
			if (
				selectText(
					range,
					selectionRange.editor,
					selectionRange.startLineNumber,
					selectionRange.startOffset,
					selectionRange.endLineNumber,
					selectionRange.endOffset
				)
			) {
				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
	}

	function recalculateAlignmentPaddingAndPositions() {
		if (!_alignedDirty) {
			return;
		}
		const anchors = _anchors;
		if (!anchors) {
			return;
		}

		for (let i = 0; i < leftEditor.anchorElements.length; i++) {
			const anchor = leftEditor.anchorElements[i];
			anchor.style.height = 0;
			anchor.className = "";
		}
		for (let i = 0; i < rightEditor.anchorElements.length; i++) {
			const anchor = rightEditor.anchorElements[i];
			anchor.style.height = 0;
			anchor.className = "";
		}

		for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
			const anchor = anchors[anchorIndex];
			const leftAnchor = leftEditor.anchorElements[anchorIndex];
			const rightAnchor = rightEditor.anchorElements[anchorIndex];
			if (!leftAnchor || !rightAnchor) {
				console.warn("anchor not found", anchorIndex, leftAnchor, rightAnchor);
			}

			if (leftAnchor && rightAnchor) {
				alignAnchor(leftAnchor, rightAnchor, anchor.type);
			}
		}
		_alignedDirty = false;
	}

	function alignAnchor(leftAnchor, rightAnchor, type) {
		if (type === "before") {
			const leftTop = leftAnchor.offsetTop;
			const rightTop = rightAnchor.offsetTop;
			let topDiff = leftTop - rightTop;
			let shortSide, longSide;
			if (topDiff < 0) {
				shortSide = leftAnchor;
				longSide = rightAnchor;
				topDiff = -topDiff;
			} else if (topDiff > 0) {
				shortSide = rightAnchor;
				longSide = leftAnchor;
			}

			if (shortSide) {
				shortSide.style.height = `${topDiff}px`;
				shortSide.className = "expanded";
			}
		} else {
			const leftBottom = leftAnchor.offsetTop + leftAnchor.offsetHeight;
			const rightBottom = rightAnchor.offsetTop + rightAnchor.offsetHeight;
			let bottomDiff = leftBottom - rightBottom;
			let shortSide, longSide;
			if (bottomDiff < 0) {
				shortSide = leftAnchor;
				longSide = rightAnchor;
				bottomDiff = -bottomDiff;
			} else if (bottomDiff > 0) {
				shortSide = rightAnchor;
				longSide = leftAnchor;
			}

			if (shortSide) {
				shortSide.style.height = `${bottomDiff}px`;
				shortSide.className = "expanded";
			}
		}
	}

	function updateDiffList() {
		if (!_diffs) {
			return;
		}

		const leftWholeText = leftEditor.text;
		const rightWholeText = rightEditor.text;
		const fragment = document.createDocumentFragment();

		for (let i = 0; i < _diffs.length; i++) {
			const diff = _diffs[i];
			const li = document.createElement("LI");
			const button = document.createElement("MARK");
			button.dataset.diff = i;
			button.className = "diff-color" + ((i % NUM_DIFF_COLORS) + 1);
			li.appendChild(button);

			const leftText = leftWholeText.substring(diff.left.pos, diff.left.pos + diff.left.len);
			const leftSpan = document.createElement("SPAN");
			leftSpan.textContent = leftText;
			leftSpan.classList.add("left");
			button.appendChild(leftSpan);

			const rightText = rightWholeText.substring(diff.right.pos, diff.right.pos + diff.right.len);
			const rightSpan = document.createElement("SPAN");
			rightSpan.textContent = rightText;
			rightSpan.classList.add("right");
			button.appendChild(rightSpan);

			fragment.appendChild(li);
		}

		diffList.innerHTML = "";
		diffList.appendChild(fragment);
	}

	window.addEventListener("keydown", (e) => {
		if (e.key === "F1") {
			e.preventDefault();
			// toggle!
			if (_alignedMode) {
				disableAlignedMode();
			} else {
				enableAlignedMode();
			}
			return;
		}

		if (e.key === "F2") {
			e.preventDefault();
			// toggle!
			if (_alignedMode) {
				disableAlignedMode();
			} else {
				enableAlignedMode();
			}
			return;
		}

		if (e.ctrlKey && (e.key === "q" || e.key === "Q")) {
			e.preventDefault();
			let source = _mousedOverEditor || _activeEditor;

			// if (!source) {
			// 	let elementAtCursor = document.elementFromPoint(cursorX, cursorY);
			// 	if (elementAtCursor) {
			// 		if (leftEditor.wrapper.contains(elementAtCursor)) {
			// 			source = leftEditor;
			// 		} else if (rightEditor.wrapper.contains(elementAtCursor)) {
			// 			source = rightEditor;
			// 		}
			// 	}
			// 	console.log("elementAtCursor", source);
			// }

			if (source) {
				syncScrollPosition(source);
			}
			return;
		}

		if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			if (!_diffs || _diffs.length === 0) {
				return;
			}

			_currentDiffIndex += e.key === "ArrowUp" ? -1 : 1;
			if (_currentDiffIndex < 0) {
				_currentDiffIndex = _diffs.length - 1;
			}
			if (_currentDiffIndex >= _diffs.length) {
				_currentDiffIndex = 0;
			}
			_syncingScroll = true;
			leftEditor.scrollToDiff(_currentDiffIndex);
			rightEditor.scrollToDiff(_currentDiffIndex);
			requestAnimationFrame(() => {
				_syncingScroll = false;
				highlightDiff(_currentDiffIndex);
			});
			return;
		}
	});

	diffList.addEventListener("click", (e) => {
		const diffIndex = Number(e.target.dataset.diff);
		if (!isNaN(diffIndex)) {
			leftEditor.scrollToDiff(diffIndex);
			rightEditor.scrollToDiff(diffIndex);
		}
	});

	disableAlignedMode();

	function syncScrollPosition(sourceEditor) {
		if (_syncingScroll) {
			return;
		}
		_syncingScroll = true;

		const targetEditor = sourceEditor === leftEditor ? rightEditor : leftEditor;
		let sourceAnchor = null;
		let targetAnchor = null;

		sourceAnchor = sourceEditor.getNearestAnchorToCaret() || sourceEditor.getFirstVisibleAnchor();
		if (sourceAnchor) {
			const anchorIndex = Number(sourceAnchor.dataset.anchor);
			targetAnchor = targetEditor.anchorElements[anchorIndex];
		}

		if (sourceAnchor && targetAnchor) {
			const prevLastScrolledEditor = _lastScrolledEditor;
			const sourceWrapper = sourceEditor.wrapper;
			const targetWrapper = targetEditor.wrapper;
			targetWrapper.scrollTop = sourceWrapper.scrollTop - sourceAnchor.offsetTop + targetAnchor.offsetTop + TOPBAR_HEIGHT;
			_lastScrolledEditor = prevLastScrolledEditor;
		}

		requestAnimationFrame(() => {
			_syncingScroll = false;
		});
	}

	function highlightDiff(diff) {
		highlightStyle.textContent = `mark[data-diff="${diff}"], mark[data-diff="${diff}"]::after { 
box-shadow: 0px 0px 15px 3px hsl(var(--diff-hue) 100% 80% / 0.8);
animation: highlightAnimation 0.3s linear 3; 
}`;
	}

	document.addEventListener("mouseover", (e) => {
		if (e.target.dataset.diff !== undefined) {
			const diff = Number(e.target.dataset.diff);
			highlightDiff(diff);
		}
	});

	document.addEventListener("mouseout", (e) => {
		if (e.target.dataset.diff !== undefined) {
			highlightStyle.textContent = "";
		}
	});

	syncScrollToggle.addEventListener("click", () => {
		_syncEditor = !_syncEditor;
		updateButtons();
	});

	alignedModeToggle.addEventListener("click", () => {
		if (_alignedMode) {
			disableAlignedMode();
		} else {
			enableAlignedMode();
		}
	});

	function updateButtons() {
		syncScrollToggle.setAttribute("aria-pressed", _syncEditor);
		alignedModeToggle.setAttribute("aria-pressed", _alignedMode);
	}

	return {
		get alignedMode() {
			return _alignedMode;
		},

		set alignedMode(value) {
			if (!!value) {
				enableAlignedMode();
			} else {
				disableAlignedMode();
			}
		},
		get dump() {
			return {
				diffs: _diffs,
				anchors: _anchors,
				leftEditor,
				rightEditor,
			};
		},
	};
})();

function debounce(func, delay) {
	let timeoutId;

	return function (...args) {
		const context = this;
		clearTimeout(timeoutId);
		timeoutId = setTimeout(function () {
			func.apply(context, args);
		}, delay);
	};
}
