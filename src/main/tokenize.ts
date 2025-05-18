const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";

const LINE_START = 1 << 0; // 1
const LINE_END = 1 << 1; // 2
const CONTAINER_START = 1 << 2; // 4
const CONTAINER_END = 1 << 3; // 8
const NO_JOIN = 1 << 4; // @@@, ### 등등 // 16
const WILD_CARD = 1 << 5;
const MANUAL_ANCHOR = 1 << 6; // 32. @@@, ### 등등
const IMAGE = 1 << 7;

const SECTION_HEADING_BIT = 10;
const SECTION_HEADING_TYPE1 = 1 << (SECTION_HEADING_BIT + 0); // 1.
const SECTION_HEADING_TYPE2 = 1 << (SECTION_HEADING_BIT + 1); // 가.
const SECTION_HEADING_TYPE3 = 1 << (SECTION_HEADING_BIT + 2); // (1)
const SECTION_HEADING_TYPE4 = 1 << (SECTION_HEADING_BIT + 3); // (가)
const SECTION_HEADING_TYPE5 = 1 << (SECTION_HEADING_BIT + 4); // 1)
const SECTION_HEADING_TYPE6 = 1 << (SECTION_HEADING_BIT + 5); // 가)

const LINE_BOUNDARY = LINE_START | LINE_END;
const CONTAINER_BOUNDARY = CONTAINER_START | CONTAINER_END;
const SECTION_HEADING_MASK =
	SECTION_HEADING_TYPE1 | SECTION_HEADING_TYPE2 | SECTION_HEADING_TYPE3 | SECTION_HEADING_TYPE4 | SECTION_HEADING_TYPE5 | SECTION_HEADING_TYPE6;

// const normalizeChars: { [ch: string]: string } = {};

// text flow containers?
const containerElements = {
	DIV: true,
	PRE: true,
	BLOCKQUOTE: true,
	LI: true,
	TD: true,
	TH: true,
	SECTION: true,
	ARTICLE: true,
	HEADER: true,
	FOOTER: true,
	ASIDE: true,
	MAIN: true,
	CAPTION: true,
	FIGURE: true,
	FIGCAPTION: true,
};

const spaceChars: Record<string, boolean> = {
	" ": true,
	"\t": true,
	"\n": true,
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
	"\u00A0": true, // &nbsp; ??
};

const splitChars: Record<string, boolean> = {
	"(": true,
	")": true,
	"[": true,
	"]": true,
	"{": true,
	"}": true,
};

const normalizedCharMap = ((normChars: (string | number)[][]) => {
	const result: Record<string, string> = {};
	let parser: DOMParser;
	function htmlEntityToChar(entity: string) {
		const doc = (parser = parser || new DOMParser()).parseFromString(entity, "text/html");
		const char = doc.body.textContent!;
		if (char.length !== 1) {
			throw new Error("htmlEntityToChar: not a single character entity: " + entity);
		}
		return char;
	}

	for (const entry of normChars) {
		const [norm, ...variants] = entry;
		for (const variant of variants) {
			if (typeof variant === "number") {
				result[String.fromCharCode(variant)] = norm as string;
			} else if (typeof variant === "string") {
				if (variant.length === 1 || (variant.length === 2 && variant.charCodeAt(0) >= 0xd800)) {
					result[variant] = norm as string;
				} else if (variant[0] === "&") {
					result[htmlEntityToChar(variant)] = norm as string;
				}
			}
		}
	}
	return result;
})([
	['"', "“", "”", "'", "‘", "’"], // 비즈플랫폼 편집기에서 작은따옴표를 큰따옴표로 바꾸어버림. WHY?
	["-", "‐", "‑", "‒", "–", "﹘", "—", "－"],
	[".", "․", "．"],
	[",", "，"],
	["•", "●"], // 이걸 중간점 용도로 쓰는 사람들은 정말 갈아마셔야된다. 도저히 용납해줄 수 없고 같은 문자로 인식하게 만들고 싶지 않다.
	["◦", "○", "ㅇ"], // 자음 "이응"을 쓰는 사람들도 개인적으로 이해가 안되지만 많더라.
	["■", "▪", "◼"],
	["□", "▫", "◻", "ㅁ"],
	["·", "⋅", "∙", "ㆍ", "‧"], // 유니코드를 만든 집단은 도대체 무슨 생각이었던걸까?...
	["…", "⋯"],
	["(", "（"],
	[")", "）"],
	["[", "［"],
	["]", "］"],
	["{", "｛"],
	["}", "｝"],
	["<", "＜"],
	[">", "＞"],
	["=", "＝"],
	["+", "＋"],
	["*", "＊", "✱", "×", "∗"],
	["/", "／", "÷"],
	["\\", "₩"], // 아마도 원화 기호로 사용했겠지
	["&", "＆"],
	["#", "＃"],
	["@", "＠"],
	["$", "＄"],
	["%", "％"],
	["^", "＾"],
	["~", "～"],
	["`", "｀"],
	["|", "｜"],
	[":", "："],
	[";", "；"],
	["?", "？"],
	["!", "！"],
	["_", "＿"],
	["→", "⇒", "➡", "➔", "➞", "➟"],
	["←", "⇐", "⬅", "⟵", "⟸"],
	["↑", "⇑", "⬆"],
	["↓", "⇓", "⬇"],
	["↔", "⇔"],
	["↕", "⇕"],
]);

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
const wildcardTrie = createTrie(true);
wildcardTrie.insert("(추가)", WILD_CARD);
wildcardTrie.insert("(삭제)", WILD_CARD);
wildcardTrie.insert("(신설)", WILD_CARD);
wildcardTrie.insert("(생략)", WILD_CARD);
wildcardTrie.insert("(현행과같음)", WILD_CARD);

const wildcardTrieNode = wildcardTrie.root.next("(")!;

const sectionHeadingTrie = createTrie(false);
for (let i = 1; i < 40; i++) {
	sectionHeadingTrie.insert(`${i}.`, SECTION_HEADING_TYPE1);
	sectionHeadingTrie.insert(`(${i})`, SECTION_HEADING_TYPE3);
	sectionHeadingTrie.insert(`${i})`, SECTION_HEADING_TYPE5);
}

for (let i = 0; i < HANGUL_ORDER.length; i++) {
	sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}.`, SECTION_HEADING_TYPE2);
	sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]})`, SECTION_HEADING_TYPE4);
	sectionHeadingTrie.insert(`${HANGUL_ORDER[i]})`, SECTION_HEADING_TYPE6);
}
const SectionHeadingTrieNode = sectionHeadingTrie.root;
const sectionHeadingStartChars = extractStartCharsFromTrie(SectionHeadingTrieNode);

const manualAnchorTrie = createTrie(false);
manualAnchorTrie.insert(MANUAL_ANCHOR1, MANUAL_ANCHOR);
manualAnchorTrie.insert(MANUAL_ANCHOR2, MANUAL_ANCHOR);
const manualAnchorTrieNode = manualAnchorTrie.root;
const manualAnchorStartChars = extractStartCharsFromTrie(manualAnchorTrieNode);

function tokenizeByChar(input: string): Token[] {
	const tokens: Token[] = [];
	let lineNum = 1;
	let flags = LINE_START;
	const inputEnd = input.length;

	for (let i = 0; i < inputEnd; i++) {
		const ch = input[i];

		if (!spaceChars[ch]) {
			if (ch === "(") {
				const result = findInTrie(wildcardTrieNode, input, i + 1);
				if (result) {
					if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
						flags |= LINE_START;
					}
					tokens.push({
						text: result.word,
						pos: i,
						len: result.end - i,
						lineNum,
						flags: flags | result.flags,
					});
					flags = 0;
					i = result.end - 1;
					continue;
				}
			}

			if (manualAnchorStartChars[ch]) {
				const nextNode = manualAnchorTrieNode.next(ch)!;
				const result = findInTrie(nextNode, input, i + 1);
				if (result) {
					if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
						flags |= LINE_START;
					}
					tokens.push({
						text: result.word,
						pos: i,
						len: result.end - i,
						lineNum,
						flags: flags | result.flags,
					});
					flags = 0;
					i = result.end - 1;
					continue;
				}
			}

			if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
				flags |= LINE_START;
			}
			const normalized = normalizedCharMap[ch] || ch;
			tokens.push({
				text: normalized,
				pos: i,
				len: 1,
				lineNum,
				flags,
			});
			flags = 0;
		}

		if (ch === "\n") {
			lineNum++;
			flags = LINE_START;
			if (tokens.length) {
				tokens[tokens.length - 1].flags |= LINE_END;
			}
		}
	}

	if (tokens.length) {
		tokens[tokens.length - 1].flags |= LINE_END;
	}

	return tokens;
}

function tokenizeByWord(input: string): Token[] {
	const tokens: Token[] = [];
	let currentStart = -1;
	let lineNum = 1;
	let flags = LINE_START;
	let shouldNormalize = false;
	const inputEnd = input.length;

	function emitToken(end: number) {
		const raw = input.slice(currentStart, end);
		const normalized = shouldNormalize ? normalize(raw) : raw;

		flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? LINE_START : 0;
		if (normalized === MANUAL_ANCHOR1 || normalized === MANUAL_ANCHOR2) {
			flags |= MANUAL_ANCHOR;
		}

		tokens.push({
			text: normalized,
			pos: currentStart,
			len: end - currentStart,
			lineNum,
			flags,
		});

		currentStart = -1;
		flags = 0;
		shouldNormalize = false;
	}

	for (let i = 0; i < inputEnd; i++) {
		let ch = input[i];

		if (spaceChars[ch]) {
			if (currentStart !== -1) emitToken(i);
			if (ch === "\n") {
				lineNum++;
				flags = LINE_START;
				if (tokens.length) tokens[tokens.length - 1].flags |= LINE_END;
			}
			continue;
		}

		if (ch === "(") {
			const result = findInTrie(wildcardTrieNode, input, i);
			if (result) {
				if (currentStart !== -1) emitToken(i);
				flags |= tokens.length === 0 || checkIfFirstOfLine(input, i) ? LINE_START : 0;

				tokens.push({
					text: result.word,
					pos: i,
					len: result.end - i,
					lineNum,
					flags: flags | result.flags,
				});
				flags = 0;
				currentStart = -1;
				i = result.end - 1;
				continue;
			}
		}

		if (currentStart === -1 && flags & LINE_START && sectionHeadingStartChars[ch]) {
			const result = findInTrie(SectionHeadingTrieNode, input, i);
			if (result) {
				const nextChar = input[result.end];
				if (nextChar === " " || nextChar === "\t" || nextChar === "\u00A0") {
					flags |= result.flags;
				}

				// let p = result.end;
				// while (p < inputEnd && SPACE_CHARS[input[p]]) p++;
				// if (p < inputEnd) flags |= result.flags;
			}
		}

		// if (SPLIT_CHARS[ch]) {
		// 	if (currentStart !== -1) emitToken(i);

		// 	flags |= tokens.length === 0 || checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;

		// 	tokens.push({
		// 		text: ch,
		// 		pos: i,
		// 		len: 1,
		// 		lineNum,
		// 		flags,
		// 	});

		// 	flags = 0;
		// 	currentStart = -1;
		// 	continue;
		// }

		if (normalizedCharMap[ch]) {
			shouldNormalize = true;
		}

		if (currentStart === -1) currentStart = i;
	}

	if (currentStart !== -1) emitToken(inputEnd);

	if (tokens.length) {
		tokens[tokens.length - 1].flags |= LINE_END;
	}

	return tokens;
}

function tokenizeByLine(input: string): Token[] {
	const tokens: Token[] = [];
	let lineNum = 1;
	let flags = LINE_START | LINE_END;
	const inputEnd = input.length;

	let buffer = "";
	let started = false;
	let inSpace = false;
	let pos = -1;

	for (let i = 0; i < inputEnd; i++) {
		const ch = input[i];

		if (ch !== "\n") {
			if (!spaceChars[ch]) {
				if (!started) {
					pos = i;
					started = true;

					const result = findInTrie(SectionHeadingTrieNode, input, i);
					if (result) {
						let p = result.end;
						while (p < inputEnd && spaceChars[input[p]]) p++;
						if (p < inputEnd) flags |= result.flags;
					}
				}
				if (inSpace && buffer.length > 0) buffer += " ";
				buffer += ch;
				inSpace = false;
			} else {
				inSpace = started;
			}
		} else {
			if (started) {
				if (buffer === MANUAL_ANCHOR1 || buffer === MANUAL_ANCHOR2) {
					flags |= MANUAL_ANCHOR;
				}
				tokens.push({
					text: buffer,
					pos,
					len: i - pos,
					lineNum,
					flags,
				});
				buffer = "";
				started = false;
				inSpace = false;
				flags = LINE_START | LINE_END;
			}
			lineNum++;
		}
	}

	return tokens;
}

function tokenize(input: string, mode: TokenizationMode, noCache: boolean = false): Token[] {
	let cacheArr = !noCache && tokenCache[mode];
	if (cacheArr) {
		for (let i = 0; i < cacheArr.length; i++) {
			const cache = cacheArr[i];
			if (cache.text.length === input.length && cache.text === input) {
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
	console.debug("tokenize took %d ms", performance.now() - now);
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
		result += normalizedCharMap[char] || char;
	}
	return result;
}

function checkIfFirstOfLine(input: string, pos: number) {
	pos--;
	while (pos >= 0) {
		if (input[pos] === "\n") {
			break;
		} else if (!spaceChars[input[pos]]) {
			return false;
		}
		pos--;
	}
	return true;
}

type TrieNode = {
	next: (char: string) => TrieNode | null;
	addChild: (char: string) => TrieNode;
	word: string | null;
	flags: number;
	children: Record<string, TrieNode>;
};

function createTrie(ignoreSpaces = false) {
	const root = createTrieNode(ignoreSpaces);

	function insert(word: string, flags = 0) {
		let node = root;
		for (let i = 0; i < word.length; i++) {
			node = node.addChild(word[i]);
		}
		node.word = word;
		node.flags = flags;
	}

	return { insert, root };
}

function createTrieNode(ignoreSpaces: boolean): TrieNode {
	const children: Record<string, TrieNode> = {};

	const node: TrieNode = {
		children,
		word: null,
		flags: 0,
		next(char: string) {
			if (ignoreSpaces && char === " ") return node;
			return children[char] || null;
		},
		addChild(char: string) {
			return children[char] ?? (children[char] = createTrieNode(ignoreSpaces));
		},
	};

	return node;
}

function findInTrie(trie: TrieNode, input: string, start: number) {
	let node: TrieNode | null = trie;
	let i = start;
	while (i < input.length) {
		const ch = input[i++];
		node = node!.next(ch);
		if (!node) break;
		if (node.word) {
			return { word: node.word, flags: node.flags, end: i };
		}
	}
	return null;
}

function extractStartCharsFromTrie(trie: TrieNode): Record<string, 1> {
	const table: Record<string, 1> = {};
	for (const ch in trie.children) {
		table[ch] = 1;
	}
	return table;
}

type ContainerInfo = {
	textFlow: boolean;
	tokens: Token[];
};

function tokenizeNode(node: Node): Token[] {
	const startTime = performance.now();
	let textPos = 0;
	let currentToken: Token | null = null;
	const results: Token[] = [];
	function processToken(text: string, start: number, length: number) {
		if (currentToken) {
			currentToken.text += text;
			currentToken.len = textPos - currentToken.pos;
		} else {
			currentToken = {
				text,
				pos: start,
				len: length,
				flags: 0,
				lineNum: 0,
			};
		}
	}

	function finalizeToken(flags: number = 0) {
		if (currentToken) {
			currentToken.len = textPos - currentToken.pos;
			currentToken.flags |= flags;
			results.push(currentToken);
			currentToken = null;
			return 1;
		}
		return 0;
	}

	function traverse(node: Node) {
		if (node.nodeType === 3) {
			const text = node.nodeValue!;
			if (text.length === 0) return;
			let nodeStart = textPos;
			let currentStart = -1;
			for (let i = 0; i < text.length; i++, textPos++) {
				const char = text[i];
				if (spaceChars[char]) {
					if (currentStart >= 0) {
						processToken(text.slice(currentStart, i), nodeStart + currentStart, i - currentStart);
						currentStart = -1;
					}
					finalizeToken();
				} else {
					if (currentStart < 0) {
						currentStart = i;
					}
				}
			}

			if (currentStart >= 0) {
				processToken(text.slice(currentStart), nodeStart + currentStart, text.length - currentStart);
			}
		} else if (node.nodeType === 1) {
			if (node.nodeName === "BR") {
				finalizeToken(LINE_END);
				return;
			}

			if ((node as HTMLElement).className === "img") {
				finalizeToken();
				results.push({
					text: (node as HTMLElement).dataset.src || (node as HTMLImageElement).src || "🖼️",
					pos: textPos,
					len: node.textContent!.length,
					lineNum: 0,
					flags: IMAGE | NO_JOIN,
				});
				textPos += node.textContent!.length;
				return;
			}

			(node as HTMLElement).dataset.startOffset = String(textPos);

			if (TEXT_FLOW_CONTAINERS[node.nodeName]) {
				finalizeToken(CONTAINER_END | LINE_END);
			}

			const isTextFlowContainer = TEXT_FLOW_CONTAINERS[node.nodeName];
			const numTokensBefore = results.length;

			for (const child of node.childNodes) {
				traverse(child);
			}

			if (BLOCK_ELEMENTS[node.nodeName]) {
				finalizeToken();
			}

			const firstToken = results[numTokensBefore];
			const lastToken = results[results.length - 1];
			if (isTextFlowContainer) {
				if (firstToken) {
					firstToken.flags |= CONTAINER_START | LINE_START;
				}
				if (lastToken) {
					lastToken.flags |= CONTAINER_END | LINE_END;
				}
			} else if (node.nodeName === "P") {
				if (firstToken) {
					firstToken.flags |= LINE_START;
				}
				if (lastToken) {
					lastToken.flags |= LINE_END;
				}
			}

			(node as HTMLElement).dataset.endOffset = String(textPos);


			// currentContainer = containerStack.pop()!;
		}
	}

	traverse(node);
	finalizeToken();
	const endTime = performance.now();
	console.log("tokenizeNode", node.nodeName, node.nodeValue, results, Math.ceil(endTime - startTime) + "ms");

	return results;
}
