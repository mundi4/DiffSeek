const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";

const enum TokenFlags {
	LINE_START = 1 << 0, // 1
	LINE_END = 1 << 1, // 2
	BLOCK_START = 1 << 2, // 4
	BLOCK_END = 1 << 3, // 8
	CONTAINER_START = 1 << 4, // 16
	CONTAINER_END = 1 << 5, // 32
	TABLE_START = 1 << 6, // 64
	TABLE_END = 1 << 7, // 128
	TABLEROW_START = 1 << 8, // 256
	TABLEROW_END = 1 << 9, // 512
	TABLECELL_START = 1 << 10, // 1024
	TABLECELL_END = 1 << 11, // 2048
	NO_JOIN_PREV = 1 << 12, // 4096 @@@, ### 등등
	NO_JOIN_NEXT = 1 << 13, // 8192 @@@, ### 등등
	WILD_CARD = 1 << 14, // 16384
	MANUAL_ANCHOR = 1 << 15, // 32768  @@@, ### 등등
	IMAGE = 1 << 16, // 65536
	HTML_SUP = 1 << 17, // 131072
	HTML_SUB = 1 << 18, // 262144
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

const spaceChars: Record<string, boolean> = {
	" ": true,
	"\t": true,
	"\n": true,
	"\u00A0": true, // &nbsp; ??
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
};

const splitChars: Record<string, boolean> = {
	"(": true,
	")": true,
	"[": true,
	"]": true,
	"{": true,
	"}": true,
};

// type CharMetadata = {
// 	isSpace: boolean;
// 	isSplit: boolean;
// 	normalizedChar: number;
// 	trieNode: TrieNode | null;
// }

const normalizedCharMap = ((normChars: (string | number)[][]) => {
	const result: Record<number, number> = {};

	let parser: DOMParser;
	function htmlEntityToChar(entity: string) {
		const doc = (parser = parser || new DOMParser()).parseFromString(entity, "text/html");
		const char = doc.body.textContent!;
		if (char.length !== 1) {
			throw new Error("htmlEntityToChar: not a single character entity: " + entity);
		}
		return char.codePointAt(0);
	}

	function getCharCode(char: string | number): number {
		if (typeof char === "number") {
			return char;
		}
		let charCode = char.codePointAt(0);
		if (charCode === 0x26) {
			// &
			charCode = htmlEntityToChar(char);
		}
		return charCode!;
	}

	for (const entry of normChars) {
		const [norm, ...variants] = entry;
		const normCharCode = getCharCode(norm);
		for (const variant of variants) {
			const variantCharCode = getCharCode(variant);
			result[variantCharCode] = normCharCode;
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

function normalize(text: string): string {
	let result = "";
	for (const char of text) {
		const charCode = char.codePointAt(0)!;
		const normCharCode = normalizedCharMap[charCode];
		if (normCharCode !== undefined) {
			result += String.fromCodePoint(normCharCode);
		} else {
			result += char;
		}
	}

	return result;
}

type TokenizeContext = {
	content: HTMLElement;
	cancelled: boolean;
};

// 왕왕 큰 함수. 그래도 괜히 여러 함수로 쪼개서 성능 손해 보고 싶지 않은 마음...
function* tokenizer(ctx: TokenizeContext, idleDeadline: IdleDeadline): Generator<void> {
	type _BlockInfo = {
		element: HTMLElement;
		container: TextFlowContainer;
		startTokenIndex: number; // 시작 토큰 인덱스
		tokenCount: number; // 토큰 개수
		depth: number;
	};

	const tokens: RichToken[] = [];
	const containers: Map<HTMLElement, TextFlowContainer> = new Map();
	const root = ctx.content;
	const textNodeBuf: Text[] = [];
	const textNodeBufIndices: number[] = [];
	let tokenIndex = 0;
	let currentToken: RichToken | null = null;
	let nextTokenFlags = 0;
	let recursionCount = 0;
	let lineNum = 1;
	let shouldNormalize = false;

	const blockStack: _BlockInfo[] = [];
	let currentBlock: _BlockInfo | null = null;

	const containerStack: TextFlowContainer[] = [];
	let currentContainer: TextFlowContainer = {
		element: root as HTMLElement,
		parent: null,
		depth: 0,
		startTokenIndex: 0,
		tokenCount: 0,
	};

	function processToken(textNode: Text, startOffset: number, endOffset: number, flags: number = 0) {
		let text = textNode.nodeValue!.slice(startOffset, endOffset);
		if (shouldNormalize) {
			text = normalize(text);
			shouldNormalize = false;
		}
		if (currentToken) {
			currentToken.text += text;
			(currentToken.range as LightRange).endContainer = textNode;
			(currentToken.range as LightRange).endOffset = endOffset;
		} else {
			currentToken = {
				text: text,
				flags: nextTokenFlags | flags,
				range: {
					startContainer: textNode,
					startOffset: startOffset,
					endContainer: textNode,
					endOffset: endOffset,
				},
				container: currentContainer,
				lineNum: lineNum,
			};
			nextTokenFlags = 0;
		}
	}

	function finalizeToken(flags: number = 0) {
		if (currentToken) {
			currentToken.flags |= flags;
			tokens[tokenIndex] = currentToken;
			if (tokenIndex > 0 && currentToken.flags & TokenFlags.LINE_END) {
				tokens[tokenIndex - 1].flags |= TokenFlags.LINE_END;
			}
			tokenIndex++;
			currentToken = null;
		}
	}

	function findInTrie(trie: TrieNode, bufferIndex: number, charIndex: number) {
		let node: TrieNode | null = trie;
		let i = bufferIndex;
		let j = charIndex;
		do {
			const text = textNodeBuf[i].nodeValue!;
			for (; j < text.length; j++) {
				let ch = text[j];
				// ch = normalizedCharMap[ch] || ch;
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
		} while (i < textNodeBuf.length);
		return null;
	}

	function doTokenize() {
		console.assert(textNodeBuf.length > 0, "textNodes should not be empty at this point");
		let nodeIndex = 0;
		let charIndex = 0;

		OUTER: do {
			const textNode = textNodeBuf[nodeIndex];
			const text = textNode.nodeValue!;
			const textLen = text.length;

			let currentStart = -1;

			while (charIndex < textLen) {
				// 4byte 문자를 생각해야한다. later....
				const cp = text.codePointAt(charIndex)!;
				if (normalizedCharMap[cp] !== undefined) {
					shouldNormalize = true;
				}
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
						const match = findInTrie(wildcardTrieNode, nodeIndex, charIndex + 1);
						if (match) {
							const startContainer = textNode;
							const startOffset = charIndex;
							if (currentStart !== -1) {
								processToken(textNode, currentStart, charIndex);
								currentStart = -1;
							}
							finalizeToken();
							currentToken = {
								text: match.word,
								flags: nextTokenFlags | match.flags,
								range: {
									startContainer,
									startOffset,
									endContainer: textNodeBuf[match.bufferIndex],
									endOffset: match.charIndex,
								},
								container: currentContainer,
								lineNum: lineNum,
							};
							nextTokenFlags = 0;
							finalizeToken();
							nodeIndex = match.bufferIndex;
							charIndex = match.charIndex;
							continue OUTER;
						}
					}
					if (sectionHeadingStartChars[char] && nextTokenFlags & TokenFlags.LINE_START) {
						const match = findInTrie(SectionHeadingTrieNode, nodeIndex, charIndex);
						if (match) {
							const startContainer = textNode;
							const startOffset = charIndex;
							if (currentStart !== -1) {
								processToken(textNode, currentStart, charIndex);
								currentStart = -1;
							}
							finalizeToken();
							currentToken = {
								text: match.word,
								flags: nextTokenFlags | match.flags,
								range: {
									startContainer,
									startOffset,
									endContainer: textNodeBuf[match.bufferIndex],
									endOffset: match.charIndex,
								},
								container: currentContainer,
								lineNum: lineNum,
							};
							nextTokenFlags = 0;
							finalizeToken();
							nodeIndex = match.bufferIndex;
							charIndex = match.charIndex;
							continue OUTER;
						}
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
		} while (nodeIndex < textNodeBuf.length);

		finalizeToken();

		textNodeBuf.length = 0;
		textNodeBufIndices.length = 0;
	}

	function* traverse(node: Node): Generator<void> {
		const nodeName = node.nodeName;
		const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === ctx.content;
		const isBlockElement = BLOCK_ELEMENTS[nodeName];

		if (isTextFlowContainer) {
			containerStack.push(currentContainer);
			currentContainer = {
				element: node as HTMLElement,
				parent: currentContainer,
				depth: currentContainer.depth + 1,
				startTokenIndex: tokenIndex,
				tokenCount: 0,
			};
			nextTokenFlags |= TokenFlags.CONTAINER_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
		}

		if (isBlockElement) {
			if (currentBlock) {
				blockStack.push(currentBlock);
			}
			currentBlock = {
				element: node as HTMLElement,
				container: currentContainer,
				depth: (currentBlock?.depth ?? -1) + 1,
				startTokenIndex: tokenIndex,
				tokenCount: 0,
			};
			nextTokenFlags |= TokenFlags.BLOCK_START | TokenFlags.LINE_START;
		}

		const isTokenBoundary = isTextFlowContainer || isBlockElement || nodeName === "TD";
		if (isTokenBoundary && textNodeBuf.length > 0) {
			doTokenize();
		}

		const childNodes = node.childNodes;
		const tokenStartIndex = tokenIndex;

		for (let i = 0; i < childNodes.length; i++) {
			if ((++recursionCount & 31) === 0 && idleDeadline.timeRemaining() < 1) {
				idleDeadline = yield;
			}

			const child = childNodes[i];
			if (child.nodeType === 3) {
				textNodeBuf.push(child as Text);
				textNodeBufIndices.push(i);
			} else if (child.nodeType === 1) {
				const childNodeName = child.nodeName;

				// 재귀 호출을 안해도 되는 단순한 case
				if (childNodeName === "A" || VOID_ELEMENTS[childNodeName]) {
					if (childNodeName === "BR" || childNodeName === "HR") {
						if (textNodeBuf.length > 0) {
							doTokenize();
						}
						nextTokenFlags |= TokenFlags.LINE_START;
						lineNum++;
					} else if (childNodeName === "IMG") {
						if (textNodeBuf.length > 0) {
							doTokenize();
						}

						const range = document.createRange();
						range.selectNode(child);
						currentToken = {
							text: quickHash53ToString((child as HTMLImageElement).src),
							flags: TokenFlags.IMAGE | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | nextTokenFlags,
							range,
							container: currentContainer,
							lineNum: lineNum,
						};
						nextTokenFlags = 0;
						finalizeToken();
					}
					continue;
				}

				yield* traverse(child);
			}
		}

		if (isTokenBoundary && textNodeBuf.length > 0) {
			doTokenize();
		}

		const tokenEndIndex = tokenIndex;
		const tokenCount = tokenEndIndex - tokenStartIndex;
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
				if (tokenCount > 0) {
					lineNum++;
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
				if (tokenCount > 0) {
					lineNum++;
				}
			}

			if (node === ctx.content) {
				firstToken.flags |= nextTokenFlags | TokenFlags.BLOCK_START | TokenFlags.CONTAINER_START | TokenFlags.LINE_START;
				lastToken.flags |= TokenFlags.BLOCK_END | TokenFlags.CONTAINER_END | TokenFlags.LINE_END;
			}
		}

		if (isBlockElement) {
			if (tokenCount > 0) {
				currentBlock!.tokenCount = tokenEndIndex - currentBlock!.startTokenIndex;
				tokens[tokens.length - 1].flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
			}
			currentBlock = blockStack.pop() || null;
		}

		if (isTextFlowContainer) {
			if (tokenCount > 0) {
				currentContainer.tokenCount = tokenEndIndex - currentContainer.startTokenIndex;
				tokens[tokens.length - 1].flags |= TokenFlags.CONTAINER_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				containers.set(node as HTMLElement, currentContainer);
			}
			currentContainer = containerStack.pop()!;
		}
	}

	yield* traverse(root);

	tokens.length = tokenIndex;
	for (let i = 1; i < tokens.length; i++) {
		if (tokens[i].flags & TokenFlags.LINE_START) {
			tokens[i - 1].flags |= TokenFlags.LINE_END;
		}
	}

	return { tokens, containers };
}

function quickHash53ToString(str: string) {
	let hash = 0n;
	const PRIME = 131n;
	for (let i = 0; i < str.length; i++) {
		hash = hash * PRIME + BigInt(str.charCodeAt(i));
		hash &= 0x1fffffffffffffn; // 53비트 마스크
	}
	return hash.toString(36); // 36진수 문자열 변환
}

