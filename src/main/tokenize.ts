// worker쓰레드에서 토큰화를 했었지만 결과를 가공하려면 UI에서 토큰을 가지고 있는 편이 낫다.
// 특히 실시간으로 유저가 선택한 텍스트 영역이 어떤 토큰인지, 반대쪽 편집기의 텍스트의 어느 토큰/어느 위치에 대응되는지를 파악하려면
// UI에서 토큰을 가지고 있어야 한다. (아니면 worker쓰레드로 요청을 보내고 onmessage로 결과를 받아서 처리해야하는데 복잡하기만 하고 실효는 그다지...)

// 주의
// 현재 프로젝트에서 const 값들은 worker와 worker가 아닌 스크립트 모두에서 참조되는 것 처럼 보이지만
// 런타임 시에는 서로 간 참조가 불가능함.

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

type TokenCacheEntry = {
	text: string;
	tokens: Token[];
};

const TOKEN_CACHE_SIZE = 2;
const tokenCache: Record<TokenizationMode, TokenCacheEntry[]> = {
	["char"]: [],
	["word"]: [],
	["line"]: [],
};

type TrieNode = {
	next: (char: string | number) => TrieNode | null;
	addChild: (char: string | number) => TrieNode;
	word: string | null;
	flags: number | null;
};

function createTrieNode(ignoreSpaces: boolean): TrieNode {
	const children: { [ch: string]: TrieNode } = {};

	function next(this: TrieNode, char: string | number): TrieNode | null {
		return ignoreSpaces && char === " " ? this : children[char] || null;
	}

	function addChild(char: string | number): TrieNode {
		if (!children[char]) {
			children[char] = createTrieNode(ignoreSpaces);
		}
		return children[char];
	}
	return { next, addChild, word: null, flags: null };
}

function createTrie(ignoreSpaces = false) {
	const root = createTrieNode(ignoreSpaces);

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

const Trie = createTrie();

// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
Trie.insert("(추가)", WILD_CARD);
Trie.insert("(삭제)", WILD_CARD);
Trie.insert("(신설)", WILD_CARD);
Trie.insert("(생략)", WILD_CARD);
Trie.insert("(현행과같음)", WILD_CARD);

const TrieRoot = Trie.root;
const WildcardNode = Trie.root.next("(");

function tokenizeByChar(input: string): Token[] {
	const tokens: Token[] = [];
	let lineNum = 1;
	let flags = 0;
	const inputPos = 0;
	const inputEnd = input.length;

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
						lineNum: lineNum,
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
				lineNum: lineNum,
				flags,
			});
			flags = 0;
		}
		if (char === "\n") {
			lineNum++;
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

function tokenizeByWord(input: string): Token[] {
	const tokens: Token[] = [];
	let currentStart = -1;
	let lineNum = 1;
	let flags = 0;
	const inputPos = 0;
	const inputEnd = input.length;

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
					lineNum: lineNum,
					flags,
				});
				flags = 0;
				currentStart = -1;
			}
			if (char === "\n") {
				lineNum++;
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
							lineNum: lineNum,
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
						lineNum: lineNum,
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
			lineNum: lineNum,
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

function tokenizeByLine(input: string): Token[] {
	const tokens: Token[] = [];
	let currentStart = -1;
	let currentEnd = -1;
	let lineNum = 1;
	const inputPos = 0;
	const inputEnd = input.length;

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
					lineNum: lineNum,
					flags: FIRST_OF_LINE | LAST_OF_LINE,
				});
				currentStart = currentEnd = -1;
			}
			lineNum++;
		}
	}

	if (currentStart !== -1) {
		tokens.push({
			text: input.substring(currentStart, currentEnd).trim(),
			pos: currentStart,
			len: currentEnd - currentStart,
			lineNum: lineNum,
			flags: FIRST_OF_LINE | LAST_OF_LINE,
		});
	}

	return tokens;
}

function tokenize(input: string, mode: TokenizationMode, inputPos?: number, inputEnd?: number, baseLineNum?: number): Token[] {
	let cacheArr;
	if ((inputPos === undefined || inputPos === 0) && (inputEnd === undefined || inputEnd === input.length)) {
		cacheArr = tokenCache[mode];
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

	let tokens: Token[];
	switch (mode) {
		case "char":
			tokens = tokenizeByChar(input);
			break;
		case "word":
			tokens = tokenizeByWord(input);
			break;
		case "line":
			tokens = tokenizeByLine(input);
			break;
		default:
			throw new Error("Unknown tokenization mode: " + mode);
	}
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

function normalize(text: string) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		result += normalizeChars[char] || char;
	}
	return result;
}

function findTokenAt(tokens: Token[], pos: number, fromIndex: number = 0): number {
	let lo = fromIndex;
	let hi = tokens.length - 1;

	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const token = tokens[mid];
		const tokenStart = token.pos;
		const tokenEnd = tokenStart + token.len;

		if (pos >= tokenStart && pos < tokenEnd) {
			return mid; // ✅ 정확히 포함된 토큰
		}

		if (tokenStart > pos) {
			hi = mid - 1;
		} else {
			lo = mid + 1;
		}
	}
	return hi >= 0 ? hi : 0;
}
