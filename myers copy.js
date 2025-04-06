
// Myers Diff (simple and reliable single-path version)
// Myers Diff (original trace structure with backtracking)
// Myers Diff (original trace structure with backtracking)

function normalizeCharCode(char) {
	// Normalize visually similar characters to a standard one
	switch (char) {
		case "·": // middle dot (U+00B7)
		case "•": // bullet (U+2022)
		case "∙": // bullet operator (U+2219)
			return ".".charCodeAt(0);
		default:
			return char.charCodeAt(0);
	}
}

const WORD_START = 64;
const WORD_END = 128;
const WILD_CARD_CODE = 0x10ffff;

function createCharTokensFromWords(wordTokens, text) {
	const charTokens = [];
	for (let wordIndex = 0; wordIndex < wordTokens.length; wordIndex++) {
		const word = wordTokens[wordIndex];
		const start = word.pos;
		const end = start + word.text.length;

		if (word.flags & WILD_CARD) {
			let flags = WILD_CARD | WORD_START | WORD_END;
			if (word.flags & FIRST_OF_LINE) flags |= FIRST_OF_LINE;
			if (word.flags & LAST_OF_LINE) flags |= LAST_OF_LINE;
			if (word.flags & NORMALIZE) flags |= NORMALIZE;
			charTokens.push({
				pos: start,
				code: WILD_CARD_CODE,
				flags,
				wordIndex,
			});
			continue;
		}

		for (let pos = start; pos < end; pos++) {
			let flags = 0;
			if (pos === start) flags |= WORD_START;
			if (pos === end - 1) flags |= WORD_END;
			if (word.flags & FIRST_OF_LINE && pos === start) flags |= FIRST_OF_LINE;
			if (word.flags & LAST_OF_LINE && pos === end - 1) flags |= LAST_OF_LINE;
			if (word.flags & NORMALIZE) flags |= NORMALIZE;
			charTokens.push({
				pos,
				code: word.flags & NORMALIZE ? normalizeCharCode(text[pos]) : text.charCodeAt(pos),
				flags,
				wordIndex,
			});
		}
	}
	return charTokens;
}

function myersDiffz(leftText, rightText) {
	const leftTokens = tokenize(leftText);
	const rightTokens = tokenize(rightText);
	const leftChars = createCharTokensFromWords(leftTokens, leftText);
	const rightChars = createCharTokensFromWords(rightTokens, rightText);

	const traceByD = [];
	let V = { 0: 0, 1: 0, "-1": 0 }; // Initialize V[1] and V[-1] for the first iteration
	let iterationCount = 0;

	for (let d = 0; ; d++) {
		const newV = {};
		traceByD[d] = {};

		for (let k = -d; k <= d; k += 2) {
			let x;

			if (k === -d) {
				x = V[k + 1];
			} else if (k === d) {
				x = V[k - 1] + 1;
			} else {
				const xDown = V[k + 1];
				const xRight = V[k - 1] + 1;
				x = xDown > xRight ? xDown : xRight;
			}

			let y = x - k;
			const path = [];

			while (x < leftChars.length && y < rightChars.length && leftChars[x].code === rightChars[y].code) {
				path.push({
					left: leftChars[x].pos,
					right: rightChars[y].pos,
					leftWord: leftChars[x].wordIndex,
					rightWord: rightChars[y].wordIndex,
				});
				x++;
				y++;
			}

			newV[k] = x;
			traceByD[d][k] = { x, path, prevK: k === -d || (k !== d && V[k - 1] < V[k + 1]) ? k + 1 : k - 1 };

			// Debugging output
			console.log(`Iteration ${iterationCount}, d=${d}, k=${k}, x=${x}, y=${y}`);

			// Checking for infinite loop
			if (++iterationCount > 1000) {
				throw new Error("Exceeded maximum iteration count. Debugging stopped.");
			}

			// Exit condition check
			if (x >= leftChars.length && y >= rightChars.length) {
				return backtrack(traceByD, d, k, leftText, rightText, leftTokens, rightTokens);
			}
		}

		V = newV;
	}
}

function backtrack(traceByD, d, k, leftText, rightText, leftTokens, rightTokens) {
	const trace = [];
	for (let i = d; i >= 0; i--) {
		const step = traceByD[i][k];
		if (step?.path?.length) {
			trace.unshift(...step.path);
		}
		k = step.prevK;
	}
	// printTrace(trace, leftText, rightText);
	return extractDiffFromTrace(trace, leftText, rightText, leftTokens, rightTokens);
}

function extractDiffFromTrace(trace, leftText, rightText, leftTokens, rightTokens) {
	const diffs = [];
	let prev = { left: -1, right: -1, leftWord: -1, rightWord: -1 };

	function getValidPos(tokens, index) {
		if (index <= 0) return 0;
		const token = tokens[index - 1];
		return token.pos + token.len;
	}

	for (const step of trace) {
		const { left, right, leftWord, rightWord } = step;
		if (leftWord !== prev.leftWord + 1 || rightWord !== prev.rightWord + 1) {
			const l0 = prev.leftWord + 1;
			const l1 = leftWord;
			const r0 = prev.rightWord + 1;
			const r1 = rightWord;

			const leftStart = getValidPos(leftTokens, l0);
			const leftEnd = getValidPos(leftTokens, l1);
			const rightStart = getValidPos(rightTokens, r0);
			const rightEnd = getValidPos(rightTokens, r1);

			if (leftEnd !== leftStart || rightEnd !== rightStart) {
				diffs.push({
					left: {
						pos: leftStart,
						len: leftEnd - leftStart,
						text: leftText.slice(leftStart, leftEnd),
					},
					right: {
						pos: rightStart,
						len: rightEnd - rightStart,
						text: rightText.slice(rightStart, rightEnd),
					},
				});
			}
		}
		prev = step;
	}

	const l0 = prev.leftWord + 1;
	const r0 = prev.rightWord + 1;
	const leftStart = getValidPos(leftTokens, l0);
	const rightStart = getValidPos(rightTokens, r0);
	const leftEnd = leftText.length;
	const rightEnd = rightText.length;

	if (leftEnd !== leftStart || rightEnd !== rightStart) {
		diffs.push({
			left: {
				pos: leftStart,
				len: leftEnd - leftStart,
				text: leftText.slice(leftStart, leftEnd),
			},
			right: {
				pos: rightStart,
				len: rightEnd - rightStart,
				text: rightText.slice(rightStart, rightEnd),
			},
		});
	}

	return diffs;
}

// let textA = "const tokensB = tokenize(textB);";
// let textB = "co33nst t3okensB = 3tokenize(te3xtB);";

// const tokensA = tokenize(textA);
// const tokensB = tokenize(textB);

// const diff = myersDiff(textA, textB);
// console.log(diff);
function zzmyersDiff(a, b) {
	const n = a.length;
	const m = b.length;
	const max = n + m;

	// V[k] 배열 초기화
	const v = Array(2 * max + 1);
	v[1] = 0;

	// 결과를 추적할 배열
	const trace = [];

	// d가 0부터 시작하여 n + m까지 순차적으로 증가
	for (let d = 0; d <= max; d++) {
		for (let k = -d; k <= d; k += 2) {
			let x;
			// 대각선에서 이동하는 방향을 결정
			if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
				x = v[k + 1];
			} else {
				x = v[k - 1] + 1;
			}

			let y = x - k;

			// 일치하는 부분을 추적하기 위해 while문을 사용
			while (x < n && y < m && a[x] === b[y]) {
				x++;
				y++;
			}

			v[k] = x;

			// 일치하는 부분을 추적
			trace.push({ x, y });

			// 두 문자열의 끝에 도달하면 종료
			if (x >= n && y >= m) {
				console.log("d:", d, "k:", k, "x:", x, "y:", y);
				return trace;
			}
		}
	}

	return trace;
}



// function myersDiff(leftTokens, rightTokens, leftLower, leftUpper, rightLower, rightUpper) {
// 	let max = leftTokens.length + rightTokens.length + 1;
// 	let trace = [];

// 	// console.log({
// 	// 	leftTokens,
// 	// 	rightTokens,
// 	// 	leftLower,
// 	// 	leftUpper,
// 	// 	rightLower,
// 	// 	rightUpper,
// 	// 	kdown: kDown,
// 	// 	maxd: maxD,
// 	// 	max,
// 	// 	offset_down: vOffset,
// 	// });

// 	let V = new Array(max * 2 + 1);
// 	V[max + 1] = leftLower;
// 	for (let d = 0; d <= max; d++) {
// 		for (let k = -d; k <= d; k += 2) {
// 			if (k === -d) {
// 				x = V[max + k + 1];
// 			} else {
// 				x = V[max + k - 1] + 1;
// 				if (k < d && V[max + k + 1] >= x) {
// 					x = V[max + k + 1];
// 				}
// 			}

// 			let y = x - k;
// 			while (x < leftUpper && y < rightUpper) {
// 				if (leftTokens[x].text !== rightTokens[y].text) break;
// 				x++;
// 				y++;
// 			}

// 			V[max + k] = x;
//             trace.push([x, y]);
// 			console.log(x, y);
// 			if (x >= leftUpper && y >= rightUpper) {
// 				console.log("V", V);
// 				console.log("T:",trace);
// 				return;
// 			}
// 		}
// 	}
// 	console.log("WTF?", x);
// }
function myersDivideAndConquer (leftTokens, rightTokens, leftLower, leftUpper, rightLower, rightUpper) {
	let kDown = leftLower - rightLower;
	let max = leftTokens.length + rightTokens.length + 1;
	let maxD = leftUpper - leftLower + rightUpper - rightLower;
	let vOffset = max - kDown;
	let trace = [];

	console.log({
		leftTokens,
		rightTokens,
		leftLower,
		leftUpper,
		rightLower,
		rightUpper,
		kdown: kDown,
		maxd: maxD,
		max,
		offset_down: vOffset,
	});

	let V = new Array(max * 2 + 1);
	V[vOffset + kDown + 1] = leftLower;
	//max + maxD

	for (let d = 0; d <= maxD; d++) {
        for (let k = kDown - d; k <= kDown + d; k += 2) {
            let x;
            if (k === kDown - d) {
				x = V[vOffset + k + 1];
			} else {
				x = V[vOffset + k - 1] + 1;
				if (k < kDown + d && V[vOffset + k + 1] >= x) {
					x = V[vOffset + k + 1];
				}
			}

			let y = x - k;
            console.log(x,y,k)
			while (x < leftUpper && y < rightUpper) {
				if (leftTokens[x].text !== rightTokens[y].text) break;
				x++;
				y++;
			}

			V[vOffset + k] = x;
            trace.push([x, y]);
			if (x >= leftUpper && y >= rightUpper) {
				console.log(V);
				console.log(trace);
				return;
			}
		}
	}
	console.log("WTF?", { trace,V});

    return trace;
}

let leftText = "a b";
let rightText = "c b";
const leftTokens = tokenize(leftText);
const rightTokens = tokenize(rightText);
myersDivideAndConquer (leftTokens, rightTokens, 0, leftTokens.length, 0, rightTokens.length);
