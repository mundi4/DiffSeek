"use strict";
// 너무나도 센스 넘쳐버리는 이름
const DiffSeek = (function () {
    let _diffs = [];
    let _anchors = [];
    let _mappings = [];
    let _alignedMode = false;
    let _alignedDirty = false;
    let _activeEditor = null;
    let _lastFocusedEditor = null;
    let _lastScrolledEditor = null;
    let _mousedOverEditor = null;
    let _currentlyScrollingEditor = null;
    let _preventScrollSync = false;
    let _currentDiffIndex = -1;
    let _syncEditor = false;
    let _resetCurrentlyScrollingEditorId = null;
    // let _leftTokens: Token[] = [];
    // let _rightTokens: Token[] = [];
    const _diffOptions = {
        algorithm: "histogram",
        tokenization: "word",
        whitespace: "ignore",
        greedyMatch: false,
        useLengthBias: true,
        maxGram: 5,
    };
    const useEditableMirror = false;
    const container = document.getElementById("main");
    const leftEditor = createEditor(container, "left", getEditorCallbacks("left"));
    const rightEditor = createEditor(container, "right", getEditorCallbacks("right"));
    leftEditor.wrapper.tabIndex = 100;
    rightEditor.wrapper.tabIndex = 101;
    const body = document.querySelector("body");
    const diffList = document.getElementById("diffList");
    const highlightStyle = document.getElementById("highlightStyle");
    const progress = document.getElementById("progress");
    const scrollSyncIndicator = document.getElementById("scrollSyncIndicator");
    const alignmentStyleElement = document.createElement("style");
    document.head.appendChild(alignmentStyleElement);
    const resizeObserver = new ResizeObserver(() => {
        _alignedDirty = true;
        if (_alignedMode) {
            recalculateAlignmentPaddingAndPositionsDebounced();
        }
        else if (_syncEditor) {
            // 어느 에디터를 기준으로 싱크를 하냐?
            // 기준이 단순하고 명확하지 않으면 오히려 더 혼란스러움.
            // 1. 포커스를 가진 에디터?...
            // 2. 마우스커서가 올려진 에디터?...
            // 3. 최근에 스크롤된 에디터?...
        }
    });
    resizeObserver.observe(container);
    const recalculateAlignmentPaddingAndPositionsDebounced = debounce(recalculateAlignmentPaddingAndPositions, 200);
    function getEditorCallbacks(editorName) {
        const pendingDiffVisibilities = new Map();
        let updateDiffVisilitiesPending = false;
        return {
            onTextChanged: function () {
                computeDiff();
            },
            onMirrorUpdated: function () {
                _alignedDirty = true;
                if (_alignedMode) {
                    recalculateAlignmentPaddingAndPositions();
                }
            },
            // 현재 화면 상에 보이는 diff 아이템들.
            onDiffVisibilityChanged: (diffIndex, visible) => {
                pendingDiffVisibilities.set(diffIndex, visible);
                if (!updateDiffVisilitiesPending) {
                    updateDiffVisilitiesPending = true;
                    requestAnimationFrame(() => {
                        updateDiffVisilitiesPending = false;
                        for (const [diffIndex, visible] of pendingDiffVisibilities) {
                            const listItem = diffList.children[diffIndex];
                            if (listItem) {
                                const button = listItem.firstElementChild;
                                button.classList.toggle(editorName + "-visible", visible);
                            }
                        }
                        pendingDiffVisibilities.clear();
                    });
                }
            },
        };
    }
    function createWorker() {
        // 회사pc 보안 설정 상 new Worker("worker.js")는 실행 안됨.
        let workerURL;
        const scriptElement = document.getElementById("worker.js");
        const workerCode = scriptElement.textContent;
        if (workerCode.length < 10) {
            workerURL = scriptElement.src; // "./dist/worker.js";
        }
        else {
            const blob = new Blob([workerCode], { type: "application/javascript" });
            workerURL = URL.createObjectURL(blob);
        }
        const worker = new Worker(workerURL);
        function htmlEntityToChar(entity) {
            const doc = new DOMParser().parseFromString(entity, "text/html");
            const char = doc.body.textContent;
            if (char.length !== 1) {
                throw new Error("htmlEntityToChar: not a single character entity: " + entity);
            }
            return char;
        }
        // TODO
        // 그냥 { type: "init? config?", normalizeChars: {...}, ... } 이런 식으로 보내는게 더 나을듯.
        for (var entry of NORMALIZE_CHARS) {
            // entry[0] = encoder.encode(entry[0]);
            let chars = "";
            for (var i = 0; i < entry.length; i++) {
                const char = entry[i];
                if (char.length === 1) {
                    chars += char;
                }
                else if (typeof char === "number") {
                    chars += String.fromCharCode(char);
                }
                else if (char[0] === "&") {
                    chars += htmlEntityToChar(char);
                }
                else {
                    throw new Error("normalizeChars: not a single character: " + char);
                }
            }
            worker.postMessage({
                type: "normalizeChars",
                chars: chars,
            });
        }
        return worker;
    }
    const { computeDiff } = (function () {
        const worker = createWorker();
        let reqId = 0;
        let computeDiffTimeoutId = null;
        function computeDiff() {
            if (computeDiffTimeoutId) {
                clearTimeout(computeDiffTimeoutId);
            }
            computeDiffTimeoutId = setTimeout(() => {
                _diffs = null;
                _anchors = null;
                _mappings = null;
                _currentDiffIndex = -1;
                _alignedDirty = true;
                // 토큰화를 UI 쓰레드에서도 해봤지만 텍스트 수정 시에 살짝 거슬리는 느낌.
                // _leftTokens = tokenize(leftEditor.text, _diffOptions.tokenization);
                // _rightTokens = tokenize(rightEditor.text, _diffOptions.tokenization);
                progress.textContent = "...";
                // 복붙이 제대로 되었는지(ctrl-c를 믿을 수 없음) 확인하기 위해...
                body.classList.toggle("identical", leftEditor.text === rightEditor.text);
                body.classList.add("computing");
                if (reqId === Number.MAX_SAFE_INTEGER) {
                    reqId = 1;
                }
                else {
                    reqId++;
                }
                const request = {
                    type: "diff",
                    reqId: reqId,
                    leftText: leftEditor.text,
                    rightText: rightEditor.text,
                    // leftTokens: _leftTokens,
                    // rightTokens: _rightTokens,
                    options: _diffOptions,
                };
                // console.debug("diff request:", request.options);
                worker.postMessage(request);
            }, COMPUTE_DEBOUNCE_TIME);
        }
        worker.onmessage = function (e) {
            const data = e.data;
            if (data.type === "diffs") {
                if (data.reqId === reqId) {
                    document.querySelector("body").classList.remove("computing");
                    onDiffComputed(data);
                }
            }
            else if (data.type === "start") {
                progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
            }
        };
        function onDiffComputed(data) {
            // console.log("onDiffComputed", data);
            const { diffs, anchors } = data;
            _diffs = diffs;
            _anchors = anchors;
            _alignedDirty = true;
            leftEditor.update({ diffs, anchors });
            rightEditor.update({ diffs, anchors });
            updateDiffList();
        }
        return { computeDiff };
    })();
    // 손 볼 여지가 많은데... 으...
    // 스크롤 위치 계산하는게 좀.. 음...
    function enableAlignedMode() {
        // 스크롤 위치는 어디쪽 에디터에 맞추나?
        // 역시 명확한 기준이 필요.
        if (!_alignedMode) {
            const currentSelectionRange = getSelectionRange();
            const currentEditor = _activeEditor || _mousedOverEditor || _lastFocusedEditor || rightEditor;
            let firstVisibleLine = null, firstVisibleLineTop;
            if (currentEditor) {
                [firstVisibleLine, firstVisibleLineTop] = currentEditor.getFirstVisibleLineElement();
            }
            else {
            }
            console.log("currentEditor", currentEditor, firstVisibleLine, firstVisibleLineTop);
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
            body.classList.toggle("aligned", true);
            body.classList.toggle("edit", false);
            recalculateAlignmentPaddingAndPositions();
            if (currentSelectionRange) {
                restoreSelectionRange(currentSelectionRange);
            }
            //_preventScrollSync = true;
            requestAnimationFrame(() => {
                let lineNum = Number(firstVisibleLine?.dataset?.lineNum) || 1;
                let distance = firstVisibleLineTop || 0;
                currentEditor.scrollToLine(lineNum, distance);
                const theOtherEditor = currentEditor === leftEditor ? rightEditor : leftEditor;
                theOtherEditor.wrapper.scrollTop = currentEditor.wrapper.scrollTop;
                //_preventScrollSync = false;
                //container.scrollTop = top;
            });
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
        body.classList.toggle("aligned", false);
        body.classList.toggle("edit", true);
        updateButtons();
        _preventScrollSync = true;
        requestAnimationFrame(() => {
            if (leftFirstLine) {
                leftEditor.scrollToLine(Number(leftFirstLine.dataset.lineNum), leftFirstLineDistance);
            }
            if (rightFirstLine) {
                rightEditor.scrollToLine(Number(rightFirstLine.dataset.lineNum), rightFirstLineDistance);
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
        const anchors = _anchors;
        if (!anchors) {
            return;
        }
        // 얘네들은 스스로 쑥쑥 자라게 auto로
        leftEditor.mirror.style.height = "auto";
        rightEditor.mirror.style.height = "auto";
        // 기존 스타일 한번에 날려버리기
        alignmentStyleElement.textContent = "";
        const leftAnchorEls = leftEditor.anchorElements, rightAnchorEls = rightEditor.anchorElements, leftTops = [], rightTops = [], leftHeights = [], rightHeights = [];
        // 레이아웃을 변경하기 전에 필요한 모든 값을 가져와서 캐시해서 reflow 최소화
        // 캐시된 offsetTop은 최신 값이 아니므로(먼저 나오는 앵커의 높이가 변경되거나 ...) 추가로 계산이 필요함
        for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
            leftTops[anchorIndex] = leftAnchorEls[anchorIndex]?.offsetTop;
            rightTops[anchorIndex] = rightAnchorEls[anchorIndex]?.offsetTop;
            leftHeights[anchorIndex] = leftAnchorEls[anchorIndex]?.offsetHeight;
            rightHeights[anchorIndex] = rightAnchorEls[anchorIndex]?.offsetHeight;
        }
        let styleText = "";
        let leftDelta = 0, rightDelta = 0;
        for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
            const anchor = anchors[anchorIndex];
            if (leftTops[anchorIndex] === undefined || rightTops[anchorIndex] === undefined) {
                continue;
            }
            const leftY = leftTops[anchorIndex] + leftDelta, rightY = rightTops[anchorIndex] + rightDelta;
            let delta;
            if (anchor.type === "before") {
                delta = leftY - rightY;
            }
            else if (anchor.type === "after") {
                const leftH = leftHeights[anchorIndex], rightH = rightHeights[anchorIndex];
                const leftB = leftY + leftH, rightB = rightY + rightH;
                delta = leftB - rightB;
            }
            else {
                console.warn("unknown anchor type", anchor.type);
                continue;
            }
            if (delta > 0) {
                // 오른쪽에 패딩 추가
                styleText += `.aligned #rightAnchor${anchorIndex} { display:block; height:${delta}px; }\n`;
                rightDelta += delta;
            }
            else {
                // 왼쪽에 패딩 추가
                styleText += `.aligned #leftAnchor${anchorIndex} { display:block; height:${-delta}px; }\n`;
                leftDelta += -delta;
            }
        }
        alignmentStyleElement.textContent = styleText;
        _alignedDirty = false;
        requestAnimationFrame(() => {
            const height = Math.max(leftEditor.mirror.offsetHeight, rightEditor.mirror.offsetHeight);
            leftEditor.mirror.style.height = `${height}px`;
            rightEditor.mirror.style.height = `${height}px`;
        });
    }
    // delta = 왼쪽 위치 - 오른쪽 위치
    //
    // function alignAnchor(leftAnchor: HTMLElement, rightAnchor: HTMLElement, type: AnchorType, accumulatedDelta = 0) {
    // 	if (type === "before") {
    // 		const leftTop = leftAnchor.offsetTop;
    // 		const rightTop = rightAnchor.offsetTop;
    // 		let topDiff = leftTop - rightTop;
    // 		let shortSide, longSide;
    // 		if (topDiff < 0) {
    // 			shortSide = leftAnchor;
    // 			longSide = rightAnchor;
    // 			topDiff = -topDiff;
    // 			accumulatedDelta += topDiff;
    // 		} else if (topDiff > 0) {
    // 			shortSide = rightAnchor;
    // 			longSide = leftAnchor;
    // 			accumulatedDelta += topDiff;
    // 		}
    // 		if (shortSide) {
    // 			shortSide.style.height = `${topDiff}px`;
    // 			shortSide.className = "expanded";
    // 		}
    // 	} else {
    // 		const leftBottom = leftAnchor.offsetTop + leftAnchor.offsetHeight;
    // 		const rightBottom = rightAnchor.offsetTop + rightAnchor.offsetHeight;
    // 		let bottomDiff = leftBottom - rightBottom;
    // 		let shortSide, longSide;
    // 		if (bottomDiff < 0) {
    // 			shortSide = leftAnchor;
    // 			longSide = rightAnchor;
    // 			bottomDiff = -bottomDiff;
    // 			accumulatedDelta += bottomDiff;
    // 		} else if (bottomDiff > 0) {
    // 			shortSide = rightAnchor;
    // 			longSide = leftAnchor;
    // 			accumulatedDelta += bottomDiff;
    // 		}
    // 		if (shortSide) {
    // 			shortSide.style.height = `${bottomDiff}px`;
    // 			shortSide.className = "expanded";
    // 		}
    // 	}
    // 	return accumulatedDelta;
    // }
    function restoreSelectionRange({ editor, startOffset, endOffset }) {
        if (editor) {
            editor.selectTextRange(startOffset, endOffset);
        }
    }
    function getSelectionRange() {
        let editor = null;
        let [startOffset, endOffset] = leftEditor.getTextSelectionRange();
        if (startOffset !== null) {
            editor = leftEditor;
        }
        else {
            [startOffset, endOffset] = rightEditor.getTextSelectionRange();
            if (startOffset !== null) {
                editor = rightEditor;
            }
        }
        if (editor) {
            return {
                editor,
                startOffset: startOffset,
                endOffset: endOffset,
            };
        }
        else {
            return null;
        }
    }
    function syncScrollPosition(sourceEditor) {
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
        sourceAnchor = sourceEditor.getClosestAnchorToCaret() || sourceEditor.getFirstVisibleAnchor();
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
    function highlightDiff(diffIndex) {
        highlightStyle.textContent = `mark[data-diff="${diffIndex}"], mark[data-diff="${diffIndex}"]::after { 
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
        }
        else {
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
            button.draggable = true;
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
        if (e.key === "F2" ||
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
            }
            else {
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
        const diffIndex = Number(e.target.dataset.diff);
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
        // editor.editor.addEventListener("dragstart", (e) => {
        // 	console.log("dragstart", {
        // 		e,
        // 		dt: e.dataTransfer,
        // 		items: Array.from(e.dataTransfer!.items),
        // 	});
        // 	const [startOffset, endOffset] = editor.getTextSelectionRange();
        // 	if (startOffset) {
        // 		// find matching token
        // 		const [tokens, theOtherTokens] = editor === leftEditor ? [_leftTokens, _rightTokens] : [_rightTokens, _leftTokens];
        // 		const startIndex = findTokenAt(tokens, startOffset);
        // 		const startToken = tokens[startIndex];
        // 		if (startToken) {
        // 			const endIndex = findTokenAt(tokens, endOffset!, startIndex);
        // 			const endToken = tokens[endIndex];
        // 			if (endToken) {
        // 				const [otherStartIndex] = findTokenMapping(
        // 					editor === leftEditor ? startIndex : undefined,
        // 					editor === rightEditor ? startIndex : undefined
        // 				);
        // 				const [otherEndIndex, otherEndCount] = findTokenMapping(
        // 					editor === leftEditor ? endIndex : undefined,
        // 					editor === rightEditor ? endIndex : undefined
        // 				);
        // 				if (otherStartIndex === null || otherEndIndex === null || otherEndCount === null) {
        // 					return;
        // 				}
        // 				const theOtherText = editor === leftEditor ? rightEditor.text : leftEditor.text;
        // 				const otherStartToken = theOtherTokens[otherStartIndex];
        // 				const otherEndToken = theOtherTokens[otherEndIndex + otherEndCount];
        // 				let resultText = editor.text.substring(startToken.pos, endToken.pos + endToken.len) + "\r\n" + "\r\n";
        // 				resultText += theOtherText.substring(otherStartToken.pos, otherEndToken.pos + otherEndToken.len) + "\r\n" + "\r\n";
        // 				e.dataTransfer!.setData("text/plain", resultText);
        // 			}
        // 		}
        // 		console.log("dragstart", { startOffset, endOffset, startIndex, startToken });
        // 	}
        // });
        // editor.mirror.addEventListener("dragstart", (e) => {
        // 	console.log("dragstart", {
        // 		e,
        // 		dt: e.dataTransfer,
        // 		items: Array.from(e.dataTransfer!.items),
        // 	});
        // 	const [startOffset, endOffset] = editor.getTextSelectionRange();
        // 	if (startOffset) {
        // 		// find matching token
        // 		const tokens = editor === leftEditor ? _leftTokens : _rightTokens;
        // 		const startIndex = findTokenAt(tokens, startOffset);
        // 		const startToken = tokens[startIndex];
        // 		if (startToken) {
        // 			const endIndex = findTokenAt(tokens, endOffset!, startIndex);
        // 			const endToken = tokens[endIndex];
        // 			if (endToken) {
        // 				const text = editor.text.substring(startToken.pos, endToken.pos + endToken.len) + "\r\n";
        // 				console.log("text:", text);
        // 			}
        // 		}
        // 		console.log("dragstart", { startOffset, endOffset, startIndex, startToken });
        // 	}
        // });
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
                }
                else {
                    leftEditor.wrapper.scrollTop = editor.wrapper.scrollTop;
                }
            }
            else if (_syncEditor) {
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
            }
            else if (e.ctrlKey && e.key === "ArrowUp") {
                // 이정도 스크롤은 기본적으로 되어되는거 아니야?
                editor.wrapper.scrollTop -= LINE_HEIGHT * 2;
                e.preventDefault();
            }
            else if (e.ctrlKey && e.key === "ArrowDown") {
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
    }
    disableAlignedMode();
    leftEditor.updateText();
    rightEditor.updateText();
    function findTokenMapping(leftIndex, rightIndex) {
        if (leftIndex !== undefined || rightIndex !== undefined) {
            const key = leftIndex !== undefined ? "left" : "right";
            let sideIndex = leftIndex !== undefined ? leftIndex : rightIndex;
            let lo = 0;
            let hi = _mappings.length - 1;
            let mid = 0;
            let entry = null;
            let side;
            while (lo <= hi) {
                mid = (lo + hi) >>> 1;
                entry = _mappings[mid];
                side = key === "left" ? entry.left : entry.right;
                if (side.pos >= sideIndex && side.pos + side.len > sideIndex) {
                    if (key === "left") {
                        return [entry.right.pos + entry.right.len];
                    }
                    else {
                        return [entry.left.pos + entry.left.len];
                    }
                }
                else if (side.pos + side.len <= sideIndex) {
                    lo = mid + 1;
                }
                else {
                    //if (side.pos > sideIndex!) {
                    hi = mid - 1;
                }
            }
        }
        return [null, null];
    }
    return {
        get alignedMode() {
            return _alignedMode;
        },
        set alignedMode(value) {
            if (!!value) {
                enableAlignedMode();
            }
            else {
                disableAlignedMode();
            }
        },
        get dump() {
            return {
                diffs: _diffs,
                anchors: _anchors,
                mappings: _mappings,
                leftEditor,
                rightEditor,
            };
        },
        compute: computeDiff,
        diffOptions: {
            get algorithm() {
                return _diffOptions.algorithm;
            },
            set algorithm(value) {
                if (_diffOptions.algorithm === value) {
                    return;
                }
                _diffOptions.algorithm = value;
                computeDiff();
            },
            get tokenization() {
                return _diffOptions.tokenization;
            },
            set tokenization(value) {
                if (_diffOptions.tokenization === value) {
                    return;
                }
                _diffOptions.tokenization = value;
                computeDiff();
            },
            get whitespace() {
                return _diffOptions.whitespace;
            },
            set whitespace(value) {
                if (_diffOptions.whitespace === value) {
                    return;
                }
                _diffOptions.whitespace = value;
                computeDiff();
            },
            get greedyMatch() {
                return !!_diffOptions.greedyMatch;
            },
            set greedyMatch(value) {
                value = !!value;
                if (!!_diffOptions.greedyMatch === value) {
                    return;
                }
                _diffOptions.greedyMatch = value;
                computeDiff();
            },
            get useLengthBias() {
                return !!_diffOptions.useLengthBias;
            },
            set useLengthBias(value) {
                value = !!value;
                if (!!_diffOptions.useLengthBias === value) {
                    return;
                }
                _diffOptions.useLengthBias = value;
                computeDiff();
            },
            get maxGram() {
                return _diffOptions.maxGram;
            },
            set maxGram(value) {
                if (_diffOptions.maxGram === value) {
                    return;
                }
                _diffOptions.maxGram = value;
                computeDiff();
            },
        },
    };
})();
//# sourceMappingURL=main.js.map