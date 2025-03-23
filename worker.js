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

function tokenizeByChar(input, inputPos = null, inputEnd = null, baseLineNum = null) {
	const tokens = [];
	let lineCount = 0;
	let flags = 0;
	if (inputPos === null) {
		inputPos = 0;
	}
	if (inputEnd === null) {
		inputEnd = input.length;
	}
	if (baseLineNum === null) {
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

function tokenizeByWord(input, inputPos = null, inputEnd = null, baseLineNum = null) {
	const tokens = [];
	let currentStart = -1;
	let lineCount = 0;
	let flags = 0;
	if (inputPos === null) {
		inputPos = 0;
	}
	if (inputEnd === null) {
		inputEnd = input.length;
	}
	if (baseLineNum === null) {
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

function tokenizeByLine(input, inputPos = null, inputEnd = null, baseLineNum = null) {
	const tokens = [];
	let currentStart = -1;
	let currentEnd = -1;
	let lineCount = 0;
	if (inputPos === null) {
		inputPos = 0;
	}
	if (inputEnd === null) {
		inputEnd = input.length;
	}
	if (baseLineNum === null) {
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

function tokenize(input, method, inputPos = null, inputEnd = null, baseLineNum = null) {
	const cacheArr = tokenCache[method];
	if (cacheArr) {
		// for (let i = 0; i < cacheArr.length; i++) {
		// 	const token = cacheArr[i];
		// 	if (token.text === input) {
		// 		if (i !== cacheArr.length - 1) {
		// 			cacheArr.splice(i, 1);
		// 			cacheArr.push(token);
		// 		}
		// 		return token.tokens;
		// 	}
		// }
	}

	const tokens =
		method === DIFF_BY_CHAR
			? tokenizeByChar(input, inputPos, inputEnd, baseLineNum)
			: method === DIFF_BY_LINE
			? tokenizeByLine(input, inputPos, inputEnd, baseLineNum)
			: tokenizeByWord(input, inputPos, inputEnd, baseLineNum);

	tokens.push({
		text: "",
		pos: input.length,
		len: 0,
		lineNum: tokens.length > 0 ? tokens[tokens.length - 1].lineNum : 1,
		flags: FIRST_OF_LINE | LAST_OF_LINE,
	});

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

function findLineStartPos(text, pos) {
	while (pos > 0 && text[pos - 1] !== "\n") {
		pos--;
	}
	return pos;
}

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

async function computeDiff({ leftText, rightText, leftTokens = undefined, rightTokens = undefined, method = DIFF_BY_WORD, ctx, skipFallback = false }) {
	const diffs = [],
		anchors = [];

	let now = performance.now();
	if (!leftTokens) {
		leftTokens = tokenize(leftText, method);
	}
	if (!rightTokens) {
		rightTokens = tokenize(rightText, method);
	}
	let elapsed = performance.now() - now;
	console.debug("Tokenize elapsed time:", elapsed);

	now = performance.now();
	const lcs = await computeLCS(leftTokens, rightTokens, ctx);
	elapsed = performance.now() - now;
	console.debug("LCS elapsed time:", elapsed);

	if (ctx && ctx.cancel) {
		throw new Error("cancelled");
	}
	const lcsLength = lcs.length;
	const leftTokensLength = leftTokens.length - 1;
	const rightTokensLength = rightTokens.length - 1;

	// LCS에 비해 나머지 부분은 성능에 큰 영향을 미치지 않음.

	if (leftTokensLength === 0 && rightTokensLength === 0) {
		//
	} else if (leftTokensLength === 0) {
		diffs.push({
			type: "diff",
			align: true,
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
			type: "diff",
			align: true,
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
				const leftToken = leftTokens[i];
				const rightToken = rightTokens[j];
				if ((leftToken.flags & rightToken.flags & FIRST_OF_LINE) === FIRST_OF_LINE) {
					anchors.push({
						type: "before",
						diffIndex: null,
						left: leftToken.pos,
						right: rightToken.pos,
					});
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
				leftCount++;
				i++;
			}

			while (j < rightTokensLength && (lcsIndex >= lcsLength || j < lcs[lcsIndex].rightIndex)) {
				rightCount++;
				j++;
			}

			let align = false;
			let leftPos, leftLen, leftLine, leftLineEnd, rightPos, rightLen, rightLine, rightLineEnd;
			let leftEmpty = leftCount === 0;
			let rightEmpty = rightCount === 0;
			let leftEntireLines = false;
			let rightEntireLines = false;
			let leftIsFirstWord, leftIsLastWord, rightIsBeforeFirstWord, rightIsAfterLastWord;

			if (leftCount > 0 && rightCount > 0) {
				leftPos = leftTokens[leftIndex].pos;
				leftLen = leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len - leftPos;
				leftLine = leftTokens[leftIndex].lineNum;
				leftLineEnd = leftTokens[leftIndex + leftCount - 1].lineNum;
				leftEntireLines =
					leftIndex === 0 || (leftTokens[leftIndex].flags & FIRST_OF_LINE && leftTokens[leftIndex + leftCount - 1].flags & LAST_OF_LINE);
				rightPos = rightTokens[rightIndex].pos;
				rightLen = rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len - rightPos;
				rightLine = rightTokens[rightIndex].lineNum;
				rightLineEnd = rightTokens[rightIndex + rightCount - 1].lineNum;
				rightEntireLines = rightTokens[rightIndex].flags & FIRST_OF_LINE && rightTokens[rightIndex + rightCount - 1].flags & LAST_OF_LINE;
				align = !!(leftTokens[leftIndex].flags && rightTokens[rightIndex].flags && FIRST_OF_LINE);

				if (method > DIFF_BY_CHAR) {
					const leftTokens2 = tokenize(
						leftText,
						method - 1,
						leftPos,
						leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						leftLine
					);
					const rightTokens2 = tokenize(
						rightText,
						method - 1,
						rightPos,
						rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						rightLine
					);
					const result = await computeDiff({
						leftText,
						rightText,
						leftTokens: leftTokens2,
						rightTokens: rightTokens2,
						method: method - 1,
						ctx,
						skipFallback: true,
					});
					if (result.diffs.length === 0) {
						for (const anchor of result.anchors) {
							if (anchor.diffIndex !== null) {
								anchor.diffIndex += diffs.length;
							}
							anchors.push(anchor);
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
			} else if (leftCount > 0 || rightCount > 0) {
				//
				// 추가 또는 삭제 한쪽만 있는 경우
				//

				let longSideText, shortSideText;
				let longSideIndex, longSideCount, longSideTokens;
				let shortSideIndex, shortSideCount, shortSideTokens;
				let longSidePos, longSideLen;
				let shortSidePos, shortSideLen;
				let longSideLine, longSideLineEnd, shortSideLine, shortSideLineEnd;
				let longSideEntireLines = false,
					shortSideEntireLines = false;
				let longSideIsFirstWord, longSideIsLastWord, shortSideIsBeforeFirstWord, shortSideIsAfterLastWord;

				if (leftCount > 0) {
					longSideText = leftText;
					longSideTokens = leftTokens;
					longSideIndex = leftIndex;
					longSideCount = leftCount;
					shortSideText = rightText;
					shortSideTokens = rightTokens;
					shortSideIndex = rightIndex;
					shortSideCount = rightCount;
				} else {
					longSideText = rightText;
					longSideTokens = rightTokens;
					longSideIndex = rightIndex;
					longSideCount = rightCount;
					shortSideText = leftText;
					shortSideTokens = leftTokens;
					shortSideIndex = leftIndex;
					shortSideCount = leftCount;
				}

				longSidePos = longSideTokens[longSideIndex].pos; //longSideIndex > 0 ? longSideTokens[longSideIndex - 1].pos + longSideTokens[longSideIndex - 1].len : 0;
				longSideLen = longSideTokens[longSideIndex + longSideCount - 1].pos + longSideTokens[longSideIndex + longSideCount - 1].len - longSidePos;
				longSideLine = longSideTokens[longSideIndex].lineNum;
				longSideLineEnd = longSideTokens[longSideIndex + longSideCount - 1].lineNum;
				longSideIsFirstWord = longSideTokens[longSideIndex].flags & FIRST_OF_LINE;
				longSideIsLastWord = longSideTokens[longSideIndex + longSideCount - 1].flags & LAST_OF_LINE;
				longSideEntireLines = longSideIsFirstWord && longSideIsLastWord;

				shortSideIsBeforeFirstWord =
					shortSideIndex === 0 || (shortSideIndex < shortSideTokens.length && shortSideTokens[shortSideIndex].flags & FIRST_OF_LINE);
				shortSideIsAfterLastWord =
					shortSideIndex === shortSideTokens.length || (shortSideIndex > 0 && shortSideTokens[shortSideIndex - 1].flags & LAST_OF_LINE);
				shortSidePos = shortSideTokens[shortSideIndex].pos; //shortSideIndex > 0 ? shortSideTokens[shortSideIndex - 1].pos + shortSideTokens[shortSideIndex - 1].len : 0;
				shortSideIsBeforeFirstWord = checkIfFirstOfLine(shortSideText, shortSidePos)
				shortSideIsAfterLastWord = shortSideIndex === 0 || shortSideTokens[shortSideIndex - 1].flags & LAST_OF_LINE;

				shortSideLen = 0;
				align = longSideEntireLines && (shortSideIsBeforeFirstWord || shortSideIsAfterLastWord);

				if (shortSideIsBeforeFirstWord || shortSideIsAfterLastWord) {
					if (longSideIsFirstWord) {
						// short side 위치를 가능하면 줄의 시작 위치로.
						if (shortSideIndex === 0) {
							shortSidePos = 0;
							shortSideLine = 1;
						} else {
							// 다음줄의 시작pos
							shortSidePos = shortSideTokens[shortSideIndex - 1].pos + shortSideTokens[shortSideIndex - 1].len;
							shortSideLine = shortSideTokens[shortSideIndex - 1].lineNum;
							const end = shortSideIndex < shortSideTokens.length ? shortSideTokens[shortSideIndex].pos : shortSideText.length;
							let p = shortSidePos;
							while (p < end) {
								if (shortSideText[p] === "\n") {
									shortSidePos = p + 1;
									shortSideLine++;
									break;
								}
								p++;
							}
						}
					} else if (longSideIsLastWord) {
						if (shortSideIndex > 0) {
							shortSidePos = shortSideTokens[shortSideIndex - 1].pos + shortSideTokens[shortSideIndex - 1].len;
							shortSideLine = shortSideTokens[shortSideIndex - 1].lineNum;
						} else {
							shortSidePos = 0;
							shortSideLine = 1;
						}
					}
				} else {
					// middle of line

					if (shortSideIndex < shortSideTokens.length) {
						shortSidePos = shortSideTokens[shortSideIndex].pos;
						shortSideLine = shortSideTokens[shortSideIndex].lineNum;
					} else {
						// 이전 토큰의 마지막에
						shortSidePos = shortSideTokens[shortSideIndex - 1].pos + shortSideTokens[shortSideIndex - 1].len;
						shortSideLine = shortSideTokens[shortSideIndex - 1].lineNum;
					}
				}

				shortSideLineEnd = shortSideLine;
				shortSideEntireLines = longSideEntireLines && shortSideIsBeforeFirstWord && shortSideIsAfterLastWord;
				if (leftCount > 0) {
					leftPos = longSidePos;
					leftLen = longSideLen;
					leftLine = longSideLine;
					leftLineEnd = longSideLineEnd;
					leftEntireLines = longSideEntireLines;
					leftIsFirstWord = longSideIsFirstWord;
					leftIsLastWord = longSideIsLastWord;
					rightPos = shortSidePos;
					rightLen = shortSideLen;
					rightLine = shortSideLine;
					rightLineEnd = shortSideLineEnd;
					rightEntireLines = shortSideEntireLines;
					rightIsBeforeFirstWord = shortSideIsBeforeFirstWord;
					rightIsAfterLastWord = shortSideIsAfterLastWord;
				} else {
					leftPos = shortSidePos;
					leftLen = shortSideLen;
					leftLine = shortSideLine;
					leftLineEnd = shortSideLineEnd;
					leftEntireLines = shortSideEntireLines;
					leftIsFirstWord = shortSideIsBeforeFirstWord;
					leftIsLastWord = shortSideIsAfterLastWord;
					rightPos = longSidePos;
					rightLen = longSideLen;
					rightLine = longSideLine;
					rightLineEnd = longSideLineEnd;
					rightEntireLines = longSideEntireLines;
					rightIsBeforeFirstWord = longSideIsFirstWord;
					rightIsAfterLastWord = longSideIsLastWord;
				}
			} else {
				throw new Error("WTF?");
			}

			if (leftIsFirstWord && rightIsBeforeFirstWord) {
				anchors.push({
					type: "before",
					diffIndex: diffs.length,
					left: leftPos,
					right: rightPos,
				});
			}

			diffs.push({
				align,
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

			if (leftIsLastWord && rightIsAfterLastWord) {
				anchors.push({
					type: "after",
					diffIndex: diffs.length - 1,
					left: leftPos + leftLen,
					right: rightPos + rightLen,
				});
			}
		}
	}

	return { diffs, anchors };
}
