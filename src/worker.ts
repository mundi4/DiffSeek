"use strict";

const TOKENIZE_BY_CHAR = 1;
const TOKENIZE_BY_WORD = 2;
const TOKENIZE_BY_LINE = 3;

const TOKEN_CACHE_SIZE = 2;

// token flags
const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
const NORMALIZE = 32; // &middot;, 따옴표 -, 말머리문자 등등 실제로 문자 코드는 다르지만 같다고 처리해야 할 문자들이 있다.

const SPACE_CHARS: { [char: string]: boolean } = {
	" ": true,
	"\t": true,
	"\n": true,
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
};

const normalizeChars: { [ch: string]: string } = {};

let _nextWork: WorkContext | null = null;
let _currentWork: WorkContext | null = null;

type DiffOptions = {
	algorithm: string;
	greedyMatch?: boolean;
	useFallback?: boolean;
	tokenization: typeof TOKENIZE_BY_CHAR | typeof TOKENIZE_BY_WORD | typeof TOKENIZE_BY_LINE;
};

type DiffRequest = {
	type: "diff";
	reqId: number;
	left: string;
	right: string;
	options?: {
		method?: 1 | 2 | 3;
		greedyMatch?: boolean;
		useFallback?: boolean;
	};
};

type WorkContext = {
	reqId: number;
	cancel: boolean;
	leftText: string;
	rightText: string;
	start: number;
	finish: number;
	lastYield: number;
	options: DiffOptions;
	entries: DiffEntry[];
	states: Record<string, any>;
};

type FindAnchorFunc = (
	lhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext
) => { x: number; y: number } | null;

function insertNormalizeChar(chars: string) {
	const norm = chars[0];
	normalizeChars[norm] = norm;
	for (let i = 1; i < chars.length; i++) {
		normalizeChars[chars[i]] = norm;
	}
}

// const decoder = new TextDecoder();

type DiffResult = {
	diffs: DiffEntry[];
	anchors: Anchor[];
};

type TokenCacheEntry = {
	text: string;
	tokens: Token[];
};

const tokenCache: { [method: number]: TokenCacheEntry[] } = {
	[TOKENIZE_BY_CHAR]: [],
	[TOKENIZE_BY_WORD]: [],
	[TOKENIZE_BY_LINE]: [],
};

type TrieNode = {
	next: (char: string | number) => TrieNode | null;
	addChild: (char: string | number) => TrieNode;
	word: string | null;
	flags: number | null;
};

function createTrieNode(): TrieNode {
	const children: { [ch: string]: TrieNode } = {};

	function next(this: TrieNode, char: string | number): TrieNode | null {
		return char === " " ? this : children[char] || null;
	}

	function addChild(char: string | number): TrieNode {
		if (!children[char]) {
			children[char] = createTrieNode();
		}
		return children[char];
	}
	return { next, addChild, word: null, flags: null };
}

function createTrie() {
	const root = createTrieNode();

	function insert(word: string, flags = 0) {
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
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
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
		const work: WorkContext = {
			reqId: e.data.reqId,
			leftText: e.data.leftText,
			rightText: e.data.rightText,
			options: e.data.options as DiffOptions,
			cancel: false,
			start: 0,
			finish: 0,
			lastYield: 0,
			entries: [],
			states: {},
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

async function runDiff(work: WorkContext) {
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

		console.log("algo:", work.options.algorithm);

		let results: DiffResult | undefined = undefined;
		console.log(work.options);
		if (work.options.algorithm === "histogram") {
			results = await runHistogramDiff(work);
		} else if (work.options.algorithm === "myers") {
			results = await runMyersDiff(work);
			console.log("myers diff", results.diffs);
		} else if (work.options.algorithm === "lcs") {
			results = await computeDiff({
				...work,
				ctx: work,
			});
		} else {
			throw new Error("Unknown algorithm: " + work.options.algorithm);
		}
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
		if (e instanceof Error && e.message === "cancelled") {
			// console.debug("Diff canceled");
		} else {
			console.error(e);
		}
	}
	[work, _nextWork] = [_nextWork!, null];
	if (work) {
		return await runDiff(work);
	}
}

function checkIfFirstOfLine(input: string, pos: number) {
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
function tokenizeByChar(input: string, inputPos?: number, inputEnd?: number, baseLineNum?: number): Token[] {
	const tokens: Token[] = [];
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
				for (let node = WildcardNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
					if (node.word !== null) {
						found = node;
						break;
					}
				}
				if (found) {
					flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
					tokens.push({
						text: found.word!,
						pos: i,
						len: p - i,
						lineNum: baseLineNum + lineCount,
						flags: flags | (found.flags || 0),
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

function normalize(text: string) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		result += normalizeChars[char] || char;
	}
	return result;
}

function tokenizeByWord(input: string, inputPos?: number, inputEnd?: number, baseLineNum?: number): Token[] {
	const tokens: Token[] = [];
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
				for (let node = WildcardNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
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
						text: found.word!,
						pos: i,
						len: p - i,
						lineNum: baseLineNum + lineCount,
						flags: flags | (found.flags || 0),
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

function tokenizeByLine(input: string, inputPos?: number, inputEnd?: number, baseLineNum?: number): Token[] {
	const tokens: Token[] = [];
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

function tokenize(input: string, method: 1 | 2 | 3, inputPos?: number, inputEnd?: number, baseLineNum?: number): Token[] {
	let cacheArr;
	if ((inputPos === undefined || inputPos === 0) && (inputEnd === undefined || inputEnd === input.length)) {
		cacheArr = tokenCache[method];
		if (cacheArr) {
			for (let i = 0; i < cacheArr.length; i++) {
				const cache = cacheArr[i];
				if (cache.text === input) {
					if (i !== cacheArr.length - 1) {
						cacheArr.splice(i, 1);
						cacheArr.push(cache);
					}
					return cache.tokens;
				}
			}
		}
	}

	const tokens =
		method === TOKENIZE_BY_CHAR
			? tokenizeByChar(input, inputPos, inputEnd, baseLineNum)
			: method === TOKENIZE_BY_LINE
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
		cacheArr.push({ text: input, tokens: tokens as Token[] });
	}
	return tokens;
}

async function computeLCS(leftTokens: Token[], rightTokens: Token[], ctx?: WorkContext) {
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
	method = TOKENIZE_BY_WORD,
	greedyMatch = false,
	useFallback = false,
	ctx,
}: {
	leftText: string;
	rightText: string;
	leftInputPos?: number;
	leftInputEnd?: number;
	rightInputPos?: number;
	rightInputEnd?: number;
	method?: 1 | 2 | 3;
	greedyMatch?: boolean;
	useFallback?: boolean;
	ctx?: WorkContext;
}) {
	//console.log("computeDiff", { leftText, rightText, leftInputPos, leftInputEnd, rightInputPos, rightInputEnd, method, greedyMatch, useFallback });

	// 앵커라는 이름도 구현 방식도 사실 좀 마음에 안들지만
	// 양쪽 텍스트에서 공통 부분(diff가 아닌 부분)을 서로 대응시킬 만한 딱히 좋은 수가 없음
	const diffs: DiffEntry[] = [],
		anchors: Anchor[] = [];

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
				addAnchor("before", anchorPos, anchorPos, null);
			}
		}
		return { diffs, anchors };
	}

	// console.log("tokens:", { leftTokens, rightTokens });

	const lcs = await computeLCS(leftTokens as Token[], rightTokens as Token[], ctx);
	const lcsLength = lcs.length;
	const leftTokensLength = leftTokens.length;
	const rightTokensLength = rightTokens.length;

	// 앵커 추가는 나중에 한번에 처리하고 싶은데
	// common sequence인 경우 대응하는 반대쪽 토큰에 대한 정보가 필요하므로 쉽지 않음.
	// 결국 서로 대응하는 토큰 쌍을 저장해놔야하는데 그러면 앵커를 나중에 추가하는게 무슨 의미?
	function addAnchor(type: "before" | "after", leftPos: number, rightPos: number, diffIndex: number | null) {
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
			type: 2,
			left: {
				pos: leftInputPos,
				len: 0,
				empty: true,
			},
			right: {
				pos: rightTokens[0].pos,
				len: rightTokens[rightTokensLength - 1].pos + rightTokens[rightTokensLength - 1].len - rightTokens[0].pos,
			},
		});
	} else if (rightTokensLength === 0) {
		diffs.push({
			type: 1,
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
					addAnchor("before", leftAnchorPos, rightAnchorPos, null);
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
				if (useFallback && method > TOKENIZE_BY_WORD) {
					const result = await computeDiff({
						leftText,
						rightText,
						leftInputPos: leftTokens[leftIndex].pos,
						leftInputEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						rightInputPos: rightTokens[rightIndex].pos,
						rightInputEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						method: TOKENIZE_BY_WORD,
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
				} else if (method > TOKENIZE_BY_CHAR) {
					// 단어 사이에서 예기치 않은 공백이 나오는 경우가 왕왕 있다.
					// 게다가 우리말은 띄어쓰기를 해도 맞고 안해도 맞는 것 같은 느낌적인 느낌의 느낌이 느껴지는 경우가 많은 느낌이다!!!
					// FALLBACK으로 글자단위 비교를 하고 그 결과를 최종결과에 넣어버리는 방법을 써도 되지만
					// 글자단위 DIFF는 오히려 사람의 눈에는 더 불편함.

					// 문제: [diff0] abc [diff1] vs [diff0] a bc [diff1] 같은 경우 "abc" vs "a bc"도 diff로 처리됨.
					// > diff0에서부터 diff1 범위까지를 몽땅 diff 범위로 묶어버렸기 때문에 abc vs a bc를 별개로 비교하지 못함.
					// > 그렇다고 토큰 하나씩 따로따로 처리를 하면 시작부분부터 "ab cd" vs "abcd" 같은걸 처리하지 못함(ab vs abcd 비교를 하게되기 때문에)
					// > 생각보다 안풀림..
					// > 글자단위 diff 결과를 토대로 diff 위치에 대한 단어단위 token을 찾아서 단어단위 diff를 만들면 될 것 같기도 한데... 일단 보류
					const result = await computeDiff({
						leftText,
						rightText,
						leftInputPos: leftTokens[leftIndex].pos,
						leftInputEnd: leftTokens[leftIndex + leftCount - 1].pos + leftTokens[leftIndex + leftCount - 1].len,
						rightInputPos: rightTokens[rightIndex].pos,
						rightInputEnd: rightTokens[rightIndex + rightCount - 1].pos + rightTokens[rightIndex + rightCount - 1].len,
						method: TOKENIZE_BY_CHAR,
						useFallback: false,
						ctx,
					});

					if (result.diffs.length === 0) {
						continue;
					}

					// 공백무시 글자단위로 비교에서도 두 문자열이 같지 않다는 것은 알았으니 기존 토큰을 기준으로 diff를 만든다.
					// 글자단위로 표시하면 오히려 눈깔 빠지니까 글자단위diff결과는 버림
					// 상당히 비효율적이지만... 일단 보류 ㅋ
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

				// 아닌거 같아
				// 한쪽의 줄의 중간. 한쪽이 줄의 시작인 경우에 앵커를 만들게 되면
				// 일단 줄의 시작 부분에 만들어진 앵커 이후에 같은 줄에 또 앵커가 만들어진다.
				// 괜찮은건가.. 아닌건가...
				if ((leftTokens[leftIndex].flags | rightTokens[rightIndex].flags) & FIRST_OF_LINE) {
					leftAnchorPos = leftPos;
					rightAnchorPos = rightPos;
					while (leftAnchorPos > 0 && leftText[leftAnchorPos - 1] !== "\n") {
						leftAnchorPos--;
					}
					while (rightAnchorPos > 0 && rightText[rightAnchorPos - 1] !== "\n") {
						rightAnchorPos--;
					}
					addAnchor("before", leftAnchorPos, rightAnchorPos, null);
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
							addAnchor("after", leftAnchorPos, rightAnchorPos, null);
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
				anchorBefore = !!(longSideIsFirstWord && shortSideIsOnLineEdge);
				anchorAfter = !!(longSideIsLastWord && shortSideIsOnLineEdge);

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
						addAnchor("before", leftAnchorPos, rightAnchorPos, null);

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
							addAnchor("after", leftAnchorPos, rightAnchorPos, null);
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
				type: leftCount > 0 ? 1 : 2,
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

function matchPrefixTokens(
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number
): false | [leftMatched: number, rightMatched: number] {
	let i = lhsLower,
		j = rhsLower;
	let ci = 0,
		cj = 0;

	const llen = lhsUpper;
	const rlen = rhsUpper;

	while (i < llen && j < rlen) {
		const ltext = leftTokens[i].text;
		const rtext = rightTokens[j].text;

		const llen2 = ltext.length;
		const rlen2 = rtext.length;

		while (ci < llen2 && cj < rlen2) {
			if (ltext[ci++] !== rtext[cj++]) return false;
		}

		if (ci >= ltext.length) {
			i++;
			ci = 0;
		}
		if (cj >= rtext.length) {
			j++;
			cj = 0;
		}

		if (ci === 0 && cj === 0) return [i - lhsLower, j - rhsLower];
	}

	return false;
}

function matchSuffixTokens(
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number
): false | [leftMatched: number, rightMatched: number] {
	// console.log("matchTokensBackward", leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper);
	let i = lhsUpper - 1, // Start from the last token of lhs
		j = rhsUpper - 1; // Start from the last token of rhs
	let ci = leftTokens[i].text.length - 1, // Start from the last character of the last token of lhs
		cj = rightTokens[j].text.length - 1; // Start from the last character of the last token of rhs

	const llen = lhsLower;
	const rlen = rhsLower;

	OUTER: while (i >= llen && j >= rlen) {
		const ltext = leftTokens[i].text;
		const rtext = rightTokens[j].text;

		while (ci >= 0 && cj >= 0) {
			if (ltext[ci--] !== rtext[cj--]) {
				// console.log("false", JSON.stringify(ltext), JSON.stringify(rtext), i, lhsUpper, j, rhsUpper, ci, cj);
				break OUTER;
			}
		}

		// If both ci and cj are -1, we know we've exhausted the tokens
		if (ci === -1 && cj === -1) {
			// console.log("true", lhsUpper - i + 1, rhsUpper - j + 1, leftTokens[i], rightTokens[j]);
			return [lhsUpper - i, rhsUpper - j]; // +1 to account for the initial token
		}

		if (ci < 0) {
			i--; // Move to the previous token on the left
			if (i >= llen) ci = leftTokens[i].text.length - 1;
		}
		if (cj < 0) {
			j--; // Move to the previous token on the right
			if (j >= rlen) cj = rightTokens[j].text.length - 1;
		}
	}
	// console.log("false")
	return false;
}

function findMiddleSnake(
	lhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext
): { x: number; y: number } | null {
	const max = lhsTokens.length + rhsTokens.length + 1;
	const width = lhsUpper - lhsLower;
	const height = rhsUpper - rhsLower;
	const delta = width - height;
	const kdown = lhsLower - rhsLower;
	const kup = lhsUpper - rhsUpper;
	const offset_down = max - kdown;
	const offset_up = max - kup;
	const maxD = (lhsUpper - lhsLower + rhsUpper - rhsLower) / 2 + 1;
	const odd = (delta & 1) != 0;
	const ret = { x: 0, y: 0 };

	// console.log("getShortestMiddleSnake", {
	// 	lhsLower,
	// 	lhsUpper,
	// 	rhsLower,
	// 	rhsUpper,
	// 	width,
	// 	height,
	// 	delta,
	// 	kDown: kdown,
	// 	kUp: kup,
	// 	offsetDown: offset_down,
	// 	offsetUp: offset_up,
	// 	maxD,
	// 	odd,
	// });

	const { vectorDown, vectorUp } = ctx.states;

	vectorDown[offset_down + kdown + 1] = lhsLower;
	vectorUp[offset_up + kup - 1] = lhsUpper;
	// console.log("offsetDown", offset_down, kdown, vectorD[offset_down + kdown + 1]);
	let d, k, x, y;
	for (d = 0; d <= maxD; d++) {
		for (k = kdown - d; k <= kdown + d; k += 2) {
			if (k === kdown - d) {
				x = vectorDown[offset_down + k + 1]; //down
			} else {
				x = vectorDown[offset_down + k - 1] + 1; //right
				if (k < kdown + d && vectorDown[offset_down + k + 1] >= x) {
					x = vectorDown[offset_down + k + 1]; //down
				}
			}
			y = x - k;

			// console.log("BEFORE \\", x, y);
			while (x < lhsUpper && y < rhsUpper && lhsTokens[x].text === rhsTokens[y].text) {
				x++;
				y++;
			}

			vectorDown[offset_down + k] = x;

			// console.log("FORWARD", {
			// 	x,
			// 	y,
			// 	k,
			// 	d,
			// 	kDown: kdown,
			// 	vectorD,
			// 	vectorU,
			// 	"vectorDown[offsetDown + k + 1]": vectorD[offset_down + k + 1],
			// 	"vectorDown[offsetDown + k - 1]": vectorD[offset_down + k - 1],
			// });

			if (odd && kup - d < k && k < kup + d) {
				if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
					ret.x = vectorDown[offset_down + k];
					ret.y = vectorDown[offset_down + k] - k;
					return ret;
				}
			}
		}

		for (k = kup - d; k <= kup + d; k += 2) {
			// find the only or better starting point
			if (k === kup + d) {
				x = vectorUp[offset_up + k - 1]; // up
			} else {
				x = vectorUp[offset_up + k + 1] - 1; // left
				if (k > kup - d && vectorUp[offset_up + k - 1] < x) x = vectorUp[offset_up + k - 1]; // up
			}
			y = x - k;
			while (x > lhsLower && y > rhsLower && lhsTokens[x - 1].text === rhsTokens[y - 1].text) {
				// diagonal
				x--;
				y--;
			}
			vectorUp[offset_up + k] = x;
			// console.log("BACKWARD", {
			// 	x,
			// 	y,
			// 	k,
			// 	d,
			// 	kUp: kup,
			// 	vectorD,
			// 	vectorU,
			// 	"vectorD[offset_down + k]": vectorD[offset_down + k],
			// 	"vectorU[offset_up + k]": vectorU[offset_up + k],
			// });

			// overlap ?
			if (!odd && kdown - d <= k && k <= kdown + d) {
				if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
					ret.x = vectorDown[offset_down + k];
					ret.y = vectorDown[offset_down + k] - k;
					return ret;
				}
			}
		}
	}

	return null;
	// throw new Error("No middle snake found");
	// return { x: lhsLower - 1, y: rhsLower - 1 };
	// return { x: -1, y: -1 }; // No snake found
}

function postProcess(entries: DiffEntry[], leftText: string, rightText: string, leftTokens: Token[], rightTokens: Token[]): DiffResult {
	console.log("postProcess", "raw entries:", Array.from(entries), leftTokens, rightTokens);
	let prevEntry: DiffEntry | null = null;

	const diffs: DiffEntry[] = [];
	const anchors: Anchor[] = [];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];

		if (entry.type) {
			if (prevEntry) {
				console.assert(prevEntry.left.pos + prevEntry.left.len === entry.left.pos, prevEntry, entry);
				console.assert(prevEntry.right.pos + prevEntry.right.len === entry.right.pos, prevEntry, entry);
				prevEntry.type |= entry.type;
				prevEntry.left.len += entry.left.len;
				prevEntry.right.len += entry.right.len;
			} else {
				//prevEntry = { left: {...entry.left}, right: {...entry.right}, type: entry.type };
				prevEntry = entry;
			}
		} else {
			if (prevEntry) {
				addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
			}
			prevEntry = null;

			const leftToken = leftTokens[entry.left.pos];
			const rightToken = rightTokens[entry.right.pos];
			if (leftToken.flags & rightToken.flags & FIRST_OF_LINE) {
				// 앵커 추가
				addAnchor("before", leftToken.pos, rightToken.pos, null);
			}
		}
	}

	if (prevEntry) {
		addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
	}

	function addAnchor(type: "before" | "after", leftPos: number, rightPos: number, diffIndex: number | null) {
		if (leftPos === undefined || rightPos === undefined) {
			console.error("addAnchor", { type, leftPos, rightPos, diffIndex });
		}

		if (type === "before") {
			// before 앵커는 항상 줄의 시작위치일 때만 추가하므로 줄바꿈 문자만 확인하면 된다!
			while (leftPos > 0 && leftText[leftPos - 1] !== "\n") {
				leftPos--;
			}
			while (rightPos > 0 && rightText[rightPos - 1] !== "\n") {
				rightPos--;
			}
		} else if (type === "after") {
			// empty diff의 after앵커는 이후에 다른 토큰이 존재할 수 있음.
			// 공백이 아닌 문자가 나오면 멈추고 기본 위치 사용.
			let p;
			p = leftPos;
			while (p < leftText.length) {
				const ch = leftText[p++];
				if (ch === "\n") {
					leftPos = p - 1;
					break;
				} else if (!SPACE_CHARS[ch]) {
					break;
				}
			}
			p = rightPos;
			while (p < rightText.length) {
				const ch = rightText[p++];
				if (ch === "\n") {
					rightPos = p - 1;
					break;
				} else if (!SPACE_CHARS[ch]) {
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
		anchors.push({ type, left: leftPos, right: rightPos, diffIndex });
	}

	function addDiff(leftIndex: number, leftCount: number, rightIndex: number, rightCount: number) {
		let leftPos, leftLen, rightPos, rightLen;
		let leftBeforeAnchorPos, rightBeforeAnchorPos, leftAfterAnchorPos, rightAfterAnchorPos;
		let leftEmpty, rightEmpty;
		let type: DiffType;
		if (leftCount > 0 && rightCount > 0) {
			type = 3; // 3: both
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

			if ((leftTokenStart.flags | rightTokenStart.flags) & FIRST_OF_LINE) {
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
					// 줄바꿈 문자 위치까지 스킵

					if (leftText[leftBeforeAnchorPos] !== "\n") {
						do {
							leftBeforeAnchorPos++;
						} while (leftBeforeAnchorPos < leftText.length && leftText[leftBeforeAnchorPos] !== "\n");
					}
					if (rightText[rightBeforeAnchorPos] !== "\n") {
						do {
							rightBeforeAnchorPos++;
						} while (rightBeforeAnchorPos < rightText.length && rightText[rightBeforeAnchorPos] !== "\n");
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
		} else {
			let longSideText, shortSideText;
			let longSideIndex, longSideCount, longSideTokens;
			let shortSideIndex, shortSideTokens;
			let longSidePos, longSideLen;
			let shortSidePos, shortSideLen;
			let longSideBeforeAnchorPos, shortSideBeforeAnchorPos;
			let longSideAfterAnchorPos, shortSideAfterAnchorPos;
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
			} else {
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
			const shortSideIsOnLineEdge =
				shortSideTokens.length === 0 ||
				(shortSideBeforeToken && shortSideBeforeToken.flags & FIRST_OF_LINE) ||
				(shortSideAfterToken && shortSideAfterToken.flags & FIRST_OF_LINE);

			// base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
			if (shortSideIsOnLineEdge) {
				// 줄의 경계에 empty diff를 표시하는 경우 현재 줄의 끝이나 다음 줄의 시작 중 "적절하게" 선택. 현재 줄의 끝(이전 토큰의 뒤)에 위치 중임.
				if (longSideIsFirstWord) {
					if (shortSidePos !== 0) {
						// pos가 0이 아닌 경우는 이전 토큰의 뒤로 위치를 잡은 경우니까 다음 줄바꿈을 찾아서 그 줄바꿈 뒤로 밀어줌
						// 주의: 줄바꿈이 있는지 없는지 확인하기보다는 원본 텍스트의 마지막에 줄바꿈이 없는 경우 강제로 줄바꿈을 붙여주는게 편함. 잊지말고 꼭 붙일 것.
						while (shortSideText[shortSidePos++] !== "\n");
					}

					// 양쪽 모두 줄의 시작 부분에 위치하므로 앵커를 추가하기에 좋은 날씨
					longSideBeforeAnchorPos = longSidePos;
					shortSideBeforeAnchorPos = shortSidePos;
					if (longSideIsLastWord) {
						longSideAfterAnchorPos = longSidePos + longSideLen;
						shortSideAfterAnchorPos = shortSidePos;
					}
				}
			}

			if (leftCount > 0) {
				leftPos = longSidePos;
				leftLen = longSideLen;
				leftEmpty = false;
				leftBeforeAnchorPos = longSideBeforeAnchorPos;
				leftAfterAnchorPos = longSideAfterAnchorPos;
				rightPos = shortSidePos;
				rightLen = shortSideLen;
				rightEmpty = true;
				rightBeforeAnchorPos = shortSideBeforeAnchorPos;
				rightAfterAnchorPos = shortSideAfterAnchorPos;
			} else {
				leftPos = shortSidePos;
				leftLen = shortSideLen;
				leftEmpty = true;
				leftBeforeAnchorPos = shortSideBeforeAnchorPos;
				leftAfterAnchorPos = shortSideAfterAnchorPos;
				rightPos = longSidePos;
				rightLen = longSideLen;
				rightEmpty = false;
				rightBeforeAnchorPos = longSideBeforeAnchorPos;
				rightAfterAnchorPos = longSideAfterAnchorPos;
			}
		}

		if (leftBeforeAnchorPos !== undefined && rightBeforeAnchorPos !== undefined) {
			addAnchor("before", leftBeforeAnchorPos, rightBeforeAnchorPos, diffs.length);
		}
		if (leftAfterAnchorPos !== undefined && rightAfterAnchorPos !== undefined) {
			addAnchor("after", leftAfterAnchorPos, rightAfterAnchorPos, diffs.length);
		}

		diffs.push({
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
		});
	}

	console.log("postProcess", "final diffs:", diffs, anchors);

	return { diffs, anchors };
	// return entries;
}

async function runMyersDiff(ctx: WorkContext): Promise<DiffResult> {
	const leftText = ctx.leftText;
	const rightText = ctx.rightText;
	const leftTokens = tokenize(leftText, ctx.options.tokenization);
	const rightTokens = tokenize(rightText, ctx.options.tokenization);
	const vectorSize = (leftTokens.length + rightTokens.length + 1) * 2;
	const vectorDown = new Array(vectorSize);
	const vectorUp = new Array(vectorSize);
	ctx.states.vectorDown = vectorDown;
	ctx.states.vectorUp = vectorUp;
	const diffs = await diffCore(leftTokens, 0, leftTokens.length, rightTokens, 0, rightTokens.length, ctx, findMiddleSnake);
	return postProcess(diffs, leftText, rightText, leftTokens, rightTokens);
}

function findBestHistogramAnchorRange(
	lhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext
): { x: number; y: number } | null {
	const useLengthBias = false;
	//options.useLengthBias ?? true;

	const freq: Record<string, number> = {};

	for (let i = lhsLower; i < lhsUpper; i++) {
		const key = lhsTokens[i].text;
		freq[key] = (freq[key] || 0) + 1;
	}
	for (let i = rhsLower; i < rhsUpper; i++) {
		const key = rhsTokens[i].text;
		freq[key] = (freq[key] || 0) + 1;
	}

	const rhsMap = new Map<string, number[]>();
	for (let i = rhsLower; i < rhsUpper; i++) {
		const key = rhsTokens[i].text;
		if (!rhsMap.has(key)) rhsMap.set(key, []);
		rhsMap.get(key)!.push(i);
	}

	let best: null | { x: number; y: number; token: Token; score: number } = null;

	for (let i = lhsLower; i < lhsUpper; i++) {
		const key = lhsTokens[i].text;
		if (!rhsMap.has(key)) continue;

		let score = freq[key];
		if (useLengthBias) {
			score += 1 / (key.length + 1);
		}

		if (!best || score < best.score) {
			best = {
				x: i,
				y: rhsMap.get(key)![0],
				token: lhsTokens[i],
				score,
			};
		}
	}

	return best ?? null;
}

async function runHistogramDiff(ctx: WorkContext): Promise<DiffResult> {
	const leftText = ctx.leftText;
	const rightText = ctx.rightText;
	const leftTokens = tokenize(leftText, ctx.options.tokenization);
	const rightTokens = tokenize(rightText, ctx.options.tokenization);

	ctx.states.entries = [] as DiffEntry[];

	let lhsLower = 0;
	let lhsUpper = leftTokens.length;
	let rhsLower = 0;
	let rhsUpper = rightTokens.length;

	const entries = await diffCore(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx, findBestHistogramAnchorRange);

	return postProcess(entries, leftText, rightText, leftTokens, rightTokens);
}

function consumeCommonEdges(
	lhsTokens: Token[],
	rhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsLower: number,
	rhsUpper: number
): [lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number, head: DiffEntry[], tail: DiffEntry[]] {
	const head: DiffEntry[] = [];
	const tail: DiffEntry[] = [];

	let matchedCount;

	// Prefix
	while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
		if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
			head.push({
				type: 0,
				left: { pos: lhsLower, len: 1 },
				right: { pos: rhsLower, len: 1 },
			});
			lhsLower++;
			rhsLower++;
		} else if (
			lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
			lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
			(matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
		) {
			head.push({
				type: 0,
				left: {
					pos: lhsLower,
					len: matchedCount[0],
				},
				right: {
					pos: rhsLower,
					len: matchedCount[1],
				},
			});
			lhsLower += matchedCount[0];
			rhsLower += matchedCount[1];
		} else {
			break;
		}
	}

	// Suffix
	while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
		if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
			tail.push({
				type: 0,
				left: { pos: lhsUpper - 1, len: 1 },
				right: { pos: rhsUpper - 1, len: 1 },
			});
			lhsUpper--;
			rhsUpper--;
		} else if (
			lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
			lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
			(matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
		) {
			tail.push({
				type: 0,
				left: {
					pos: lhsUpper - matchedCount[0],
					len: matchedCount[0],
				},
				right: {
					pos: rhsUpper - matchedCount[1],
					len: matchedCount[1],
				},
			});
			lhsUpper -= matchedCount[0];
			rhsUpper -= matchedCount[1];
		} else {
			break;
		}
	}
	tail.reverse();
	return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
}

async function diffCore(
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext,
	findAnchor: FindAnchorFunc
): Promise<DiffEntry[]> {
	const results: DiffEntry[] = ctx.entries;

	if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
		throw new Error("Invalid range");
	}

	const now = performance.now();
	if (now - ctx.lastYield > 100) {
		ctx.lastYield = now;
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (ctx.cancel) throw new Error("cancelled");
	}

	// TODO
	// 공통 부분을 스킵하는건데 문제는 여기에서 HEAD, TAIL을 스킵하고
	// 이후에 diffCore를 재귀적으로 호출할 때 앞쪽 절반에 대해서 HEAD부분, 뒤쪽 절반에 대해서 TAIL부분을 다시 한번 스킵을 시도하게 된다.
	// 더 이상 스킵할 게 없으니 결과에는 차이가 없겠지만 불필요한 시도를 안하는 쪽으로 개선해 볼 필요가 있음!
	let skippedHead: DiffEntry[];
	let skippedTail: DiffEntry[];
	console.log("BEFORE CONSUME", lhsLower, lhsUpper, rhsLower, rhsUpper);
	[lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(leftTokens, rightTokens, lhsLower, lhsUpper, rhsLower, rhsUpper);
	results.push(...skippedHead);

	// 2. 종료 조건
	if (lhsLower === lhsUpper || rhsLower === rhsUpper) {
		if (lhsLower !== lhsUpper || rhsLower !== rhsUpper) {
			results.push({
				type: lhsLower === lhsUpper ? 2 : 1,
				left: {
					pos: lhsLower,
					len: lhsUpper - lhsLower,
				},
				right: {
					pos: rhsLower,
					len: rhsUpper - rhsLower,
				},
			});
			console.log(results[results.length - 1]);
		}
		results.push(...skippedTail);
		return results;
	}

	const anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx);
	console.log("anchor:", anchor, lhsLower, lhsUpper, rhsLower, rhsUpper);

	// 무한루프 위험.
	// 조건을 제대로 생각해보자.
	if (!anchor || anchor.x < lhsLower || anchor.x >= lhsUpper  || anchor.y < rhsLower || anchor.y >= rhsUpper) {
		let type: DiffType = 0;
		if (lhsUpper > lhsLower) type |= 1;
		if (rhsUpper > rhsLower) type |= 2;
		console.assert(type !== 0, "anchor not found", type, lhsLower, lhsUpper, rhsLower, rhsUpper, anchor);

		results.push({
			type: type as DiffType,
			left: {
				pos: lhsLower,
				len: lhsUpper - lhsLower,
			},
			right: {
				pos: rhsLower,
				len: rhsUpper - rhsLower,
			},
		});
		results.push(...skippedTail);
		return results;
	}

	await diffCore(leftTokens, lhsLower, anchor.x, rightTokens, rhsLower, anchor.y, ctx, findAnchor);
	await diffCore(leftTokens, anchor.x, lhsUpper, rightTokens, anchor.y, rhsUpper, ctx, findAnchor);

	results.push(...skippedTail);

	return results;
}
