import { BLOCK_ELEMENTS, DIFF_TAG_NAME, HANGUL_ORDER, MANUAL_ANCHOR_ELEMENT_NAME, TEXT_FLOW_CONTAINERS } from "../../constants";

import { createTrie, extractStartCharsFromTrie, type TrieNode } from "./trie";
import { normalizedCharMap } from "./normalizedCharMap";
import { quickHash53ToString } from "@/utils/quickHash53ToString";

export const MANUAL_ANCHOR1 = "🔗@";
export const MANUAL_ANCHOR2 = "🔗#";

export type RichToken = {
	text: string;
	flags: number;
	range: LightRange | Range;
	lineNum: number;
	container: TextFlowContainer;
};

export const enum TokenFlags {
	None = 0,
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
	SECTION_HEADING_TYPE6 = 1 << 24, // 가)

	SECTION_HEADING_MASK = SECTION_HEADING_TYPE1 |
		SECTION_HEADING_TYPE2 |
		SECTION_HEADING_TYPE3 |
		SECTION_HEADING_TYPE4 |
		SECTION_HEADING_TYPE5 |
		SECTION_HEADING_TYPE6,
}

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

// type CharMetadata = {
// 	isSpace: boolean;
// 	isSplit: boolean;
// 	normalizedChar: number;
// 	trieNode: TrieNode | null;
// }

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

export class TokenizeContext {
	#rootContent: HTMLElement;
	#onDone: (tokens: RichToken[]) => void;
	#cancelled: boolean;
	#generator: Generator<void, { tokens: RichToken[]; containers: Map<HTMLElement, TextFlowContainer> }, IdleDeadline> | null = null;
	#callbackId: number | null = null;

	constructor(rootContent: HTMLElement, onDone: (tokens: RichToken[]) => void) {
		this.#rootContent = rootContent;
		this.#onDone = onDone;
		this.#cancelled = false;
	}

	start() {
		if (this.#cancelled) {
			throw new Error("Cannot start a cancelled context");
		}

		if (this.#callbackId !== null) {
			throw new Error("Cannot reuse context");
		}

		this.#queueNextStep();
	}

	cancel() {
		this.#cancelled = true;
		if (this.#callbackId !== null) {
			cancelIdleCallback(this.#callbackId);
			this.#callbackId = null;
		}
	}

	#step(idleDeadline: IdleDeadline): void {
		if (this.#cancelled) {
			return;
		}

		if (this.#generator === null) {
			// idleDeadline과 함께 generator를 생성을 하려면 여기에서 생성해야 함.
			this.#generator = this.#generate(idleDeadline);
		}

		const { done, value } = this.#generator.next(idleDeadline);
		if (this.#cancelled) {
			return;
		}

		if (done) {
			this.#onDone(value.tokens);
		} else {
			this.#queueNextStep();
		}
	}

	#queueNextStep() {
		this.#callbackId = requestIdleCallback((IdleDeadline) => this.#step(IdleDeadline), { timeout: 500 });
	}

	*#generate(idleDeadline: IdleDeadline): Generator<void, { tokens: RichToken[]; containers: Map<HTMLElement, TextFlowContainer> }, IdleDeadline> {
		type _BlockInfo = {
			element: HTMLElement;
			container: TextFlowContainer;
			startTokenIndex: number; // 시작 토큰 인덱스
			tokenCount: number; // 토큰 개수
			depth: number;
		};

		const tokens: RichToken[] = [];
		const containers: Map<HTMLElement, TextFlowContainer> = new Map();
		const root = this.#rootContent;
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

		function doTokenizeText() {
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
						if (sectionHeadingStartChars[char] && nextTokenFlags & TokenFlags.LINE_START && !currentToken && currentStart === -1) {
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
			const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === root;
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
				doTokenizeText();
			}

			const childNodes = node.childNodes;
			const tokenStartIndex = tokenIndex;

			for (let i = 0; i < childNodes.length; i++) {
				if ((++recursionCount & 31) === 0 && idleDeadline.timeRemaining() < 2) {
					idleDeadline = yield;
				}

				const child = childNodes[i];
				if (child.nodeType === 3) {
					textNodeBuf.push(child as Text);
					textNodeBufIndices.push(i);
				} else if (child.nodeType === 1) {
					const childNodeName = child.nodeName;

					if (childNodeName === DIFF_TAG_NAME) {
						continue;
					}

					if (childNodeName === "IMG") {
						if (textNodeBuf.length > 0) {
							doTokenizeText();
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
						continue;
					}

					if (childNodeName === MANUAL_ANCHOR_ELEMENT_NAME && (child as HTMLAnchorElement).classList.contains("manual-anchor")) {
						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}
						nextTokenFlags |= TokenFlags.LINE_START;
						lineNum++;

						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}
						const range = document.createRange();
						range.selectNode(child);
						currentToken = {
							text: (child as HTMLAnchorElement).dataset.manualAnchor === "B" ? MANUAL_ANCHOR2 : MANUAL_ANCHOR1,
							flags:
								TokenFlags.MANUAL_ANCHOR |
								TokenFlags.NO_JOIN_PREV |
								TokenFlags.NO_JOIN_NEXT |
								nextTokenFlags |
								TokenFlags.LINE_START |
								TokenFlags.LINE_END,
							range,
							container: currentContainer,
							lineNum: lineNum,
						};
						nextTokenFlags = 0;
						// console.log("manual anchor found", currentToken.text, currentToken.range);
						finalizeToken();
						continue;
					}

					if (childNodeName === "BR" || childNodeName === "HR") {
						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}
						nextTokenFlags |= TokenFlags.LINE_START;
						lineNum++;
						continue;
					}

					yield* traverse(child);
				}
			}

			if (isTokenBoundary && textNodeBuf.length > 0) {
				doTokenizeText();
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

				if (node === root) {
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
}
