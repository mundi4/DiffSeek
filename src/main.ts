"use strict";

// 너무나도 센스 넘쳐버리는 이름
const DiffSeek = (function () {
	let _diffs: DiffEntry[] | null = [];
	let _anchors: Anchor[] | null = [];
	let _alignedMode = false;
	let _alignedDirty = false;
	let _activeEditor: Editor | null = null;
	let _lastFocusedEditor: Editor | null = null;
	let _lastScrolledEditor: Editor | null = null;
	let _mousedOverEditor: Editor | null = null;
	let _currentlyScrollingEditor: Editor | null = null;
	let _preventScrollSync = false;
	let _currentDiffIndex = -1;
	let _syncEditor = false;
	let _resetCurrentlyScrollingEditorId: number | null = null;

	const _diffOptions = {
		algorithm: "myers",
		tokenization: 2,
		greedyMatch: true,
		useFallback: true,
	};

	const useEditableMirror = false;
	const container = document.getElementById("main") as HTMLElement;
	const leftEditor = createEditor(container, "left", getEditorCallbacks("left"));
	const rightEditor = createEditor(container, "right", getEditorCallbacks("right"));
	leftEditor.wrapper.tabIndex = 100;
	rightEditor.wrapper.tabIndex = 101;

	leftEditor.editor.innerHTML = `<div>@@@
type TokenCacheEntry = {
	text: string;
	tokens: Token[];
};

const tokenCache: { [method: number]: TokenCacheEntry[] } = {
	[TOKENIZE_BY_CHAR]: [],
	[TOKENIZE_BY_WORD]: [],
	[TOKENIZE_BY_LINE]: [],
};

type TrieNode = {
	next: (char: string | number) => TrieNode | null;
	addChild: (char: string | number) => TrieNode;
	word: string | null;
	flags: number | null;
};</div>`;

	rightEditor.editor.innerHTML = `<div>@@@
const tokenCache: { [method: number]: TokenCacheEntry[] } = {
	[TOKENIZE_BY_CHAR]: [],
	[TOKENIZE_BY_WORD]: [],
	[TOKENIZE3_BY_LINE]: [],
};

type TrieNode = {
	next: (char: string | number) => TrieNode | null;
	addChild: (char: string | number) => TrieNode;
	word: string | null;
	fl3ags: number | null;1
};
</div>`;
// rightEditor.editor.innerHTML = `<div>111
// </div>`;
	const body = document.querySelector("body") as HTMLBodyElement;
	const diffList = document.getElementById("diffList") as HTMLUListElement;
	const highlightStyle = document.getElementById("highlightStyle") as HTMLStyleElement;
	const progress = document.getElementById("progress") as HTMLElement;
	const scrollSyncIndicator = document.getElementById("scrollSyncIndicator") as HTMLElement;

	const resizeObserver = new ResizeObserver((entries) => {
		_alignedDirty = true;
		if (_alignedMode) {
			recalculateAlignmentPaddingAndPositionsDebounced();
		} else if (_syncEditor) {
			// 어느 에디터를 기준으로 싱크를 하냐?
			// 기준이 단순하고 명확하지 않으면 오히려 더 혼란스러움.
			// 1. 포커스를 가진 에디터?...
			// 2. 마우스커서가 올려진 에디터?...
			// 3. 최근에 스크롤된 에디터?...
		}
	});

	const recalculateAlignmentPaddingAndPositionsDebounced = debounce(recalculateAlignmentPaddingAndPositions, 200);

	function getEditorCallbacks(editorName: EditorName) {
		const pendingDiffVisibilities = new Map();
		let updateDiffVisilitiesPending = false;

		return {
			onTextChanged: function () {
				_diffs = null;
				_anchors = null;
				_currentDiffIndex = -1;
				_alignedDirty = true;
				computeDiff();
			},

			onMirrorUpdated: function () {
				_alignedDirty = true;
				if (_alignedMode) {
					recalculateAlignmentPaddingAndPositions();
				}
			},

			// 현재 화면 상에 보이는 diff 아이템들.
			onDiffVisibilityChanged: (diffIndex: number, visible: boolean) => {
				pendingDiffVisibilities.set(diffIndex, visible);
				if (!updateDiffVisilitiesPending) {
					updateDiffVisilitiesPending = true;
					requestAnimationFrame(() => {
						updateDiffVisilitiesPending = false;
						for (const [diffIndex, visible] of pendingDiffVisibilities) {
							const listItem = diffList.children[diffIndex];
							if (listItem) {
								const button = listItem.firstElementChild as HTMLElement;
								button.classList.toggle(editorName + "-visible", visible);
							}
						}
						pendingDiffVisibilities.clear();
					});
				}
			},
		};
	}

	const { computeDiff } = (function () {
		// 회사pc 보안 설정 상 new Worker("worker.js")는 실행 안됨.
		let workerURL;
		const workerCode = (document.getElementById("worker.js") as HTMLElement).textContent;
		if (workerCode!.trim().length === 0) {
			workerURL = "./dist/worker.js";
		} else {
			const blob = new Blob([workerCode!], { type: "application/javascript" });
			workerURL = URL.createObjectURL(blob);
		}
		const worker = new Worker(workerURL);
		// 인코더 쓸 필요 있을까?? 안쓰는 쪽이 메인쓰레드 부담이 작을 것 같은데...?
		// const encoder = new TextEncoder();

		function htmlEntityToChar(entity: string) {
			const doc = new DOMParser().parseFromString(entity, "text/html");
			const char = doc.body.textContent!;
			if (char.length !== 1) {
				throw new Error("htmlEntityToChar: not a single character entity: " + entity);
			}
			return char;
		}

		for (var entry of NORMALIZE_CHARS) {
			// entry[0] = encoder.encode(entry[0]);
			let chars = "";
			for (var i = 0; i < entry.length; i++) {
				const char = entry[i];
				if (char.length === 1) {
					chars += char;
				} else if (typeof char === "number") {
					chars += String.fromCharCode(char);
				} else if (char[0] === "&") {
					chars += htmlEntityToChar(char);
				} else {
					throw new Error("normalizeChars: not a single character: " + char);
				}
			}
			worker.postMessage({
				type: "normalizeChars",
				chars: chars,
			});
		}

		let reqId = 0;
		let computeDiffTimeoutId: number | null = null;
		function computeDiff() {
			if (computeDiffTimeoutId) {
				clearTimeout(computeDiffTimeoutId);
			}

			computeDiffTimeoutId = setTimeout(() => {
				progress.textContent = "...";
				body.classList.toggle("identical", leftEditor.text === rightEditor.text);
				body.classList.add("computing");
				if (reqId === Number.MAX_SAFE_INTEGER) {
					reqId = 1;
				} else {
					reqId++;
				}
				worker.postMessage({
					type: "diff",
					reqId: reqId,
					leftText: leftEditor.text,
					rightText: rightEditor.text,
					// left: encoder.encode(leftEditor.text),
					// right: encoder.encode(rightEditor.text),
					// method: _diffMethod,
					// useFallback: _useFallback,
					// greedyMatch: _greedyMatch,
					options: _diffOptions,
				});
			}, COMPUTE_DEBOUNCE_TIME);
		}

		worker.onmessage = function (e) {
			const data = e.data;
			if (data.type === "diffs") {
				if (data.reqId === reqId) {
					document.querySelector("body")!.classList.remove("computing");
					onDiffComputed(data);
				}
			} else if (data.type === "start") {
				progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
			}
		};

		function onDiffComputed({ diffs, anchors }: { diffs: DiffEntry[]; anchors: Anchor[] }) {
			//console.debug("diffs computed", diffs, anchors);
			_diffs = diffs;
			_anchors = anchors;
			_alignedDirty = true;
			leftEditor.update({ diffs, anchors });
			rightEditor.update({ diffs, anchors });
			updateDiffList();
		}

		return { computeDiff };
	})();

	function enableAlignedMode() {
		// 스크롤 위치는 어디쪽 에디터에 맞추나?
		// 역시 명확한 기준이 필요.

		if (!_alignedMode) {
			const currentSelectionRange = getSelectionRange();
			const currentEditor = _activeEditor || _mousedOverEditor || _lastFocusedEditor || rightEditor;
			// let firstVisibleLine, firstVisibleLineTop;
			// if (currentEditor) {
			// 	[firstVisibleLine, firstVisibleLineTop] = currentEditor.getFirstVisibleLineElement();
			// }

			_alignedMode = true;
			leftEditor.mirror.tabIndex = 100;
			rightEditor.mirror.tabIndex = 101;
			if (useEditableMirror) {
				leftEditor.mirror.contentEditable = "plaintext-only";
				rightEditor.mirror.contentEditable = "plaintext-only";
			}
			updateButtons();
			leftEditor.setEditMode(false);
			rightEditor.setEditMode(false);
			body.classList.remove("edit");
			body.classList.add("aligned");
			recalculateAlignmentPaddingAndPositions();

			if (currentSelectionRange) {
				restoreSelectionRange(currentSelectionRange);
			}

			//if (firstVisibleLine) {
			// const top = firstVisibleLine.offsetTop + TOPBAR_HEIGHT;
			requestAnimationFrame(() => {
				const theOtherEditor = currentEditor === leftEditor ? rightEditor : leftEditor;
				theOtherEditor.wrapper.scrollTop = currentEditor.wrapper.scrollTop;
				// container.scrollTop = top;
			});
			//}
		}
	}

	function disableAlignedMode() {
		const currentSelectionRange = getSelectionRange();

		// 일단 editmode로 가기 전에 스크롤 위치를 복원할 수 있게 화면 상 첫줄을 보존해두고...
		const [leftFirstLine, leftFirstLineDistance] = leftEditor.getFirstVisibleLineElement();
		const [rightFirstLine, rightFirstLineDistance] = rightEditor.getFirstVisibleLineElement();

		const activeEditor = _activeEditor;

		_alignedMode = false;
		leftEditor.setEditMode(true);
		rightEditor.setEditMode(true);
		leftEditor.mirror.removeAttribute("tabindex");
		rightEditor.mirror.removeAttribute("tabindex");
		leftEditor.mirror.contentEditable = "false";
		rightEditor.mirror.contentEditable = "false";
		body.classList.remove("aligned");
		body.classList.add("edit");
		updateButtons();

		_preventScrollSync = true;
		requestAnimationFrame(() => {
			if (leftFirstLine) {
				leftEditor.scrollToLine(Number(leftFirstLine.dataset.lineNum), leftFirstLineDistance!);
			}
			if (rightFirstLine) {
				rightEditor.scrollToLine(Number(rightFirstLine.dataset.lineNum), rightFirstLineDistance!);
			}
			_preventScrollSync = false;
		});

		if (currentSelectionRange) {
			restoreSelectionRange(currentSelectionRange);
		}
	}

	// 최적화의 여지가 있다.
	// 엘러먼트 별로 스타일과 클래스를 지정할 게 아니라 css텍스트(예: #leftAnchor17 { height: 60px; } ...)를 만들어서 style요소에다 한번에 집어넣어버리면
	// reset이 간단하고 브라우저도 한번만 일을 하면 되니 더 낫지 않을까...? offsetHeight 같은 속성을 사용하면 브라우저가 매번 계산을 다시 해야한다.
	// 위에서부터 왼쪽/오른쪽 누적 패딩을 계산하면서 내려오면 될 것 같은데...?
	function recalculateAlignmentPaddingAndPositions() {
		if (!_alignedDirty) {
			return;
		}

		leftEditor.mirror.style.height = "auto";
		rightEditor.mirror.style.height = "auto";

		const anchors = _anchors;
		if (!anchors) {
			return;
		}

		for (let i = 0; i < leftEditor.anchorElements.length; i++) {
			const anchor = leftEditor.anchorElements[i];
			anchor.style.height = "0";
			anchor.className = "";
		}
		for (let i = 0; i < rightEditor.anchorElements.length; i++) {
			const anchor = rightEditor.anchorElements[i];
			anchor.style.height = "0";
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
		requestAnimationFrame(() => {
			const height = Math.max(leftEditor.mirror.offsetHeight, rightEditor.mirror.offsetHeight);
			// console.log("height", {
			// 	left: leftEditor.mirror.offsetHeight,
			// 	right: rightEditor.mirror.offsetHeight,
			// 	height: height,
			// 	leftScrollHeight: leftEditor.wrapper.scrollHeight,
			// 	rightScrollHeight: rightEditor.wrapper.scrollHeight,
			// });
			leftEditor.mirror.style.height = `${height}px`;
			rightEditor.mirror.style.height = `${height}px`;
		});
	}

	function alignAnchor(leftAnchor: HTMLElement, rightAnchor: HTMLElement, type: AnchorType) {
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

	function restoreSelectionRange({ editor, startOffset, endOffset }: { editor: Editor; startOffset: number; endOffset: number }) {
		if (editor) {
			editor.selectTextRange(startOffset, endOffset);
		}
	}

	function getSelectionRange() {
		let editor;
		let range = leftEditor.getTextSelectionRange();
		if (range !== null) {
			editor = leftEditor;
		} else {
			range = rightEditor.getTextSelectionRange();
			if (range !== null) {
				editor = rightEditor;
			}
		}

		if (editor) {
			return {
				editor,
				startOffset: range!.startOffset,
				endOffset: range!.endOffset,
			};
		} else {
			return null;
		}
	}

	function syncScrollPosition(sourceEditor: Editor | null) {
		if (_preventScrollSync) {
			return;
		}

		if (!sourceEditor) {
			sourceEditor = _currentlyScrollingEditor || _activeEditor || _mousedOverEditor || _lastFocusedEditor;
			if (!sourceEditor) {
				return;
			}
		}

		if (_currentlyScrollingEditor !== null && _currentlyScrollingEditor !== sourceEditor) {
			return;
		}

		_preventScrollSync = true;
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
			targetWrapper.scrollTop = sourceWrapper.scrollTop - sourceAnchor.offsetTop + targetAnchor.offsetTop;
			_lastScrolledEditor = prevLastScrolledEditor;
		}
		requestAnimationFrame(() => {
			_preventScrollSync = false;
		});
	}

	function highlightDiff(diffIndex: number) {
		highlightStyle.textContent = `mark[data-diff="${diffIndex}"], mark[data-diff="${diffIndex}"]::after { 
box-shadow: 0px 0px 15px 3px hsl(var(--diff-hue) 100% 80% / 0.8);
animation: highlightAnimation 0.3s linear 3; 
}`;
	}

	document.addEventListener("mouseover", (e) => {
		if ((e.target as HTMLElement).dataset.diff !== undefined) {
			const diff = Number((e.target as HTMLElement).dataset.diff);
			highlightDiff(diff);
		}
	});

	document.addEventListener("mouseout", (e) => {
		if ((e.target as HTMLElement).dataset.diff !== undefined) {
			highlightStyle.textContent = "";
		}
	});

	// syncScrollToggle.addEventListener("click", () => {
	// 	toggleSyncScroll();
	// });

	// alignedModeToggle.addEventListener("click", () => {
	// 	if (_alignedMode) {
	// 		disableAlignedMode();
	// 	} else {
	// 		enableAlignedMode();
	// 	}
	// });

	function toggleSyncScroll() {
		_syncEditor = !_syncEditor;
		updateButtons();
	}

	function updateButtons() {
		//syncScrollToggle.setAttribute("aria-pressed", _syncEditor);
		// alignedModeToggle.setAttribute("aria-pressed", _alignedMode);
		if (_syncEditor && !_alignedMode) {
			scrollSyncIndicator.style.display = "block";
		} else {
			scrollSyncIndicator.style.display = "none";
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
			button.dataset.diff = i.toString();
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

	document.addEventListener("keydown", (e) => {
		// 어느 단축키를 써야 잘썼다고 소문나냐?
		if (
			e.key === "F2" ||
			(e.key === "Enter" && e.ctrlKey)
			// || e.key === "Escape"
		) {
			e.preventDefault();

			if (e.shiftKey) {
				toggleSyncScroll();
				return;
			}

			if (_alignedMode) {
				disableAlignedMode();
			} else {
				enableAlignedMode();
			}
			return;
		}

		// 기본적으로 브라우저의 첫번째 탭, 두번째 탭을 선택하는 단축키이긴 한데...
		// 아몰랑.
		if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
			// TODO focus가 양쪽을 왔다갔다 할때 caret cursor 위치가 초기화됨.
			// 포커스를 잃을때 위치를 저장하고 포커스를 받은 뒤 딱히 위치를 정할 수 없을 때 저장된 위치 복구??
			e.preventDefault();
			if (_alignedMode) {
				disableAlignedMode();
			}
			const editor = e.key === "1" ? leftEditor : rightEditor;
			editor.editor.focus();
			return;
		}

		// 주의 요망
		// aligned 모드에서 후딱 단어 하나를 삭제하거나 등등등 정말 단순한 수정을 바로 할 수 있게
		if ((_alignedMode && !e.ctrlKey && e.key.length === 1) || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
			disableAlignedMode();
			// 위험. 텍스트가 변경이 되고 mirror는 아직 업데이트 되지 않은 상태임.
			// requestAnimationFrame(() => {
			// 	enableAlignedMode();
			// });
			return;
		}

		// diff cycling
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
			_preventScrollSync = true;
			leftEditor.scrollToDiff(_currentDiffIndex);
			rightEditor.scrollToDiff(_currentDiffIndex);
			highlightDiff(_currentDiffIndex);
			requestAnimationFrame(() => {
				_preventScrollSync = false;
			});
			return;
		}
	});

	diffList.addEventListener("click", (e) => {
		const diffIndex = Number((e.target as HTMLElement).dataset.diff);
		if (!isNaN(diffIndex)) {
			_currentDiffIndex = diffIndex;
			_preventScrollSync = true;
			leftEditor.scrollToDiff(diffIndex);
			rightEditor.scrollToDiff(diffIndex);
			requestAnimationFrame(() => {
				_preventScrollSync = false;
			});
		}
	});

	for (const editor of [leftEditor, rightEditor]) {
		editor.wrapper.addEventListener("scroll", (e) => {
			if (_currentlyScrollingEditor !== null || _preventScrollSync) {
				return;
			}

			_lastScrolledEditor = _currentlyScrollingEditor = editor;
			if (_alignedMode) {
				// aligned mode일 때는 양쪽 에디터의 높이가 같게 유지되니 둘 다 overflow:visible로 해두고
				// 부모에서 스크롤하면 둘 다 스크롤이 되지만 그렇게 하면 스크롤바가 하나만 보이는게 생각보다 어색하고 불편하다.
				// 그래서 그냥 강제로 스크롤 동기화 시킴.
				if (editor === leftEditor) {
					rightEditor.wrapper.scrollTop = editor.wrapper.scrollTop;
				} else {
					leftEditor.wrapper.scrollTop = editor.wrapper.scrollTop;
				}
			} else if (_syncEditor) {
				syncScrollPosition(editor);
			}

			if (_resetCurrentlyScrollingEditorId) {
				cancelAnimationFrame(_resetCurrentlyScrollingEditorId);
			}
			_resetCurrentlyScrollingEditorId = requestAnimationFrame(() => {
				_currentlyScrollingEditor = null;
			});
		});

		editor.wrapper.addEventListener("mouseenter", () => {
			_mousedOverEditor = editor;
		});

		editor.wrapper.addEventListener("mouseleave", () => {
			_mousedOverEditor = null;
		});

		function onFocus() {
			_activeEditor = _lastFocusedEditor = editor;
		}

		function onBlur() {
			_activeEditor = null;
		}
		editor.editor.addEventListener("focus", onFocus);
		editor.mirror.addEventListener("focus", onFocus);
		editor.editor.addEventListener("blur", onBlur);
		editor.mirror.addEventListener("blur", onBlur);

		editor.editor.addEventListener("keydown", (e) => {
			if (e.key === " " && e.ctrlKey) {
				// 에디터에서 컨트롤-스페이스바로 현재 줄위치 동기화
				syncScrollPosition(editor);
			} else if (e.ctrlKey && e.key === "ArrowUp") {
				// 이정도 스크롤은 기본적으로 되어되는거 아니야?
				editor.wrapper.scrollTop -= LINE_HEIGHT * 2;
				e.preventDefault();
			} else if (e.ctrlKey && e.key === "ArrowDown") {
				editor.wrapper.scrollTop += LINE_HEIGHT * 2;
				e.preventDefault();
			}
		});

		// editor.editor.addEventListener("click", (e) => {
		// 	if (e.ctrlKey) {
		// 		enableAlignedMode(true);
		// 	}
		// });

		editor.mirror.addEventListener("click", (e) => {
			if (e.ctrlKey) {
				_activeEditor = editor;
				disableAlignedMode();
			}
		});

		// 그냥 써도 괜찮을 것 같은데?
		editor.mirror.addEventListener("paste", (e) => {
			disableAlignedMode();
		});

		editor.mirror.addEventListener("cut", (e) => {
			disableAlignedMode();
		});

		if (useEditableMirror) {
			// editor.mirror.addEventListener("paste", (e) => {
			// 	disableAlignedMode();
			// });

			// editor.mirror.addEventListener("paste", (e) => {
			// 	disableAlignedMode();
			// });

			// editor.mirror.addEventListener("cut", (e) => {
			// 	disableAlignedMode();
			// });

			editor.mirror.addEventListener("drop", (e) => {
				e.preventDefault();
			});

			// aligned mode에서도 텍스트 커서가 깜빡이면서 보였으면 좋겠고 단순한 편집은 모드 토글 없이 바로 수행할 수 있게?
			// 수정을 시도하는 순간:
			// 1. editor로 포커스를 옮기고
			// 2. mirror의 커서위치와 텍스트선택 범위롤 editor에서 복원
			// 3. 나머지는 브라우저가 하게 내비둔다.
			// 불안하지만 일단 써보면서 문제가 있으면 지워버리지 뭐
			// => 결론: 쓰지마. 한글을 입력할 때 가끔씩 아무 조건에도 안걸리고 뚫려서 입력이 된다. ㅋㅋ
			// editor.mirror.addEventListener("keydown", (e) => {
			// 	if (
			// 		_alignedMode &&
			// 		!e.ctrlKey &&
			// 		//e.key.length === 1 ||
			// 		(e.key === "Backspace" || e.key === "Delete" || e.key === "Enter")
			// 	) {
			// 		disableAlignedMode();
			// 		return;
			// 	}
			// 	e.preventDefault();
			// });
		}

		resizeObserver.observe(editor.wrapper);
	}

	disableAlignedMode();

	leftEditor.updateText();
	rightEditor.updateText();

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

		compute: computeDiff,

		diffOptions: {
			get greedyMatch() {
				return _diffOptions.greedyMatch;
			},
			set greedyMatch(value) {
				value = !!value;
				if (_diffOptions.greedyMatch === value) {
					return;
				}
				_diffOptions.greedyMatch = value;
				computeDiff();
			},
			get useFallback() {
				return _diffOptions.useFallback;
			},
			set useFallback(value) {
				value = !!value;
				if (_diffOptions.useFallback === value) {
					return;
				}
				_diffOptions.useFallback = value;
				computeDiff();
			},
			get tokenization() {
				return _diffOptions.tokenization;
			},
			set tokenization(value) {
				value = Number(value);
				if (_diffOptions.tokenization === value) {
					return;
				}
				_diffOptions.tokenization = value;
				computeDiff();
			},
			get algorithm() {
				return _diffOptions.algorithm;
			},
			set algorithm(value) {
				if (_diffOptions.algorithm === value) {
					return;
				}
				_diffOptions.algorithm = value;
				computeDiff();
			}
		},
	};
})();

function debounce(func: { (): void; apply?: any }, delay: number | undefined) {
	let timeoutId: number;
	return function (this: any, ...args: any) {
		const context = this;
		clearTimeout(timeoutId);
		timeoutId = setTimeout(function () {
			func.apply(context, args);
		}, delay);
	};
}
