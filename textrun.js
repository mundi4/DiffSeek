"use strict";

// 개정대비표에서 복붙 했을때 빨간색 텍스트를 그대로 보여줄 방법이 있을까?
// 텍스트 색과 diff 범위는 완전히 별개라서 서로 완전히 겹칠 수도 있고 안겹칠 수도 있고 일부분만 겹칠 수도 있다
// 일부분만 겹칠 경우가 까다로워지는 부분인데 textrun은 만들더라도 update때에도 일일히 속성 별로 다른 요소를 써서 DOM을 만들어야한다.
// 또.. 색상데이터를 어떻게 관리할 것인가?
// 텍스트의 어느 위치 어느 범위에 색이 들어가있는지 뭐 그런 data가 필요하다. 붙여넣기 때 그런 데이터를 추출하는건 어렵지 않지만(??)
// 이후에 텍스트가 변경되면 그에 따라 범위의 pos,len값도 조정되어야하니 결국 원본 텍스트 자체에 색상정보가 포함되어야 한다.
// 그럼 원본텍스트를 html로 저장하고 변경될 때마다 매번 parsing? 미쳤다.
// 원본 텍스트에 marker문자(zero-width space 등)를 넣고 그걸로 빨간색 범위 파악? nope!
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
			} else {
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
			} else {
				nextDiffPos = Number.MAX_SAFE_INTEGER;
				nextDiffEndPos = Number.MAX_SAFE_INTEGER;
			}
		}

		if (nextDiffPos < nextEventPos) {
			nextEventPos = nextDiffPos;
		} else if (nextDiffEndPos < nextEventPos) {
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
			} else {
				textruns.push({
					type: "LINEBREAK",
					pos: nextNewLinePos,
					len: 1,
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
    });

	return textruns;
}
