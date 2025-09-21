// import { type TrieNode } from "./trie";
// import { normalizedCharMap } from "./normalizedCharMap";
// import { wildcardTrieNode } from "./wildcards";
// import { sectionHeadingStartChars, SectionHeadingTrieNode } from "./section-headings";
// import { TokenFlags } from "./TokenFlags";
// import {
//     BLOCK_ELEMENTS,
//     DIFF_TAG_NAME,
//     TEXT_FLOW_CONTAINERS,
// } from "../constants";
// import { findBlockParent } from "@/utils/findBlockParent";
// import { createImageLoader, type ImageLoadResult } from "../imageCache";
// import { isManualAnchorElement } from "../utils/isManualAnchorElement";
// import { nextIdle } from "@/utils/nextIdle";

// export const MANUAL_ANCHOR1 = "🔗@";
// export const MANUAL_ANCHOR2 = "🔗#";

// export const enum TokenRangeType {
//     TEXT = 1,
//     ELEMENT = 2,
// }

// export type TokenRange =
//     | {
//         type: TokenRangeType.TEXT;
//         node: Text;
//         offset: number;
//         endNode: Text;
//         endOffset: number;
//     }
//     | {
//         type: TokenRangeType.ELEMENT;
//         node: Element;
//     };

// export type RichToken = {
//     text: string;
//     flags: number;
//     range: TokenRange;
//     data?: Uint8ClampedArray;
//     width?: number;
//     height?: number;
//     lineBreakerElement?: HTMLElement;
// };

// export type TokenizeResult = {
//     tokens: RichToken[];
//     imageMap: Map<RichToken, ImageLoadResult>;
// };

// let imgSeen = 0;

// // /**
// //  * 외부 진입점
// //  */
// // export class Tokenizer {
// //     #root: HTMLElement;
// //     #onDone: (result: TokenizeResult) => void;
// //     #cancellable = new AbortController();
// //     #started = false;
// //     // #abortController = 

// //     constructor(root: HTMLElement, onDone: (result: TokenizeResult) => void) {
// //         this.#root = root;
// //         this.#onDone = onDone;
// //     }

// //     async tokenize() {
// //         if (this.#started) throw new Error("Tokenizer already started");
// //         if (this.#cancellable.signal.aborted) throw new Error("Cancelled");
// //         this.#started = true;
// //         const result = await this.#run();
// //         return { tokens: result!.tokens, imageMap: result!.imageMap };
// //     }

// //     cancel() {
// //         this.#cancellable.abort();
// //     }

// //     get cancelled() {
// //         return this.#cancellable.signal.aborted;
// //     }

// //     async #run() {
// //         const state = new TokenizerState(this.#root, this.#cancellable);

// //         try {
// //             let deadline = await nextIdle();
// //             const gen = state.traverse(this.#root, deadline);
// //             let res = await gen.next(deadline);

// //             while (!res.done) {
// //                 if (this.cancelled) return;
// //                 deadline = await nextIdle();
// //                 res = await gen.next(deadline);
// //             }

// //             state.finalizeLineBreaks();
// //             await state.awaitImages();

// //             if (!this.cancelled) {
// //                 this.#onDone({ tokens: state.tokens, imageMap: state.imageMap });
// //             }
// //             return state;
// //         } catch (err) {
// //             console.error("Tokenizer error:", err);
// //             throw err;
// //         }
// //     }
// // }

// export async function tokenize(root: HTMLElement, cancellable: AbortSignal): Promise<TokenizeResult> {
//     cancellable.throwIfAborted();
//     const state = new TokenizerState(root, cancellable);

//     let deadline = await nextIdle();
//     state.traverse(root, deadline);
//     // let res = await gen.next(deadline);

//     // while (!res.done) {
//     //     cancellable.throwIfAborted();
//     //     deadline = await nextIdle();
//     //     res = await gen.next(deadline);
//     // }

//     state.finalizeLineBreaks();
//     await state.awaitImages();

//     cancellable.throwIfAborted();
//     return { tokens: state.tokens, imageMap: state.imageMap };
// }

// /**
//  * 내부 상태와 토큰화 로직
//  */
// class TokenizerState {
//     tokens: RichToken[] = [];
//     imageMap: Map<RichToken, ImageLoadResult> = new Map();
//     loader = createImageLoader();
//     cancellable: AbortSignal;

//     private tokenIndex = 0;
//     private currentToken: RichToken | null = null;
//     private nextTokenFlags = 0;
//     private recursionCount = 0;
//     private shouldNormalize = false;
//     private lastLineBreakElem: HTMLElement | null = null;
//     private textNodeBuf: Text[] = [];

//     constructor(readonly root: HTMLElement, cancellable: AbortSignal) {
//         this.cancellable = cancellable;
//     }

//     // ----------------------------
//     // Token handling
//     // ----------------------------
//     private processToken(node: Text, start: number, end: number, flags = 0) {
//         let text = node.nodeValue!.slice(start, end);
//         if (this.shouldNormalize) {
//             text = normalizeCharacters(text);
//             this.shouldNormalize = false;
//         }

//         if (this.currentToken) {
//             this.currentToken.text += text;
//             (this.currentToken.range as Extract<TokenRange, { type: TokenRangeType.TEXT }>).endNode = node;
//             (this.currentToken.range as Extract<TokenRange, { type: TokenRangeType.TEXT }>).endOffset = end;
//         } else {
//             this.currentToken = {
//                 text,
//                 flags: this.nextTokenFlags | flags,
//                 range: {
//                     type: TokenRangeType.TEXT,
//                     node,
//                     offset: start,
//                     endNode: node,
//                     endOffset: end,
//                 },
//             };
//             this.nextTokenFlags = 0;
//         }
//     }

//     private finalizeToken(flags = 0) {
//         if (this.currentToken) {
//             this.currentToken.flags |= flags;
//             this.tokens[this.tokenIndex++] = this.currentToken;

//             if (this.currentToken.flags & TokenFlags.LINE_START && this.lastLineBreakElem) {
//                 this.currentToken.lineBreakerElement = this.lastLineBreakElem;
//                 this.lastLineBreakElem = null;
//             }
//             this.currentToken = null;
//         }
//     }

//     // ----------------------------
//     // Trie matchers
//     // ----------------------------
//     private findInTrie(trie: TrieNode, bufIndex: number, charIndex: number) {
//         let node: TrieNode | null = trie;
//         let i = bufIndex;
//         let j = charIndex;

//         do {
//             const text = this.textNodeBuf[i].nodeValue!;
//             for (; j < text.length; j++) {
//                 let cp = text.codePointAt(j)!;
//                 cp = normalizedCharMap[cp] ?? cp;
//                 node = node!.next(cp);
//                 if (!node) return null;
//                 if (node.word) {
//                     return { bufferIndex: i, charIndex: j + (cp > 0xffff ? 2 : 1), word: node.word, flags: node.flags };
//                 }
//                 if (cp > 0xffff) j++;
//             }
//             i++;
//             j = 0;
//         } while (i < this.textNodeBuf.length);
//         return null;
//     }

//     private handleWildcard(nodeIndex: number, charIndex: number, textNode: Text, currentStart: number): boolean {
//         if (textNode.nodeValue![charIndex] === "(") {
//             const match = this.findInTrie(wildcardTrieNode, nodeIndex, charIndex + 1);
//             if (match) {
//                 if (currentStart !== -1) this.processToken(textNode, currentStart, charIndex);
//                 this.finalizeToken();
//                 this.currentToken = {
//                     text: match.word,
//                     flags: this.nextTokenFlags | match.flags,
//                     range: {
//                         type: TokenRangeType.TEXT,
//                         node: textNode,
//                         offset: charIndex,
//                         endNode: this.textNodeBuf[match.bufferIndex],
//                         endOffset: match.charIndex,
//                     },
//                 };
//                 this.nextTokenFlags = 0;
//                 this.finalizeToken();
//                 return true;
//             }
//         }
//         return false;
//     }

//     private handleSectionHeading(nodeIndex: number, charIndex: number, textNode: Text, currentStart: number): boolean {
//         const char = textNode.nodeValue![charIndex];
//         if (
//             this.nextTokenFlags & TokenFlags.LINE_START &&
//             sectionHeadingStartChars[char] &&
//             !this.currentToken &&
//             currentStart === -1
//         ) {
//             const match = this.findInTrie(SectionHeadingTrieNode, nodeIndex, charIndex);
//             if (match) {
//                 this.finalizeToken();
//                 this.currentToken = {
//                     text: match.word.trimEnd(),
//                     flags: this.nextTokenFlags | match.flags,
//                     range: {
//                         type: TokenRangeType.TEXT,
//                         node: textNode,
//                         offset: charIndex,
//                         endNode: this.textNodeBuf[match.bufferIndex],
//                         endOffset: match.charIndex,
//                     },
//                 };
//                 this.nextTokenFlags = 0;
//                 this.finalizeToken();
//                 return true;
//             }
//         }
//         return false;
//     }

//     // ----------------------------
//     // Buffer flushing
//     // ----------------------------
//     private flushTextBuf() {
//         let nodeIndex = 0;
//         let charIndex = 0;

//         OUTER: do {
//             const textNode = this.textNodeBuf[nodeIndex];
//             const text = textNode.nodeValue!;
//             const textLen = text.length;

//             let currentStart = -1;
//             while (charIndex < textLen) {
//                 const cp = text.codePointAt(charIndex)!;
//                 if (normalizedCharMap[cp] !== undefined) this.shouldNormalize = true;

//                 const char = text[charIndex];
//                 if (/\s/.test(char)) {
//                     if (currentStart !== -1) this.processToken(textNode, currentStart, charIndex);
//                     this.finalizeToken();
//                     currentStart = -1;
//                 } else if (this.handleWildcard(nodeIndex, charIndex, textNode, currentStart)) {
//                     charIndex = textNode.nodeValue!.length; // jump out, OUTER will reposition
//                     continue OUTER;
//                 } else if (this.handleSectionHeading(nodeIndex, charIndex, textNode, currentStart)) {
//                     charIndex = textNode.nodeValue!.length;
//                     continue OUTER;
//                 } else {
//                     if (currentStart === -1) currentStart = charIndex;
//                 }

//                 charIndex++;
//                 if (cp > 0xffff) charIndex++;
//             }

//             if (currentStart !== -1) {
//                 this.processToken(textNode, currentStart, textLen);
//             }
//             nodeIndex++;
//             charIndex = 0;
//         } while (nodeIndex < this.textNodeBuf.length);

//         this.finalizeToken();
//         this.textNodeBuf.length = 0;
//     }

//     // ----------------------------
//     // Element handling
//     // ----------------------------
//     private handleImage(elem: HTMLImageElement) {
//         const token: RichToken = {
//             text: `$img:${++imgSeen}`,
//             flags: TokenFlags.IMAGE | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | this.nextTokenFlags,
//             range: { type: TokenRangeType.ELEMENT, node: elem },
//         };
//         this.tokens[this.tokenIndex++] = token;
//         this.nextTokenFlags = 0;

//         elem.dataset.tokenIndex = String(this.tokens.length - 1);
//         const props = this.loader.load(elem, this.cancellable);
//         this.imageMap.set(token, props);
//     }

//     private handleManualAnchor(elem: Element) {
//         const token: RichToken = {
//             text: (elem as HTMLAnchorElement).dataset.manualAnchor === "B" ? MANUAL_ANCHOR2 : MANUAL_ANCHOR1,
//             flags:
//                 TokenFlags.MANUAL_ANCHOR |
//                 TokenFlags.NO_JOIN_PREV |
//                 TokenFlags.NO_JOIN_NEXT |
//                 TokenFlags.LINE_START |
//                 TokenFlags.LINE_END,
//             range: { type: TokenRangeType.ELEMENT, node: elem },
//         };
//         this.tokens[this.tokenIndex++] = token;
//         this.lastLineBreakElem = elem as HTMLElement;
//     }

//     // ----------------------------
//     // Traversal
//     // ----------------------------
//     async traverse(node: Node, deadline: IdleDeadline) {
//         const nodeName = node.nodeName;
//         const isBlockElement = BLOCK_ELEMENTS[nodeName];

//         if (isBlockElement) {
//             this.nextTokenFlags |= TokenFlags.LINE_START;
//             this.lastLineBreakElem = null;
//         }

//         const childNodes = node.childNodes;
//         const tokenStart = this.tokenIndex;

//         for (let i = 0; i < childNodes.length; i++) {
//             if ((++this.recursionCount & 31) === 0 && deadline.timeRemaining() < 2) {
//                 deadline = await nextIdle();
//             }

//             const child = childNodes[i];
//             if (child.nodeType === 3) {
//                 this.textNodeBuf.push(child as Text);
//             } else if (child.nodeType === 1) {
//                 const childName = child.nodeName;

//                 if (childName === DIFF_TAG_NAME) continue;
//                 if (childName === "IMG") {
//                     if (this.textNodeBuf.length) this.flushTextBuf();
//                     this.handleImage(child as HTMLImageElement);
//                     continue;
//                 }
//                 if (isManualAnchorElement(child as Element)) {
//                     if (this.textNodeBuf.length) this.flushTextBuf();
//                     this.handleManualAnchor(child as Element);
//                     continue;
//                 }
//                 if (childName === "BR" || childName === "HR") {
//                     if (this.textNodeBuf.length) this.flushTextBuf();
//                     this.nextTokenFlags |= TokenFlags.LINE_START;
//                     this.lastLineBreakElem = child as HTMLElement;
//                     continue;
//                 }

//                 // Recurse
//                 this.traverse(child, deadline);
//                 // let res = await gen.next(deadline);
//                 // while (!res.done) {
//                 //     deadline = await nextIdle();
//                 //     res = await gen.next(deadline);
//                 // }
//             }
//         }

//         if (this.textNodeBuf.length) this.flushTextBuf();
//         this.applyNodeBoundaryFlags(nodeName, tokenStart, this.tokenIndex);
//     }

//     // ----------------------------
//     // Boundary flags
//     // ----------------------------
//     private applyNodeBoundaryFlags(nodeName: string, start: number, end: number) {
//         if (end <= start) return;

//         if (nodeName === "TABLE") {
//             this.tokens[start].flags |= TokenFlags.TABLE_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
//             this.tokens[end - 1].flags |= TokenFlags.TABLE_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
//         } else if (nodeName === "TD" || nodeName === "TH") {
//             this.tokens[start].flags |= TokenFlags.TABLECELL_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
//             this.tokens[end - 1].flags |= TokenFlags.TABLECELL_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
//         } else if (BLOCK_ELEMENTS[nodeName]) {
//             this.tokens[start].flags |= TokenFlags.BLOCK_START | TokenFlags.LINE_START;
//             this.tokens[end - 1].flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
//         }
//         if (nodeName === "SUP" || nodeName === "SUB") {
//             for (let j = start; j < end; j++) {
//                 this.tokens[j].flags |= nodeName === "SUP" ? TokenFlags.HTML_SUP : TokenFlags.HTML_SUB;
//             }
//         }
//     }

//     // ----------------------------
//     // Finalization
//     // ----------------------------
//     finalizeLineBreaks() {
//         for (let i = 0; i < this.tokens.length; i++) {
//             const token = this.tokens[i];
//             if (token.flags & TokenFlags.LINE_START && i > 0) {
//                 this.tokens[i - 1].flags |= TokenFlags.LINE_END;
//             }

//             if (!token.lineBreakerElement) {
//                 const startNode =
//                     token.range.type === TokenRangeType.TEXT ? token.range.node.parentNode : token.range.node;
//                 if (token.flags & TokenFlags.BLOCK_START) {
//                     token.lineBreakerElement = findBlockParent(startNode as Element, this.root) || undefined;
//                 } else if (token.flags & TokenFlags.TABLE_START) {
//                     token.lineBreakerElement = (startNode as Element).closest("TABLE") as HTMLElement;
//                 } else if (token.flags & TokenFlags.TABLECELL_START) {
//                     token.lineBreakerElement = (startNode as Element).closest("TD,TH") as HTMLElement;
//                 }
//             }
//         }
//     }

//     async awaitImages() {
//         const pending: Promise<any>[] = [];
//         for (const [token, props] of this.imageMap) {
//             if (!props.hash && props.promise) {
//                 pending.push(
//                     props.promise.then(() => {
//                         if (props.hash) token.text = `$img:${props.hash}`;
//                     })
//                 );
//             }
//         }
//         if (pending.length) await Promise.allSettled(pending);
//     }
// }

// // -------------------
// // helpers
// // -------------------
// function normalizeCharacters(text: string): string {
//     let result = "";
//     for (const char of text) {
//         const cp = char.codePointAt(0)!;
//         const norm = normalizedCharMap[cp];
//         result += norm !== undefined ? String.fromCodePoint(norm) : char;
//     }
//     return result;
// }
