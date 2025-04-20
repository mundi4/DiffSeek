"use strict";
function createEditor(container, editorName, callbacks) {
    const { onDiffVisibilityChanged, onTextChanged, onMirrorUpdated } = callbacks;
    const _lineElements = [];
    const _diffElements = [];
    const _anchorElements = [];
    const _lineHints = [];
    const _visibleAnchors = new Set();
    const _visibleDiffIndices = new Set();
    // 편집기 내에 약간의 html을 허용할지 말지.
    // 일단 금지. browser에서 계산하는 텍스트와 내가 만드는 텍스트를 완전히 일치시키기 힘들다. 한글자한글자 문자 인덱스까지 완전히 일치시켜야 됨...
    // 게다가 contenteditable 내에 브라우저가 뜸금없이 넣는 style(스타일 클래스가 지정된 텍스트를 지우고 바로 이어서 텍스트를 입력할 경우)이나 <br> 등등도 처리를 해줘야 하고
    // 여하튼 신경 쓸게 많음
    const _allowHTML = true;
    let _text = "";
    let _hasHTML = false;
    let _textProps = [];
    let _savedCaret = null;
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
    // 복붙한 스타일이 들어있는 부분을 수정할 때(정확히는 스타일이 입혀진 텍스트를 지우고 바로 입력할 때)
    // 브라우저가 친절하게도 비슷한 지워지기 전의 비슷한 스타일을 친히 넣어주신다!
    // 분에 넘치게 황공하오니 잽싸게 reject.
    const { observeEditor, unobserveEditor } = (() => {
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
                    mutation.target.removeAttribute("style");
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
        function trackIntersections() {
            for (const anchor of _anchorElements) {
                if (anchor)
                    intersectionObserver.observe(anchor);
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
        if (_hasHTML) {
            const [text, textProps] = flattenHTML(editor);
            _text = text;
            _textProps = textProps;
            if (textProps.length <= 1) {
                // 일단 현재로써는 1개의 textProps은 반드시 들어있다.
                _hasHTML = false;
            }
        }
        else {
            _text = editor.textContent || "";
            _textProps = [];
        }
        // if (_text.length === 0 || _text[_text.length - 1] !== "\n") {
        // }
        _text += "\n"; // 텍스트의 끝은 항상 \n으로 끝나야 인생이 편해진다.
        onTextChanged(_text);
    }
    editor.addEventListener("input", updateText);
    editor.addEventListener("paste", (e) => {
        if (!_allowHTML)
            return;
        const html = e.clipboardData?.getData("text/html");
        if (!html)
            return;
        e.preventDefault();
        _hasHTML = true;
        const cleanedHTML = sanitizeHTML(html);
        editor.contentEditable = "true";
        unobserveEditor();
        // deprecated된 함수... 자존심 상하지만 직접 html을 삽입하는 경우 undo/redo가 안됨.
        document.execCommand("insertHTML", false, cleanedHTML);
        observeEditor();
        editor.contentEditable = "plaintext-only";
        updateText();
    });
    // mirror.addEventListener("dragstart", (e) => {
    // 	console.log("dragstart", e);
    // 	const selection = window.getSelection();
    // 	if (!selection || selection.isCollapsed) {
    // 		return;
    // 	}
    // 	const range = selection.getRangeAt(0);
    // 	if (!mirror.contains(range.commonAncestorContainer)) {
    // 		return;
    // 	}
    // 	const startPos = getTextOffsetFromMirrorNodeAndOffset(range.startContainer, range.startOffset);
    // 	const endPos = getTextOffsetFromMirrorNodeAndOffset(range.endContainer, range.endOffset);
    // });
    function getTextOffsetFromMirrorNodeAndOffset(node, offset) {
        let lineEl = node;
        while (lineEl && lineEl.parentNode !== mirror) {
            lineEl = lineEl.parentNode;
        }
        if (!lineEl) {
            return NaN;
        }
        let pos = Number(lineEl.dataset.pos);
        let offsetInLine = getTextOffsetFromRoot(lineEl, node, offset);
        if (offsetInLine !== null) {
            return pos + offsetInLine;
        }
        else {
            return NaN;
        }
    }
    function getTextOffsetFromRoot(root, textNode, textNodeOffset) {
        let offset = 0;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if (walker.currentNode === textNode) {
                return offset + textNodeOffset;
            }
            // 텍스트노드의 nodeValue는 항상 null이 아닌 문자열임!!!
            offset += walker.currentNode.nodeValue.length;
        }
        return NaN;
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
        }
        else {
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
        return [lineEl, distance]; //null일 수도 있지만 의도적으로 느낌표 때려박음
    }
    function scrollToDiff(diffIndex) {
        const offsetTop = _diffElements[diffIndex][0].offsetTop - wrapper.clientTop;
        wrapper.scrollTop = offsetTop - SCROLL_MARGIN;
    }
    // 내가 머리가 나쁘다는 걸 확실하게 알게 해주는 함수
    function scrollToLine(lineNum, margin = 0) {
        const lineEl = _lineElements[lineNum - 1];
        if (lineEl) {
            const scrollTop = lineEl.offsetTop - margin;
            wrapper.scrollTop = scrollTop;
        }
    }
    const { update } = (() => {
        let _renderId = 0;
        let _cancelRenderId = null;
        function update({ diffs, anchors }) {
            const FORCE_RENDER_TIMEOUT = 500;
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
            console.debug("[%s] update(#%d) started", editorName, renderId);
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
            console.debug("update", editorName, { renderId, diffs, anchors });
            untrackIntersections();
            _lineElements.length = 0;
            _lineHints.length = 0;
            _diffElements.length = 0;
            _anchorElements.length = 0;
            // 여기서 일단 한번 yield 해줘야 idleDeadline을 받을 수 있음.
            let idleDeadline = yield;
            const textruns = getTextRuns(editorName, _text, _textProps, diffs, anchors);
            console.debug(editorName, "textruns", textruns);
            const text = _text;
            const view = mirror;
            let lineEl = null;
            let nextInlineNode = null;
            let currentDiffIndex = null;
            let currentTextProps = { pos: 0, color: null, supsub: null, flags: 0 };
            let lineNum;
            let lineIsEmpty = true;
            let numConsecutiveBlankLines = 0;
            let textPos;
            let currentContainer;
            let diffEl = null;
            const containerStack = [];
            function appendAnchor(pos, anchorIndex) {
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
                // push가 아닌 index로 삽입함!
                // textrun이 꼬이면 anchor가 스킵될 수도 있음.
                _anchorElements[anchorIndex] = anchorEl;
            }
            function appendChars(chars) {
                let el;
                const nodeName = "SPAN";
                if (!nextInlineNode || nextInlineNode.nodeName !== nodeName) {
                    el = document.createElement(nodeName);
                    currentContainer.insertBefore(el, nextInlineNode);
                }
                else {
                    el = nextInlineNode;
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
                // 현재 container에 남아있는 inline 노드들 제거(이전 업데이트 때 쓰였지만 지금은 안쓰이는 노드들)
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
                if (currentContainer !== lineEl) {
                    const ret = currentContainer;
                    nextInlineNode = currentContainer.nextSibling;
                    currentContainer = lineEl;
                    return ret;
                }
                return null;
            }
            textPos = 0;
            lineNum = 1;
            lineEl = view.firstElementChild;
            let textRunIndex = 0;
            // 줄단위로 필요한 부분만 업데이트 할 수 있게 줄에 해당하는 textrun들만 모아두지만
            // 필요한 부분만 업데이트 하는 코드는 그냥 다 지워버림. 신경쓸게 많고 얻는게 그리 많지 않다 => 지금도 이미 충분히 빠르다.
            let textrunBuffer = [];
            while (textRunIndex < textruns.length) {
                if (renderId !== _renderId) {
                    // 새로운 렌더 요청이 들어옴.
                    return;
                }
                // 삐~~ 타임오버.
                if (idleDeadline && idleDeadline.timeRemaining() <= 3) {
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
                let textrun;
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
                    }
                    else if (type === "ANCHOR") {
                        appendAnchor(textrun.pos, textrun.anchorIndex);
                    }
                    else if (type === "MODIFIER") {
                        // not implemented yet
                        currentTextProps = textrun.props;
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
                // 남은 container들 pop pop pop
                while (popContainer())
                    ;
                lineEl = lineEl.nextElementSibling;
                textPos = textrun.pos + textrun.len;
                if (lineIsEmpty) {
                    numConsecutiveBlankLines++;
                }
                else {
                    numConsecutiveBlankLines = 0;
                }
                _lineHints[lineNum - 1] = { pos: lineStartPos, len: textPos - lineStartPos, empty: false, numConsecutiveBlankLines };
                lineNum++;
                if (textrun.type === "LINEBREAK") {
                    //
                }
                else {
                    // 안해도 textrunIndex === textruns.length가 되서 while문이 끝나긴 하지만... 나를 못믿겠어.
                    break;
                }
            }
            // 남은 줄들은 모조리 제거
            while (lineEl) {
                const nextnext = lineEl.nextElementSibling;
                lineEl.remove();
                lineEl = nextnext;
            }
            trackIntersections();
            onMirrorUpdated();
        }
        return { update };
    })();
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
    function findLineIndexByPos(pos, low = 0, high = _lineHints.length - 1) {
        const lineHints = _lineHints;
        if (lineHints.length === 0)
            return -1;
        if (pos < 0)
            return -1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const hint = lineHints[mid];
            const start = hint.pos;
            const end = mid + 1 < lineHints.length ? lineHints[mid + 1].pos : Infinity;
            if (pos < start) {
                high = mid - 1;
            }
            else if (pos >= end) {
                low = mid + 1;
            }
            else {
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
    // selectTextRange, getTextSelectionRange 이 둘은 다음날 보면 다시 깜깜해진다.
    // 손대려면 정말 각 잡고 해야함.
    function selectTextRange(startOffset, endOffset) {
        startOffset = Math.max(0, Math.min(startOffset, _text.length));
        endOffset = Math.max(0, Math.min(endOffset, _text.length));
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
            console.log("startLineIndex", startLineIndex, "endLineIndex", endLineIndex);
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
            console.log("line pos:", pos);
            if (pos === endOffset) {
                range.setEndBefore(_lineElements[endLineIndex]);
                endSet = true;
            }
            else {
                while ((currentNode = walker.nextNode())) {
                    const nodeLen = currentNode.nodeValue.length;
                    console.log("pos + nodeLen", pos + nodeLen);
                    if (pos + nodeLen >= endOffset) {
                        range.setEnd(currentNode, endOffset - pos);
                        endSet = true;
                        break;
                    }
                    pos += nodeLen;
                }
            }
        }
        if (startSet && endSet) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        else {
            console.log("startSet", startSet, "endSet", endSet, "startOffset", startOffset, "endOffset", endOffset);
        }
    }
    function getFirstTextNode(node) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        return walker.nextNode();
    }
    function getTextSelectionRange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            return [null, null];
        }
        const range = selection.getRangeAt(0);
        if (!wrapper.contains(range.commonAncestorContainer)) {
            return [null, null];
        }
        let startOffset = Number.NaN;
        let endOffset = Number.NaN;
        let startNode = range.startContainer;
        let endNode = range.endContainer;
        let nodeStartOffset = range.startOffset;
        let nodeEndOffset = range.endOffset;
        if (startNode.nodeType !== 3) {
            startNode = getFirstTextNode(startNode.childNodes[nodeStartOffset]);
            nodeStartOffset = 0;
        }
        if (endNode.nodeType !== 3) {
            endNode = getFirstTextNode(endNode.childNodes[nodeEndOffset]);
            nodeEndOffset = 0;
        }
        if (!startNode || !endNode) {
            return [null, null];
        }
        if (_editMode) {
            // edit 모드에서 contenteditable은 그냥 textNode 집합임. textNode 하나가 한 줄일 수도 있고
            // 하나의 textNode에 여러줄이 들어가 있을 수도 있다. 고로 그냥 글자 수를 새어보는 수 밖에 없음.
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
            let currentNode;
            let pos = 0;
            while ((currentNode = walker.nextNode())) {
                if (currentNode === startNode) {
                    startOffset = pos + nodeStartOffset;
                }
                if (currentNode === endNode) {
                    endOffset = pos + nodeEndOffset;
                    break;
                }
                pos += currentNode.nodeValue.length;
            }
        }
        else {
            // aligned mode.
            // 이 경우 조금 최적화가 가능. 실제로 이게 얼마나 효율적인지는 테스트해 볼 필요가 있겠지만...
            // 몇 천 라인의 텍스트에 diff, anchor가 많은 경우 당연히 시작줄, 끝줄을 먼저 찾고 그 줄에 대해서만
            // offset을 계산하는 것이 더 빠르겠지!
            let startLineEl = startNode.parentElement?.closest("div[data-pos]");
            let endLineEl = endNode.parentElement?.closest("div[data-pos]");
            if (startLineEl && endLineEl) {
                let walker = document.createTreeWalker(startLineEl, NodeFilter.SHOW_TEXT, null);
                let pos = Number(startLineEl.dataset.pos);
                let currentNode;
                while ((currentNode = walker.nextNode())) {
                    if (currentNode === startNode) {
                        startOffset = pos + nodeStartOffset;
                        break;
                    }
                    pos += currentNode.nodeValue.length;
                }
                walker = document.createTreeWalker(endLineEl, NodeFilter.SHOW_TEXT, null);
                pos = Number(endLineEl.dataset.pos);
                while ((currentNode = walker.nextNode())) {
                    if (currentNode === endNode) {
                        endOffset = pos + nodeEndOffset;
                        break;
                    }
                    pos += currentNode.nodeValue.length;
                }
            }
            if (startOffset > _text.length - 1) {
                startOffset = _text.length - 1;
            }
            if (endOffset > _text.length - 1) {
                endOffset = _text.length - 1;
            }
        }
        if (isNaN(startOffset) || isNaN(endOffset)) {
            return [null, null];
        }
        if (startOffset > endOffset) {
            [startOffset, endOffset] = [endOffset, startOffset];
        }
        return [startOffset, endOffset];
    }
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
        },
    };
}
//# sourceMappingURL=editor.js.map