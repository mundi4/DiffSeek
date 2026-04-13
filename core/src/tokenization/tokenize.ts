import { CHAR_META } from "../char-meta";
import { CM_LETTER, CM_NEEDS_NORM, CM_NUMBER, CM_WS, CM_WS_COLLAPSABLE } from "../char-meta-flags";
import {
	ANCHOR_CLASS_NAME,
	BLOCK_ELEMENTS,
	CONTAINER_TAGS,
	DIFF_TAG_NAME,
	MANUAL_ANCHOR_TAG_NAME,
	STRUCTURAL_TD_CLOSE_TEXT,
	STRUCTURAL_TD_OPEN_TEXT,
	STRUCTURAL_TR_CLOSE_TEXT,
	STRUCTURAL_TR_OPEN_TEXT,
	TEXTLESS_ELEMENTS,
	VOID_ELEMENTS,
} from "../constants";
import { hashString } from "../utils/hash-string";
import { NormalizeCharTable } from "./normalize-char-table";
import { TextNodeCursor, type TextPos } from "./text-node-cursor";
import {
	PAYLOAD_SHIFT,
	STRUCTURAL_ELEMENT_TD,
	STRUCTURAL_ELEMENT_TR,
	TOKEN_FLAGS_HAS_FOLLOWING_SPACE,
	TOKEN_FLAGS_HAS_PRECEDING_SPACE,
	TOKEN_FLAGS_IS_HEADING,
	TOKEN_FLAGS_LINE_END,
	TOKEN_FLAGS_LINE_START,
	TOKEN_FLAGS_NONE,
	TOKEN_FLAGS_STRUCTURAL_OPEN,
	TOKEN_FLAGS_TYPE_IMAGE,
	TOKEN_FLAGS_TYPE_STRUCTURAL,
	TOKEN_FLAGS_TYPE_TEXT,
	TOKEN_FLAGS_WILDCARD,
	TOKEN_FLAGS_WORD_LIKE,
	TOKEN_TYPE_MASK,
} from "./token-flags";
import { matchFlatTrieAtCursor } from "./trie";
import { CM_HEADING_START, tryMatchSectionHeading } from "./try-match-section-heading";
import {
	type ContainerInfo,
	type LineBoundaryInfo,
	type SectionHeadingInfo,
	type Token,
	type TokenizeResult,
	type TokenizerOptions,
} from "./types";
import { CM_WILDCARD_START, wildcardFlatTrie } from "./wildcard-trie";

const IGNORED_TAGS: Record<string, boolean> = {
	[MANUAL_ANCHOR_TAG_NAME]: true,
	[ANCHOR_CLASS_NAME]: true,
	[DIFF_TAG_NAME]: true,
} as const;

const PARENT_TYPE_NONE = 0;
const PARENT_TYPE_BLOCK = 1;
const PARENT_TYPE_CONTAINER = 2;
const PARENT_TYPE_INLINE = 3;

const NODE_NAME_TO_STRUCTURAL_ELEMENT_TYPE: Record<string, number> = {
	TR: STRUCTURAL_ELEMENT_TR,
	TD: STRUCTURAL_ELEMENT_TD,
	TH: STRUCTURAL_ELEMENT_TD,
};

type ParentType =
	| typeof PARENT_TYPE_NONE
	| typeof PARENT_TYPE_BLOCK
	| typeof PARENT_TYPE_CONTAINER
	| typeof PARENT_TYPE_INLINE;

export async function tokenize(
	root: HTMLElement,
	signal: AbortSignal,
	options: TokenizerOptions = {},
): Promise<TokenizeResult> {
	const mergeNonWordLikeTokens = !!options.mergeNonWordLikeTokens;
	const enableStructuralTokens = true; //!!options.enableStructuralTokens;
	const mergeLetterNumberBoundary = !!options.mergeLetterNumberBoundary;
	const allowStandaloneLawArticle = !!options.allowStandaloneLawArticle;

	let yieldCounter = 0;

	const tokens: Token[] = [];
	const lineBoundaries: LineBoundaryInfo[] = [];
	const sectionHeadings: SectionHeadingInfo[] = [];
	const containers: ContainerInfo[] = [];
	let nextTokenFlags = TOKEN_FLAGS_NONE;
	let lastToken: Token | null = null;

	// src도 없는 이미지 태그인 경우(이런게 가능?)
	let nextImageId = 1;

	let currentLineNumber = 0;
	let lineStartWhich: Node | null = null;
	let lineStartWhere: InsertPosition = "beforebegin"; // 그냥 처음엔 아무 값이나. lineStartWhich가 null이 아닐 때만 유효함

	/**
	 * 줄바꿈 경계에서 아직은 새로운 줄을 시작하기가 꺼려질 때!
	 * 예를 들어, 블럭 요소가 시작될 때 줄바꿈이 시작되지만 블럭이 비어있다면 줄바꿈은 의미 없음.
	 */
	let newLinePending = false;

	// 공백을 무시(주로 줄의 시작 부분)
	let isTrimMode = false;

	// traverse 상태
	let current: HTMLElement;
	let currentParentType: ParentType = PARENT_TYPE_CONTAINER;
	let currentChildIndex = 0;
	let currentNumChildren = 0;
	let currentIsTextless = false;
	let currentHasTextNodes = false;

	// let wholeText = "";

	// 줄의 경계나 기타 텍스트를 중단 시키는 요소를 만날 때까지 텍스트노드를 모아둠.
	const textNodeBuf: Text[] = [];

	const wholeTextBuf: string[] = [];
	let wholeTextLastChar = -1;
	let wholeTextLength = 0;

	// 재귀 호출 없이 노드를 순회하기 위해...
	type StackFrame = {
		parentType: ParentType;
		current: HTMLElement;
		childIndex: number;
		numChildren: number;
		isTextless: boolean;
		hasTextNodes: boolean;
		containerIndex: number;
		containerInfo: ContainerInfo;
	};

	// container 추적 상태
	const rootContainerInfo: ContainerInfo = { el: root, firstTokenIndex: 0, lastTokenIndex: -1 };
	containers.push(rootContainerInfo);
	let currentContainerIndex: number = 0;
	let currentContainerInfo: ContainerInfo = rootContainerInfo;

	// 재귀 호출 없이 노드를 순회하기 위해...
	const stack: StackFrame[] = [];

	const yieldNow = async () => {
		await scheduler.yield();
		signal.throwIfAborted();
	};

	const markLineStart = (which: Node, where: InsertPosition) => {
		newLinePending = true;

		if (which && where) {
			lineStartWhich = which;
			lineStartWhere = where;
		}

		nextTokenFlags |= TOKEN_FLAGS_LINE_START;
		nextTokenFlags &= ~TOKEN_FLAGS_HAS_PRECEDING_SPACE; // 공백은 다음 줄로 넘어가지 않음!
		isTrimMode = true; // 새로운 줄은 선행 공백을 무시함.
	};

	const markLineEnd = (which: Node, where: InsertPosition) => {
		// let data = (lineBoundaries[currentLineNumber - 1] ??= { startWhich: null, startWhere: null, endWhich: null, endWhere: null });
		let data = lineBoundaries[currentLineNumber];
		if (data && (!data.endWhich || !data.endWhere)) {
			data.endWhich = which;
			data.endWhere = where;
		}
	};

	const commitLineStart = () => {
		if (!newLinePending) {
			return;
		}

		currentLineNumber++;

		if (!lineStartWhich) {
			throw new Error("Invalid line start point when committing new line.");
			// if (import.meta.env.DEV) {
			//     console.warn("Committing new line without a valid line start point.");
			// }
			//lineBoundaries[currentLineNumber] = null;
		}

		lineBoundaries[currentLineNumber] = {
			startWhich: lineStartWhich!,
			startWhere: lineStartWhere,
			endWhich: null,
			endWhere: null,
			containerIndex: currentContainerIndex,
		};

		// let data = (lineBoundaries[currentLineNumber] ??= { startWhich: null, startWhere: null, endWhich: lineEndWhich, endWhere: lineEndWhere });
		// data.startWhich = lineStartWhich;
		// data.startWhere = lineStartWhere;

		newLinePending = false;
		lineStartWhich = null;
		lineStartWhere = "beforebegin";
	};

	const handleElement = async (element: HTMLElement): Promise<ParentType> => {
		const elementName = element.nodeName;

		if (IGNORED_TAGS[elementName]) {
			return PARENT_TYPE_NONE;
		}

		if (elementName === "BR") {
			// 쌓여있던 텍스트노드 처리
			commitLineStart();

			await flushTextNodeBuf();
			markLineEnd(element, "beforebegin");

			markLineStart(element, "afterend");
			//commitNewLine(); // BR은 즉시 줄바꿈

			return PARENT_TYPE_NONE;
		}

		if (elementName === "IMG") {
			// 쌓여있던 텍스트노드 처리
			await flushTextNodeBuf();

			addImageToken(element as HTMLImageElement);

			return PARENT_TYPE_NONE;
		}

		if (CONTAINER_TAGS[elementName]) {
			// console.log("Handling container element.", { tag: elementName });
			await flushTextNodeBuf();

			// markNewLine(element, "afterbegin");
			// commitNewLine();
			return PARENT_TYPE_CONTAINER;
		}

		const isVoidElem = VOID_ELEMENTS[element.nodeName];

		if (BLOCK_ELEMENTS[elementName]) {
			await flushTextNodeBuf();

			if (isVoidElem) {
				markLineEnd(element, "beforebegin");

				// 다른 줄바꿈이 나타나기 전에 다음 토큰이 나온다면
				// 줄바꿈은 이 요소와 다음 토큰 사이가 되어야 하므로
				// 이 요소 뒤로 줄시작 마크
				markLineStart(element, "afterend");

				// 방문하지 않음
				return PARENT_TYPE_NONE;
			}

			// markNewLine(element, "beforebegin");
			return PARENT_TYPE_BLOCK;
		}

		return isVoidElem ? PARENT_TYPE_NONE : PARENT_TYPE_INLINE;
	};

	const moveDown = (element: HTMLElement, newParentType: ParentType) => {
		const savedContainerIndex = currentContainerIndex;
		const savedContainerInfo = currentContainerInfo;

		if (enableStructuralTokens) {
			const elemType = NODE_NAME_TO_STRUCTURAL_ELEMENT_TYPE[element.nodeName];
			if (elemType) {
				addToken(
					TOKEN_FLAGS_TYPE_STRUCTURAL,
					element.nodeName,
					TOKEN_FLAGS_STRUCTURAL_OPEN | (elemType << PAYLOAD_SHIFT),
					element,
					0,
					element,
					0,
				);
			}
		}

		if (newParentType === PARENT_TYPE_CONTAINER) {
			const info: ContainerInfo = { el: element, firstTokenIndex: tokens.length, lastTokenIndex: -1 };
			containers.push(info);
			currentContainerIndex = containers.length - 1;
			currentContainerInfo = info;

			markLineStart(element, "afterbegin");
			commitLineStart();
		} else if (newParentType === PARENT_TYPE_BLOCK) {
			markLineStart(element, "afterbegin");
		}

		stack.push({
			current,
			childIndex: currentChildIndex,
			numChildren: currentNumChildren,
			isTextless: currentIsTextless,
			parentType: currentParentType,
			hasTextNodes: currentHasTextNodes,
			containerIndex: savedContainerIndex,
			containerInfo: savedContainerInfo,
		});

		current = element as HTMLElement;
		currentChildIndex = 0;
		currentNumChildren = current.childNodes.length;
		currentParentType = newParentType;
		currentIsTextless = TEXTLESS_ELEMENTS[current.nodeName];
		currentHasTextNodes = false;
	};

	const moveUp = async () => {
		const wasContainer = currentParentType === PARENT_TYPE_CONTAINER;

		if (currentParentType === PARENT_TYPE_BLOCK || currentParentType === PARENT_TYPE_CONTAINER) {
			await flushTextNodeBuf();

			if (currentParentType === PARENT_TYPE_CONTAINER) {
				currentContainerInfo.lastTokenIndex = tokens.length - 1;

				markLineEnd(current, "beforeend");

				markLineStart(current, "afterend");
			} else {
				markLineEnd(current, "beforeend");

				markLineStart(current, "afterend");
			}
		}

		if (enableStructuralTokens) {
			const elemType = NODE_NAME_TO_STRUCTURAL_ELEMENT_TYPE[current.nodeName];
			if (elemType) {
				addToken(
					TOKEN_FLAGS_TYPE_STRUCTURAL,
					"/" + current.nodeName,
					elemType << PAYLOAD_SHIFT,
					current,
					0,
					current,
					0,
				);
			}
		}

		if (stack.length === 0) {
			return true;
		}

		const childHasTextNodes = currentHasTextNodes;

		({
			current,
			childIndex: currentChildIndex,
			numChildren: currentNumChildren,
			isTextless: currentIsTextless,
			parentType: currentParentType,
			containerIndex: currentContainerIndex,
			containerInfo: currentContainerInfo,
		} = stack.pop()!);

		if (childHasTextNodes) {
			currentHasTextNodes = true;
		}

		// CONTAINER에서 나온 경우: 부모의 나머지 구간을 새 세그먼트로 시작
		// 예) root(ci=0) → td(ci=1) → root 재진입(ci=2)
		// 단, 부모가 textless(TR, TABLE, UL 등)이면 임의 요소 삽입이 불가하므로
		// continuation과 lineBoundary 모두 생성하지 않음
		if (wasContainer) {
			if (currentParentType === PARENT_TYPE_CONTAINER) {
				// 부모도 container일 때만 continuation 생성
				// (TR 같은 textless/BLOCK 부모 안에서는 marker 삽입이 불가하므로 제외)
				const continuationInfo: ContainerInfo = {
					el: current,
					firstTokenIndex: tokens.length,
					lastTokenIndex: -1,
				};
				containers.push(continuationInfo);
				currentContainerIndex = containers.length - 1;
				currentContainerInfo = continuationInfo;
			} else {
				// pending line 취소
				newLinePending = false;
				lineStartWhich = null;
			}
		}

		currentChildIndex++; // 다음 형제로 이동 필요!

		return false;
	};

	const addToken = (
		type: typeof TOKEN_FLAGS_TYPE_TEXT | typeof TOKEN_FLAGS_TYPE_IMAGE | typeof TOKEN_FLAGS_TYPE_STRUCTURAL,
		text: string,
		flags: number,
		startNode: Node,
		startOffset: number,
		endNode: Node,
		endOffset: number,
	) => {
		const index = tokens.length;

		flags &= ~TOKEN_TYPE_MASK;
		flags |= type;
		// if (type === "text") {
		//     flags |= TOKEN_FLAGS_TYPE_TEXT;
		// } else if (type === "image") {
		//     flags |= TOKEN_FLAGS_TYPE_IMAGE;
		// } else if (type === "structural") {
		//     console.log("Adding structural token.", { text, flags });
		//     flags |= TOKEN_FLAGS_TYPE_STRUCTURAL;
		// }

		let textOffset = wholeTextLength;
		let textLength: number;

		if (type !== TOKEN_FLAGS_TYPE_STRUCTURAL) {
			// 아직까지도 pending 상태인 줄바꿈이 있다면 처리
			if (newLinePending) {
				commitLineStart();
			}

			flags |= nextTokenFlags;

			if (flags & TOKEN_FLAGS_LINE_START) {
				lastToken && (lastToken.flags |= TOKEN_FLAGS_LINE_END);
				if (wholeTextLength > 0 && wholeTextLastChar !== 10) {
					wholeTextBuf.push("\n");
					wholeTextLastChar = 10;
					wholeTextLength++;
				}
			} else if (flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE) {
				lastToken && (lastToken.flags |= TOKEN_FLAGS_HAS_FOLLOWING_SPACE);
				if (wholeTextLength > 0 && wholeTextLastChar !== 32) {
					wholeTextBuf.push(" ");
					wholeTextLastChar = 32;
					wholeTextLength++;
				}
			}

			textOffset = wholeTextLength;
			textLength = text.length;
			if (textLength > 0) {
				wholeTextBuf.push(text);
				wholeTextLastChar = text.charCodeAt(text.length - 1);
				wholeTextLength += textLength;
			}
		} else {
			textLength = 0;
		}

		const token = {
			index,
			type,
			textOffset,
			textLength,
			flags,
			startNode,
			startOffset,
			endNode,
			endOffset,
			lineNumber: currentLineNumber,
			text,
			containerIndex: currentContainerIndex,
		};
		tokens.push(token);

		if (type !== TOKEN_FLAGS_TYPE_STRUCTURAL) {
			nextTokenFlags = TOKEN_FLAGS_NONE;
			isTrimMode = false;
			lastToken = token;
		}

		return index;
	};

	const addImageToken = (img: HTMLImageElement) => {
		const src = img.src || `image${nextImageId++}`;
		const text = hashString(src);

		return addToken(TOKEN_FLAGS_TYPE_IMAGE, text, 0, img, 0, img, 0);
	};

	async function flushTextNodeBuf(): Promise<boolean> {
		if (textNodeBuf.length === 0) {
			return false;
		}

		const cursor = new TextNodeCursor(textNodeBuf);
		// if (!cursor.moveNext()) {
		//     resetTextBuf();
		//     return false;
		// }

		const tokenCountBefore = tokens.length;

		// 임시 문자열 저장
		const chunks: string[] = [];

		let currentWordCategory = 0; // 0=non-word, 1=letter, 2=number
		let collapsable = true;
		let tokenStartPos: TextPos | null = null;
		let chunkPos: TextPos | null = null;

		function flushChunkRange(endPos?: TextPos): void {
			if (!chunkPos) return;

			endPos ??= cursor.getPos();

			const sNode = chunkPos.nodeIndex;
			const sChar = chunkPos.charIndex;
			const eNode = endPos.nodeIndex;
			const eChar = endPos.charIndex;
			// console.log("Flushing chunk range.", { sNode, sChar, eNode, eChar });
			if (sNode === eNode) {
				if (sChar !== eChar) {
					const text = textNodeBuf[sNode].nodeValue ?? "";
					chunks.push(text.slice(sChar, eChar));
				}
				chunkPos = null;
				return;
			}

			// first node
			{
				const text = textNodeBuf[sNode].nodeValue ?? "";
				if (sChar < text.length) {
					chunks.push(text.slice(sChar));
				}
			}

			// middle nodes
			for (let i = sNode + 1; i < eNode; i++) {
				const text = textNodeBuf[i].nodeValue ?? "";
				if (text.length > 0) {
					chunks.push(text);
				}
			}

			// last node
			{
				const text = textNodeBuf[eNode].nodeValue ?? "";
				if (eChar > 0) {
					chunks.push(text.slice(0, eChar));
				}
			}

			chunkPos = null;
		}

		const finalizeToken = (endPos?: TextPos) => {
			flushChunkRange(endPos);
			flushText(endPos);
		};

		function flushText(endPos?: TextPos) {
			if (!tokenStartPos) {
				return;
			}

			const tokenEndPos = endPos ?? cursor.getPos();

			const text = chunks.length > 1 ? chunks.join("") : chunks[0];
			chunks.length = 0;

			if (!text) {
				if (import.meta.env.DEV) {
					console.warn("Generated empty token text. This should not happen.", { tokenStartPos, tokenEndPos });
				}
				return;
			}

			const { nodeIndex: startNodeIndex, charIndex: startCharIndex } = tokenStartPos;
			let { nodeIndex: endNodeIndex, charIndex: endCharIndex } = tokenEndPos;
			if (endNodeIndex > startNodeIndex) {
				if (endNodeIndex === startNodeIndex + 1 && endCharIndex === 0) {
					endNodeIndex = startNodeIndex;
					endCharIndex = textNodeBuf[startNodeIndex].length;
				}
			}

			let flags = TOKEN_FLAGS_NONE;
			if (currentWordCategory !== 0) {
				flags |= TOKEN_FLAGS_WORD_LIKE;
			}

			addToken(
				TOKEN_FLAGS_TYPE_TEXT,
				text,
				flags,
				textNodeBuf[startNodeIndex],
				startCharIndex,
				textNodeBuf[endNodeIndex],
				endCharIndex,
			);

			tokenStartPos = null;
		}

		if (cursor.moveNext()) {
			while (!cursor.eof()) {
				if ((++yieldCounter & 0x1f) === 0) {
					await yieldNow();
				}

				const code = cursor.current;
				let meta = CHAR_META[code];

				if (meta & CM_WS) {
					finalizeToken();
					if (!isTrimMode || !(meta & CM_WS_COLLAPSABLE)) {
						isTrimMode = false;
						commitLineStart();
						nextTokenFlags |= TOKEN_FLAGS_HAS_PRECEDING_SPACE;
					}

					cursor.moveNext();
					continue;
				} else {
					commitLineStart();
					isTrimMode = false;
				}

				collapsable = false;

				// 비-word-like 토큰이 쌓여있는 상태에서 heading 패턴이 매칭되면
				// headingStartPos까지만 flush하고 heading을 별도 토큰으로 방출한다.
				// match 실패 시 cursor는 tryMatchSectionHeading이 복원하므로 flush 없이 통과.
				if (tokenStartPos && currentWordCategory === 0 && meta & CM_HEADING_START) {
					const headingStartPos = cursor.getPos();
					const isLineStart = !!(nextTokenFlags & TOKEN_FLAGS_LINE_START);
					const match = tryMatchSectionHeading(cursor, code, allowStandaloneLawArticle, isLineStart);
					if (match) {
						flushChunkRange(headingStartPos);
						flushText(headingStartPos);
						const headingEndPos = cursor.getPos();
						if (isLineStart && match.hasFollowingContent) {
							nextTokenFlags |= (match.type << PAYLOAD_SHIFT) | TOKEN_FLAGS_IS_HEADING;
							sectionHeadings.push({ ...match, tokenIndex: tokens.length });
						}
						addToken(
							TOKEN_FLAGS_TYPE_TEXT,
							match.text,
							TOKEN_FLAGS_WORD_LIKE,
							textNodeBuf[headingStartPos.nodeIndex],
							headingStartPos.charIndex,
							textNodeBuf[headingEndPos.nodeIndex],
							headingEndPos.charIndex,
						);
						continue;
					}
				}

				if (!tokenStartPos && meta & CM_HEADING_START) {
					const headingStartPos = cursor.getPos();
					const isLineStart = !!(nextTokenFlags & TOKEN_FLAGS_LINE_START);
					const match = tryMatchSectionHeading(cursor, code, allowStandaloneLawArticle, isLineStart);
					if (match) {
						const headingEndPos = cursor.getPos();
						if (isLineStart && match.hasFollowingContent) {
							nextTokenFlags |= (match.type << PAYLOAD_SHIFT) | TOKEN_FLAGS_IS_HEADING;
							sectionHeadings.push({ ...match, tokenIndex: tokens.length });
						}
						addToken(
							TOKEN_FLAGS_TYPE_TEXT,
							match.text,
							TOKEN_FLAGS_WORD_LIKE,
							textNodeBuf[headingStartPos.nodeIndex],
							headingStartPos.charIndex,
							textNodeBuf[headingEndPos.nodeIndex],
							headingEndPos.charIndex,
						);
						continue;
					}
				}

				const charCategory = meta & CM_LETTER ? 1 : meta & CM_NUMBER ? 2 : 0;
				if (tokenStartPos) {
					// 분리
					const categoryChanged = mergeLetterNumberBoundary
						? (charCategory !== 0) !== (currentWordCategory !== 0)
						: charCategory !== currentWordCategory;
					if (categoryChanged || (!mergeNonWordLikeTokens && charCategory === 0)) {
						flushChunkRange();
						flushText();
						tokenStartPos = chunkPos = cursor.getPos();
						currentWordCategory = charCategory;
					} else {
						// normalize 된 경우 chunkPos는 null이 되어버리므로
						// 그 경우 다음 첫 유효문자 위치에 chunkPos를 설정해줘야 함
						if (!chunkPos) {
							chunkPos = cursor.getPos();
						}
					}
				} else {
					tokenStartPos = chunkPos = cursor.getPos();
					currentWordCategory = charCategory;
				}

				let norm: number = -1;
				if (meta & CM_NEEDS_NORM) {
					norm = NormalizeCharTable[code];
					meta = CHAR_META[norm];
				}

				if (meta & CM_WILDCARD_START) {
					// console.log("Potential wildcard trie match at cursor.", { char: String.fromCharCode(code), code, pos: cursor.getPos() });
					const startPos = cursor.getPos();
					const match = matchFlatTrieAtCursor(wildcardFlatTrie, cursor, NormalizeCharTable);
					if (match) {
						finalizeToken(startPos);
						nextTokenFlags |= TOKEN_FLAGS_HAS_PRECEDING_SPACE;
						addToken(
							TOKEN_FLAGS_TYPE_TEXT,
							match.word,
							TOKEN_FLAGS_WILDCARD,
							textNodeBuf[startPos.nodeIndex],
							startPos.charIndex,
							textNodeBuf[cursor.getPos().nodeIndex],
							cursor.getPos().charIndex,
						);
						nextTokenFlags |= TOKEN_FLAGS_HAS_PRECEDING_SPACE;

						// moveNext()는 하지 않음. 성공 시 이미 cursor는 다음 문자 위치로 이동되어 있음.
						// 다음 문자가 공백일 수도 있으므로 그냥 다음 루프로 진행
						continue;
					} else {
						// 매치 실패 시에는 cursor는 초기 위치로 복구됨. 그대로 진행
					}
				}

				if (norm !== -1) {
					// 문자가 정규화 된 경우.
					// 원본 문자 대신 정규화된 문자를 추가해야하므로 이전까지의 범위를 먼저 flush하고 나서 배열에 정규화된 문자 추가
					flushChunkRange();
					chunks.push(String.fromCharCode(norm));
				}

				cursor.moveNext();
			}

			// pending 중인 토큰 마무리
			if (tokenStartPos) {
				finalizeToken();
			}
		}

		// 버퍼 초기화
		textNodeBuf.length = 0;

		return tokens.length > tokenCountBefore;
	}

	// RUN
	const startTime = performance.now();

	await (async () => {
		// initial state

		current = root;
		currentChildIndex = 0;
		currentNumChildren = current.childNodes.length;
		currentParentType = PARENT_TYPE_CONTAINER;
		currentIsTextless = false;

		currentLineNumber = -1; // 첫 줄은 가상의 줄. 줄번호: 0
		markLineStart(current, "afterbegin");
		commitLineStart();

		OUTER: while (true) {
			if ((++yieldCounter & 0x1f) === 0) {
				await yieldNow();
			}

			while (currentChildIndex >= currentNumChildren) {
				if (await moveUp()) {
					break OUTER;
				}
			}

			const child = current.childNodes[currentChildIndex];
			if (child.nodeType === 1) {
				const parentType = await handleElement(child as HTMLElement);
				if (parentType !== PARENT_TYPE_NONE) {
					// console.log("Moving down into element.", { tag: child.nodeName, parentType });
					moveDown(child as HTMLElement, parentType);
					continue;
				}
			} else if (child.nodeType === 3) {
				if (!currentIsTextless) {
					if ((child as Text).length > 0) {
						textNodeBuf.push(child as Text);
					}
					currentHasTextNodes = true;
				}
			}

			currentChildIndex++;
		}

		if (tokens.length > 0) {
			// 마지막 텍스트 토큰에 LINE_END 설정.
			// 구조적 토큰은 lastToken을 갱신하지 않으므로,
			// tokens[length-1]이 구조적 토큰이면 마지막 텍스트 토큰을 놓침.
			if (lastToken) {
				lastToken.flags |= TOKEN_FLAGS_LINE_END;
			}
			if (wholeTextLastChar !== 10 /* \n */) {
				wholeTextBuf.push("\n");
				wholeTextLastChar = 10 /* \n */;
				wholeTextLength++;
			}
		}

		//await yieldNow();
		//commitNewLine();
		// markEndLine(root, "beforeend");
	})();

	const elapsed = performance.now() - startTime;

	currentContainerInfo.lastTokenIndex = tokens.length - 1;

	return {
		wholeText: wholeTextBuf.join(""),
		tokens,
		lineBoundaries,
		sectionHeadings,
		containers,
		elapsed,
	};
}
