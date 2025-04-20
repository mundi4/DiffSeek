"use strict";
// 이것저것 이어붙이는 코드 집합
const DiffSeek = (function () {
    let _alignedMode = false;
    let _alignedDirty = false;
    let _activeEditor = null;
    let _lastFocusedEditor = null;
    let _lastScrolledEditor = null;
    let _currentlyScrollingEditor = null;
    let _preventScrollSync = false;
    let _currentDiffIndex = -1;
    let _syncEditor = false;
    let _resetCurrentlyScrollingEditorId = null;
    // let _diffResult: DiffResponse | null = null;
    let _diffContext = { done: false, reqId: 0 };
    // devtools 콘솔에서 설정 값을 바꿨을때 바로 업데이트 시키기 위해...
    const _diffOptions = (function (defaultValues) {
        let _diffOptions = { ...defaultValues };
        function setValue(key, value) {
            if (_diffOptions[key] !== value) {
                _diffOptions[key] = value;
                computeDiff();
            }
        }
        return {
            get algorithm() {
                return _diffOptions.algorithm;
            },
            set algorithm(value) {
                if (value !== "histogram" && value !== "myers" && value !== "lcs") {
                    throw new Error("Invalid algorithm: " + value);
                }
                setValue("algorithm", value);
            },
            get tokenization() {
                return _diffOptions.tokenization;
            },
            set tokenization(value) {
                if (value !== "char" && value !== "word" && value !== "line") {
                    throw new Error("Invalid tokenization: " + value);
                }
                setValue("tokenization", value);
            },
            get whitespace() {
                return _diffOptions.whitespace;
            },
            set whitespace(value) {
                if (value !== "ignore" && value !== "normalize") {
                    throw new Error("Invalid whitespace handling: " + value);
                }
                setValue("whitespace", value);
            },
            get greedyMatch() {
                return !!_diffOptions.greedyMatch;
            },
            set greedyMatch(value) {
                if (value !== true && value !== false) {
                    throw new Error("Invalid greedyMatch: " + value);
                }
                setValue("greedyMatch", !!value);
            },
            get useLengthBias() {
                return !!_diffOptions.useLengthBias;
            },
            set useLengthBias(value) {
                if (value !== true && value !== false) {
                    throw new Error("Invalid useLengthBias: " + value);
                }
                setValue("useLengthBias", !!value);
            },
            get maxGram() {
                return _diffOptions.maxGram;
            },
            set maxGram(value) {
                if (value < 1) {
                    throw new Error("Invalid maxGram: " + value);
                }
                setValue("maxGram", value);
            },
            get lengthBiasFactor() {
                return _diffOptions.lengthBiasFactor;
            },
            set lengthBiasFactor(value) {
                if (value <= 0) {
                    throw new Error("Invalid lengthBiasFactor: " + value);
                }
                setValue("lengthBiasFactor", value);
            },
            get sectionHeadingMultiplier() {
                return _diffOptions.sectionHeadingMultiplier;
            },
            set sectionHeadingMultiplier(value) {
                if (value <= 0) {
                    throw new Error("Invalid sectionHeadingMultiplier: " + value);
                }
                setValue("sectionHeadingMultiplier", value);
            },
            get lineStartMultiplier() {
                return _diffOptions.lineStartMultiplier;
            },
            set lineStartMultiplier(value) {
                if (value <= 0) {
                    throw new Error("Invalid lineStartMultiplier: " + value);
                }
                setValue("lineStartMultiplier", value);
            },
            get lineEndMultiplier() {
                return _diffOptions.lineEndMultiplier;
            },
            set lineEndMultiplier(value) {
                if (value <= 0) {
                    throw new Error("Invalid lineEndMultiplier: " + value);
                }
                setValue("lineEndMultiplier", value);
            },
            get uniqueMultiplier() {
                return _diffOptions.uniqueMultiplier;
            },
            set uniqueMultiplier(value) {
                if (value <= 0) {
                    throw new Error("Invalid uniqueMultiplier: " + value);
                }
                setValue("uniqueMultiplier", value);
            },
        };
    })({
        algorithm: "histogram",
        tokenization: "word",
        whitespace: "ignore",
        greedyMatch: false,
        useLengthBias: true,
        maxGram: 5,
        lengthBiasFactor: 0.7,
        sectionHeadingMultiplier: 1 / 0.75,
        lineStartMultiplier: 1 / 0.85,
        lineEndMultiplier: 1 / 0.9,
        uniqueMultiplier: 1 / 0.6667,
    });
    const useEditableMirror = false;
    const container = document.getElementById("main");
    const leftEditor = createEditor(container, "left", getEditorCallbacks("left"));
    const rightEditor = createEditor(container, "right", getEditorCallbacks("right"));
    leftEditor.wrapper.tabIndex = 100;
    rightEditor.wrapper.tabIndex = 101;
    // 지저분의 끝
    const statusBar = InitializeStatusBar([
        {
            side: "center",
            key: "mode",
            label: "",
            get: () => (_alignedMode ? "📖" : "✏️"),
            toggle: () => {
                if (_alignedMode) {
                    disableAlignedMode();
                }
                else {
                    enableAlignedMode();
                }
            },
        },
        {
            side: "left",
            key: "tokenization",
            label: "단위",
            get: () => _diffOptions.tokenization,
            set: (value) => (_diffOptions.tokenization = value),
            options: [
                { label: "글자", value: "char" },
                { label: "단어", value: "word" },
                { label: "줄", value: "line" },
            ],
        },
        {
            side: "left",
            key: "algorithm",
            label: "알고리즘",
            get: () => _diffOptions.algorithm,
            set: (value) => (_diffOptions.algorithm = value),
            options: [
                { label: "Histogram", value: "histogram" },
                { label: "⚠️ Myers ❌", value: "myers" },
                { label: "LCS DP", value: "lcs" },
            ],
        },
        {
            side: "left",
            key: "whitespace",
            label: "공백",
            get: () => _diffOptions.whitespace,
            set: (value) => (_diffOptions.whitespace = value),
            visible: () => _diffOptions.algorithm === "histogram" && _diffOptions.tokenization === "word",
            options: [
                { label: "정규화", value: "normalize" },
                { label: "무시", value: "ignore" },
            ],
        },
        // {
        // 	side: "right",
        // 	key: "greedyMatch",
        // 	label: "Greedy Match",
        // 	get: () => _diffOptions.greedyMatch,
        // 	set: (value: boolean) => (_diffOptions.greedyMatch = value),
        // 	disabled: () => _diffOptions.algorithm === "lcs",
        // 	options: [false, true].map((v) => ({ label: v ? "On" : "Off", value: v })),
        // },
        // {
        // 	side: "right",
        // 	key: "useLengthBias",
        // 	label: "Length Bias",
        // 	get: () => _diffOptions.useLengthBias,
        // 	set: (value: boolean) => (_diffOptions.useLengthBias = value),
        // 	disabled: () => _diffOptions.algorithm === "histogram",
        // 	options: [false, true].map((v) => ({ label: v ? "On" : "Off", value: v })),
        // },
        // {
        // 	side: "right",
        // 	key: "maxGram",
        // 	label: "Max Gram",
        // 	get: () => _diffOptions.maxGram,
        // 	set: (value: number) => (_diffOptions.maxGram = value),
        // 	disabled: () => _diffOptions.algorithm === "histogram",
        // 	options: [1, 2, 3, 4, 5, 6, 7].reverse().map((v) => ({ label: v.toString(), value: v })),
        // },
        {
            side: "right",
            key: "diffs",
            label: "≠",
            get: () => {
                if (!_diffContext.done) {
                    return "...";
                }
                return `${_diffContext.diffs.length}`;
            },
        },
        // {
        // 	side: "right",
        // 	key: "tokenCount",
        // 	label: "#",
        // 	get: () => {
        // 		if (_diffResult === null) {
        // 			return "...";
        // 		}
        // 		return `${_diffResult.leftTokenCount} / ${_diffResult.rightTokenCount}`;
        // 	},
        // },
        {
            side: "right",
            key: "processTime",
            label: "⏱",
            get: () => {
                if (!_diffContext.done) {
                    return "...";
                }
                return `${Math.ceil(_diffContext.processTime)}ms`;
            },
        },
    ]);
    const body = document.querySelector("body");
    const diffList = document.getElementById("diffList");
    const highlightStyle = document.getElementById("highlightStyle");
    const progress = document.getElementById("progress");
    const scrollSyncIndicator = document.getElementById("scrollSyncIndicator");
    // aligned mode용 style 컨테이너. 필요한 경우 한번에 기존의 모든 스타일을 날려버리기 위해 요소마다 style값을 직접 지정하지 않고
    // .alinged #rightAnchor32 { height: 200px; } 이런식으로 스타일 추가함.
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
        // 보안 상 new Worker("worker.js")는 실행 안됨.
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
        function* computeDiffGenerator(ctx) {
            let idleDeadline = yield ctx;
            ctx.leftTokens = tokenize(ctx.leftText, _diffOptions.tokenization);
            if (idleDeadline.timeRemaining() < 1) {
                idleDeadline = yield;
            }
            ctx.rightTokens = tokenize(ctx.rightText, _diffOptions.tokenization);
            if (idleDeadline.timeRemaining() < 1) {
                idleDeadline = yield;
            }
            const request = {
                type: "diff",
                reqId: ctx.reqId,
                options: ctx.diffOptions,
                leftTokens: ctx.leftTokens,
                rightTokens: ctx.rightTokens,
            };
            console.log("postingMessage", request);
            worker.postMessage(request);
            updateButtons();
        }
        function computeDiff() {
            if (computeDiffTimeoutId) {
                cancelIdleCallback(computeDiffTimeoutId);
                //clearTimeout(computeDiffTimeoutId);
            }
            _currentDiffIndex = -1;
            _alignedDirty = true;
            const leftText = leftEditor.text;
            const rightText = rightEditor.text;
            body.classList.add("computing");
            progress.textContent = "...";
            body.classList.toggle("identical", leftText === rightText);
            const ctx = (_diffContext = {
                reqId: ++reqId, //overflow 되는 순간 지구 멸망
                leftText: leftText,
                rightText: rightText,
                diffOptions: { ..._diffOptions },
                done: false,
            });
            const generator = computeDiffGenerator(ctx);
            const step = (idleDeadline) => {
                computeDiffTimeoutId = null;
                const { done } = generator.next(idleDeadline);
                if (!done && ctx === _diffContext) {
                    computeDiffTimeoutId = requestIdleCallback(step, { timeout: 200 });
                }
            };
            computeDiffTimeoutId = requestIdleCallback(step);
        }
        worker.onmessage = function (e) {
            console.log("worker message", e);
            const data = e.data;
            if (data.type === "diff") {
                if (data.reqId === reqId) {
                    console.debug("diff response:", data);
                    document.querySelector("body").classList.remove("computing");
                    _diffContext.rawDiffs = data.diffs;
                    postProcess(_diffContext);
                    _diffContext.done = true;
                    onDiffComputed(_diffContext);
                }
            }
            else if (data.type === "start") {
                progress.textContent = PROCESSING_MESSAGES[Math.floor(Math.random() * PROCESSING_MESSAGES.length)];
            }
        };
        function onDiffComputed(diffContext) {
            leftEditor.update({ diffs: diffContext.diffs, anchors: diffContext.anchors });
            rightEditor.update({ diffs: diffContext.diffs, anchors: diffContext.anchors });
            updateDiffList();
            updateButtons();
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
            const currentEditor = _activeEditor || _lastFocusedEditor || rightEditor;
            const [firstVisibleLineEl, firstVisibleLineDistance] = currentEditor.getFirstVisibleLineElement();
            _alignedMode = true;
            leftEditor.mirror.tabIndex = 100;
            rightEditor.mirror.tabIndex = 101;
            if (useEditableMirror) {
                leftEditor.mirror.contentEditable = "plaintext-only";
                rightEditor.mirror.contentEditable = "plaintext-only";
            }
            leftEditor.setEditMode(false);
            rightEditor.setEditMode(false);
            body.classList.toggle("aligned", true);
            body.classList.toggle("edit", false);
            recalculateAlignmentPaddingAndPositions();
            if (currentSelectionRange) {
                restoreSelectionRange(currentSelectionRange);
            }
            updateButtons();
            requestAnimationFrame(() => {
                // 레이아웃이 끝난 후 미리 찾아뒀던 줄 위치로 스크롤.
                let lineNum = Number(firstVisibleLineEl?.dataset?.lineNum) || 1;
                let distance = firstVisibleLineDistance || 0;
                currentEditor.scrollToLine(lineNum, distance);
                const theOtherEditor = currentEditor === leftEditor ? rightEditor : leftEditor;
                theOtherEditor.wrapper.scrollTop = currentEditor.wrapper.scrollTop;
                // 포커스를 가져야 aligned mode 진입 후 바로 키보드로 스크롤 할 수 있음.
                // 스크롤이 동기화되니 사실 어느쪽이 포커스를 가지든 상관 무.
                currentEditor.mirror.focus();
            });
        }
    }
    function disableAlignedMode() {
        const currentSelectionRange = getSelectionRange();
        // 일단 editmode로 가기 전에 현재 화면 상 첫줄을 보존
        const [leftFirstLine, leftFirstLineDistance] = leftEditor.getFirstVisibleLineElement();
        const [rightFirstLine, rightFirstLineDistance] = rightEditor.getFirstVisibleLineElement();
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
            requestAnimationFrame(() => {
                _preventScrollSync = false;
            });
        });
        if (currentSelectionRange) {
            restoreSelectionRange(currentSelectionRange);
        }
    }
    function recalculateAlignmentPaddingAndPositions() {
        if (!_alignedDirty) {
            return;
        }
        if (!_diffContext.done) {
            return;
        }
        const anchors = _diffContext.anchors, lhsTokens = _diffContext.leftTokens, rhsTokens = _diffContext.rightTokens, lhsLines = leftEditor.lineElements, rhsLines = rightEditor.lineElements, lhsLineHints = leftEditor.lineHints, rhsLineHints = rightEditor.lineHints;
        // 얘네들은 알아서 스스로 쑥쑥 자라게 auto로
        leftEditor.mirror.style.height = "auto";
        rightEditor.mirror.style.height = "auto";
        // 기존 스타일 한번에 날려버리기
        alignmentStyleElement.textContent = "";
        const leftAnchorEls = leftEditor.anchorElements, rightAnchorEls = rightEditor.anchorElements;
        // leftTops: number[] = new Array<number>(anchors.length),
        // rightTops: number[] = new Array<number>(anchors.length),
        // leftHeights: number[] = new Array<number>(anchors.length),
        // rightHeights: number[] = new Array<number>(anchors.length);
        // for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
        // 	leftTops[anchorIndex] = leftAnchorEls[anchorIndex]?.offsetTop;
        // 	rightTops[anchorIndex] = rightAnchorEls[anchorIndex]?.offsetTop;
        // 	if (anchors[anchorIndex].type === "after") {
        // 		leftHeights[anchorIndex] = leftAnchorEls[anchorIndex]?.offsetHeight;
        // 		rightHeights[anchorIndex] = rightAnchorEls[anchorIndex]?.offsetHeight;
        // 	}
        // }
        let styleText = "";
        let leftDelta = 0, rightDelta = 0;
        for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
            const anchor = anchors[anchorIndex];
            const leftAnchorEl = leftAnchorEls[anchorIndex], rightAnchorEl = rightAnchorEls[anchorIndex];
            if (!leftAnchorEl || !rightAnchorEl) {
                continue;
            }
            const leftTop = leftAnchorEl.offsetTop, rightTop = rightAnchorEl.offsetTop;
            const leftY = leftTop + leftDelta, rightY = rightTop + rightDelta;
            let delta;
            if (anchor.type === "before") {
                delta = leftY - rightY;
                if (delta > LINE_HEIGHT) {
                    const anchorLineIndex = findIndexByPos(lhsLineHints, anchor.left);
                    if (anchorLineIndex > 0) {
                        const lastBlankLineIndex = anchorLineIndex - 1;
                        const hint = lhsLineHints[lastBlankLineIndex];
                        const collapseLimit = hint.numConsecutiveBlankLines - 1; // 마지막 한 줄은 남긴다
                        let collapsedLines = 0;
                        while (collapsedLines < collapseLimit) {
                            const lineIndex = lastBlankLineIndex - collapsedLines;
                            const lineEl = lhsLines[lineIndex];
                            const lineHeight = lineEl.offsetHeight;
                            if (lineHeight > delta)
                                break;
                            delta -= lineHeight;
                            rightDelta += lineHeight;
                            collapsedLines++;
                            const lineNum = lineIndex + 1;
                            styleText += `.aligned #leftMirror div[data-line-num="${lineNum}"] { display:none; }\n`;
                        }
                    }
                }
            }
            else if (anchor.type === "after") {
                const leftHeight = leftAnchorEl.offsetHeight, rightHeight = rightAnchorEl.offsetHeight;
                const leftB = leftY + leftHeight, rightB = rightY + rightHeight;
                delta = leftB - rightB;
            }
            else {
                console.warn("unknown anchor type", anchor.type);
                continue;
            }
            if (delta > 0) {
                styleText += `.aligned #rightAnchor${anchorIndex} { display:block; height:${delta}px; }\n`;
                rightDelta += delta;
            }
            else {
                styleText += `.aligned #leftAnchor${anchorIndex} { display:block; height:${-delta}px; }\n`;
                leftDelta += -delta;
            }
        }
        alignmentStyleElement.textContent = styleText;
        _alignedDirty = false;
        requestAnimationFrame(() => {
            // 레이아웃이 끝난 후 mirror 높이 조정
            const height = Math.max(leftEditor.mirror.offsetHeight, rightEditor.mirror.offsetHeight);
            leftEditor.mirror.style.height = `${height}px`;
            rightEditor.mirror.style.height = `${height}px`;
        });
    }
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
            sourceEditor = _currentlyScrollingEditor || _activeEditor || _lastFocusedEditor;
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
        if (_syncEditor && !_alignedMode) {
            scrollSyncIndicator.style.display = "block";
        }
        else {
            scrollSyncIndicator.style.display = "none";
        }
        statusBar.update();
    }
    function updateDiffList() {
        if (!_diffContext.done) {
            return;
        }
        const diffs = _diffContext.diffs;
        const leftWholeText = leftEditor.text;
        const rightWholeText = rightEditor.text;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < diffs.length; i++) {
            const diff = diffs[i];
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
        if (e.key === "F2") {
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
        // 기본적으로 브라우저의 첫번째 탭, 두번째 탭을 선택하는 단축키인데...
        // 브라우저에서 기본적으로 사용되는 단축키를 덮어쓰는 건 정말 못된 짓이긴 한데...
        // 사용자의 의도를 무시해버릴 수 있는 아주 나쁜 단축키지만... 인터넷도 안되는 컴에서 누가 엣지에 탭을 여러개 열어놓고 쓸까 싶다.
        if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
            e.preventDefault();
            if (_alignedMode) {
                disableAlignedMode();
            }
            const editor = e.key === "1" ? leftEditor : rightEditor;
            editor.editor.focus();
            return;
        }
        // mirror로 이벤트핸들러 옮김. 테스트 해봐야함함
        // if ((_alignedMode && !e.ctrlKey && e.key.length === 1) || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
        // 	disableAlignedMode();
        // 	return;
        // }
        // diff cycling
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            if (_diffContext.done) {
                const diffs = _diffContext.diffs;
                if (!diffs || diffs.length === 0) {
                    return;
                }
                _currentDiffIndex += e.key === "ArrowUp" ? -1 : 1;
                if (_currentDiffIndex < 0) {
                    _currentDiffIndex = diffs.length - 1;
                }
                if (_currentDiffIndex >= diffs.length) {
                    _currentDiffIndex = 0;
                }
                scrollToDiff(_currentDiffIndex);
                highlightDiff(_currentDiffIndex);
            }
        }
    });
    diffList.addEventListener("click", (e) => {
        const diffIndex = Number(e.target.dataset.diff);
        if (!isNaN(diffIndex)) {
            _currentDiffIndex = diffIndex;
            scrollToDiff(diffIndex);
        }
    });
    function scrollToDiff(diffIndex) {
        _preventScrollSync = true;
        leftEditor.scrollToDiff(diffIndex);
        rightEditor.scrollToDiff(diffIndex);
        requestAnimationFrame(() => {
            _preventScrollSync = false;
        });
    }
    for (const editor of [leftEditor, rightEditor]) {
        editor.wrapper.addEventListener("scroll", (e) => {
            if (_currentlyScrollingEditor !== null || _preventScrollSync) {
                return;
            }
            _lastScrolledEditor = _currentlyScrollingEditor = editor;
            if (_alignedMode) {
                // aligned mode일 때는 양쪽 에디터의 높이가 같게 유지되니 둘 다 overflow:visible로 해두고
                // 부모에서 스크롤하면 둘 다 스크롤이 되지만(딜레이 전혀 없이 완전 자연스럽게!) 그렇게 만들면 스크롤바가 하나만 보이는게 생각보다 어색하고 불편하다.
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
                // 에디터에서 편집 중 반대쪽 에디터의 스크롤 위치를 현재 에디터의 내용에 맞추...려고 시도만 해 봄.
                syncScrollPosition(editor);
                return;
            }
            if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                // 이정도 스크롤은 기본적으로 되어되는거 아니야?? 이 기능 나만 쓰나?
                // 스크롤 영역 밖의 딱 한두줄! 딱 그정도만 보면 된다 싶을 때?
                // 텍스트커서가 중앙 부분에 위치하지 않으면 마음이 놓이지 않아서 지금 당장 위아래로 조금 스크롤 해야만 할 때!!!!
                const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2;
                editor.wrapper.scrollTop += delta;
                e.preventDefault();
            }
        });
        editor.mirror.addEventListener("paste", (e) => {
            disableAlignedMode();
        });
        editor.mirror.addEventListener("cut", (e) => {
            disableAlignedMode();
        });
        editor.mirror.addEventListener("keydown", (e) => {
            // aligned 모드에서 간단한 편집을 시도할 때 잽싸게 aligned 모드에서 나가기!
            // aligned 모드에서 나갈때 mirror에서 선택되어있던 텍스트 영역이 contenteditable 내에서 복원이 되므로
            // 그 이후는 복원된 텍스트 영역을 브라우저가 key에 맞게 처리해줌. 조금 얍삽?
            if ((!e.ctrlKey && e.key.length === 1) || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
                disableAlignedMode();
                return;
            }
            // mirror에서 전체 텍스트 선택 시에 창 전체의 텍스트가 아닌 현재 에디터의 텍스트만 선택되도록.
            if (e.ctrlKey && (e.key === "A" || e.key === "a")) {
                e.preventDefault();
                editor.selectTextRange(0, editor.text.length);
                return;
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
        }
    }
    //type PostProcessResult = ReturnType<typeof postProcess>;
    function postProcess(diffContext) {
        let prevEntry = null;
        const leftText = diffContext.leftText;
        const rightText = diffContext.rightText;
        const leftTokens = diffContext.leftTokens;
        const rightTokens = diffContext.rightTokens;
        const rawEntries = diffContext.rawDiffs;
        const diffs = [];
        const anchors = [];
        const MAX_ANCHOR_SKIP = 5;
        let anchorSkipCount = 0;
        for (let i = 0; i < rawEntries.length; i++) {
            const entry = rawEntries[i];
            if (entry.type) {
                if (prevEntry) {
                    console.assert(prevEntry.left.pos + prevEntry.left.len === entry.left.pos, prevEntry, entry);
                    console.assert(prevEntry.right.pos + prevEntry.right.len === entry.right.pos, prevEntry, entry);
                    prevEntry.type |= entry.type;
                    prevEntry.left.len += entry.left.len;
                    prevEntry.right.len += entry.right.len;
                }
                else {
                    prevEntry = { left: { ...entry.left }, right: { ...entry.right }, type: entry.type };
                    //prevEntry = entry;
                }
            }
            else {
                if (prevEntry) {
                    addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
                    // mappings.push(prevEntry);
                }
                prevEntry = null;
                const leftToken = leftTokens[entry.left.pos];
                const rightToken = rightTokens[entry.right.pos];
                if (leftToken.flags & rightToken.flags & FIRST_OF_LINE) {
                    // 앵커 추가
                    addAnchor("before", leftToken.pos, leftToken.lineNum, rightToken.pos, rightToken.lineNum, null);
                }
                // mappings.push(entry);
            }
        }
        addAnchor("before", leftText.length, -1, rightText.length, -1, null);
        if (prevEntry) {
            addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
            // mappings.push(prevEntry);
        }
        function addAnchor(type, leftPos, leftLine, rightPos, rightLine, diffIndex) {
            if (leftPos === undefined || rightPos === undefined) {
                console.error("addAnchor", { type, leftPos, rightPos, diffIndex });
            }
            // 앵커가 너무 많아지는 걸 방지!
            if (diffIndex === null && anchorSkipCount < MAX_ANCHOR_SKIP && anchors.length > 0) {
                const lastAnchor = anchors[anchors.length - 1];
                if (lastAnchor.type === type && lastAnchor.diffIndex === null && leftLine - lastAnchor.leftLine <= 1 && rightLine - lastAnchor.rightLine <= 1) {
                    anchorSkipCount++;
                    return;
                }
            }
            anchorSkipCount = 0;
            if (type === "before") {
                // before 앵커는 항상 줄의 시작위치일 때만 추가하므로 줄바꿈 문자만 확인하면 된다!
                while (leftPos > 0 && leftText[leftPos - 1] !== "\n") {
                    leftPos--;
                }
                while (rightPos > 0 && rightText[rightPos - 1] !== "\n") {
                    rightPos--;
                }
            }
            else if (type === "after") {
                // empty diff의 after앵커는 이후에 다른 토큰이 존재할 수 있음.
                // 공백이 아닌 문자가 나오면 멈추고 기본 위치 사용.
                let p;
                p = leftPos;
                while (p < leftText.length) {
                    const ch = leftText[p++];
                    if (ch === "\n") {
                        leftPos = p - 1;
                        break;
                    }
                    else if (!SPACE_CHARS[ch]) {
                        break;
                    }
                }
                p = rightPos;
                while (p < rightText.length) {
                    const ch = rightText[p++];
                    if (ch === "\n") {
                        rightPos = p - 1;
                        break;
                    }
                    else if (!SPACE_CHARS[ch]) {
                        break;
                    }
                }
            }
            if (anchors.length > 0) {
                let lastAnchor = anchors[anchors.length - 1];
                if (lastAnchor.left > leftPos || lastAnchor.right > rightPos) {
                    return;
                }
                if (lastAnchor.left === leftPos || lastAnchor.right === rightPos) {
                    if (type === lastAnchor.type || type === "before") {
                        return;
                    }
                }
            }
            anchors.push({ type, left: leftPos, leftLine, right: rightPos, rightLine, diffIndex });
        }
        function addDiff(leftIndex, leftCount, rightIndex, rightCount) {
            let leftPos, leftLen, rightPos, rightLen;
            let leftBeforeAnchorPos, leftBeforeAnchorLine, rightBeforeAnchorPos, rightBeforeAnchorLine, leftAfterAnchorPos, leftAfterAnchorLine, rightAfterAnchorPos, rightAfterAnchorLine;
            let leftEmpty, rightEmpty;
            let type;
            // 양쪽에 대응하는 토큰이 모두 존재하는 경우. 쉬운 케이스
            if (leftCount > 0 && rightCount > 0) {
                type = 3;
                let leftTokenStart = leftTokens[leftIndex];
                let leftTokenEnd = leftTokens[leftIndex + leftCount - 1];
                let rightTokenEnd = rightTokens[rightIndex + rightCount - 1];
                let rightTokenStart = rightTokens[rightIndex];
                leftPos = leftTokenStart.pos;
                leftLen = leftTokenEnd.pos + leftTokenEnd.len - leftPos;
                leftEmpty = false;
                rightPos = rightTokenStart.pos;
                rightLen = rightTokenEnd.pos + rightTokenEnd.len - rightPos;
                rightEmpty = false;
                // 생각: 한쪽만 줄의 첫 토큰일 때에도 앵커를 넣을까? 앵커에 display:block을 줘서 강제로 줄바꿈 시킨 후에에
                // 좌우 정렬을 할 수 있을 것 같기도 한데...
                if (leftTokenStart.flags & rightTokenStart.flags & FIRST_OF_LINE) {
                    leftBeforeAnchorPos = leftPos;
                    rightBeforeAnchorPos = rightPos;
                    while (leftBeforeAnchorPos > 0 && leftText[leftBeforeAnchorPos - 1] !== "\n") {
                        leftBeforeAnchorPos--;
                    }
                    while (rightBeforeAnchorPos > 0 && rightText[rightBeforeAnchorPos - 1] !== "\n") {
                        rightBeforeAnchorPos--;
                    }
                    // addAnchor("before", leftAnchorPos, rightAnchorPos, null);
                    if (leftTokenEnd.flags & rightTokenEnd.flags & LAST_OF_LINE) {
                        leftAfterAnchorPos = leftPos + leftLen;
                        rightAfterAnchorPos = rightPos + rightLen;
                        if (leftText[leftAfterAnchorPos] !== "\n") {
                            do {
                                leftAfterAnchorPos++;
                            } while (leftAfterAnchorPos < leftText.length && leftText[leftAfterAnchorPos] !== "\n");
                        }
                        if (rightText[rightAfterAnchorPos] !== "\n") {
                            do {
                                rightAfterAnchorPos++;
                            } while (rightAfterAnchorPos < rightText.length && rightText[rightAfterAnchorPos] !== "\n");
                        }
                        // while (leftAnchorPos + 1 < leftText.length && leftText[leftAnchorPos + 1] !== "\n") {
                        // 	leftAnchorPos++;
                        // }
                        // while (rightAnchorPos + 1 < rightText.length && rightText[rightAnchorPos + 1] !== "\n") {
                        // 	rightAnchorPos++;
                        // }
                        // addAnchor("after", leftBeforeAnchorPos, rightBeforeAnchorPos, null);
                    }
                }
            }
            else {
                // 한쪽이 비어있음.
                // 단순하게 토큰 사이에 위치시켜도 되지만 되도록이면 대응하는 쪽과 유사한 위치(줄시작/줄끝)에 위치시키기 위해...
                // 자꾸 이런저런 시도를 하다보니 난장판인데 만지기 싫음...
                let longSideText, shortSideText;
                let longSideIndex, longSideCount, longSideTokens;
                let shortSideIndex, shortSideTokens;
                let longSidePos, longSideLen;
                let shortSidePos, shortSideLen;
                let longSideBeforeAnchorPos, shortSideBeforeAnchorPos, longSideBeforeAnchorLine, shortSideBeforeAnchorLine;
                let longSideAfterAnchorPos, shortSideAfterAnchorPos, longSideAfterAnchorLine, shortSideAfterAnchorLine;
                let longSideTokenStart, longSideTokenEnd;
                let shortSideBeforeToken, shortSideAfterToken;
                if (leftCount > 0) {
                    type = 1; // 1: left
                    longSideText = leftText;
                    longSideTokens = leftTokens;
                    longSideIndex = leftIndex;
                    longSideCount = leftCount;
                    shortSideText = rightText;
                    shortSideTokens = rightTokens;
                    shortSideIndex = rightIndex;
                    leftEmpty = false;
                    rightEmpty = true;
                }
                else {
                    type = 2; // 2: right
                    longSideText = rightText;
                    longSideTokens = rightTokens;
                    longSideIndex = rightIndex;
                    longSideCount = rightCount;
                    shortSideText = leftText;
                    shortSideTokens = leftTokens;
                    shortSideIndex = leftIndex;
                    leftEmpty = true;
                    rightEmpty = false;
                }
                longSideTokenStart = longSideTokens[longSideIndex];
                longSideTokenEnd = longSideTokens[longSideIndex + longSideCount - 1];
                shortSideBeforeToken = shortSideTokens[shortSideIndex - 1];
                shortSideAfterToken = shortSideTokens[shortSideIndex];
                longSidePos = longSideTokenStart.pos;
                longSideLen = longSideTokenEnd.pos + longSideTokenEnd.len - longSidePos;
                shortSidePos = shortSideBeforeToken ? shortSideBeforeToken.pos + shortSideBeforeToken.len : 0;
                shortSideLen = 0;
                const longSideIsFirstWord = longSideTokenStart.flags & FIRST_OF_LINE;
                const longSideIsLastWord = longSideTokenEnd.flags & LAST_OF_LINE;
                const shortSideIsOnLineEdge = shortSideTokens.length === 0 ||
                    (shortSideBeforeToken && shortSideBeforeToken.flags & LAST_OF_LINE) ||
                    (shortSideAfterToken && shortSideAfterToken.flags & FIRST_OF_LINE);
                let shortSidePushedToNextLine = false;
                // base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
                if (shortSideIsOnLineEdge) {
                    // 줄의 경계에 empty diff를 표시하는 경우 현재 줄의 끝이나 다음 줄의 시작 중 "적절하게" 선택. 현재 줄의 끝(이전 토큰의 뒤)에 위치 중임.
                    if (longSideIsFirstWord) {
                        if (shortSidePos !== 0) {
                            // pos가 0이 아닌 경우는 이전 토큰의 뒤로 위치를 잡은 경우니까 다음 줄바꿈을 찾아서 그 줄바꿈 뒤로 밀어줌
                            // 주의: 현재 위치 이후에 줄바꿈이 있는지 없는지 확인하기보다는 원본 텍스트의 마지막에 줄바꿈이 없는 경우 강제로 줄바꿈을 붙여주는게 편함.
                            // 잊지말고 꼭 원본텍스트의 끝에 줄바꿈 하나 붙일 것.
                            // const maxPos = shortSideAfterToken ? shortSideAfterToken.pos - 1 : shortSideText.length - 1;
                            // while (shortSidePos < maxPos && shortSideText[shortSidePos++] !== "\n");
                            while (shortSideText[shortSidePos++] !== "\n")
                                ;
                            shortSidePushedToNextLine = true;
                        }
                        // 양쪽 모두 줄의 시작 부분에 위치하므로 앵커 추가.
                        // 빈 diff가 줄 시작이나 줄 끝 위치에 있다면 하나의 줄로 표시되게 할 수 있음(css 사용)
                        longSideBeforeAnchorPos = longSidePos;
                        longSideBeforeAnchorLine = longSideTokenStart.lineNum;
                        shortSideBeforeAnchorPos = shortSidePos;
                        shortSideBeforeAnchorLine = (shortSideBeforeToken ? shortSideBeforeToken.lineNum : 1) + (shortSidePushedToNextLine ? 1 : 0);
                        if (longSideIsLastWord) {
                            longSideAfterAnchorPos = longSidePos + longSideLen;
                            longSideAfterAnchorLine = longSideTokenEnd.lineNum;
                            shortSideAfterAnchorPos = shortSidePos;
                            shortSideAfterAnchorLine = shortSideBeforeAnchorLine;
                        }
                    }
                }
                if (leftCount > 0) {
                    leftPos = longSidePos;
                    leftLen = longSideLen;
                    leftEmpty = false;
                    leftBeforeAnchorPos = longSideBeforeAnchorPos;
                    leftBeforeAnchorLine = longSideBeforeAnchorLine;
                    leftAfterAnchorPos = longSideAfterAnchorPos;
                    leftAfterAnchorLine = longSideAfterAnchorLine;
                    rightPos = shortSidePos;
                    rightLen = shortSideLen;
                    rightEmpty = true;
                    rightBeforeAnchorPos = shortSideBeforeAnchorPos;
                    rightBeforeAnchorLine = shortSideBeforeAnchorLine;
                    rightAfterAnchorPos = shortSideAfterAnchorPos;
                    rightAfterAnchorLine = shortSideAfterAnchorLine;
                }
                else {
                    leftPos = shortSidePos;
                    leftLen = shortSideLen;
                    leftEmpty = true;
                    leftBeforeAnchorPos = shortSideBeforeAnchorPos;
                    leftAfterAnchorPos = shortSideAfterAnchorPos;
                    rightPos = longSidePos;
                    rightLen = longSideLen;
                    rightEmpty = false;
                    rightBeforeAnchorPos = longSideBeforeAnchorPos;
                    rightBeforeAnchorLine = longSideBeforeAnchorLine;
                    rightAfterAnchorPos = longSideAfterAnchorPos;
                    rightAfterAnchorLine = longSideAfterAnchorLine;
                }
            }
            if (leftBeforeAnchorPos !== undefined && rightBeforeAnchorPos !== undefined) {
                addAnchor("before", leftBeforeAnchorPos, leftBeforeAnchorLine, rightBeforeAnchorPos, rightBeforeAnchorLine, diffs.length);
            }
            if (leftAfterAnchorPos !== undefined && rightAfterAnchorPos !== undefined) {
                addAnchor("after", leftAfterAnchorPos, leftAfterAnchorLine, rightAfterAnchorPos, rightAfterAnchorLine, diffs.length);
            }
            const newEntry = {
                type: type,
                left: {
                    pos: leftPos,
                    len: leftLen,
                    empty: leftEmpty,
                },
                right: {
                    pos: rightPos,
                    len: rightLen,
                    empty: rightEmpty,
                },
            };
            diffs.push(newEntry);
        }
        diffContext.diffs = diffs;
        diffContext.anchors = anchors;
        return { diffs, anchors, leftTokenCount: leftTokens.length, rightTokenCount: rightTokens.length };
    }
    disableAlignedMode();
    leftEditor.updateText();
    rightEditor.updateText();
    _diffContext = {
        reqId: 0,
        leftText: leftEditor.text,
        rightText: rightEditor.text,
        diffOptions: { ..._diffOptions },
        done: false,
    };
    computeDiff();
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
            // 디버깅 할 때...
            return {
                _diffContext: _diffContext,
                // diffs: _diffResult?.diffs,
                // anchors: _diffResult?.anchors,
                diffOptions: _diffOptions,
                leftEditor,
                rightEditor,
                activeEditor: _activeEditor,
            };
        },
        compute: computeDiff,
        diffOptions: _diffOptions,
    };
})();
//# sourceMappingURL=main.js.map