const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";

const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
//const NORMALIZE = 32; // &middot;, 따옴표 -, 말머리문자 등등 실제로 문자 코드는 다르지만 같다고 처리해야 할 문자들이 있다.
const SECTION_HEADING = 64;
const MANUAL_ANCHOR = 128; // @@@, ### 등등

const normalizeChars: { [ch: string]: string } = {};

const SPACE_CHARS: { [char: string]: boolean } = {
	" ": true,
	"\t": true,
	"\n": true,
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
	"\u00A0": true, // &nbsp; ??
};

const TOKEN_CACHE_SIZE = 2;

type TokenCacheEntry = {
	text: string;
	tokens: Token[];
};

const tokenCache: Record<TokenizationMode, TokenCacheEntry[]> = {
	["char"]: [],
	["word"]: [],
	["line"]: [],
};

// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
const WildcardTrie = createTrie(true);
WildcardTrie.insert("(추가)", WILD_CARD);
WildcardTrie.insert("(삭제)", WILD_CARD);
WildcardTrie.insert("(신설)", WILD_CARD);
WildcardTrie.insert("(생략)", WILD_CARD);
WildcardTrie.insert("(현행과같음)", WILD_CARD);

const TrieRoot = WildcardTrie.root;
const WildcardTrieNode = WildcardTrie.root.next("(");

const SectionHeadingTrie = createTrie(false);
for (let i = 1; i < 40; i++) {
	// 1. 제목 ==> 이 패턴은 무시. 보통 이 제목들은 왼쪽 문서 전체 테이블의 맨 왼쪽 컬럼에 들어가 있는데
	// 많은 문서들이 섹션을 테이블 행으로 분리하지 않고 그냥 엔터키를 열심히 눌러서 분리해두었기 때문에
	// 이런 경우 복사붙여넣기 하면 1. 제목, 2. 제목2, ...이 모두 문서의 첫 부분에 나와버림. 영구같다!
	SectionHeadingTrie.insert(`(${i}) `);
	SectionHeadingTrie.insert(`${i}) `);
}

const syllables = "가나다라마바사아자차카타파하";
for (let i = 0; i < syllables.length; i++) {
	SectionHeadingTrie.insert(`(${syllables[i]}) `);
	SectionHeadingTrie.insert(`${syllables[i]}) `);
	SectionHeadingTrie.insert(`(${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
	SectionHeadingTrie.insert(`${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
}
const SectionHeadingTrieNode = SectionHeadingTrie.root;

const ManualAnchorTrie = createTrie(false);
ManualAnchorTrie.insert(MANUAL_ANCHOR1, MANUAL_ANCHOR);
ManualAnchorTrie.insert(MANUAL_ANCHOR2, MANUAL_ANCHOR);
const ManualAnchorTrieNode = ManualAnchorTrie.root;

// ============================================================
// Tokenization
// tokenize를 ui쓰레드에서 실행하는 것으로 바꿔봤지만
// editor에서 물흐르듯 자연스러운 편집이 안되는 느낌. 불쾌함!
// 그래도 UI쓰레드에서 토큰을 직접 가지고 있으면 편리한 부분이 있긴 있음.
// ============================================================
// #region Tokenization
function tokenizeByChar(input: string): Token[] {
	const tokens: Token[] = [];
	let lineNum = 1;
	let flags = FIRST_OF_LINE;
	let node: TrieNode | null = null;
	const inputPos = 0;
	const inputEnd = input.length;

	for (let i = inputPos; i < inputEnd; i++) {
		let char = input[i];
		if (!SPACE_CHARS[char]) {
			if (char === "(") {
				let p = i + 1;
				let found = null;
				for (node = WildcardTrieNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
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
			if ((node = ManualAnchorTrieNode.next(char))) {
				let p = i + 1;
				let found = null;
				for (; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
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
				text: normalizeChars[char] || char,
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

	//console.debug("tokenizeByChar", tokens);
	return tokens;
}

function tokenizeByWord(input: string): Token[] {
	const tokens: Token[] = [];
	let currentStart = -1;
	let lineNum = 1;
	let flags = FIRST_OF_LINE;
	let shouldNormalize = false;
	const inputPos = 0;
	const inputEnd = input.length;

	for (let i = inputPos; i < inputEnd; i++) {
		let char = input[i];
		// 문장부호를 별개로 단어로 분리하는 방법도 생각해볼 필요가 있음.
		// 문제는 (hello)와 (world)에서 '('만 매치되면 눈이 피곤해진다. 괄호안의 문자들이 여러줄이면 더더욱..
		if (SPACE_CHARS[char]) {
			if (currentStart !== -1) {
				flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
				const text = shouldNormalize ? normalize(input.substring(currentStart, i)) : input.substring(currentStart, i);
				if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
					flags |= MANUAL_ANCHOR;
				}
				tokens.push({
					text: text,
					pos: currentStart,
					len: i - currentStart,
					lineNum: lineNum,
					flags,
				});
				flags = 0;
				shouldNormalize = false;
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
				shouldNormalize = true;
				char = normalizeChars[char];
			}
			if (char === "(") {
				let p = i + 1;
				let found = null;
				for (let node = WildcardTrieNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
					if (node.word !== null) {
						found = node;
						break;
					}
				}
				if (found) {
					if (currentStart !== -1) {
						flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
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

					flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
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
			if (flags & FIRST_OF_LINE) {
				let p = i;
				let found = null;
				for (let node: TrieNode | null = SectionHeadingTrieNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
					if (node.word !== null) {
						found = node;
						break;
					}
				}
				if (found) {
					while (p < inputEnd && SPACE_CHARS[input[p]]) {
						p++;
					}
					if (p < inputEnd) {
						flags |= SECTION_HEADING;
					}
				}
			}

			if (currentStart === -1) {
				currentStart = i;
			}
		}
	}

	if (currentStart !== -1) {
		const text = shouldNormalize ? normalize(input.substring(currentStart)) : input.substring(currentStart);
		if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
			flags |= MANUAL_ANCHOR;
		}
		flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
		tokens.push({
			text: text,
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

	//console.debug("tokenizeByWord", tokens);
	return tokens;
}

function tokenizeByLine(input: string): Token[] {
	const tokens: Token[] = [];
	let currentStart = -1;
	let currentEnd = -1;
	let lineNum = 1;
	let flags = FIRST_OF_LINE | LAST_OF_LINE;
	const inputPos = 0;
	const inputEnd = input.length;

	for (let i = inputPos; i < inputEnd; i++) {
		const char = input[i];
		if (char !== "\n") {
			if (!SPACE_CHARS[char]) {
				if (currentStart === -1) {
					currentStart = i;
					let p = i;
					let found = null;
					for (let node: TrieNode | null = SectionHeadingTrieNode; p < inputEnd && (node = node!.next(input[p++])) !== null; ) {
						if (node.word !== null) {
							found = node;
							break;
						}
					}
					if (found) {
						while (p < inputEnd && SPACE_CHARS[input[p]]) {
							p++;
						}
						if (p < inputEnd) {
							flags |= SECTION_HEADING;
						}
					}
				}
				currentEnd = i + 1;
			}
		} else {
			if (currentStart !== -1) {
				const text = input.substring(currentStart, currentEnd).replace(/\s+/g, " ");
				if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
					flags |= MANUAL_ANCHOR;
				}
				tokens.push({
					text: text,
					pos: currentStart,
					len: i - currentStart,
					lineNum: lineNum,
					flags: flags,
				});
				flags = FIRST_OF_LINE | LAST_OF_LINE;
				currentStart = currentEnd = -1;
			}
			lineNum++;
		}
	}

	if (currentStart !== -1) {
		const text = input.substring(currentStart, currentEnd).replace(/\s+/g, " ");
		if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
			flags |= MANUAL_ANCHOR;
		}
		tokens.push({
			text: text,
			pos: currentStart,
			len: currentEnd - currentStart,
			lineNum: lineNum,
			flags: flags,
		});
	}
	//console.debug("tokenizeByLine", tokens);
	return tokens;
}

function tokenize(input: string, mode: TokenizationMode, noCache: boolean = false): Token[] {
	let cacheArr = !noCache && tokenCache[mode];
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

	const now = performance.now();
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
	console.log("tokenize took %d ms", performance.now() - now);
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

function normalize(text: string) {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		result += normalizeChars[char] || char;
	}
	return result;
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
