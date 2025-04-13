"use strict";
function createEditor(container, editorName, callbacks) {
    const { onDiffVisibilityChanged, onTextChanged, onMirrorUpdated } = callbacks;
    const _lineElements = [];
    const _diffElements = [];
    const _anchorElements = [];
    const _visibleAnchors = new Set();
    const _visibleDiffIndices = new Set();
    let _text = "";
    let _textProps = [];
    let _savedCaret = null;
    let _observingAnchors = false;
    let _editMode = false;
    let _textruns = []; // 변경된 부분만 업데이트 가능하게?
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
    function updateText() {
        _text = editor.textContent || "";
        ///// 약간의 html을 포함해서 style="color:..."와 sup, sub 태그를 가져오려는 게 목적인데
        ///// contentEditable에 html을 넣으면 브라우저가 종종 스타일과 태그를 살짝 바꿔버린다
        ///// 예를 들어 <sup>주)</sup>가 있을때 이 부분을 삭제하는 경우 브라우저는 무슨 심보인지 font-size를 style를 추가해버린다(커서가 해당 부분을 빠져나오면 추가 안됨)
        ///// mutationObserver로 style attr이 붙는 경우 도로 삭제해버리면 되지만 mutationObserver는 이제 보기만 해도 짜증난다.
        // const [_, text, props] = flattenHTML(editor.innerHTML);
        // _text = text;
        // _textProps = props;
        if (_text.length === 0 || _text[_text.length - 1] !== "\n") {
            _text += "\n"; // 텍스트의 끝은 항상 \n으로 끝나야 인생이 편해진다.
        }
        onTextChanged(_text);
    }
    editor.addEventListener("input", updateText);
    // editor.addEventListener("paste", (e) => {
    // 	const html = e.clipboardData?.getData("text/html");
    // 	// const plain = e.clipboardData?.getData("text/plain");
    // 	if (!html) return; // html 복붙이 아닌 경우는 무시
    // 	const now = performance.now();
    // 	// (e.target as HTMLElement).contentEditable = "true";
    // 	e.clipboardData?.setData("text/html", "hello");
    // 	e.preventDefault(); // 브라우저 붙여넣기는 막고...
    // 	const [cleanedHTML, text, textProps] = flattenHTML(html);
    // 	_text = text;
    // 	_textProps = textProps;
    // 	// 현재 커서 위치에 삽입
    // 	insertHTMLAtCursor(cleanedHTML);
    // 	// console.log("paste", performance.now() - now, cleanedHTML);
    // 	// (e.target as HTMLElement).contentEditable = "plaintext-only";
    // 	updateText();
    // });
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
    // generator함수 사용. 왜? 그냥 써보려고!!
    let _renderId = 0;
    let _cancelRenderId = null;
    function update({ diffs, anchors }) {
        if (_cancelRenderId) {
            cancelIdleCallback(_cancelRenderId);
            _cancelRenderId = null;
        }
        if (_renderId === Number.MAX_SAFE_INTEGER) {
            // 그런일은... 절대로... 없을거라...
            _renderId = 0;
        }
        const startTime = performance.now();
        const renderId = ++_renderId;
        const generator = updateGenerator({ renderId, diffs, anchors });
        // 일단 start!
        generator.next();
        const step = (idleDeadline) => {
            _cancelRenderId = null;
            const { done } = generator.next(idleDeadline);
            if (!done) {
                if (renderId === _renderId) {
                    _cancelRenderId = requestIdleCallback(step, { timeout: FORCE_RENDER_TIMEOUT });
                }
            }
            else {
                console.debug("[%s] update(#%d) took %d ms", editorName, renderId, performance.now() - startTime);
            }
        };
        _cancelRenderId = requestIdleCallback(step, { timeout: FORCE_RENDER_TIMEOUT });
    }
    function* updateGenerator({ renderId, diffs, anchors }) {
        if (!diffs) {
            return;
        }
        // const startTime = performance.now();
        // console.debug("update");
        untrackIntersections();
        _lineElements.length = 0;
        _diffElements.length = 0;
        _anchorElements.length = 0; // anchors.length; 혹시 모르니 그냥 0으로 초기화 해서 기존 요소들을 지워버리는게 속편함.
        // 여기서 일단 한번 yield 해줘야 idleDeadline을 받을 수 있음.
        let idleDeadline = yield;
        const textruns = getTextRuns(editorName, _text, _textProps, diffs, anchors);
        const text = _text;
        const view = mirror;
        let lineEl = null;
        let nextInlineNode = null;
        let currentDiffIndex = null;
        let lineNum;
        let textPos;
        let textProps = { pos: 0, color: null, supsub: null };
        let currentContainer;
        const containerStack = [];
        function appendAnchor(pos, anchorIndex) {
            // 앵커는 diff 범위 안에 오지 않는다. 왜냐.. 내가 그렇게 만들었음!
            // diff 범위 안 anchor를 허용하면 코드가 복잡해짐. diff를 닫고 lineEl이 currentContainer가 될때까지 pop한 후
            // anchor 넣고 다시 이전 container를 새로 만들어줘야함.
            console.assert(currentContainer === lineEl, "currentContainer should be lineEl when appending anchor");
            const anchor = anchors[anchorIndex];
            let anchorEl;
            if (nextInlineNode === null || nextInlineNode.nodeName !== ANCHOR_TAG) {
                anchorEl = document.createElement(ANCHOR_TAG);
                anchorEl.contentEditable = "false"; // 만약에 mirror를 contentEditable로 만들경우에...
                currentContainer.insertBefore(anchorEl, nextInlineNode);
            }
            else {
                anchorEl = nextInlineNode;
                nextInlineNode = anchorEl.nextSibling;
            }
            anchorEl.id = `${editorName}Anchor${anchorIndex}`;
            anchorEl.dataset.type = anchor.type;
            anchorEl.dataset.anchor = anchorIndex.toString();
            anchorEl.dataset.pos = pos.toString();
            if (anchor.diffIndex !== null) {
                anchorEl.dataset.diff = anchor.diffIndex.toString();
            }
            else {
                delete anchorEl.dataset.diff;
            }
            _anchorElements[anchorIndex] = anchorEl;
        }
        function appendChars(chars) {
            let el;
            const nodeName = textProps.supsub ?? "SPAN";
            if (!nextInlineNode || nextInlineNode.nodeName !== nodeName) {
                el = document.createElement(nodeName);
                currentContainer.insertBefore(el, nextInlineNode);
            }
            else {
                el = nextInlineNode;
                nextInlineNode = el.nextSibling;
            }
            el.textContent = chars;
            el.className = textProps.color || "";
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
        let diffEl = null;
        function openDiff(diffIndex) {
            if (nextInlineNode === null || nextInlineNode.nodeName !== DIFF_ELEMENT_NAME) {
                diffEl = document.createElement(DIFF_ELEMENT_NAME);
                const parent = currentContainer ?? lineEl;
                parent.insertBefore(diffEl, nextInlineNode);
                currentContainer = diffEl;
            }
            else {
                diffEl = currentContainer = nextInlineNode;
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
                nextInlineNode = currentContainer.nextSibling;
                currentContainer = containerStack.pop();
                return currentContainer;
            }
            else {
                if (currentContainer !== lineEl) {
                    const ret = currentContainer;
                    nextInlineNode = currentContainer.nextSibling;
                    currentContainer = lineEl;
                    return ret;
                }
            }
            return null;
        }
        textPos = 0;
        lineNum = 1;
        lineEl = view.firstElementChild;
        let textRunIndex = 0;
        let textrunBuffer = [];
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
            let textrun;
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
                    }
                    else if (type === "ANCHOR") {
                        appendAnchor(textrun.pos, textrun.anchorIndex);
                    }
                    else if (type === "MODIFIER") {
                        // not implemented yet
                    }
                    else if (type === "DIFF") {
                        currentDiffIndex = textrun.diffIndex;
                        openDiff(currentDiffIndex);
                    }
                    else if (type === "DIFF_END") {
                        closeDiff();
                        currentDiffIndex = null;
                    }
                }
                while (popContainer())
                    ;
            }
            else {
                textrun = textrunBuffer[textrunBuffer.length - 1];
            }
            lineEl = lineEl.nextElementSibling;
            lineNum++;
            textPos = textrun.pos + textrun.len;
            if (textrun.type === "LINEBREAK") {
            }
            else {
                // 안해도 textrunIndex === textruns.length가 되서 while문이 끝나긴 하지만... 나를 못믿겠어.
                break;
            }
        }
        while (lineEl) {
            const nextnext = lineEl.nextElementSibling;
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
                if (anchor)
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
    // selectTextRange, getTextSelectionRange 이 둘은 다음날 보면 다시 깜깜해진다.
    // 손대려면 정말 각 잡고 해야함.
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
            return [null, null];
        }
        const range = selection.getRangeAt(0);
        if (!wrapper.contains(range.commonAncestorContainer)) {
            return [null, null];
        }
        let startOffset = Number.NaN;
        let endOffset = Number.NaN;
        if (_editMode) {
            // 딱히 방법이 없다.
            // 내부가 하나의 큰 textNode일 수도 있고 여러개의 textNode일 수도 있다.(붙여넣기 한 경우 하나의 통 textNode가 들어감)
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
            // 몇 천 라인의 텍스트에 diff, anchor가 많은 경우 당연히 시작줄, 끝줄을 먼저 찾고 그 줄에 대해서만
            // offset을 계산하는 것이 더 빠르겠지!
            // 주의: startContainer, endContainer가 text노드가 아닐 수도 있음.
            let startLineEl = range.startContainer; //사실 텍스트노드일 수도 있음.
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
        trackVisibleAnchors: trackIntersections,
        untrackVisibleAnchors: untrackIntersections,
        getFirstVisibleAnchor,
        scrollToLine,
        getFirstVisibleLineElement,
        getClosestAnchorToCaret: getClosestAnchorToCaret,
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