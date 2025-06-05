const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";

const enum TokenFlags {
	LINE_START = 1 << 0,
	LINE_END = 1 << 1,
	BLOCK_START = 1 << 2,
	BLOCK_END = 1 << 3,
	CONTAINER_START = 1 << 4,
	CONTAINER_END = 1 << 5,
	TABLE_START = 1 << 6,
	TABLE_END = 1 << 7,
	TABLEROW_START = 1 << 8,
	TABLEROW_END = 1 << 9,
	TABLECELL_START = 1 << 10,
	TABLECELL_END = 1 << 11,
	NO_JOIN_PREV = 1 << 12, // @@@, ### 등등
	NO_JOIN_NEXT = 1 << 13, // @@@, ### 등등
	WILD_CARD = 1 << 14,
	MANUAL_ANCHOR = 1 << 15, // 32. @@@, ### 등등
	IMAGE = 1 << 16,
	HTML_SUP = 1 << 17,
	HTML_SUB = 1 << 18,
	SECTION_HEADING_TYPE1 = 1 << 19, // 1.
	SECTION_HEADING_TYPE2 = 1 << 20, // 가.
	SECTION_HEADING_TYPE3 = 1 << 21, // (1)
	SECTION_HEADING_TYPE4 = 1 << 22, // (가)
	SECTION_HEADING_TYPE5 = 1 << 23, // 1)
	SECTION_HEADING_TYPE6 = 1 << 23, // 가)
}

const SECTION_HEADING_MASK =
	TokenFlags.SECTION_HEADING_TYPE1 |
	TokenFlags.SECTION_HEADING_TYPE2 |
	TokenFlags.SECTION_HEADING_TYPE3 |
	TokenFlags.SECTION_HEADING_TYPE4 |
	TokenFlags.SECTION_HEADING_TYPE5 |
	TokenFlags.SECTION_HEADING_TYPE6;

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
	[" ", "\u00A0"],
]);

// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
const wildcardTrie = createTrie(true);
wildcardTrie.insert("(추가)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(삭제)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(신설)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(생략)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(현행과같음)", TokenFlags.WILD_CARD);

const wildcardTrieNode = wildcardTrie.root.next("(")!;

const sectionHeadingTrie = createTrie(false);
for (let i = 1; i < 40; i++) {
	sectionHeadingTrie.insert(`${i}.`, TokenFlags.SECTION_HEADING_TYPE1);
	sectionHeadingTrie.insert(`(${i})`, TokenFlags.SECTION_HEADING_TYPE3);
	sectionHeadingTrie.insert(`${i})`, TokenFlags.SECTION_HEADING_TYPE5);
}

for (let i = 0; i < HANGUL_ORDER.length; i++) {
	sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}.`, TokenFlags.SECTION_HEADING_TYPE2);
	sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]})`, TokenFlags.SECTION_HEADING_TYPE4);
	sectionHeadingTrie.insert(`${HANGUL_ORDER[i]})`, TokenFlags.SECTION_HEADING_TYPE6);
}
const SectionHeadingTrieNode = sectionHeadingTrie.root;
const sectionHeadingStartChars = extractStartCharsFromTrie(SectionHeadingTrieNode);

const manualAnchorTrie = createTrie(false);
manualAnchorTrie.insert(MANUAL_ANCHOR1, TokenFlags.MANUAL_ANCHOR);
manualAnchorTrie.insert(MANUAL_ANCHOR2, TokenFlags.MANUAL_ANCHOR);
const manualAnchorTrieNode = manualAnchorTrie.root;
const manualAnchorStartChars = extractStartCharsFromTrie(manualAnchorTrieNode);

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

type TokinizeContext = {
	content: HTMLElement;
	cancelled: boolean;
};

type TokenizationEvent =
	| { type: "containerStart"; container: RichTokenContainer }
	| { type: "containerEnd"; container: RichTokenContainer }
	| TextTokenizationEvent
	| { type: "img"; src: string; node: Node; indexInParent: number }
	| { type: "break" };

type TextTokenizationEvent = {
	type: "textNode";
	node: Text;
	parent: RichTokenContainer;
	indexInParent: number;
	text: string;
};

type CurrentNodeInfo = {
	childIndex: number;
};

type TextNodeInfo = {
	node: Text;
};

// const TOKEN_BOUNDARY_ELEMENTS: Record<string, boolean> = {
// 	...BLOCK_ELEMENTS,
// 	BR: true,
// 	HR: true,
// 	IMG: true,
// };

// function* tokenizeWithContainers(root: Node): Generator<TokenizationEvent, void, unknown> {
// 	const containerStack: ContainerInfo[] = [];

// 	function* traverse(node: Node, depth: number, indexInParent: number): Generator<TokenizationEvent> {
// 		// 컨테이너 여부 판단
// 		const nodeName = node.nodeName;

// 		const isTokenBoundary = nodeName === "BR" || BLOCK_ELEMENTS[nodeName];

// 		// 논리적으로 의미가 있는, 토큰화에 쓸모 있는 정보를 제공할 수 있는 container 노드만 취급
// 		const isContainer =
// 			BLOCK_ELEMENTS[nodeName] || // 블럭요소는 블럭의 시작과 끝을 판단하는데 필요
// 			nodeName === "TABLE" || // 마찬가지 테이블 행의 시작과 끝
// 			nodeName === "TR" || // 테이블 행의 시작과 끝
// 			nodeName === "TD" || // 테이블 셀의 시작과 끝
// 			nodeName === "TH" || // 테이블 셀의 시작과 끝
// 			nodeName === "SUP" || // SUP
// 			nodeName === "SUB"; // SUB

// 		if (isContainer) {
// 			const containerInfo: ContainerInfo = {
// 				node,
// 				depth,
// 			};

// 			containerStack.push(containerInfo);
// 			yield { type: "containerStart", container: containerInfo };
// 		}

// 		if (node.nodeType === 3) {
// 			// 텍스트 노드일 때
// 			if (containerStack.length > 0) {
// 				const parentContainer = containerStack[containerStack.length - 1];
// 				yield {
// 					type: "textNode",
// 					node: node as Text,
// 					parent: parentContainer,
// 					indexInParent,
// 					text: node.nodeValue!,
// 				};
// 				if (containerStack.length > 0) {
// 					containerStack[containerStack.length - 1].tokenCount++;
// 				}
// 			}
// 		} else if (node.nodeType === 1) {
// 			if (nodeName === "IMG") {
// 				yield { type: "img", node, src: (node as HTMLImageElement).src, indexInParent };
// 			}
// 			if (nodeName === "BR") {
// 				yield { type: "break" };
// 			}
// 			if (nodeName === "A") {
// 				return;
// 			}
// 			// 엘리먼트 노드
// 			let childIndex = 0;
// 			for (const child of node.childNodes) {
// 				yield* traverse(child, depth + 1, childIndex++);
// 			}
// 		}

// 		if (isContainer) {
// 			const containerInfo = containerStack.pop()!;
// 			yield { type: "containerEnd", container: containerInfo };
// 		}
// 	}

// 	yield* traverse(root, 0, 0);
// }

// function* tokenize2(ctx: TokinizeContext) {
// 	const tokens: RichToken[] = (ctx.tokens ??= []);
// 	let tokenIndex = 0;
// 	let buffer: TextTokenizationEvent[] = [];

// 	const iterator = tokenizeWithContainers(ctx.content);
// 	let nextResult = iterator.next();

// 	let currentToken: RichToken | null = null;
// 	let currentFlags = LINE_START;
// 	let shouldNormalize = false;
// 	let containerStack: ContainerInfo[] = [];

// 	let currentContainer: ContainerInfo = {
// 		node: ctx.content,
// 		depth: 0,
// 		indexInParent: 0,
// 		tokenStartIndex: 0,
// 		tokenCount: 0,
// 		commonFlags: 0,
// 	};

// 	function processToken(textNode: Text, startOffset: number, endOffset: number, flags: number = 0) {
// 		let str = textNode.nodeValue!.slice(startOffset, endOffset);
// 		if (shouldNormalize) {
// 			str = normalize(str);
// 			shouldNormalize = false;
// 		}
// 		if (currentToken) {
// 			currentToken.text += str;
// 			currentToken.endContainer = textNode;
// 			currentToken.endOffset = endOffset;
// 		} else {
// 			currentToken = {
// 				text: str,
// 				flags: currentFlags | flags,
// 				startContainer: textNode,
// 				startOffset: startOffset,
// 				endContainer: textNode,
// 				endOffset: endOffset,
// 			};
// 		}
// 	}

// 	function finalizeToken(flags: number = 0) {
// 		if (currentToken) {
// 			currentToken.flags |= flags;
// 			tokens[tokenIndex] = currentToken;
// 			tokenIndex++;
// 			currentToken = null;
// 			currentFlags = 0;
// 		}
// 	}

// 	function findInTrie2(trie: TrieNode, buffer: TextTokenizationEvent[], bufferIndex: number, bufferCount: number, charIndex: number) {
// 		let node: TrieNode | null = trie;
// 		let i = bufferIndex;
// 		let j = charIndex;
// 		do {
// 			const text = buffer[i].text;
// 			for (; j < text.length; j++) {
// 				node = node!.next(text[j]);
// 				if (!node) {
// 					return null;
// 				}
// 				if (node.word) {
// 					return { bufferIndex: i, charIndex: j + 1, word: node.word, flags: node.flags };
// 				}
// 			}

// 			i++;
// 			j = 0;
// 		} while (i < bufferCount);
// 		return null;
// 	}

// 	while (!nextResult.done) {
// 		let event = nextResult.value;

// 		if (event.type === "textNode") {
// 			console.assert(currentToken === null, "currentToken should be null at this point");
// 			let bufferCount = 0;
// 			do {
// 				buffer[bufferCount++] = event;
// 			} while (!(nextResult = iterator.next()).done && (event = nextResult.value).type === "textNode");

// 			let i = 0;
// 			OUTER: for (let bufferIndex = 0; bufferIndex < bufferCount; bufferIndex++) {
// 				const text = buffer[bufferIndex].text;
// 				const textLen = text.length;
// 				let currentStart = -1;
// 				for (; i < textLen; i++) {
// 					let char = text[i];
// 					char = normalizedCharMap[char] || char; // normalize the character
// 					if (spaceChars[char]) {
// 						if (currentStart !== -1) {
// 							processToken(buffer[bufferIndex].node, currentStart, i);
// 							currentStart = -1;
// 						}
// 						finalizeToken();
// 					} else {
// 						// 모든 문자에 대해서 trie를 탐색하는건 너무 비효율적이라서...
// 						if (char === "(") {
// 							// 정말 지저분하지만... 별 수 없다.
// 							const found = findInTrie2(wildcardTrieNode, buffer, bufferIndex, bufferCount, i + 1);
// 							if (found) {
// 								const startContainer = buffer[bufferIndex].node;
// 								const startOffset = i;
// 								if (currentStart !== -1) {
// 									processToken(buffer[bufferIndex].node, currentStart, i);
// 									currentStart = -1;
// 								}
// 								finalizeToken();
// 								tokens[tokenIndex++] = {
// 									text: found.word,
// 									flags: currentFlags | found.flags,
// 									startContainer,
// 									startOffset,
// 									endContainer: buffer[found.bufferIndex].node,
// 									endOffset: found.charIndex,
// 								};
// 								currentFlags = 0;
// 								bufferIndex = found.bufferIndex - 1;
// 								i = found.charIndex; // continue OUTER로 넘어갈 때 i++는 실행이 안된다!
// 								continue OUTER;
// 							}
// 						}
// 						if (currentFlags & LINE_START && sectionHeadingStartChars[char]) {
// 							const found = findInTrie2(SectionHeadingTrieNode, buffer, bufferIndex, bufferCount, i);
// 							if (found) {
// 								const startContainer = buffer[bufferIndex].node;
// 								const startOffset = i;
// 								if (currentStart !== -1) {
// 									processToken(buffer[bufferIndex].node, currentStart, i);
// 									currentStart = -1;
// 								}
// 								finalizeToken();
// 								tokens[tokenIndex++] = {
// 									text: found.word,
// 									flags: currentFlags | found.flags,
// 									startContainer,
// 									startOffset,
// 									endContainer: buffer[found.bufferIndex].node,
// 									endOffset: found.charIndex,
// 								};
// 								currentFlags = 0;
// 								bufferIndex = found.bufferIndex - 1;
// 								i = found.charIndex; // continue OUTER로 넘어갈 때 i++는 실행이 안된다!
// 								continue OUTER;
// 							}
// 						}

// 						if (normalizedCharMap[char]) {
// 							shouldNormalize = true;
// 						}

// 						if (currentStart === -1) {
// 							currentStart = i;
// 						}
// 					}
// 				}
// 				if (currentStart !== -1) {
// 					processToken(buffer[bufferIndex].node, currentStart, textLen);
// 				}

// 				i = 0;
// 			}

// 			if (currentToken) {
// 				finalizeToken();
// 			}
// 			if (nextResult.done) {
// 				break;
// 			}
// 		}

// 		console.assert(currentToken === null, "currentToken should be null at this point");

// 		if (event.type === "containerStart") {
// 			containerStack.push(currentContainer);
// 			currentContainer = event.container;
// 			currentContainer.tokenStartIndex = tokenIndex;
// 		} else if (event.type === "containerEnd") {
// 			currentContainer.tokenCount = tokenIndex - currentContainer.tokenStartIndex;
// 			(currentContainer.node as HTMLElement).dataset.tokenStart = String(currentContainer.tokenStartIndex);
// 			(currentContainer.node as HTMLElement).dataset.tokenEnd = String(tokenIndex);

// 			const nodeName = currentContainer.node.nodeName;
// 			const firstToken = tokens[currentContainer.tokenStartIndex];
// 			const lastToken = tokens[tokenIndex - 1];

// 			if (currentContainer.commonFlags !== 0) {
// 				for (let i = currentContainer.tokenStartIndex; i < tokenIndex; i++) {
// 					tokens[i].flags |= currentContainer.commonFlags;
// 				}
// 			}

// 			if (TEXT_FLOW_CONTAINERS[nodeName]) {
// 				if (firstToken) {
// 					firstToken.flags |= currentFlags | CONTAINER_START | BLOCK_START | LINE_START;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= CONTAINER_END | BLOCK_END | LINE_END;
// 				}
// 			} else if (LINEBREAK_ELEMENTS[nodeName]) {
// 				if (firstToken) {
// 					firstToken.flags |= currentFlags | LINE_START;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= LINE_END;
// 				}
// 			}

// 			if (LINE_ELEMENTS[nodeName]) {
// 				if (firstToken) {
// 					firstToken.flags |= currentFlags | LINE_START;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= LINE_END;
// 				}
// 			}

// 			if (nodeName === "TD" || nodeName === "TH") {
// 				if (firstToken) {
// 					firstToken.flags |= TABLECELL_START | NO_JOIN_PREV;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= TABLECELL_END | NO_JOIN_NEXT;
// 				}
// 			} else if (nodeName === "TR") {
// 				if (firstToken) {
// 					firstToken.flags |= TABLEROW_START | NO_JOIN_PREV;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= TABLEROW_END | NO_JOIN_NEXT;
// 				}
// 			} else if (nodeName === "TABLE") {
// 				if (firstToken) {
// 					firstToken.flags |= TABLE_START;
// 				}
// 				if (lastToken) {
// 					lastToken.flags |= TABLE_END;
// 				}
// 			}

// 			currentContainer = containerStack.pop()!;
// 			currentFlags &= ~CONTAINER_START;
// 		} else if (event.type === "break") {
// 			if (tokenIndex > 0) {
// 				tokens[tokenIndex - 1].flags |= LINE_END;
// 			}
// 			currentFlags |= LINE_START;
// 		} else if (event.type === "img") {
// 			tokens[tokenIndex++] = {
// 				text: event.src || "🖼️",
// 				flags: IMAGE | NO_JOIN_PREV | NO_JOIN_NEXT | currentFlags,
// 				startContainer: event.node.parentNode!,
// 				startOffset: currentContainer.indexInParent,
// 				endContainer: event.node.parentNode!,
// 				endOffset: currentContainer.indexInParent + 1,
// 			};
// 		}

// 		nextResult = iterator.next();
// 	}

// 	if (currentToken) {
// 		finalizeToken();
// 	}

// 	tokens.length = tokenIndex;
// 	return tokens;
// }

//
// 왕왕 큰 함수. 그래도 괜히 여러 함수로 쪼개서 성능 손해 보고 싶지 않은 마음...
function* tokenizer(ctx: TokinizeContext, idleDeadline: IdleDeadline): Generator<void> {
	const tokens: RichToken[] = [];
	const containers: Map<HTMLElement, RichTokenContainer> = new Map();
	const root = ctx.content;
	const textNodes: Text[] = [];
	const textNodeIndices: number[] = [];
	let tokenIndex = 0;
	let currentToken: RichToken | null = null;
	let nextTokenFlags = 0;
	let recursionCount = 0;

	const containerStack: RichTokenContainer[] = [];
	let currentContainer: RichTokenContainer = null!;

	function processToken(textNode: Text, startOffset: number, endOffset: number, flags: number = 0) {
		if (currentToken) {
			currentToken.text += textNode.nodeValue!.slice(startOffset, endOffset);
			(currentToken.range as LightRange).endContainer = textNode;
			(currentToken.range as LightRange).endOffset = endOffset;
		} else {
			currentToken = {
				text: textNode.nodeValue!.slice(startOffset, endOffset),
				flags: nextTokenFlags | flags,
				range: {
					startContainer: textNode,
					startOffset: startOffset,
					endContainer: textNode,
					endOffset: endOffset,
				},
				container: currentContainer,
			};
			nextTokenFlags = 0;
		}
	}

	function finalizeToken(flags: number = 0) {
		if (currentToken) {
			currentToken.flags |= flags;
			tokens[tokenIndex++] = currentToken;
			currentToken = null;
		}
	}

	function findInTrie2(trie: TrieNode, bufferIndex: number, charIndex: number) {
		let node: TrieNode | null = trie;
		let i = bufferIndex;
		let j = charIndex;
		do {
			const text = textNodes[i].nodeValue!;
			for (; j < text.length; j++) {
				let ch = text[j];
				ch = normalizedCharMap[ch] || ch;
				node = node!.next(ch);
				if (!node) {
					return null;
				}
				if (node.word) {
					return { bufferIndex: i, charIndex: j + 1, word: node.word, flags: node.flags };
				}
			}

			i++;
			j = 0;
		} while (i < textNodes.length);
		return null;
	}

	function doTokenize() {
		console.assert(textNodes.length > 0, "textNodes should not be empty at this point");
		let nodeIndex = 0;
		let charIndex = 0;

		// for loop를 쓰면 머리 아파진다.
		// trie 매칭이 성공 했을때 임의로 nodeIndex와 charIndex를 advance 시켜야하기 때문에
		// continue 할때 인덱스 값을 하나 빼줘야하는지 말아야하는지 생각을 안해도 된다면 그것만으로 while의 가치는 충분함!
		do {
			const textNode = textNodes[nodeIndex];
			const text = textNode.nodeValue!;
			const textLen = text.length;
			let shouldNormalize = false;
			let currentStart = -1;

			while (charIndex < textLen) {
				// 4byte 문자를 생각해야한다. later....
				const cp = text.codePointAt(charIndex)!;
				// todo 문자가 아니라 코드포인트로 spaceChar나 normalizeChar 등등 확인하기

				let char = text[charIndex];

				if (spaceChars[char]) {
					// split here
					if (currentStart !== -1) {
						processToken(textNode, currentStart, charIndex);
						currentStart = -1;
					}
					finalizeToken();
				} else {
					if (char === "(") {
						const match = findInTrie2(wildcardTrieNode, nodeIndex, charIndex + 1);
						if (match) {
							const startContainer = textNode;
							const startOffset = charIndex;
							if (currentStart !== -1) {
								processToken(textNode, currentStart, charIndex);
								currentStart = -1;
							}
							finalizeToken();
							tokens[tokenIndex++] = {
								text: match.word,
								flags: nextTokenFlags | match.flags,
								range: {
									startContainer,
									startOffset,
									endContainer: textNodes[match.bufferIndex],
									endOffset: match.charIndex,
								},
								container: currentContainer,
							};
							nextTokenFlags = 0;
							nodeIndex = match.bufferIndex;
							charIndex = match.charIndex;
							continue;
						}
					}
					if (sectionHeadingStartChars[char] && nextTokenFlags & TokenFlags.LINE_START) {
					}

					if (currentStart === -1) {
						currentStart = charIndex;
					}
				}
				// ...
				// ...
				charIndex++;
				if (cp > 0xffff) {
					charIndex++;
				}
			}
			if (currentStart !== -1) {
				processToken(textNode, currentStart, textLen);
				currentStart = -1;
			}
			nodeIndex++;
			charIndex = 0;
		} while (nodeIndex < textNodes.length);

		finalizeToken();

		textNodes.length = 0;
		textNodeIndices.length = 0;
	}

	function* traverse(node: Node): Generator<void> {
		const nodeName = node.nodeName;
		const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === ctx.content;
		const isBlockElement = BLOCK_ELEMENTS[nodeName];

		let containerCreated = false;
		if (isBlockElement || isTextFlowContainer) {
			nextTokenFlags |= TokenFlags.BLOCK_START | TokenFlags.LINE_START;
			if (isTextFlowContainer) {
				nextTokenFlags |= TokenFlags.CONTAINER_START;
			}
			containerStack.push(currentContainer);
			currentContainer = {
				element: node as HTMLElement,
				depth: (currentContainer?.depth ?? -1) + 1,
				startTokenIndex: tokenIndex,
				tokenCount: 0,
				parent: currentContainer || null,
			};
			containerCreated = true;
		}

		const isTokenBoundary = isTextFlowContainer || isBlockElement || nodeName === "TD";
		if (isTokenBoundary && textNodes.length > 0) {
			doTokenize();
		}

		const childNodes = node.childNodes;
		const tokenStartIndex = tokenIndex;

		for (let i = 0; i < childNodes.length; i++) {
			// ++recursionCount % 31 === 0 이렇게 해도 되지만 비트연산을 쓰면 뭔가 있어 보인다. 눈꼽만큼 더 빠를걸?
			if ((++recursionCount & 31) === 0 && idleDeadline.timeRemaining() < 1) {
				idleDeadline = yield;
			}

			const child = childNodes[i];
			if (child.nodeType === 3) {
				textNodes.push(child as Text);
				textNodeIndices.push(i);
			} else if (child.nodeType === 1) {
				const childNodeName = child.nodeName;

				// 재귀 호출을 안해도 되는 단순한 case
				if (childNodeName === "A" || VOID_ELEMENTS[childNodeName]) {
					if (childNodeName === "BR" || childNodeName === "HR") {
						if (textNodes.length > 0) {
							doTokenize();
						}
						nextTokenFlags |= TokenFlags.LINE_END;
					} else if (childNodeName === "IMG") {
						if (textNodes.length > 0) {
							doTokenize();
						}
						const range = document.createRange();
						range.selectNode(child);
						tokens[tokenIndex++] = {
							text: (child as HTMLImageElement).src,
							flags: TokenFlags.IMAGE | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | nextTokenFlags,
							range,
							container: currentContainer,
						};
						nextTokenFlags = 0;
					}
					continue;
				}

				yield* traverse(child);
			}
		}

		if (isTokenBoundary && textNodes.length > 0) {
			doTokenize();
		}

		const tokenCount = tokenIndex - tokenStartIndex;
		if (tokenCount > 0) {
			const firstToken = tokens[tokenStartIndex];
			const lastToken = tokens[tokenIndex - 1];

			if (nodeName === "SUP" || nodeName === "SUB") {
				// SUP + SUP는 조인이 가능해야 하므로 NO_JOIN_PREV, NO_JOIN_NEXT 플래그를 주지 않음
				// 예: <sup>주</sup><sup>1)</sup> 이런 거지같은 상황이 나올 수도 있다.
				const commonFlags = nodeName === "SUP" ? TokenFlags.HTML_SUP : TokenFlags.HTML_SUB;
				for (let i = tokenStartIndex; i < tokenIndex; i++) {
					tokens[i].flags |= commonFlags;
				}
			} else if (nodeName === "TD" || nodeName === "TH") {
				if (firstToken) {
					firstToken.flags |=
						TokenFlags.TABLECELL_START | TokenFlags.NO_JOIN_PREV | TokenFlags.CONTAINER_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
				}
				if (lastToken) {
					lastToken.flags |=
						TokenFlags.TABLECELL_END | TokenFlags.NO_JOIN_NEXT | TokenFlags.CONTAINER_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				}
			} else if (nodeName === "TR") {
				if (firstToken) {
					firstToken.flags |= TokenFlags.TABLEROW_START;
				}
				if (lastToken) {
					lastToken.flags |= TokenFlags.TABLEROW_END;
				}
			} else if (nodeName === "TABLE") {
				if (firstToken) {
					firstToken.flags |= TokenFlags.TABLE_START;
				}
				if (lastToken) {
					lastToken.flags |= TokenFlags.TABLE_END;
				}
			}

			if (BLOCK_ELEMENTS[nodeName]) {
				if (firstToken) {
					firstToken.flags |= nextTokenFlags | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
				}
				if (lastToken) {
					lastToken.flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				}
				nextTokenFlags |= TokenFlags.LINE_START;
			}

			if (node === ctx.content) {
				firstToken.flags |= nextTokenFlags | TokenFlags.BLOCK_START | TokenFlags.CONTAINER_START | TokenFlags.LINE_START;
				lastToken.flags |= TokenFlags.BLOCK_END | TokenFlags.CONTAINER_END | TokenFlags.LINE_END;
			}
		}

		if (containerCreated) {
			if (tokenCount > 0) {
				currentContainer.startTokenIndex = tokenStartIndex;
				currentContainer.tokenCount = tokenCount;
				containers.set(node as HTMLElement, currentContainer);
			}
			currentContainer = containerStack.pop()!;
		}
	}

	yield* traverse(root);
	tokens.length = tokenIndex;

	return { tokens, containers };
}
