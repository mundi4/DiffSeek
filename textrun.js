"use strict";

const ANCHOR = "ANCHOR";
const CHARS = "CHARS";
const DIFF = "DIFF";
const DIFF_END = "DIFF_END";
const LINEBREAK = "LINEBREAK";
const END_OF_STRING = "END_OF_STRING";

// 최적화의 여지가 많음
// textrun 배열을 만들면 나중에 변경된 부분만 업데이트 하거나 특정 줄만 업데이트 하기 수월함.
// mirror를 안쓰고 editor 자체를 dom으로 만들 경우 현재 커서가 있는 줄을 수정하는 게 상당히 거슬리는데(특히 한글 입력 중이면)
// 특정 줄만 업데이트를 미뤄둘 수 있으면 그런 상황에서 특정 줄만 업데이트 미뤄두고 상황 봐서 나중에 그 줄만 업데이트 할 수 있음.
function* textrunGenerator(textKey, text, diffs, anchors) {
	const _textLen = text.length;
	let _pos = 0;
	let _textPos = 0;
	let _diffIndex = -1;
	let _anchorIndex = -1;
	let _anchorPos;
	let _diffPos;
	let _inDiff = false;
	let _diffEnd;
	let _hasNonSpaceChar = false;
	let _lineNum = 1;

	const current = {
		pos: 0,
		len: 0,
		diffIndex: null,
		anchorIndex: null,
		hasNonSpaceChar: false,
	};

	// anchor위치는 diff의 시작위치
	// diff 범위 밖일때는 어디에서든 올 수 있다

	function nextAnchor() {
		_anchorIndex++;
		if (_anchorIndex < anchors.length) {
			const data = anchors[_anchorIndex];
			_anchorPos = data[textKey];
			if (_anchorPos < _pos) {
				console.warn("Anchor skipped", { anchor: data, anchorIndex: _anchorIndex, pos: _pos, anchorPos: _anchorPos });
				nextAnchor();
			}
		} else {
			_anchorIndex = anchors.length;
			_anchorPos = Number.MAX_SAFE_INTEGER;
		}
	}

	function nextDiff() {
		_diffIndex++;
		if (_diffIndex < diffs.length) {
			const data = diffs[_diffIndex][textKey];
			_diffPos = data.pos;
			_diffEnd = data.pos + data.len;
		} else {
			_diffIndex = diffs.length;
			_diffPos = Number.MAX_SAFE_INTEGER;
			_diffEnd = Number.MAX_SAFE_INTEGER;
		}
	}

	// 일단 줄번호++
	// 해당 줄번호에 해당하는 ling mapping를 찾아서 그 index를 _lineMapIndex로 저장.
	// 못찾으면 그 이후 maping index에 ~를 씌운 값
	//
	nextDiff();
	nextAnchor();

	function chars() {
		current.type = CHARS;
		current.pos = _textPos;
		current.len = _pos - _textPos;
		current.diffIndex = _inDiff ? _diffIndex : null;
		current.hasNonSpaceChar = _hasNonSpaceChar;
		_hasNonSpaceChar = false;
		_textPos = _pos;
		return current;
	}

	// 주의:
	// 같은 pos를 가진 anchor가 두개가 있을 수 있다. 길이가 0인 diff에 대한 anchor와 그 위치에 시작되는 common anchor
	// 반대의 순서는 없음.

	while (true) {
		if (_pos === _anchorPos) {
			let anchor = anchors[_anchorIndex];
			if (anchor.type === "before") {
				current.type = ANCHOR;
				current.pos = _pos;
				current.len = 0;
				current.diffIndex = _diffIndex;
				current.anchorIndex = _anchorIndex;
				yield current;
				nextAnchor();
			}
			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (_pos === _diffPos) {
			// 현재 위치 이전까지의 문자열들.
			if (_textPos < _pos) {
				yield chars();
			}
			_inDiff = true;
			_diffPos = Number.MAX_SAFE_INTEGER;
			current.type = DIFF;
			current.pos = _pos;
			current.len = 0;
			current.diffIndex = _diffIndex;
			yield current;
		}

		while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
			_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
			_pos++;
		}
		if (_textPos < _pos) {
			yield chars();
		}

		if (_pos === _diffEnd) {
			current.type = DIFF_END;
			current.pos = _pos;
			current.len = 0;
			current.diffIndex = _diffIndex;
			yield current;
			_inDiff = false;
			nextDiff();
			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (_pos === _anchorPos) {
			const anchor = anchors[_anchorIndex];
			if (anchor.type === "after") {
				current.type = ANCHOR;
				current.pos = _pos;
				current.len = 0;
				current.diffIndex = _diffIndex;
				current.anchorIndex = _anchorIndex;
				yield current;
				nextAnchor();
			}
			// type이 after가 아니더라도 이미 이 시점에서는 before 타입 앵커를 리턴할 수 없다.

			while (_pos < _textLen && _pos !== _diffPos && _pos !== _diffEnd && _pos !== _anchorPos && text[_pos] !== "\n") {
				_hasNonSpaceChar = _hasNonSpaceChar || (text[_pos] !== " " && text[_pos] !== "\t");
				_pos++;
			}
			if (_textPos < _pos) {
				yield chars();
			}
		}

		if (text[_pos] === "\n") {
			current.type = LINEBREAK;
			current.pos = _pos;
			current.len = 1;
			current.diffIndex = _inDiff ? _diffIndex : null;
			yield current;
			_lineNum++;
			_textPos = ++_pos;

			while (_anchorPos < _pos) {
				console.warn("Anchor skipped", { anchor: anchors[_anchorIndex], anchorIndex: _anchorIndex, pos: _pos, anchorPos: _anchorPos });
				nextAnchor();
			}

			continue;
		}

		if (_pos >= _textLen) {
			current.type = END_OF_STRING;
			current.pos = _textLen;
			current.len = 0;
			current.diffIndex = null;
			return current;
		}
	}

	// current.type = END_OF_STRING;
	// current.pos = _textLen;
	// current.len = 0;
	// current.diffIndex = null;
	// yield current;
	//yield [END_OF_STRING, _textLen, 0, null];
}

// generator함수보다 이 방법을 쓰면 
// 뒷부분의 textrun만 변경되었을 경우를 감지해서 그 부분만 업데이트 할 수 있다
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
	while (pos < textLen) {
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
                console.warn("!!!!!!!!!!!!!!!!!!")

				break;
			} else {
				textruns.push({
					type: "LINEBREAK",
					pos: nextNewLinePos,
					len: 1,
				});
				pos = nextEventPos + 1;
				nextNewLinePos = null;
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
