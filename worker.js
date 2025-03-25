"use strict";

const DIFF_BY_CHAR = 1;
const DIFF_BY_WORD = 2;
const DIFF_BY_LINE = 3;
const DIFF_BY_PARAGRAPH = 4;

const TOKEN_CACHE_SIZE = 4;
const MIN_PARAGRAPH_GAP = 1;

const FIRST_OF_LINE = 1; // PRECEDED_BY_NEWLINE ?
const LAST_OF_LINE = 2; // FOLLOWED_BY_NEWLINE ?
const WILD_CARD = 16;

const decoder = new TextDecoder();
let _nextWork = null;
let _currentWork = null;

const tokenCache = {
	[DIFF_BY_CHAR]: [],
	[DIFF_BY_WORD]: [],
	[DIFF_BY_LINE]: [],
	[DIFF_BY_PARAGRAPH]: [],
};

// #region trie
function createTrieNode() {
	const children = {};
	function next(char) {
		return char === " " ? this : children[char] || null;
	}

	function addChild(char) {
		if (!children[char]) {
			children[char] = createTrieNode();
		}
		return children[char];
	}
	return { next, addChild, word: null, flags: null };
}

function createTrie() {
	const root = createTrieNode();

	function insert(word, flags = 0) {
		let node = root;
		for (const char of word) {
			node = node.addChild(char);
		}
		node.word = word;
		node.flags = flags;
	}

	return { insert, root };
}
// #endregion

const SPACE_CHARS = {
	" ": true, // 공백
	"\t": true, // 탭
	"\n": true, // 줄 바꿈
	"\r": true, // 캐리지 리턴
	"\f": true, // 폼 피드
	"\v": true, // 수평 탭
};

const Trie = createTrie();
Trie.insert("(추가)", WILD_CARD);
Trie.insert("(삭제)", WILD_CARD);
Trie.insert("(신설)", WILD_CARD);
Trie.insert("(생략)", WILD_CARD);
Trie.insert("(현행과같음)", WILD_CARD);

const TrieRoot = Trie.root;
const WildcardNode = Trie.root.next("(");

self.onmessage = (e) => {
	if (e.data.type === "diff") {
		const work = {
			reqId: e.data.reqId,
			left: e.data.left,
			right: e.data.right,
			method: e.data.method,
			cancel: false,
		};
		if (_currentWork) {
			_currentWork.cancel = true;
			_nextWork = work;
			return;
		}
		runDiff(work);
	}
};

async function runDiff(work) {
	_currentWork = work;
	const leftText = decoder.decode(work.left);
	const rightText = decoder.decode(work.right);
	try {
		work.lastYield = work.start = performance.now();
		const results = await computeDiff({ leftText, rightText, method: work.method || DIFF_BY_WORD, ctx: work });
		work.finish = performance.now();
		//console.log("Elapsed time:", work.finish - work.start);
		_currentWork = null;
		if (results) {
			self.postMessage({
				reqId: work.reqId,
				type: "diffs",
				diffs: results.diffs,
				anchors: results.anchors,
			});
		} else {
			console.debug("Diff canceled");
		}
	} catch (e) {
		if (e.message === "cancelled") {
			console.debug("Diff canceled");
		} else {
			console.error(e);
		}
	}
	[work, _nextWork] = [_nextWork, null];
	if (work) {
		return await runDiff(work);
	}
}

function normalizeText(input) {
	return input.replace(/\s{2,}/g, " ").trim();
}

function checkIfFirstOfLine(input, pos) {
	pos--;
	while (pos >= 0) {
		if (input[pos] === "\n") {
			break;
		} else if (!SPACE_CHARS[input[pos]]) {
			return false;
		}
		pos--;
	}
	return true;
}

function tokenizeByChar(input, inputPos = undefined, inputEnd = undefined, baseLineNum = undefined) {
	const tokens = [];
	let lineCount = 0;
	let flags = 0;
	if (inputPos === undefined) {
		inputPos = 0;
	}
	if (inputEnd === undefined) {
		inputEnd = input.length;
	}
	if (baseLineNum === undefined) {
		baseLineNum = 1;
	}

	for (let i = inputPos; i < inputEnd; i++) {
		const char = input[i];
		if (!SPACE_CHARS[char]) {
			if (char === "(") {
				let p = i + 1;
				let found = null;
				for (let node = WildcardNode; p < inputEnd && (node = node.next(input[p++])) !== null; ) {
					if (node.word !== null) {
						found = node;
						break;
					}
				}
				if (found) {
					flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
					tokens.push({
						text: found.word,
						pos: i,
						len: p - i,
						lineNum: baseLineNum + lineCount,
						flags: flags | found.flags,
					});
					flags = 0;
					i = p - 1;
					continue;
				}
			}
			flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
			tokens.push({
				text: char,
				pos: i,
				len: 1,
				lineNum: baseLineNum + lineCount,
				flags,
			});
			flags = 0;
		}
		if (char === "\n") {
			lineCount++;
			flags = FIRST_OF_LINE;
			if (tokens.length > 0) {
				tokens[tokens.length - 1].flags |= LAST_OF_LINE;
			}
		}
	}

	if (tokens.length > 0) {
		let p = inputEnd;
		while (p <= input.length) {
			if (p === input.length || input[p] === "\n") {
				tokens[tokens.length - 1].flags |= LAST_OF_LINE;
				break;
			} else if (!SPACE_CHARS[input[p]]) {
				break;
			}
			p++;
		}
	}

	//console.log("tokenizeByChar", tokens);
	return tokens;
}

function tokenizeByWord(input, inputPos = undefined, inputEnd = undefined, baseLineNum = undefined) {
	const tokens = [];
	let currentStart = -1;
	let lineCount = 0;
	let flags = 0;
	if (inputPos === undefined) {
		inputPos = 0;
	}
	if (inputEnd === undefined) {
		inputEnd = input.length;
	}
	if (baseLineNum === undefined) {
		baseLineNum = 1;
	}

	for (let i = inputPos; i < inputEnd; i++) {
		const char = input[i];
		//if (/[\w\u3131-\uD79D]+/.test(char)) {
		// 문장부호를 별개로 단어로 분리하는 방법도 생각해볼 필요가 있음.
		// but!! "(현행과 같음)"의 여는 괄호가 별개로 매치되는 건 원하지 않음.

		if (SPACE_CHARS[char]) {
			if (currentStart !== -1) {
				flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
				tokens.push({
					text: input.substring(currentStart, i),
					pos: currentStart,
					len: i - currentStart,
					lineNum: baseLineNum + lineCount,
					flags,
				});
				flags = 0;
				currentStart = -1;
			}
			if (char === "\n") {
				lineCount++;
				flags = FIRST_OF_LINE;
				if (tokens.length > 0) {
					tokens[tokens.length - 1].flags |= LAST_OF_LINE;
				}
			}
		} else {
			if (char === "(") {
				let p = i + 1;
				let found = null;
				for (let node = WildcardNode; p < inputEnd && (node = node.next(input[p++])) !== null; ) {
					if (node.word !== null) {
						found = node;
						break;
					}
				}
				if (found) {
					if (currentStart !== -1) {
						flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
						tokens.push({
							text: input.substring(currentStart, i),
							pos: currentStart,
							len: i - currentStart,
							lineNum: baseLineNum + lineCount,
							flags,
						});
						flags = 0;
						currentStart = -1;
					}

					flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
					tokens.push({
						text: found.word,
						pos: i,
						len: p - i,
						lineNum: baseLineNum + lineCount,
						flags: flags | found.flags,
					});
					flags = 0;
					i = p - 1;
					continue;
				}
			}

			if (currentStart === -1) {
				currentStart = i;
			}
		}
	}

	if (currentStart !== -1) {
		flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
		tokens.push({
			text: input.substring(currentStart),
			pos: currentStart,
			len: inputEnd - currentStart,
			lineNum: baseLineNum + lineCount,
			flags: flags,
		});
	}

	if (tokens.length > 0) {
		let p = inputEnd;
		while (p <= input.length) {
			if (p === input.length || input[p] === "\n") {
				tokens[tokens.length - 1].flags |= LAST_OF_LINE;
				break;
			} else if (!SPACE_CHARS[input[p]]) {
				break;
			}
			p++;
		}
	}

	//console.log("tokenizeByWord", tokens);
	return tokens;
}

function tokenizeByLine(input, inputPos = undefined, inputEnd = undefined, baseLineNum = undefined) {
	const tokens = [];
	let currentStart = -1;
	let currentEnd = -1;
	let lineCount = 0;
	if (inputPos === undefined) {
		inputPos = 0;
	}
	if (inputEnd === undefined) {
		inputEnd = input.length;
	}
	if (baseLineNum === undefined) {
		baseLineNum = 1;
	}

	for (let i = inputPos; i < inputEnd; i++) {
		const char = input[i];
		if (char !== "\n") {
			if (!SPACE_CHARS[char]) {
				if (currentStart === -1) {
					currentStart = i;
				}
				currentEnd = i + 1;
			}
		} else {
			if (currentStart !== -1) {
				tokens.push({
					text: input.substring(currentStart, currentEnd),
					pos: currentStart,
					len: i - currentStart,
					lineNum: baseLineNum + lineCount,
					flags: FIRST_OF_LINE | LAST_OF_LINE,
				});
				currentStart = currentEnd = -1;
			}
			lineCount++;
		}
	}

	if (currentStart !== -1) {
		tokens.push({
			text: input.substring(currentStart, currentEnd),
			pos: currentStart,
			len: currentEnd - currentStart,
			lineNum: baseLineNum + lineCount,
			flags: FIRST_OF_LINE | LAST_OF_LINE,
		});
	}

	return tokens;
}

function tokenize(input, method, inputPos = undefined, inputEnd = undefined, baseLineNum = undefined) {
	let cacheArr;
	if ((inputPos === undefined || inputPos === 0) && (inputEnd === undefined || inputEnd === input.length)) {
		cacheArr = tokenCache[method];
		if (cacheArr) {
			for (let i = 0; i < cacheArr.length; i++) {
				const token = cacheArr[i];
				if (token.text === input) {
					if (i !== cacheArr.length - 1) {
						cacheArr.splice(i, 1);
						cacheArr.push(token);
					}
					return token.tokens;
				}
			}
		}
	}

	const tokens =
		method === DIFF_BY_CHAR
			? tokenizeByChar(input, inputPos, inputEnd, baseLineNum)
			: method === DIFF_BY_LINE
			? tokenizeByLine(input, inputPos, inputEnd, baseLineNum)
			: tokenizeByWord(input, inputPos, inputEnd, baseLineNum);

	// tokens.push({
	// 	text: "",
	// 	pos: input.length,
	// 	len: 0,
	// 	lineNum: tokens.length > 0 ? tokens[tokens.length - 1].lineNum : 1,
	// 	flags: FIRST_OF_LINE | LAST_OF_LINE,
	// });

	if (cacheArr) {
		if (cacheArr.length >= TOKEN_CACHE_SIZE) {
			cacheArr.shift();
		}
		cacheArr.push({ text: input, tokens });
	}
	return tokens;
}

// function computeLCS(leftTokens, rightTokens) {
// 	const m = leftTokens.length;
// 	const n = rightTokens.length;
// 	const dp = new Array(m + 1);
// 	const blockLength = new Array(m + 1);
// 	const lcsIndices = [];

// 	for (let i = 0; i <= m; i++) {
// 		dp[i] = new Array(n + 1).fill(0);
// 		blockLength[i] = new Array(n + 1).fill(0);
// 	}

// 	for (let i = 1; i <= m; i++) {
// 		for (let j = 1; j <= n; j++) {
// 			if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 				let weight = 1;
// 				// 연속된 매치 토큰에 가중치 부여
// 				if (i > 1 && j > 1 && leftTokens[i - 2].text === rightTokens[j - 2].text) {
// 					weight += dp[i - 1][j - 1];
// 				}
// 				// dp 테이블 갱신
// 				dp[i][j] = dp[i - 1][j - 1] + weight;
// 			} else {
// 				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
// 			}
// 		}
// 	}

// 	// for (let i = 1; i <= m; i++) {
// 	// 	for (let j = 1; j <= n; j++) {
// 	// 		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 	// 			let weight = 1;
// 	// 			if (i > 1 && j > 1 && leftTokens[i - 2].text === rightTokens[j - 2].text) {
// 	// 				weight += blockLength[i - 1][j - 1];
// 	// 			}
// 	// 			dp[i][j] = dp[i - 1][j - 1] + weight;
// 	// 			blockLength[i][j] = blockLength[i - 1][j - 1] + 1;
// 	// 		} else {
// 	// 			dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
// 	// 			blockLength[i][j] = 0;
// 	// 		}
// 	// 	}
// 	// }

// 	let i = m;
// 	let j = n;
// 	while (i > 0 && j > 0) {
// 		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 			if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 				lcsIndices.push({ leftIndex: i - 1, rightIndex: j - 1, text: leftTokens[i - 1].text });
// 			}
// 			i--;
// 			j--;
// 		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
// 			i--;
// 		} else {
// 			j--;
// 		}
// 	}
// 	lcsIndices.reverse();
// 	return lcsIndices;
// }

// function backtrackLCS(dp, leftTokens, rightTokens) {
// 	let i = leftTokens.length;
// 	let j = rightTokens.length;
// 	const lcsIndices = [];

// 	while (i > 0 && j > 0) {
// 		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 			if (dp[i][j] === dp[i - 1][j - 1] + 1) {
// 				lcsIndices.push({ leftIndex: i - 1, rightIndex: j - 1, text: leftTokens[i - 1].text });
// 				i--;
// 				j--;
// 			} else {
// 				if (dp[i - 1][j] > dp[i][j - 1]) {
// 					i--;
// 				} else if (dp[i - 1][j] < dp[i][j - 1]) {
// 					j--;
// 				} else {
// 					i--;
// 				}
// 			}
// 		} else {
// 			if (dp[i - 1][j] > dp[i][j - 1]) {
// 				i--;
// 			} else {
// 				j--;
// 			}
// 		}
// 	}

// 	lcsIndices.reverse();
// 	return lcsIndices;
// }

//
// WEIGHTED LCS! meticulous하게 테스트 해볼 필요 있음.
//
// function computeLCS(leftTokens, rightTokens) {
// 	const m = leftTokens.length;
// 	const n = rightTokens.length;
// 	const dp = new Array(m + 1);
// 	const lcsIndices = [];

// 	for (let i = 0; i <= m; i++) {
// 		dp[i] = new Array(n + 1).fill(0);
// 	}

// 	for (let i = 1; i <= m; i++) {
// 		for (let j = 1; j <= n; j++) {
// 			if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 				let weight = 1;
// 				if (i > 1 && j > 1 && leftTokens[i - 2].text === rightTokens[j - 2].text) {
// 					weight += dp[i - 1][j - 1];
// 				}
// 				dp[i][j] = dp[i - 1][j - 1] + weight;
// 			} else {
// 				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
// 			}
// 		}
// 	}

// 	let i = m;
// 	let j = n;
// 	while (i > 0 && j > 0) {
// 		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 			lcsIndices.push({ leftIndex: i - 1, rightIndex: j - 1, text: leftTokens[i - 1].text });
// 			i--;
// 			j--;
// 		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
// 			i--;
// 		} else {
// 			j--;
// 		}
// 	}

// 	lcsIndices.reverse();
// 	return lcsIndices;
// }

async function computeLCS(leftTokens, rightTokens, ctx) {
	const m = leftTokens.length;
	const n = rightTokens.length;

	const dp = new Array(m + 1);
	//const consecutive = new Array(m + 1);
	for (let i = 0; i <= m; i++) {
		dp[i] = new Array(n + 1).fill(0);
		//consecutive[i] = new Array(n + 1).fill(0);
	}
	for (let i = 1; i <= m; i++) {
		const leftText = leftTokens[i - 1].text;
		for (let j = 1; j <= n; j++) {
			if (ctx && ((i + j) & 16383) === 0) {
				const now = performance.now();
				if (now - ctx.lastYield > 100) {
					ctx.lastYield = now;
					await new Promise((resolve) => setTimeout(resolve, 0));
					if (ctx.cancel) {
						throw new Error("cancelled");
					}
				}
			}

			const rightText = rightTokens[j - 1].text;
			if (leftText === rightText) {
				//consecutive[i][j] = consecutive[i - 1][j - 1] + 1;
				dp[i][j] = dp[i - 1][j - 1] + 1; // + consecutive[i][j];
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
				//consecutive[i][j] = 0;
			}
		}
	}

	let i = m;
	let j = n;
	const lcsIndices = [];
	while (i > 0 && j > 0) {
		// if (ctx && ((i + j) & 511) === 0) {
		// 	const now = performance.now();
		// 	if (now - ctx.lastYield > 100) {
		// 		ctx.lastYield = now;
		// 		await new Promise((resolve) => setTimeout(resolve, 0));
		// 		if (ctx.cancel) {
		// 			throw new Error("cancelled");
		// 		}
		// 	}
		// }
		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
			lcsIndices.push({
				leftIndex: i - 1,
				rightIndex: j - 1,
				//text: leftTokens[i - 1].text, // 필요하면 leftTokens[leftIndex]로 얻을 수 있음!
			});
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}
	lcsIndices.reverse();
	return lcsIndices;
}

// async function computeLCS(leftTokens, rightTokens, ctx) {
// 	const m = leftTokens.length;
// 	const n = rightTokens.length;

// 	const dp = new Array(m + 1);
// 	const consecutive = new Array(m + 1);
// 	for (let i = 0; i <= m; i++) {
// 		dp[i] = new Array(n + 1).fill(0);
// 		consecutive[i] = new Array(n + 1).fill(0);
// 	}

// 	for (let i = 1; i <= m; i++) {
// 		const leftText = leftTokens[i - 1].text;
// 		for (let j = 1; j <= n; j++) {
// 			if (j % 1023 === 0) {
// 				if (ctx && performance.now() - ctx.lastYield > 100) {
// 					ctx.lastYield = performance.now();
// 					await new Promise((resolve) => setTimeout(resolve, 0));
// 					if (ctx.cancel) {
// 						return null;
// 					}
// 				}
// 			}

// 			const rightText = rightTokens[j - 1].text;

// 			if (leftText === rightText) {
// 				consecutive[i][j] = consecutive[i - 1][j - 1] + 1; // 연속 매치 횟수 증가
// 				dp[i][j] = dp[i - 1][j - 1] + 1 + consecutive[i][j]; // 연속 매치에 가중치 부여
// 			} else {
// 				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
// 				consecutive[i][j] = 0;
// 			}
// 		}
// 	}

// 	let i = m;
// 	let j = n;
// 	const lcsIndices = [];
// 	while (i > 0 && j > 0) {
// 		if ((i + j) % 1023 === 0 && ctx && performance.now() - ctx.lastYield > 100) {
// 			ctx.lastYield = performance.now();
// 			await new Promise((resolve) => setTimeout(resolve, 0));
// 			if (ctx.cancel) {
// 				return null;
// 			}
// 		}
// 		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
// 			lcsIndices.push({ leftIndex: i - 1, rightIndex: j - 1, text: leftTokens[i - 1].text });
// 			i--;
// 			j--;
// 		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
// 			i--;
// 		} else {
// 			j--;
// 		}
// 	}

// 	lcsIndices.reverse();
// 	return lcsIndices;
// }

// function findLineEndPos(text, pos, maxPos, numLines = 1){
// 	while (pos < maxPos && numLines > 0) {
// 		if (text[pos] === "\n") {
// 			numLines--;
// 			if (numLines === 0) {
// 				break;
// 			}
// 		}
// 		pos++;
// 	}
// 	return pos;
// }

function skipCommonChars(leftTokens, leftTokenIndex, leftTokenCount, rightTokens, rightTokenIndex, rightTokenCount) {
	let i = leftTokenIndex;
	let j = rightTokenIndex;
	// 각 토큰의 text의 한글자 한글자를 비교

	let leftToken = leftTokens[i];
	let rightToken = rightTokens[j];
	let leftCharIndex = 0;
	let rightCharIndex = 0;
	let leftSkipped = 0;
	let rightSkipped = 0;
	while (leftToken && rightToken) {
		const leftText = leftToken.text[leftCharIndex];
		const rightText = rightToken.text[rightCharIndex];
		while (leftCharIndex < leftToken.text.length && rightCharIndex < rightToken.text.length) {
			if (leftText[leftCharIndex] !== rightText[rightCharIndex]) {
				break;
			}
			if (++leftCharIndex >= leftToken.text.length) {
				leftToken = leftTokens[++i];
				leftCharIndex = 0;
			}
		}
	}

	return { leftIndex: i, rightIndex: j };
}

async function computeDiff({
	leftText,
	rightText,
	leftInputPos = undefined,
	leftInputEnd = undefined,
	rightInputPos = undefined,
	rightInputEnd = undefined,
	leftTokens = undefined,
	rightTokens = undefined,
	method = DIFF_BY_WORD,
	ctx,
	skipFallback = false,
}) {
	const diffs = [],
		anchors = [];

	let now = performance.now();

	if (leftInputPos === undefined) {
		leftInputPos = 0;
	}
	if (leftInputEnd === undefined) {
		leftInputEnd = leftText.length;
	}
	if (rightInputPos === undefined) {
		rightInputPos = 0;
	}
	if (rightInputEnd === undefined) {
		rightInputEnd = rightText.length;
	}

	if (!leftTokens) {
		leftTokens = tokenize(leftText, method, leftInputPos, leftInputEnd);
	}
	if (!rightTokens) {
		rightTokens = tokenize(rightText, method, rightInputPos, rightInputEnd);
	}
	let elapsed = performance.now() - now;
	console.debug("Tokenize elapsed time:", elapsed, { leftTokens, rightTokens });

	now = performance.now();
	const lcs = await computeLCS(leftTokens, rightTokens, ctx);
	elapsed = performance.now() - now;
	console.debug("LCS elapsed time:", elapsed);

	if (ctx && ctx.cancel) {
		throw new Error("cancelled");
	}
	const lcsLength = lcs.length;
	const leftTokensLength = leftTokens.length;
	const rightTokensLength = rightTokens.length;
	// LCS에 비해 나머지 부분은 성능에 큰 영향을 미치지 않음.


	function addAnchor(type, leftPos, rightPos, diffIndex = null) {
		if (anchors.length > 0) {
			let lastAnchor = anchors[anchors.length - 1];
			while (lastAnchor.left > leftPos || lastAnchor.right > rightPos){
				console.warn("popping",Array.from(anchors), type, leftPos, rightPos)
				anchors.pop();
				lastAnchor = anchors[anchors.length - 1];
			}
			if (lastAnchor.left === leftPos || lastAnchor.right === rightPos) {
				if (type === lastAnchor.type || type === "before") {
					return;
				}
			}
		}
		anchors.push({ type, diffIndex, left: leftPos, right: rightPos });
	}

	if (leftTokensLength === 0 && rightTokensLength === 0) {
		//
	} else if (leftTokensLength === 0) {
		diffs.push({
			left: {
				pos: 0,
				len: 0,
				line: 1,
				lineEnd: 1,
				entireLines: true,
				empty: true,
			},
			right: {
				pos: rightTokens[0].pos,
				len: rightTokens[rightTokensLength - 1].pos + rightTokens[rightTokensLength - 1].len - rightTokens[0].pos,
				line: rightTokens[0].lineNum,
				lineEnd: rightTokens[rightTokensLength - 1].lineNum,
				entireLines: true,
			},
		});
	} else if (rightTokensLength === 0) {
		diffs.push({
			left: {
				pos: leftTokens[0].pos,
				len: leftTokens[leftTokensLength - 1].pos + leftTokens[leftTokensLength - 1].len - leftTokens[0].pos,
				line: leftTokens[0].lineNum,
				lineEnd: leftTokens[leftTokensLength - 1].lineNum,
				entireLines: true,
			},
			right: {
				pos: 0,
				len: 0,
				line: 1,
				lineEnd: 1,
				entireLines: true,
				empty: true,
			},
		});
	} else {
		let i = 0;
		let j = 0;
		let lcsIndex = 0;
		let lastYield = 0;
		let iteration = 0;

		while (lcsIndex < lcsLength || i < leftTokensLength || j < rightTokensLength) {
			if (ctx && (iteration & 1023) === 0) {
				const now = performance.now();
				if (now - ctx.lastYield > 100) {
					ctx.lastYield = now;
					await new Promise((resolve) => setTimeout(resolve, 0));
					if (ctx.cancel) {
						throw new Error("cancelled");
					}
				}
			}
			if (lcsIndex < lcsLength && i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex) {
				// if (lcsIndex < lcsLength && leftTokens[i].text === leftTokens[lcs[lcsIndex].leftIndex].text && rightTokens[j].text === rightTokens[lcs[lcsIndex].rightIndex].text) {
				const leftToken = leftTokens[i];
				const rightToken = rightTokens[j];
				if ((leftToken.flags & rightToken.flags & FIRST_OF_LINE) === FIRST_OF_LINE) {
					let leftAnchorPos = leftToken.pos;
					let rightAnchorPos = rightToken.pos;
					while (leftAnchorPos > 0 && leftText[leftAnchorPos - 1] !== "\n") {
						leftAnchorPos--;
					}
					while (rightAnchorPos > 0 && rightText[rightAnchorPos - 1] !== "\n") {
						rightAnchorPos--;
					}
					addAnchor("before", leftAnchorPos, rightAnchorPos);
				}
				i++;
				j++;
				lcsIndex++;
				continue; // 다음 순회로 건너뜀
			}

			let leftIndex = i;
			let leftCount = 0;
			let rightIndex = j;
			let rightCount = 0;

			while (i < leftTokensLength && (lcsIndex >= lcsLength || i < lcs[lcsIndex].leftIndex)) {
				// while (i < leftTokensLength && (lcsIndex >= lcsLength || leftTokens[i].text !== leftTokens[lcs[lcsIndex].leftIndex].text)) {
				leftCount++;
				i++;
			}

			while (j < rightTokensLength && (lcsIndex >= lcsLength || j < lcs[lcsIndex].rightIndex)) {
				// while (j < rightTokensLength && (lcsIndex >= lcsLength || rightTokens[j].text !== rightTokens[lcs[lcsIndex].rightIndex].text)) {
				rightCount++;
				j++;
			}

			let anchorBefore = false,
				anchorAfter = false;
			let leftPos, leftLen, rightPos, rightLen;
			let leftEmpty;
			let rightEmpty;
			let leftAnchorPos = null;
			let rightAnchorPos = null;

			if (leftCount > 0 && rightCount > 0) {
				leftPos = leftTokens[leftIndex].pos;
				leftLen = leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len - leftPos;
				leftEmpty = false;
				rightPos = rightTokens[rightIndex].pos;
				rightLen = rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len - rightPos;
				rightEmpty = false;
				anchorBefore = !!(leftTokens[leftIndex].flags & rightTokens[rightIndex].flags & FIRST_OF_LINE);
				anchorAfter = !!(leftTokens[leftIndex + leftCount - 1].flags & rightTokens[rightIndex + rightCount - 1].flags & LAST_OF_LINE);


				if (method > DIFF_BY_CHAR) {
					// console.log("try fallback", {
					// 	leftPos,
					// 	leftEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
					// 	rightPos,
					// 	rightEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
					// });
					const result = await computeDiff({
						leftText,
						rightText,
						leftInputPos: leftPos,
						leftInputEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						rightInputPos: rightPos,
						rightInputEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						method: method - 1,
						ctx,
						skipFallback: true,
					});

					// console.log("fallback result ", { result });

					// diff 결과가 1개 이하일 때에만 결과를 사용하고 그렇지 않은 경우는 무시하고 현재 method로 diff 생성.

					if (result.diffs.length <= 1) {
						const leftEnd = leftPos + leftLen;
						const rightEnd = rightPos + rightLen;
						for (const anchor of result.anchors) {
							if (anchor.left < leftEnd && anchor.right < rightEnd) {
								if (anchor.diffIndex !== null) {
									anchor.diffIndex += diffs.length;
								}
								addAnchor(anchor.type, anchor.left, anchor.right, anchor.diffIndex);
							}
						}
						for (const diff of result.diffs) {
							diffs.push(diff);
						}
						continue;
					}

					// for (const diff of result.diffs) {
					// 	diffs.push(diff);
					// }

					// console.log("fallback done");
					// continue;
				}
				// if (method !== DIFF_BY_CHAR) {
				// 	if (leftLen <= 40 && rightLen <= 40) {
				// 		let leftFragment = leftText.substring(leftPos, leftPos + leftLen).replace(/\s/g, "");
				// 		let rightFragment = rightText.substring(rightPos, rightPos + rightLen).replace(/\s/g, "");
				// 		if (leftFragment === rightFragment) {
				// 			leftIndex = rightIndex = 0;
				// 			leftCount = rightCount = 0;
				// 			continue;
				// 		}
				// 	}
				// }

				if (anchorBefore) {
					leftAnchorPos = leftPos;
					rightAnchorPos = rightPos;
					while (leftAnchorPos > 0 && leftText[leftAnchorPos - 1] !== "\n") {
						leftAnchorPos--;
					}
					while (rightAnchorPos > 0 && rightText[rightAnchorPos - 1] !== "\n") {
						rightAnchorPos--;
					}
				}

				if ((leftTokens[leftIndex].flags | rightTokens[rightIndex].flags) & FIRST_OF_LINE) {
					leftAnchorPos = leftPos;
					rightAnchorPos = rightPos;
					while (leftAnchorPos > 0 && leftText[leftAnchorPos - 1] !== "\n") {
						leftAnchorPos--;
					}
					while (rightAnchorPos > 0 && rightText[rightAnchorPos - 1] !== "\n") {
						rightAnchorPos--;
					}
					addAnchor("before", leftAnchorPos, rightAnchorPos);
					if (leftTokens[leftIndex].flags & rightTokens[rightIndex].flags & FIRST_OF_LINE) {
						if (leftTokens[leftIndex + leftCount - 1].flags & rightTokens[rightIndex + rightCount - 1].flags & LAST_OF_LINE) {
							leftAnchorPos = leftPos + leftLen;
							rightAnchorPos = rightPos + rightLen;
							// 줄바꿈 문자 위치까지 스킵

							if (leftText[leftAnchorPos] !== "\n") {
								do {
									leftAnchorPos++;
								} while (leftAnchorPos < leftText.length && leftText[leftAnchorPos] !== "\n");
							}
							if (rightText[rightAnchorPos] !== "\n") {
								do {
									rightAnchorPos++;
								} while (rightAnchorPos < rightText.length && rightText[rightAnchorPos] !== "\n");
							}

							// while (leftAnchorPos + 1 < leftText.length && leftText[leftAnchorPos + 1] !== "\n") {
							// 	leftAnchorPos++;
							// }
							// while (rightAnchorPos + 1 < rightText.length && rightText[rightAnchorPos + 1] !== "\n") {
							// 	rightAnchorPos++;
							// }
							addAnchor("after", leftAnchorPos, rightAnchorPos);
						}
					}
				}
			} else if (leftCount > 0 || rightCount > 0) {
				let longSideText, shortSideText;
				let longSideIndex, longSideCount, longSideTokens;
				let shortSideIndex, shortSideCount, shortSideTokens;
				let longSidePos, longSideLen;
				let shortSidePos, shortSideLen;
				let longSideStartPos, shortSideStart;
				let longSideEndPos, shortSideEnd;
				let longSideAnchorPos, shortSideAnchorPos;

				if (leftCount > 0) {
					longSideText = leftText;
					longSideTokens = leftTokens;
					longSideIndex = leftIndex;
					longSideCount = leftCount;
					shortSideText = rightText;
					shortSideTokens = rightTokens;
					shortSideIndex = rightIndex;
					shortSideCount = rightCount;
					longSideStartPos = leftInputPos;
					shortSideStart = rightInputPos;
					longSideEndPos = leftInputEnd;
					shortSideEnd = rightInputEnd;
				} else {
					longSideText = rightText;
					longSideTokens = rightTokens;
					longSideIndex = rightIndex;
					longSideCount = rightCount;
					shortSideText = leftText;
					shortSideTokens = leftTokens;
					shortSideIndex = leftIndex;
					shortSideCount = leftCount;
					longSideStartPos = rightInputPos;
					shortSideStart = leftInputPos;
					longSideEndPos = rightInputEnd;
					shortSideEnd = leftInputEnd;
				}

				longSidePos = longSideTokens[longSideIndex].pos;
				longSideLen = longSideTokens[longSideIndex + longSideCount - 1].pos + longSideTokens[longSideIndex + longSideCount - 1].len - longSidePos;
				shortSideLen = 0;
				const longSideIsFirstWord = longSideTokens[longSideIndex].flags & FIRST_OF_LINE;
				const longSideIsLastWord = longSideTokens[longSideIndex + longSideCount - 1].flags & LAST_OF_LINE;
				const shortSideIsOnLineEdge =
					shortSideTokens.length === 0 ||
					(shortSideIndex > 0 && shortSideTokens[shortSideIndex - 1].flags & FIRST_OF_LINE) ||
					(shortSideIndex < shortSideTokens.length && shortSideTokens[shortSideIndex].flags & FIRST_OF_LINE);
				anchorBefore = longSideIsFirstWord && shortSideIsOnLineEdge;
				anchorAfter = longSideIsLastWord && shortSideIsOnLineEdge;

				// base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
				shortSidePos = shortSideIndex > 0 ? shortSideTokens[shortSideIndex - 1].pos + shortSideTokens[shortSideIndex - 1].len : shortSideStart;

				// 참고:
				// 만약 shortSidePos가 줄의 시작 위치로 정해진다면(\n 위치의 +1) shortSideAnchorPos도 같은 값을 사용할 수 있다.
				// 그렇지 않은 경우에는 앞쪽 공백을 다 스킵해서 shortSideAnchorPos를 찾아야 한다.
				if (shortSideIsOnLineEdge) {
					if (longSideIsFirstWord) {
						// longside는 블럭 diff다. shortside도 가능하다면 빈줄을 찾아서 찾아서 독식하자.
						// 현재 shortsidepos는 이전 블럭의 끝이므로 이후에 줄바꿈이 두개 나오면 된다

						if (shortSideIndex > 0 && shortSideIndex < shortSideTokens.length) {
							// 이전 토큰과 다음 토큰 사이에 있으므로 lineNum을 확인하면 된다.
							if (shortSideTokens[shortSideIndex].lineNum > shortSideTokens[shortSideIndex - 1].lineNum) {
								// 이전 토큰과 다음 토큰 사이에 빈줄이 있다.
								while (shortSideText[shortSidePos++] !== "\n") {}
								shortSideAnchorPos = shortSidePos;
							} else {
								// do not even try
							}
						} else if (shortSideIndex > 0) {
							// 현재 pos는 이전 토큰의 끝이므로 그 이후 첫번째 줄바꿈 위치를 찾아서 +1한 자리로.
							// 줄바꿈은 무조건 있다. 내가 텍스트를 그렇게 만들거니까.
							while (shortSideText[shortSidePos++] !== "\n") {}
						} else {
							// 이전 토큰은 없지만 이게 텍스트의 시작은 아닐 수도 있다. - 텍스트 중간 부분에서 diff를 구하는 경우.
							// 일단 현재 pos이전에 첫번째 줄바꿈을 찾되 도중에 공백이 아닌 문자를 만나면 포기
							// 첫번째 줄바꿈에서 끝내지말고고 계속 찾아서 최대한 위로 끌어올리기.
							if (shortSidePos === 0) {
								shortSideAnchorPos = shortSidePos;
							} else {
								let p = shortSidePos;
								let success = false;
								while (p > 0) {
									const ch = shortSideText[p - 1];
									if (ch === "\n") {
										shortSidePos = shortSideAnchorPos = p;
										success = true;
									} else if (!SPACE_CHARS[ch]) {
										break;
									}
									p--;
								}
								if (p === 0) {
									shortSidePos = shortSideAnchorPos = 0;
									success = true;
								}
								if (!success) {
									p = shortSidePos;
									while (p < shortSideText.length) {
										if (shortSideText[p] === "\n") {
											shortSidePos = p + 1;
											shortSideAnchorPos = shortSidePos;
											break;
										}
										if (!SPACE_CHARS[shortSideText[p++]]) {
											break;
										}
									}
								}
								// while (p >= 0) {
								// 	if (shortSideText[p] === "\n") {
								// 		console.log(7);
								// 		shortSidePos = p + 1;
								// 		shortSideAnchorPos = shortSidePos;
								// 		success = true;
								// 		p--;
								// 		continue;
								// 		// keep going.
								// 	}
								// 	if (!SPACE_CHARS[shortSideText[p--]]) {
								// 		break;
								// 	}
								// }
								// if (!success) {
								// 	p = shortSidePos;
								// 	while (p < shortSideEnd) {
								// 		if (shortSideText[p] === "\n") {
								// 			console.log(8);
								// 			shortSidePos = p + 1;
								// 			shortSideAnchorPos = shortSidePos;
								// 			break;
								// 		}
								// 		if (!SPACE_CHARS[shortSideText[p++]]) {
								// 			break;
								// 		}
								// 	}
								// }
							}
						}
					}
				}

				if (longSideIsFirstWord) {
					longSideAnchorPos = longSidePos;
					while (longSideAnchorPos > 0 && longSideText[longSideAnchorPos - 1] !== "\n") {
						longSideAnchorPos--;
					}
					if (shortSideAnchorPos !== undefined) {
						shortSideAnchorPos = shortSidePos;
						while (shortSideAnchorPos > 0 && shortSideText[shortSideAnchorPos - 1] !== "\n") {
							shortSideAnchorPos--;
						}
					}
					if (leftCount > 0) {
						[leftAnchorPos, rightAnchorPos] = [longSideAnchorPos, shortSideAnchorPos];
					} else {
						[leftAnchorPos, rightAnchorPos] = [shortSideAnchorPos, longSideAnchorPos];
					}
					addAnchor("before", leftAnchorPos, rightAnchorPos);

					if (longSideIsLastWord && shortSideIsOnLineEdge) {
						longSideAnchorPos = longSidePos + longSideLen;
						while (longSideAnchorPos < longSideEndPos && longSideText[longSideAnchorPos] !== "\n") {
							longSideAnchorPos++;
						}
						shortSideAnchorPos = shortSidePos + shortSideLen;
						// 이후 이어지는 공백 문자 중 마지막 공백 문자 자리에서 AFTER 앵커

						while (shortSideAnchorPos < shortSideEnd) {
							if (shortSideText[shortSideAnchorPos] === "\n") {
								break;
							}
							if (!SPACE_CHARS[shortSideText[shortSideAnchorPos]]) {
								break;
							}
							shortSideAnchorPos++;
						}
						if (leftCount > 0) {
							[leftAnchorPos, rightAnchorPos] = [longSideAnchorPos, shortSideAnchorPos];
						} else {
							[leftAnchorPos, rightAnchorPos] = [shortSideAnchorPos, longSideAnchorPos];
						}
						addAnchor("after", leftAnchorPos, rightAnchorPos);
					}
				}
				if (leftCount > 0) {
					leftPos = longSidePos;
					leftLen = longSideLen;
					leftEmpty = false;
					rightPos = shortSidePos;
					rightLen = shortSideLen;
					rightEmpty = true;
				} else {
					leftPos = shortSidePos;
					leftLen = shortSideLen;
					leftEmpty = true;
					rightPos = longSidePos;
					rightLen = longSideLen;
					rightEmpty = false;
				}
			} else {
				throw new Error("WTF? both leftCount and rightCount are 0");
			}

			// if (anchorBefore) {
			// 	anchors.push({
			// 		type: "before",
			// 		diffIndex: diffs.length,
			// 		left: leftPos,
			// 		right: rightPos,
			// 	});
			// }
			// if (anchorAfter) {
			// 	anchors.push({
			// 		type: "after",
			// 		diffIndex: diffs.length,
			// 		left: leftPos + leftLen,
			// 		right: rightPos + rightLen,
			// 	});
			// }
			diffs.push({
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
			});
		}
	}

	console.debug("computeDiff done", { diffs, anchors });
	return { diffs, anchors };
}
