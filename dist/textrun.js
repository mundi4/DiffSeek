"use strict";
function getTextRuns(textKey, text, diffs, anchors) {
    let pos = 0;
    let textLen = text.length;
    let nextDiffPos = null;
    let nextDiffEndPos = null;
    let nextDiff = null;
    let nextAnchorPos = null;
    let nextAnchor = null;
    let nextNewLinePos = null;
    let nextNewLineIsEndOfString = false;
    let diffIndex = -1;
    let anchorIndex = -1;
    const textruns = [];
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
        if (nextAnchorPos === null) {
            anchorIndex++;
            if (anchorIndex < anchors.length) {
                nextAnchor = anchors[anchorIndex];
                nextAnchorPos = nextAnchor[textKey];
                if (nextAnchorPos < pos) {
                    // skipped anchor. this should not happen.
                    console.warn("Skipped anchor", { anchor: nextAnchor, anchorIndex: anchorIndex, pos: pos, anchorPos: nextAnchorPos });
                    nextAnchorPos = nextAnchor = null;
                    continue;
                }
            }
            else {
                nextAnchorPos = Number.MAX_SAFE_INTEGER;
            }
        }
        if (nextAnchorPos < nextEventPos) {
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
        if (nextDiffPos < nextEventPos) {
            nextEventPos = nextDiffPos;
        }
        else if (nextDiffEndPos < nextEventPos) {
            nextEventPos = nextDiffEndPos;
        }
        if (nextNewLinePos === null) {
            nextNewLinePos = text.indexOf("\n", pos);
            if (nextNewLinePos === -1) {
                nextNewLinePos = textLen;
                nextNewLineIsEndOfString = true;
            }
        }
        if (nextNewLinePos < nextEventPos) {
            nextEventPos = nextNewLinePos;
        }
        if (pos < nextEventPos) {
            // chars
            textruns.push({
                type: "CHARS",
                pos: pos,
                len: nextEventPos - pos,
                diffIndex: null,
                anchorIndex: null,
            });
            pos = nextEventPos;
        }
        // 이벤트 처리 후 반드시 continue로 다음 반복으로 넘어가야 함. (혹은 else if else if else if...)
        if (nextEventPos === nextAnchorPos && nextAnchor.type === "before") {
            textruns.push({
                type: "ANCHOR",
                pos: nextAnchorPos,
                len: 0,
                diffIndex: diffIndex,
                anchorIndex: anchorIndex,
            });
            nextAnchorPos = nextAnchor = null;
            continue;
        }
        if (nextEventPos === nextDiffPos) {
            textruns.push({
                type: "DIFF",
                pos: nextDiffPos,
                len: 0,
                diffIndex: diffIndex,
                anchorIndex: null,
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
                diffIndex: diffIndex,
                anchorIndex: null,
            });
            nextDiffPos = nextDiffEndPos = nextDiff = null;
            continue;
        }
        if (nextEventPos === nextAnchorPos && nextAnchor.type === "after") {
            textruns.push({
                type: "ANCHOR",
                pos: nextAnchorPos,
                len: 0,
                diffIndex: diffIndex,
                anchorIndex: anchorIndex,
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
                    diffIndex: null,
                    anchorIndex: null,
                });
                pos = nextEventPos + 1;
                nextNewLinePos = null;
                continue;
            }
        }
    }
    textruns.push({
        type: "END_OF_STRING",
        pos: textLen,
        len: 0,
        diffIndex: null,
        anchorIndex: null,
    });
    return textruns;
}
//# sourceMappingURL=textrun.js.map