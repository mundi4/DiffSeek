"use strict";

const DIFF_BY_CHAR = 1;
const DIFF_BY_WORD = 2;
const DIFF_BY_LINE = 3;
const TOKEN_CACHE_SIZE = 2;

// token flags
const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
const NORMALIZE = 32; // &middot;, 따옴표 -, 말머리문자 등등 실제로 문자 코드는 다르지만 같다고 처리해야 할 문자들이 있다.

const SPACE_CHARS = {
	" ": true,
	"\t": true,
	"\n": true,
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
};

const normalizeChars = {};

//let greedyMatch = false;

function insertNormalizeChar(chars) {
	const norm = chars[0];
	normalizeChars[norm] = norm;
	for (let i = 1; i < chars.length; i++) {
		normalizeChars[chars[i]] = norm;
	}
}

// const decoder = new TextDecoder();
let _nextWork = null;
let _currentWork = null;

const tokenCache = {
	[DIFF_BY_CHAR]: [],
	[DIFF_BY_WORD]: [],
	[DIFF_BY_LINE]: [],
};

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

// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
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
			leftText: e.data.left,
			rightText: e.data.right,
			...e.data.options,
			cancel: false,
		};
		if (_currentWork) {
			_currentWork.cancel = true;
			_nextWork = work;
			return;
		}
		runDiff(work);
	} else if (e.data.type === "normalizeChars") {
		insertNormalizeChar(e.data.chars);
		// } else if (e.data.type === "option") {
		// 	if (e.data.key === "greedyMatch") {
		// 		greedyMatch = e.data.value;
		// 	}
	}
};

async function runDiff(work) {
	_currentWork = work;
	// const leftText = decoder.decode(work.left);
	// const rightText = decoder.decode(work.right);
	// const leftText = work.left;
	// const rightText = work.right;
	try {
		work.lastYield = work.start = performance.now();
		self.postMessage({
			reqId: work.reqId,
			type: "start",
			start: work.start,
		});
		const results = await computeDiff({
			...work,
			ctx: work,
		});
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
			// console.debug("Diff canceled");
		}
	} catch (e) {
		if (e.message === "cancelled") {
			// console.debug("Diff canceled");
		} else {
			console.error(e);
		}
	}
	[work, _nextWork] = [_nextWork, null];
	if (work) {
		return await runDiff(work);
	}
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

function normalize(text) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		result += normalizeChars[char] || char;
	}
	return result;
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
		let char = input[i];
		// 문장부호를 별개로 단어로 분리하는 방법도 생각해볼 필요가 있음.
		// 문제는 (hello)와 (world)에서 '('만 매치되면 눈이 피곤해진다. 괄호안의 문자들이 여러줄이면 더더욱..
		if (SPACE_CHARS[char]) {
			if (currentStart !== -1) {
				flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
				tokens.push({
					text: flags & NORMALIZE ? normalize(input.substring(currentStart, i)) : input.substring(currentStart, i),
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
			if (normalizeChars[char]) {
				flags |= NORMALIZE;
				char = normalizeChars[char];
			}
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
			text: flags & NORMALIZE ? normalize(input.substring(currentStart)) : input.substring(currentStart),
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
					text: input.substring(currentStart, currentEnd).trim(),
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
			text: input.substring(currentStart, currentEnd).trim(),
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

async function computeLCS(leftTokens, rightTokens, ctx) {
	const m = leftTokens.length;
	const n = rightTokens.length;

	const dp = new Array(m + 1);
	for (let i = 0; i <= m; i++) {
		dp[i] = new Array(n + 1).fill(0);
	}

	// 텍스트가 길어지는 경우(토큰이 많은 경우) 끔찍하게 많은 반복을 수행하게된다.
	for (let i = 1; i <= m; i++) {
		const leftText = leftTokens[i - 1].text;
		for (let j = 1; j <= n; j++) {
			// 주기적으로 yield 해서 취소요청을 받아야함.
			// performance.now()는 미친게 아닌가 싶을 정도로 무거운 함수이기 때문에 되도록 자제.
			// await new Promise(...) 역시 자주 사용하면 안됨
			// (i+j) % 0x4000 === 0 일 때만 사용하기로. 브라우저 js엔진의 비트연산 속도를 믿어본다 ㅋ
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

			if (leftText === rightTokens[j - 1].text) {
				dp[i][j] = dp[i - 1][j - 1] + 1; // + consecutive[i][j];
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	let i = m;
	let j = n;
	const lcsIndices = [];
	while (i > 0 && j > 0) {
		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
			lcsIndices.push({
				leftIndex: i - 1,
				rightIndex: j - 1,
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

async function computeDiff({
	leftText,
	rightText,
	leftInputPos = undefined,
	leftInputEnd = undefined,
	rightInputPos = undefined,
	rightInputEnd = undefined,
	// leftTokens = undefined,
	// rightTokens = undefined,
	method = DIFF_BY_WORD,
	greedyMatch = false,
	useFallback = false,
	ctx,
}) {
	//console.log("computeDiff", { leftText, rightText, leftInputPos, leftInputEnd, rightInputPos, rightInputEnd, method, greedyMatch, useFallback });

	// 앵커라는 이름도 구현 방식도 사실 좀 마음에 안들지만
	// 양쪽 텍스트에서 공통 부분(diff가 아닌 부분)을 서로 대응시킬 만한 딱히 좋은 수가 없음
	const diffs = [],
		anchors = [];

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

	const leftTokens = tokenize(leftText, method, leftInputPos, leftInputEnd);
	const rightTokens = tokenize(rightText, method, rightInputPos, rightInputEnd);

	if (leftText === rightText) {
		for (let i = 0; i < leftTokens.length; i++) {
			const token = leftTokens[i];
			if (token.flags & FIRST_OF_LINE) {
				let anchorPos = token.pos;
				while (anchorPos > 0 && leftText[anchorPos - 1] !== "\n") {
					anchorPos--;
				}
				addAnchor("before", anchorPos, anchorPos);
			}
		}
		return { diffs, anchors };
	}

	// console.log("tokens:", { leftTokens, rightTokens });

	const lcs = await computeLCS(leftTokens, rightTokens, ctx);
	const lcsLength = lcs.length;
	const leftTokensLength = leftTokens.length;
	const rightTokensLength = rightTokens.length;

	// 앵커 추가는 나중에 한번에 처리하고 싶은데
	// common sequence인 경우 대응하는 반대쪽 토큰에 대한 정보가 필요하므로 쉽지 않음.
	// 결국 서로 대응하는 토큰 쌍을 저장해놔야하는데 그러면 앵커를 나중에 추가하는게 무슨 의미?
	function addAnchor(type, leftPos, rightPos, diffIndex = null) {
		if (leftPos === undefined || rightPos === undefined) {
			console.error("addAnchor", { type, leftPos, rightPos, diffIndex });
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
		anchors.push({ type, diffIndex, left: leftPos, right: rightPos });
	}

	if (leftTokensLength === 0 && rightTokensLength === 0) {
		// 딱히 할 수 있는게 없다.
	} else if (leftTokensLength === 0) {
		diffs.push({
			left: {
				pos: leftInputPos,
				len: 0,
				empty: true,
			},
			right: {
				pos: rightTokens[0].pos,
				len: rightTokens[rightTokensLength - 1].pos + rightTokens[rightTokensLength - 1].len - rightTokens[0].pos,
				line: rightTokens[0].lineNum,
			},
		});
	} else if (rightTokensLength === 0) {
		diffs.push({
			left: {
				pos: leftTokens[0].pos,
				len: leftTokens[leftTokensLength - 1].pos + leftTokens[leftTokensLength - 1].len - leftTokens[0].pos,
			},
			right: {
				pos: rightInputPos,
				len: 0,
				empty: true,
			},
		});
	} else {
		let i = 0;
		let j = 0;
		let lcsIndex = 0;
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
			if (
				lcsIndex < lcsLength &&
				((greedyMatch &&
					leftTokens[i].text === leftTokens[lcs[lcsIndex].leftIndex].text &&
					rightTokens[j].text === rightTokens[lcs[lcsIndex].rightIndex].text) ||
					(i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex))
			) {
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
				continue;
			}

			const lcsEntry = lcs[lcsIndex];
			let leftIndex = i;
			let leftCount = 0;
			let rightIndex = j;
			let rightCount = 0;

			// greedyMatch인 경우 최대한 공통부분을 일찍/많이 잡아먹어야하므로
			// diff는 최대한 적게 잡아먹어야함. 맞...지..?

			while (
				i < leftTokensLength && // 유효한 토큰 index
				(!lcsEntry || // 공통 sequence가 없는 경우
					(!greedyMatch && i < lcsEntry.leftIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
					leftTokens[i].text !== leftTokens[lcsEntry.leftIndex].text) // or 텍스트가 같으면 바로 중단
			) {
				leftCount++;
				i++;
			}

			while (
				j < rightTokensLength && // 유효한 토큰 index
				(!lcsEntry || // 공통 sequence가 없는 경우
					(!greedyMatch && j < lcsEntry.rightIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
					rightTokens[j].text !== rightTokens[lcsEntry.rightIndex].text) // or 텍스트가 같으면 바로 중단
			) {
				rightCount++;
				j++;
			}

			if (leftCount > 0 && rightCount > 0) {
				if (useFallback && method > DIFF_BY_WORD) {
					const result = await computeDiff({
						leftText,
						rightText,
						leftInputPos: leftTokens[leftIndex].pos,
						leftInputEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						rightInputPos: rightTokens[rightIndex].pos,
						rightInputEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						method: DIFF_BY_WORD,
						greedyMatch,
						useFallback: useFallback,
						ctx,
					});
					for (const anchor of result.anchors) {
						if (anchor.diffIndex !== null) {
							anchor.diffIndex += diffs.length;
						}
						addAnchor(anchor.type, anchor.left, anchor.right, diffs.length);
					}
					for (const diff of result.diffs) {
						diffs.push(diff);
					}
					continue;
				} else if (method > DIFF_BY_CHAR) {
					// 단어 사이에서 예기치 않은 공백이 나오는 경우가 왕왕 있다.
					// 게다가 우리말은 띄어쓰기를 해도 맞고 안해도 맞는 것 같은 느낌적인 느낌의 느낌이 느껴지는 경우가 많은 느낌이다!!!
					// FALLBACK으로 글자단위 비교를 하고 그 결과를 최종결과에 넣어버리는 방법을 써도 되지만
					// 글자단위 DIFF는 오히려 사람의 눈에는 더 불편함.

					// 문제: [diff0] abc [diff1] vs [diff0] a bc [diff1] 같은 경우 "abc" vs "a bc"도 diff로 처리됨.
					// > diff0에서부터 diff1 범위까지를 몽땅 diff 범위로 묶어버렸기 때문에 abc vs a bc를 별개로 비교하지 못함.
					// > 그렇다고 토큰 하나씩 따로따로 처리를 하면 시작부분부터 "ab cd" vs "abcd" 같은걸 처리하지 못함(ab vs abcd 비교를 하게되기 때문에)
					// 그래도 diff를 diff가 아닌 걸로 표시하는 게 아니라라 diff가 아닌 걸 diff로 표시하는 거니까 큰 문제가 되지는 않을 것...
					const result = await computeDiff({
						leftText,
						rightText,
						leftInputPos: leftTokens[leftIndex].pos,
						leftInputEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						rightInputPos: rightTokens[rightIndex].pos,
						rightInputEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						method: DIFF_BY_CHAR,
						useFallback: false,
						ctx,
					});

					if (result.diffs.length === 0) {
						continue;
					}

					// 글자단위로 표시하면 오히려 눈깔 빠진다.
					// 공백무시 글자단위로 비교에서도 두 문자열이 같지 않다는 것은 알았으니 기존 토큰을 기준으로 diff를 만든다.
				}
			}

			// 조금씩 수정하다가 난장판이 된 부분인데 섣불리 손대고 싶지 않다... ㅋ

			let leftPos, leftLen, rightPos, rightLen;
			let leftEmpty;
			let rightEmpty;
			let leftAnchorPos = null;
			let rightAnchorPos = null;

			let anchorBefore = false,
				anchorAfter = false;

			if (leftCount > 0 && rightCount > 0) {
				leftPos = leftTokens[leftIndex].pos;
				leftLen = leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len - leftPos;
				leftEmpty = false;
				rightPos = rightTokens[rightIndex].pos;
				rightLen = rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len - rightPos;
				rightEmpty = false;
				anchorBefore = !!(leftTokens[leftIndex].flags & rightTokens[rightIndex].flags & FIRST_OF_LINE);
				anchorAfter = !!(leftTokens[leftIndex + leftCount - 1].flags & rightTokens[rightIndex + rightCount - 1].flags & LAST_OF_LINE);

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
				// 이렇게까지 장황하게 만들어야되나 싶은데 더이상은 손대기 싫은 부분...

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
							// 마지막 토큰 이후에도 줄바꿈은 무조건 하나 이상 있다. 내가 텍스트를 강제로 그렇게 만들거니까.
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
							}
						}
					}
				}

				if (longSideIsFirstWord) {
					if (shortSideAnchorPos !== undefined) {
						shortSideAnchorPos = shortSidePos;
						while (shortSideAnchorPos > 0 && shortSideText[shortSideAnchorPos - 1] !== "\n") {
							shortSideAnchorPos--;
						}

						longSideAnchorPos = longSidePos;
						while (longSideAnchorPos > 0 && longSideText[longSideAnchorPos - 1] !== "\n") {
							longSideAnchorPos--;
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
				throw new Error("WTF just happened?");
			}

			// 빈 diff일 경우에도 하나 이상의 공백(줄바꿈) 위치를 차지할 수 있게 하려고 empty 속성을 추가했는데
			// 쓰지도 않는다. 그리고 적절한 공백을 할당시켜 주는 코드가 정말 지랄같음.
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

	// console.debug("computeDiff done", { diffs, anchors });
	return { diffs, anchors };
}
