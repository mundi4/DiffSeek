import { type TrieNode } from "./trie";
import { normalizedCharMap } from "./normalizedCharMap";
import { quickHash53ToString } from "@/utils/quickHash53ToString";
import { wildcardTrieNode } from "./wildcards";
import { sectionHeadingStartChars, SectionHeadingTrieNode } from "./section-headings";
import { TokenFlags } from "./TokenFlags";
import { BLOCK_ELEMENTS, DIFF_TAG_NAME, MANUAL_ANCHOR_ELEMENT_NAME, TEXT_FLOW_CONTAINERS } from "../constants";

export const MANUAL_ANCHOR1 = "🔗@";
export const MANUAL_ANCHOR2 = "🔗#";

export type RichToken = {
	text: string;
	flags: number;
	range: LightRange | Range;
	lineNum: number;
	container: TextFlowContainer;
};

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

let imgSeen = 0;

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
					const cp = text.codePointAt(j)!;
					node = node!.next(cp);
					if (!node) {
						return null;
					}
					if (node.word) {
						return { bufferIndex: i, charIndex: j + (cp > 0xFFFF ? 2 : 1), word: node.word, flags: node.flags };
					}
					// Handle 4-byte unicode characters
					if (cp > 0xFFFF) {
						j++; // Skip the next surrogate pair
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
					// Handle 4-byte characters properly
					const cp = text.codePointAt(charIndex)!;
					if (normalizedCharMap[cp] !== undefined) {
						shouldNormalize = true;
					}

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
					// Properly advance through characters, including 4-byte unicode characters
					charIndex++;
					if (cp > 0xffff) {
						charIndex++; // Skip the second surrogate pair for 4-byte characters
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

						const src = (child as HTMLImageElement).src;
						let tokenText;
						if (src && src.startsWith("data:")) {
							tokenText = quickHash53ToString(src);
						} else {
							// 워드에서 복붙할때 임시 경로에 그림파일이 들어가는 경우가 있는데 이후 다른 그림을 복붙할 때 같은 경로에 다른 그림파일이 저장될 수 있다.
							// 그렇기 때문에 경로가 같더라도 같은 그림으로 취급하면 안됨.
							// => 안전빵으로 무조건 다른 그림으로 취급.
							tokenText = `(img${++imgSeen})`;
						}

						currentToken = {
							text: tokenText,
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
