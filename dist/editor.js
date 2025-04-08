"use strict";
function createEditor(container, name, callbacks) {
    const { onDiffVisibilityChanged, onTextChanged, onMirrorUpdated } = callbacks;
    const _lineElements = [];
    const _diffElements = [];
    const _anchorElements = [];
    const _visibleAnchors = new Set();
    const _visibleDiffIndices = new Set();
    let _text = "";
    let _savedCaret = null;
    let _observingAnchors = false;
    let _editMode = false;
    const wrapper = document.createElement("div");
    wrapper.id = name + "EditorWrapper";
    wrapper.classList.add("editor-wrapper");
    const mirror = document.createElement("div");
    mirror.id = name + "Mirror";
    mirror.classList.add("mirror");
    mirror.spellcheck = false;
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
        _text = editor.textContent || "";
        // let p = _text.length - 1;
        // let endsWithNewline = false;
        // while (p >= 0) {
        // 	if (!/\s/.test(_text[p])) {
        // 		break;
        // 	}
        // 	if (_text[p] === "\n") {
        // 		endsWithNewline = true;
        // 		break;
        // 	}
        // 	p--;
        // }
        // if (!endsWithNewline) {
        // }
        _text += "\n";
        onTextChanged(_text);
    }
    editor.addEventListener("input", updateText);
    const intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                if (entry.target.nodeName === ANCHOR_TAG) {
                    _visibleAnchors.add(entry.target);
                }
                else if (entry.target.nodeName === DIFF_ELEMENT_NAME) {
                    const diffIndex = Number(entry.target.dataset.diff);
                    _visibleDiffIndices.add(diffIndex);
                    onDiffVisibilityChanged(diffIndex, true);
                }
            }
            else {
                if (entry.target.nodeName === ANCHOR_TAG) {
                    _visibleAnchors.delete(entry.target);
                }
                else if (entry.target.nodeName === DIFF_ELEMENT_NAME) {
                    const diffIndex = Number(entry.target.dataset.diff);
                    _visibleDiffIndices.delete(diffIndex);
                    onDiffVisibilityChanged(diffIndex, false);
                }
            }
        }
    }, { threshold: 1, root: wrapper });
    // function saveCaret() {
    // 	const sel = window.getSelection();
    // 	if (sel.rangeCount > 0) {
    // 		const range = sel.getRangeAt(0);
    // 		if (editor.contains(range.commonAncestorContainer)) {
    // 			_savedCaret = range.cloneRange();
    // 		}
    // 	}
    // }
    // function restoreCaret() {
    // 	if (_savedCaret && editor.contains(_savedCaret.commonAncestorContainer)) {
    // 		const sel = window.getSelection();
    // 		sel.removeAllRanges();
    // 		sel.addRange(_savedCaret);
    // 	}
    // 	_savedCaret = null;
    // }
    function getVisibleAnchors() {
        return Array.from(_visibleAnchors).sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos));
    }
    let mouseX;
    let mouseY;
    document.addEventListener("mousemove", (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
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
            y = EDITOR_PADDING + TOPBAR_HEIGHT;
        }
        else {
            y = rect.top;
        }
        let nearestAnchor = null;
        let minDistance = Number.MAX_SAFE_INTEGER;
        for (const anchor of _visibleAnchors) {
            const rect = anchor.getBoundingClientRect();
            const distance = Math.abs(rect.top - y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestAnchor = anchor;
            }
        }
        return nearestAnchor;
    }
    function getFirstVisibleLineElement() {
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
            }
            else {
                low = mid + 1;
            }
        }
        return [lineEl, distance];
    }
    function scrollToDiff(diffIndex) {
        const offsetTop = _diffElements[diffIndex][0].offsetTop - wrapper.clientTop;
        wrapper.scrollTop = offsetTop - SCROLL_MARGIN;
    }
    // 내가 머리가 나쁘다는 걸 확실하게 알게 해주는 함수
    function scrollToLine(lineNum, distance = 0) {
        const lineEl = _lineElements[lineNum - 1];
        if (lineEl) {
            const scrollTop = lineEl.offsetTop - distance;
            wrapper.scrollTop = scrollTop;
        }
    }
    // generator 함수로 만들고 requestIdleCallback으로 점증적으로 업데이트 할까?
    // => 그리 무겁고 오래 걸리는 작업이 아니다.
    // 양쪽에 3000줄, 대략 diff가 20개정도 있는 상황에서 20ms 정도. 회사똥컴에서는 더 오래 걸리겠지만
    // 그렇게 큰 문서는 드물고 requestIdleCallback 자체의 오버헤드도 생각해야되니 일단 보류.
    function update({ diffs, anchors }) {
        if (!diffs) {
            return;
        }
        // const startTime = performance.now();
        // console.debug("update");
        _lineElements.length = 0;
        _diffElements.length = 0;
        _anchorElements.length = 0;
        untrackIntersections();
        const textruns = getTextRuns(name, _text, diffs, anchors);
        // editor.style.removeProperty("min-height");
        // mirror.style.removeProperty("min-height");
        // wrapper.style.removeProperty("min-height");
        const text = _text;
        const view = mirror;
        let lineEl = null;
        let inlineNode = null;
        let currentDiffIndex = null;
        let lineNum = 1;
        let unwrittenDiff = false;
        let _pos = 0;
        function appendAnchor(pos, anchorIndex, diffIndex = null) {
            const anchor = anchors[anchorIndex];
            if (inlineNode === null || inlineNode.nodeName !== ANCHOR_TAG) {
                const el = document.createElement(ANCHOR_TAG);
                el.contentEditable = false.toString();
                lineEl.insertBefore(el, inlineNode);
                inlineNode = el;
            }
            inlineNode.id = `${name}Anchor${anchorIndex}`;
            inlineNode.dataset.anchor = anchorIndex.toString();
            inlineNode.dataset.type = anchor.type;
            inlineNode.dataset.pos = pos.toString();
            if (diffIndex !== null) {
                inlineNode.dataset.diff = diffIndex.toString();
            }
            else {
                delete inlineNode.dataset.diff;
            }
            _anchorElements.push(inlineNode);
            inlineNode = inlineNode.nextSibling;
        }
        function appendChars(chars) {
            if (currentDiffIndex !== null) {
                //const diff = diffs[currentDiffIndex];
                if (inlineNode === null || inlineNode.nodeName !== DIFF_ELEMENT_NAME) {
                    const el = document.createElement(DIFF_ELEMENT_NAME);
                    if (chars !== "") {
                        el.textContent = chars;
                    }
                    lineEl.insertBefore(el, inlineNode);
                    inlineNode = el;
                }
                else {
                    if (chars === "") {
                        if (inlineNode.childNodes.length > 0) {
                            while (inlineNode.firstChild) {
                                inlineNode.removeChild(inlineNode.firstChild);
                            }
                        }
                    }
                    else {
                        if (inlineNode.textContent !== chars) {
                            inlineNode.textContent = chars;
                        }
                    }
                }
                inlineNode.dataset.diff = currentDiffIndex.toString();
                inlineNode.className = "diff-color" + ((currentDiffIndex % NUM_DIFF_COLORS) + 1);
                //inlineNode.classList.toggle("block", diff.align && diff[name].empty);
                _diffElements[currentDiffIndex] = _diffElements[currentDiffIndex] || [];
                _diffElements[currentDiffIndex].push(inlineNode);
                unwrittenDiff = false;
            }
            else {
                if (inlineNode === null || inlineNode.nodeName !== "SPAN") {
                    //console.log("new text node");
                    const el = document.createElement("SPAN");
                    el.textContent = chars;
                    lineEl.insertBefore(el, inlineNode);
                    inlineNode = el;
                }
                else {
                    if (inlineNode.textContent !== chars) {
                        inlineNode.textContent = chars;
                    }
                }
            }
            inlineNode = inlineNode.nextSibling;
        }
        lineEl = view.firstElementChild;
        if (lineEl === null) {
            lineEl = document.createElement(LINE_TAG);
            view.appendChild(lineEl);
            lineEl.dataset.lineNum = lineNum.toString();
            lineEl.dataset.pos = _pos.toString();
            lineNum++;
        }
        _lineElements.push(lineEl);
        inlineNode = lineEl.firstChild;
        for (const textrun of textruns) {
            // if (name === "right") {
            // 	console.log(lineNum, textrun);
            // }
            if (textrun.type === "CHARS") {
                const { pos, len } = textrun;
                appendChars(text.substring(pos, pos + len));
            }
            else if (textrun.type === "ANCHOR") {
                const { pos, anchorIndex } = textrun;
                appendAnchor(pos, anchorIndex, currentDiffIndex);
                unwrittenDiff = false;
            }
            else if (textrun.type === "DIFF") {
                currentDiffIndex = textrun.diffIndex;
                unwrittenDiff = true;
            }
            else if (textrun.type === "DIFF_END") {
                if (unwrittenDiff) {
                    appendChars("");
                }
                currentDiffIndex = null;
            }
            else if (textrun.type === "LINEBREAK" || textrun.type === "END_OF_STRING") {
                if (unwrittenDiff) {
                    appendChars("");
                }
                // \n을 넣어야할지 말아야할지... 차이 비교해보기
                // 특히 선택영역 복구할 때 문제 없는지.
                // if (inlineNode === null || inlineNode.nodeType !== 3 || inlineNode.nodeValue !== "\n") {
                // 	lineEl.insertBefore(document.createTextNode("\n"), inlineNode);
                // }
                while (inlineNode) {
                    const nextInlineNode = inlineNode.nextSibling;
                    inlineNode.remove();
                    inlineNode = nextInlineNode;
                }
                lineEl = lineEl.nextElementSibling;
                if (textrun.type === "LINEBREAK") {
                    lineNum++;
                    _pos = textrun.pos + textrun.len;
                    if (lineEl === null) {
                        lineEl = document.createElement(LINE_TAG);
                        view.appendChild(lineEl);
                    }
                    lineEl.dataset.lineNum = lineNum.toString();
                    lineEl.dataset.pos = _pos.toString();
                    _lineElements.push(lineEl);
                    inlineNode = lineEl.firstChild;
                    if (currentDiffIndex !== null) {
                        unwrittenDiff = true;
                    }
                }
                else {
                    _lineElements.length = lineNum;
                    while (lineEl) {
                        const nextLineEl = lineEl.nextElementSibling;
                        lineEl.remove();
                        lineEl = nextLineEl;
                    }
                    break;
                }
            }
        }
        trackIntersections();
        onMirrorUpdated();
        // const endTime = performance.now();
        // const elapsedTime = endTime - startTime;
        // console.debug(`update took ${elapsedTime} ms`);
    }
    function trackIntersections() {
        if (!_observingAnchors) {
            for (const anchor of _anchorElements) {
                intersectionObserver.observe(anchor);
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
        let firstAnchor = null;
        let firstPos = null;
        for (const anchor of _visibleAnchors) {
            if (firstAnchor === null) {
                firstAnchor = anchor;
                firstPos = Number(anchor.dataset.pos);
            }
            else {
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
        _editMode = !!editMode;
    }
    function getTextOffsetFromRoot(root, textNode, textNodeOffset) {
        let offset = 0;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if (walker.currentNode === textNode) {
                return offset + textNodeOffset;
            }
            offset += walker.currentNode.nodeValue.length;
        }
        return null;
    }
    function findLineIndexByPos(pos, low = 0, high = _lineElements.length - 1) {
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
            }
            else {
                low = mid + 1;
            }
        }
        return high;
    }
    function selectTextRange(startOffset, endOffset) {
        const range = document.createRange();
        let startSet = false;
        let endSet = false;
        if (_editMode) {
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
            let currentNode;
            let pos = 0;
            while (!endSet && (currentNode = walker.nextNode())) {
                if (!startSet && pos + currentNode.nodeValue.length >= startOffset) {
                    range.setStart(currentNode, startOffset - pos);
                    startSet = true;
                }
                if (!endSet && pos + currentNode.nodeValue.length >= endOffset) {
                    range.setEnd(currentNode, endOffset - pos);
                    endSet = true;
                }
                pos += currentNode.nodeValue.length;
            }
        }
        else {
            // binary search in _lineElements for startOffset
            let startLineIndex = findLineIndexByPos(startOffset);
            let endLineIndex = findLineIndexByPos(endOffset, startLineIndex);
            let currentNode;
            let walker = document.createTreeWalker(_lineElements[startLineIndex], NodeFilter.SHOW_TEXT, null);
            let pos = Number(_lineElements[startLineIndex].dataset.pos);
            while ((currentNode = walker.nextNode())) {
                const nodeLen = currentNode.nodeValue.length;
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
                const nodeLen = currentNode.nodeValue.length;
                if (pos + nodeLen >= endOffset) {
                    range.setEnd(currentNode, endOffset - pos);
                    endSet = true;
                    break;
                }
                pos += nodeLen;
            }
        }
        if (startSet && endSet) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    function getTextSelectionRange() {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (!wrapper.contains(range.commonAncestorContainer)) {
            return null;
        }
        let startOffset = Number.NaN;
        let endOffset = Number.NaN;
        if (_editMode) {
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
                pos += currentNode.textContent.length;
            }
        }
        else {
            // 이 경우 조금 최적화가 가능. 실제로 이게 얼마나 효율적인지는 테스트해 볼 필요가 있겠지만...
            // 몇천 라인의 텍스트고 diff, anchor가 많은 경우 당연히 시작줄, 끝줄을 먼저 찾고 그 줄에 대해서만
            // offset을 계산하는 것이 더 빠르겠지!
            // 주의: startContainer, endContainer가 text노드가 아닐 수도 있음.
            let startLineEl = range.startContainer; // HTMLElement가 아닐 수 있지만... so what?
            if (startLineEl.nodeType === 3) {
                startLineEl = startLineEl.parentElement.closest("div[data-pos]");
            }
            else {
                startOffset = Number(startLineEl.dataset.pos);
            }
            let endLineEl = range.endContainer;
            if (endLineEl.nodeType === 3) {
                endLineEl = endLineEl.parentElement.closest("div[data-pos]");
            }
            else {
                endOffset = Number(endLineEl.dataset.pos) + endLineEl.textContent.length;
            }
            if (isNaN(startOffset) || isNaN(endOffset)) {
                if (startLineEl && endLineEl) {
                    if (isNaN(startOffset)) {
                        startOffset = getTextOffsetFromRoot(startLineEl, range.startContainer, range.startOffset) + Number(startLineEl.dataset.pos);
                    }
                    if (isNaN(endOffset)) {
                        endOffset = getTextOffsetFromRoot(endLineEl, range.endContainer, range.endOffset) + Number(endLineEl.dataset.pos);
                    }
                }
                else {
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
                        pos += currentNode.textContent.length;
                    }
                }
            }
        }
        if (isNaN(startOffset) || isNaN(endOffset)) {
            return null;
        }
        // 원본텍스트의 끝에 하나의 "\n"이 더 붙어있으니 원본텍스트 크기보다 offset이 더 커질 수 있음!!
        if (startOffset >= _text.length) {
            startOffset = _text.length - 1;
        }
        if (endOffset >= _text.length) {
            endOffset = _text.length - 1;
        }
        return {
            startOffset,
            endOffset,
        };
    }
    //updateText();
    return {
        name: name,
        wrapper,
        editor,
        mirror,
        updateText,
        update,
        scrollToDiff,
        // saveCaret,
        // restoreCaret,
        getVisibleAnchors,
        trackVisibleAnchors: trackIntersections,
        untrackVisibleAnchors: untrackIntersections,
        getFirstVisibleAnchor,
        scrollToLine,
        getFirstVisibleLineElement,
        getNearestAnchorToCaret,
        setEditMode,
        getTextSelectionRange,
        selectTextRange,
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
    };
}
//# sourceMappingURL=editor.js.map