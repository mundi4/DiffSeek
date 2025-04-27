"use strict";
function getTextRuns(textKey, text, { diffs, anchors, headings }, startPos, endPos) {
    diffs ??= [];
    anchors ??= [];
    headings ??= [];
    let nextPropsPos = null;
    let nextDiffPos = null;
    let nextDiffEndPos = null;
    let nextDiff = null;
    let nextAnchorPos = null;
    let nextAnchor = null;
    let nextHeadingPos = null;
    let nextHeadingEndPos = null;
    let nextHeading = null;
    let nextNewLinePos = null;
    let nextNewLineIsEndOfString = false;
    let diffIndex = -1;
    let anchorIndex = -1;
    let headingIndex = -1;
    const textruns = [];
    const textLen = endPos ?? text.length;
    let pos = startPos ?? 0;
    if (pos > 0) {
        for (let i = 0; i < diffs.length; i++) {
            if (diffs[i][textKey].pos >= pos) {
                diffIndex = i - 1;
                break;
            }
        }
        for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            if (a[textKey] >= pos) {
                anchorIndex = i - 1;
                break;
            }
        }
        for (let i = 0; i < headings.length; i++) {
            const h = headings[i];
            if (h[textKey].pos >= pos) {
                headingIndex = i - 1;
                break;
            }
        }
    }
    // let counter = 0;
    // pos < textLen 조건을 쓰면 text의 끝에 위치한 이벤트가 무시될 수 있음.
    while (true) {
        // if (counter++ > 100000) {
        // 	console.error("Infinite loop detected", {
        // 		textruns,
        // 		pos: pos,
        // 		textLen: textLen,
        // 		nextDiffPos: nextDiffPos,
        // 		nextDiffEndPos: nextDiffEndPos,
        // 		nextAnchorPos: nextAnchorPos,
        // 		nextNewLinePos: nextNewLinePos,
        // 		diffIndex: diffIndex,
        // 		anchorIndex: anchorIndex,
        // 		nextDiff: nextDiff,
        // 		nextAnchor: nextAnchor,
        // 		diffs,
        // 		anchors,
        // 	});
        // 	throw new Error("Infinite loop detected");
        // }
        let nextEventPos = textLen;
        if (nextPropsPos !== null && nextPropsPos < nextEventPos) {
            nextEventPos = nextPropsPos;
        }
        if (nextAnchorPos === null) {
            anchorIndex++;
            if (anchorIndex < anchors.length) {
                nextAnchor = anchors[anchorIndex];
                nextAnchorPos = nextAnchor[textKey];
                if (nextAnchorPos < pos) {
                    // anchor 위치를 조절할 때 문제가 생긴 경우인데... 앵커를 못 박으면 줄맞춤 정렬이 깨진다. 딱 그뿐...
                    console.warn("Skipped anchor", { anchor: nextAnchor, anchorIndex: anchorIndex, pos: pos, anchorPos: nextAnchorPos });
                    nextAnchorPos = nextAnchor = null;
                    // continue;
                }
            }
            else {
                nextAnchorPos = Number.MAX_SAFE_INTEGER;
            }
        }
        if (nextAnchorPos !== null && nextAnchorPos < nextEventPos) {
            nextEventPos = nextAnchorPos;
        }
        if (nextDiffEndPos === null) {
            diffIndex++;
            if (diffIndex < diffs.length) {
                nextDiff = diffs[diffIndex][textKey];
                nextDiffPos = nextDiff.pos;
                nextDiffEndPos = nextDiff.pos + nextDiff.len;
                if (nextDiffPos < pos) {
                    console.warn("Skipped diff", { diff: nextDiff, diffIndex: diffIndex, pos: pos, diffPos: nextDiffPos });
                    nextDiffPos = nextDiffEndPos = nextDiff = null;
                }
            }
            else {
                nextDiffPos = Number.MAX_SAFE_INTEGER;
                nextDiffEndPos = Number.MAX_SAFE_INTEGER;
            }
        }
        if (nextDiffPos !== null && nextDiffPos < nextEventPos) {
            nextEventPos = nextDiffPos;
        }
        else if (nextDiffEndPos !== null && nextDiffEndPos < nextEventPos) {
            nextEventPos = nextDiffEndPos;
        }
        if (nextHeadingEndPos === null) {
            headingIndex++;
            if (headingIndex < headings.length) {
                nextHeading = headings[headingIndex][textKey];
                nextHeadingPos = nextHeading.pos;
                nextHeadingEndPos = nextHeading.pos + nextHeading.len;
                if (nextHeadingPos < pos) {
                    console.warn("Skipped heading", { heading: nextHeading, headingIndex: headingIndex, pos: pos, headingPos: nextHeadingPos });
                    nextHeadingPos = nextHeadingEndPos = nextHeading = null;
                }
            }
            else {
                nextHeadingPos = Number.MAX_SAFE_INTEGER;
                nextHeadingEndPos = Number.MAX_SAFE_INTEGER;
            }
        }
        if (nextHeadingPos !== null && nextHeadingPos < nextEventPos) {
            nextEventPos = nextHeadingPos;
        }
        else if (nextHeadingEndPos !== null && nextHeadingEndPos < nextEventPos) {
            nextEventPos = nextHeadingEndPos;
        }
        if (nextNewLinePos === null) {
            nextNewLinePos = text.indexOf("\n", pos);
            if (nextNewLinePos === -1 || nextNewLinePos >= textLen) {
                nextNewLinePos = textLen;
                nextNewLineIsEndOfString = true;
            }
        }
        if (nextNewLinePos !== null && nextNewLinePos < nextEventPos) {
            nextEventPos = nextNewLinePos;
        }
        if (pos < nextEventPos) {
            // chars
            textruns.push({
                type: "CHARS",
                pos: pos,
                len: nextEventPos - pos,
                dataIndex: null,
            });
            pos = nextEventPos;
        }
        // 이벤트 처리 후 반드시 continue로 다음 반복으로 넘어가야 함. (혹은 else if else if else if...)
        if (nextEventPos === nextAnchorPos && nextAnchor.type === "before") {
            textruns.push({
                type: "ANCHOR",
                pos: nextAnchorPos,
                len: 0,
                dataIndex: anchorIndex,
            });
            nextAnchorPos = nextAnchor = null;
            continue;
        }
        if (nextEventPos === nextDiffPos) {
            textruns.push({
                type: "DIFF",
                pos: nextDiffPos,
                len: 0,
                dataIndex: diffIndex,
            });
            nextDiffPos = Number.MAX_SAFE_INTEGER;
            continue;
        }
        if (nextEventPos === nextDiffEndPos) {
            // diff end
            textruns.push({
                type: "DIFF_END",
                pos: nextDiffEndPos,
                len: 0,
                dataIndex: diffIndex,
            });
            nextDiffPos = nextDiffEndPos = nextDiff = null;
            continue;
        }
        if (nextEventPos === nextHeadingPos) {
            textruns.push({
                type: "HEADING",
                pos: nextHeadingPos,
                len: 0,
                dataIndex: headingIndex,
            });
            nextHeadingPos = Number.MAX_SAFE_INTEGER;
            continue;
        }
        if (nextEventPos === nextHeadingEndPos) {
            textruns.push({
                type: "HEADING_END",
                pos: nextHeadingEndPos,
                len: 0,
                dataIndex: headingIndex,
            });
            nextHeadingPos = nextHeadingEndPos = nextHeading = null;
            continue;
        }
        if (nextEventPos === nextAnchorPos && nextAnchor.type === "after") {
            textruns.push({
                type: "ANCHOR",
                pos: nextAnchorPos,
                len: 0,
                dataIndex: anchorIndex,
            });
            nextAnchorPos = null;
            continue;
        }
        if (nextEventPos === nextNewLinePos) {
            if (nextNewLineIsEndOfString) {
                break;
            }
            else {
                textruns.push({
                    type: "LINEBREAK",
                    pos: nextNewLinePos,
                    len: 1,
                    dataIndex: null,
                });
                pos = nextEventPos + 1;
                nextNewLinePos = null;
                continue;
            }
        }
    }
    // 닫히지 않은 diff. endPos를 넣어서 호출한 경우 diff가 끝나기 전에 endPos에 도달할 수 있음.
    if (nextDiffPos === Number.MAX_SAFE_INTEGER && nextDiffEndPos !== Number.MAX_SAFE_INTEGER) {
        textruns.push({
            type: "DIFF_END",
            pos: textLen,
            len: 0,
            dataIndex: diffIndex,
        });
    }
    // heading과 diff는 오버랩되지 않으므로 순서는 상관 없음.
    if (nextHeadingPos === Number.MAX_SAFE_INTEGER && nextHeadingEndPos !== Number.MAX_SAFE_INTEGER) {
        textruns.push({
            type: "HEADING_END",
            pos: textLen,
            len: 0,
            dataIndex: headingIndex,
        });
    }
    textruns.push({
        type: "END_OF_STRING",
        pos: textLen,
        len: 0,
        dataIndex: null,
    });
    return textruns;
}
//# sourceMappingURL=textrun.js.map