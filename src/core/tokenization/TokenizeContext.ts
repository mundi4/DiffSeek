import { type TrieNode } from "./trie";
import { normalizedCharMap } from "./normalizedCharMap";
import { wildcardTrieNode } from "./wildcards";
import { sectionHeadingStartChars, SectionHeadingTrieNode } from "./section-headings";
import { TokenFlags } from "./TokenFlags";
import { BLOCK_ELEMENTS, DIFF_TAG_NAME, MANUAL_ANCHOR_ELEMENT_NAME, TEXT_FLOW_CONTAINERS } from "../constants";
import { findBlockParent } from "@/utils/findBlockParent";
import { createImageLoader, type ImageLoadResult } from "../imageCache";

export const MANUAL_ANCHOR1 = "🔗@";
export const MANUAL_ANCHOR2 = "🔗#";

export const enum TokenRangeType {
	TEXT = 1,
	ELEMENT = 2,
}

export type TokenRange =
	| {
		type: TokenRangeType.TEXT;
		node: Text;
		offset: number;
		endNode: Text;
		endOffset: number;
	}
	| {
		type: TokenRangeType.ELEMENT;
		node: Element;
	};

export type RichToken = {
	text: string;
	flags: number;
	range: TokenRange;
	//container: TextFlowContainer;
	// for image tokens
	data?: Uint8ClampedArray;
	width?: number;
	height?: number;
	lineBreakerElement?: HTMLElement;
};

// const normalizeChars: { [ch: string]: string } = {};

let ctx: OffscreenCanvasRenderingContext2D | null = null;

const IMAGE_SIZE = 500;
function getImageData(img: HTMLImageElement): ImageData {
	if (!ctx) {
		const canvas = new OffscreenCanvas(IMAGE_SIZE, IMAGE_SIZE);
		ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to create OffscreenCanvasRenderingContext2D");
		}
	}
	ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
	return ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
}

const spaceChars: Record<string, boolean> = {
	" ": true,
	"\t": true,
	"\n": true,
	"\u00A0": true, // &nbsp; ??
	"\r": true, // 글쎄...
	"\f": true, // 이것들은...
	"\v": true, // 볼일이 없을것...
};

function normalizeCharacters(text: string): string {
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

export type TokenizeResult = {
	tokens: RichToken[],
	imageMap: Map<RichToken, ImageLoadResult>,
};

export type ImageProps = {
	elem: HTMLImageElement;
	hasFixedSize: boolean;
	hash?: string;
	dataUrl?: string;
	ensureLoaded: () => Promise<{ hash: string, dataUrl: string }>;
	// lastLoadedSrc: string;
	// _promise?: Promise<{ hash: string, dataUrl: string }>;
}

export class TokenizeContext {
	#rootContent: HTMLElement;
	#onDone: (result: TokenizeResult) => void;
	#cancellable = { cancelled: false };
	// #cancelled: boolean;
	#generator: AsyncGenerator<void, TokenizeResult, IdleDeadline> | null = null;
	#callbackId: number | null = null;
	#imageMap: Map<RichToken, ImageLoadResult> = new Map();
	#imageDataCache: Map<string, { dataUrl: string }> = new Map(); // 

	constructor(rootContent: HTMLElement, onDone: (result: TokenizeResult) => void) {
		this.#rootContent = rootContent;
		this.#onDone = onDone;
	}

	start() {
		if (this.#cancellable.cancelled) {
			throw new Error("Cannot start a cancelled context");
		}

		if (this.#callbackId !== null) {
			throw new Error("Cannot reuse context");
		}

		this.#queueNextStep();
	}

	cancel() {
		this.#cancellable.cancelled = true;
		if (this.#callbackId !== null) {
			cancelIdleCallback(this.#callbackId);
			this.#callbackId = null;
		}
	}

	get cancelled() {
		return this.#cancellable.cancelled;
	}

	set cancelled(value: boolean) {
		if (value) {
			this.cancel();
		}
	}

	async #step(idleDeadline: IdleDeadline): Promise<void> {
		if (this.#cancellable.cancelled) {
			return;
		}

		if (this.#generator === null) {
			// idleDeadline과 함께 generator를 생성을 하려면 여기에서 생성해야 함.
			this.#generator = this.#generateAsync(idleDeadline);
		}

		const { done, value } = await this.#generator.next(idleDeadline);
		if (this.#cancellable.cancelled) {
			return;
		}

		if (done) {
			this.#onDone(value);
		} else {
			this.#queueNextStep();
		}
	}

	#queueNextStep() {
		this.#callbackId = requestIdleCallback(async (IdleDeadline) => await this.#step(IdleDeadline), { timeout: 500 });
	}

	async *#generateAsync(idleDeadline: IdleDeadline): AsyncGenerator<void, TokenizeResult, IdleDeadline> {
		const tokens: RichToken[] = [];
		const root = this.#rootContent;
		const textNodeBuf: Text[] = [];
		const textNodeBufIndices: number[] = [];
		const imageMap = this.#imageMap;
		const imageDataCache = this.#imageDataCache;
		const loadImagePromises = new Map<string, Promise<{ hash: string, dataUrl: string }>>();
		const imageLoader = createImageLoader();
		const cancellable: { cancelled: boolean } = this.#cancellable;

		let tokenIndex = 0;
		let currentToken: RichToken | null = null;
		let nextTokenFlags = 0;
		let recursionCount = 0;
		let lineNum = 1;
		let shouldNormalize = false;
		let lastLineBreakElem: HTMLElement | null = null;

		function processToken(textNode: Text, startOffset: number, endOffset: number, flags: number = 0) {
			if (import.meta.env.DEV) {
				console.assert(currentToken === null || currentToken.range.type === TokenRangeType.TEXT, "currentToken should be null or text type here");
			}

			let text = textNode.nodeValue!.slice(startOffset, endOffset);
			if (shouldNormalize) {
				text = normalizeCharacters(text);
				shouldNormalize = false;
			}

			if (currentToken) {
				currentToken.text += text;
				(currentToken.range as Extract<TokenRange, { type: TokenRangeType.TEXT }>).endNode = textNode;
				(currentToken.range as Extract<TokenRange, { type: TokenRangeType.TEXT }>).endOffset = endOffset;
			} else {
				currentToken = {
					text: text,
					flags: nextTokenFlags | flags,
					range: {
						type: TokenRangeType.TEXT,
						node: textNode,
						offset: startOffset,
						endNode: textNode,
						endOffset: endOffset,
					},
					//container: currentContainer,
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

				flags = currentToken.flags;
				if (flags & TokenFlags.LINE_START) {
					if (lastLineBreakElem) {
						currentToken.lineBreakerElement = lastLineBreakElem;
						lastLineBreakElem = null;
					}
				}

				currentToken = null;
			}
		}

		function findInTrie(trie: TrieNode, bufferIndex: number, charIndex: number) {
			let node: TrieNode | null = trie;
			let i = bufferIndex;
			let j = charIndex;
			do {
				let text = textNodeBuf[i].nodeValue!;
				for (; j < text.length; j++) {
					let cp = text.codePointAt(j)!;
					cp = normalizedCharMap[cp] ?? cp;
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
					const cp = text.codePointAt(charIndex)!;
					if (normalizedCharMap[cp] !== undefined) {
						shouldNormalize = true;
					}

					const char = text[charIndex];
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
								const startNode = textNode;
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
										type: TokenRangeType.TEXT,
										node: startNode,
										offset: startOffset,
										endNode: textNodeBuf[match.bufferIndex],
										endOffset: match.charIndex,
									},
									//container: currentContainer,
								};
								nextTokenFlags = 0;
								finalizeToken();
								nodeIndex = match.bufferIndex;
								charIndex = match.charIndex;
								continue OUTER;
							}
						}

						if (
							nextTokenFlags & TokenFlags.LINE_START &&
							sectionHeadingStartChars[char] &&
							!currentToken && currentStart === -1
						) {
							const match = findInTrie(SectionHeadingTrieNode, nodeIndex, charIndex);
							if (match) {
								const startNode = textNode;
								const startOffset = charIndex;
								if (currentStart !== -1) {
									processToken(textNode, currentStart, charIndex);
									currentStart = -1;
								}
								finalizeToken();
								currentToken = {
									text: match.word.trimEnd(), // 좀 억지스러운데 가장 쉬운 방법...
									flags: nextTokenFlags | match.flags,
									range: {
										type: TokenRangeType.TEXT,
										node: startNode,
										offset: startOffset,
										endNode: textNodeBuf[match.bufferIndex],
										endOffset: match.charIndex,
									},
									//container: currentContainer,
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

		function handleImage(elem: HTMLImageElement) {
			const text = `$img:${++imgSeen}`;
			const token = currentToken = {
				text,
				flags: TokenFlags.IMAGE | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | nextTokenFlags,
				range: {
					type: TokenRangeType.ELEMENT,
					node: elem,
				},
			};
			finalizeToken();
			nextTokenFlags = 0;

			elem.dataset.tokenIndex = String(tokens.length - 1);
			const props = imageLoader.load(elem, cancellable);
			imageMap.set(token, props);
			return { token, props };



			// const hasFixedSize = isImageSizeFixed(elem);
			// let lastLoadedSrc: string | undefined;
			// let promise: Promise<{ hash: string; dataUrl: string }> | undefined;
			// const props: ImageProps = {
			// 	elem,
			// 	hasFixedSize,
			// 	hash: undefined,
			// 	dataUrl: undefined,
			// 	ensureLoaded: () => {
			// 		if (lastLoadedSrc !== elem.src) {
			// 			lastLoadedSrc = elem.src;
			// 			props.hash = props.dataUrl = undefined;
			// 			delete elem.dataset.hash;
			// 			delete elem.dataset.dataurl;

			// 			promise = (async () => {
			// 				const { hash, dataUrl } = await loadImageDataBySrc(elem.src);
			// 				console.log("image loaded", { src: elem.getAttribute("src"), srcUrl: elem.src, hash, dataUrl });
			// 				props.hash = hash;
			// 				props.dataUrl = dataUrl;
			// 				token.text = `$img:${hash}`;
			// 				elem.dataset.hash = hash;
			// 				return { hash, dataUrl };
			// 			})();
			// 		}
			// 		return promise!;
			// 	},
			// };
			// props.ensureLoaded(); // do not wait




		}

		async function* traverse(node: Node, idleDeadline: IdleDeadline): AsyncGenerator<void, void, IdleDeadline> {
			const nodeName = node.nodeName;
			const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === root;
			const isBlockElement = BLOCK_ELEMENTS[nodeName];

			const isTokenBoundary = isTextFlowContainer || isBlockElement || nodeName === "TD" || nodeName === "SUP" || nodeName === "SUB";
			if (isTokenBoundary && textNodeBuf.length > 0) {
				doTokenizeText();
			}

			if (isBlockElement) {
				// 블럭요소 안에 토큰이 하나도 없을 수도 있다. 그런 경우 nextTokenFlags는 소비되지 않기 때문에 블럭이 끝난 이후에도 남아있게 된다.
				// 블럭요소가 끝날 때 nextTokenFlags를 리셋해주는 방법도 사용할 수 없다. 블럭 안에 블럭이 있을 수 있기 때문에.
				// 블럭요소를 stack으로 관리해도 되지만 지금은 그냥 TokenFlags.BLOCK_START를 쓰지 않고 TokenFlags.LINE_START만 쓴다.
				// TokenFlags.LINE_START는 블럭이 끝난 이후에도 유효한 값이다. 블럭요소 직후에는 당연히 새로운 줄이 시작되니까.
				nextTokenFlags |= TokenFlags.LINE_START;
				lastLineBreakElem = null;
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
						//const { token, props } = 
						handleImage(child as HTMLImageElement);
						continue;
					}

					if (isManualAnchorElement(child as Element)) {
						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}
						nextTokenFlags |= TokenFlags.LINE_START;
						lineNum++;

						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}

						currentToken = {
							text: (child as HTMLAnchorElement).dataset.manualAnchor === "B" ? MANUAL_ANCHOR2 : MANUAL_ANCHOR1,
							flags:
								TokenFlags.MANUAL_ANCHOR |
								TokenFlags.NO_JOIN_PREV |
								TokenFlags.NO_JOIN_NEXT |
								nextTokenFlags |
								TokenFlags.LINE_START |
								TokenFlags.LINE_END,
							range: {
								type: TokenRangeType.ELEMENT,
								node: child as Element,
							},
							// container: currentContainer,
						};
						nextTokenFlags = 0;
						finalizeToken();
						lastLineBreakElem = child as HTMLElement;
						continue;
					}

					if (childNodeName === "BR" || childNodeName === "HR") {
						if (textNodeBuf.length > 0) {
							doTokenizeText();
						}
						nextTokenFlags |= TokenFlags.LINE_START;
						lastLineBreakElem = child as HTMLElement;
						lineNum++;
						continue;
					}

					// yield*  traverse(child); // 비동기 generator로 변경
					const gen = traverse(child, idleDeadline);
					let result = await gen.next(idleDeadline);
					while (!result.done) {
						idleDeadline = yield result.value;
						result = await gen.next(idleDeadline);
					}
				}
			}

			if (isTokenBoundary && textNodeBuf.length > 0) {
				doTokenizeText();
			}

			const tokenEndIndex = tokenIndex;
			const tokenCount = tokenEndIndex - tokenStartIndex;
			if (tokenCount > 0) {
				if (node.nodeName === "TABLE") {
					tokens[tokenStartIndex].flags |= TokenFlags.TABLE_START | TokenFlags.TABLECELL_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
					tokens[tokenEndIndex - 1].flags |= TokenFlags.TABLE_END | TokenFlags.TABLECELL_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				} else if (node.nodeName === "TD" || node.nodeName === "TH") {
					tokens[tokenStartIndex].flags |= TokenFlags.TABLECELL_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
					tokens[tokenEndIndex - 1].flags |= TokenFlags.TABLECELL_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				} else if (isBlockElement) {
					tokens[tokenStartIndex].flags |= TokenFlags.BLOCK_START | TokenFlags.LINE_START;
					tokens[tokenEndIndex - 1].flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
				}
				if (node.nodeName === "SUP" || node.nodeName === "SUB") {
					for (let j = tokenStartIndex; j < tokenEndIndex; j++) {
						tokens[j].flags |= node.nodeName === "SUP" ? TokenFlags.HTML_SUP : TokenFlags.HTML_SUB;
					}
				}
			}
		}

		const gen = traverse(root, idleDeadline);
		let result = await gen.next(idleDeadline);
		while (!result.done) {
			idleDeadline = yield result.value;
			result = await gen.next(idleDeadline);
		}

		tokens.length = tokenIndex;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token.flags & TokenFlags.LINE_START && i > 0) {
				tokens[i - 1].flags |= TokenFlags.LINE_END;
			}

			const startNode = (token.range.type === TokenRangeType.TEXT ? token.range.node.parentNode : token.range.node) as Element;
			const flags = token.flags;
			if (i === 0 && token.lineBreakerElement) {
				console.log(0, 'lineBreakerElement already set', token.lineBreakerElement, startNode);
			}

			if (!token.lineBreakerElement) {
				if (flags & TokenFlags.BLOCK_START) {
					// ::before 가능
					token.lineBreakerElement = findBlockParent(startNode, root) || undefined;
				} else if (flags & TokenFlags.TABLECELL_START) {
					// ::before 불가
					token.lineBreakerElement = startNode.closest("TD, TH") as HTMLElement;
				} else if (flags & TokenFlags.TABLE_START) {
					// ::before 가능
					token.lineBreakerElement = startNode.closest("TABLE") as HTMLElement;
				}
			}
		}

		const awaitables: Promise<any>[] = [];
		let settledCount = 0;
		let totalCount = 0;
		for (const [richToken, props] of imageMap) {
			if (props.hash) {
				richToken.text = `$img:${props.hash}`;
			} else {
				totalCount++;
				props.promise!.then(() => {
					if (props.hash) {
						richToken.text = `$img:${props.hash}`;
					}
				}).finally(() => {
					settledCount++;
				});
			}
		}

		while (settledCount < totalCount) {
			idleDeadline = yield;
		}

		//await Promise.allSettled(awaitables);

		return { tokens, imageMap };
	}
}

function isManualAnchorElement(elem: Element): boolean {
	return elem.nodeName === MANUAL_ANCHOR_ELEMENT_NAME && (elem as HTMLAnchorElement).classList.contains("manual-anchor");
}