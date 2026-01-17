import { TokenFlags } from '../TokenFlags';
import { ANCHOR_CLASS_NAME, BLOCK_ELEMENTS, CONTAINER_TAGS, DIFF_TAG_NAME, MANUAL_ANCHOR_TAG_NAME, TEXTLESS_ELEMENTS, VOID_ELEMENTS, WS_TABLE } from '../constants';
import { normalizedCharMap } from '../helpers/normalizedCharMap';
import { Scheduler, type SchedulerOptions } from '../scheduler';
import { matchTrie, wildcardTrie } from './trie';
import { tryMatchNumbering } from '../helpers/tryMatchNumbering';
import { TokenType, type LineStartPoint, type Token } from '../types';
import { hashStringFNV1aBase64 } from './hashStringFNV1aBase64';

const segmenter = new Intl.Segmenter('ko', { granularity: 'word' });

export type TokenizerOptions = SchedulerOptions & {
};

export type TokenizeResult = {
    wholeText: string;
    tokens: Token[];
    lineStartPoints: LineStartPoint[];
    elapsed: number;
}

const IGNORED_TAGS: Record<string, boolean> = {
    [MANUAL_ANCHOR_TAG_NAME]: true,
    [ANCHOR_CLASS_NAME]: true,
    [DIFF_TAG_NAME]: true,
} as const;

type DecendType =
    0 | // don't decend
    1 |  // decend into block
    2 |  // decend into container
    3; // decend into inline 

export async function tokenize(root: HTMLElement, options: TokenizerOptions = {}): Promise<TokenizeResult> {
    const tokens: Token[] = [];
    const lineStartPoints: LineStartPoint[] = [];
    const textNodeBuf: Text[] = [];
    const mapNodeIndex: number[] = [];
    const mapCharIndex: number[] = [];
    let lastContainerId = 0;
    let currentLineNumber = 0;
    let currentTokenText = '';
    let hasPrecedingSpace = false;
    let newLineAlreadyAdded = false;
    let nextTokenAtLineStart = false;

    let discardPrecedingSpaces = false;
    let trimTrailingSpaces = false;
    let isLineStart = true;
    let lineStartWhich: Node | null = null;
    let lineStartWhere: InsertPosition | null = null;
    let preCounter = 0;
    let isTextless = false;
    let resetTrimPrecedingSpaces = false;
    let blockType: 0 | 1 | 2 = 0;
    let childIndex = 0;
    let numChildren = 0;
    let current: HTMLElement;
    let wholeText = "";

    type StackFrame = {
        blockType: 0 | 1 | 2;
        current: HTMLElement;
        childIndex: number;
        numChildren: number;
        isTextless: boolean;
        resetTrimPrecedingSpaces: boolean;
    };

    const stack: StackFrame[] = [];

    function handleElement(element: HTMLElement): DecendType {
        const elementName = element.nodeName;

        if (elementName === "BR") {
            flushTextBuf();
            markNewLine(element, "afterend", true);
            return 0;
        }

        if (elementName === "IMG") {
            flushTextBuf();
            addImageToken(element as HTMLImageElement);
            return 0;
        }

        if (IGNORED_TAGS[elementName]) {
            return 0;
        }

        const elementBlockType = CONTAINER_TAGS[elementName] ? 2 : (BLOCK_ELEMENTS[elementName] ? 1 : 0);
        if (elementBlockType) {
            // text <-- 이 부분을 flush!
            // <block>...
            //
            // 줄끝: yes
            // 블럭끝: no
            flushTextBuf();

            if (elementBlockType === 2) {
                // 컨테이너인 경우 내용이 없더라도 newLine 마크
                markNewLine(element, "afterbegin", true);
            }

            // markNewLine에서 처리되지만 그냥 확실하게 여기서 한방!
            hasPrecedingSpace = false;
            discardPrecedingSpaces = true;
        }

        if (VOID_ELEMENTS[element.nodeName] || !element.hasChildNodes()) {
            if (elementBlockType === 1) {
                markNewLine(element, "afterend");
            }
            return 0;
        }

        if (elementBlockType === 1) {
            markNewLine(element, "beforebegin");
        }

        return elementBlockType || 3;
    }

    function moveDown(element: HTMLElement, elementBlockType: 0 | 1 | 2) {
        stack.push({
            current,
            childIndex,
            numChildren, // 그냥 새로 뽑아와도 되는데
            isTextless, // 그냥 새로 뽑아와도 되는데
            resetTrimPrecedingSpaces,
            blockType,
        });

        current = element as HTMLElement;
        childIndex = 0;
        numChildren = current.childNodes.length;
        blockType = elementBlockType;
        isTextless = TEXTLESS_ELEMENTS[current.nodeName];
        if (blockType) {
            resetTrimPrecedingSpaces = !discardPrecedingSpaces;
            discardPrecedingSpaces = true;
        }
    }

    function moveUp() {
        if (blockType) {
            trimTrailingSpaces = true;
            flushTextBuf();
            trimTrailingSpaces = false;

            if (blockType === 2) {
                //markNewLine(current, "afterend");
            } else {
                markNewLine(current, "afterend");
            }

            hasPrecedingSpace = false;
        }

        if (resetTrimPrecedingSpaces) {
            discardPrecedingSpaces = false;
        }

        if (stack.length === 0) {
            return true;
        }

        ({ current, childIndex, numChildren, isTextless, resetTrimPrecedingSpaces, blockType } = stack.pop()!);
        childIndex++; // 다음 형제로 이동 필요!
        return false;
    }

    async function run() {
        // initial state
        let yieldCounter = 0;

        current = root;
        childIndex = 0;
        numChildren = current.childNodes.length;
        blockType = 2;
        isTextless = false;
        resetTrimPrecedingSpaces = false;

        OUTER:
        while (true) {
            if ((++yieldCounter & 0x7f) === 0) {
                await scheduler.yield();
            }

            while (childIndex >= numChildren) {
                if (moveUp()) {
                    break OUTER;
                }
            }

            const child = current.childNodes[childIndex];
            if (child.nodeType === 1) {
                const decendType = handleElement(child as HTMLElement);
                if (decendType) {
                    moveDown(child as HTMLElement, decendType === 3 ? 0 : decendType);
                    continue;
                }
            } else if (child.nodeType === 3) {
                if (!isTextless) {
                    handleTextNode(child as Text);
                }
            }

            childIndex++;
        }
    }


    // async function walkDOMAsync(element: HTMLElement): Promise<void> {
    //     const elementName = element.nodeName;
    //     const isBlock = BLOCK_ELEMENTS[elementName];
    //     const isContainer = CONTAINER_TAGS[elementName] || element === root;

    //     if (isBlock || isContainer) {
    //         flushTextBuf();
    //     }

    //     if (isContainer) {
    //         markNewLine(element, "afterbegin", true);
    //     } else if (isBlock) {
    //         markNewLine(element, "beforebegin");
    //     }

    //     let wasBlockStart = false;
    //     if (isContainer || isBlock) {
    //         wasBlockStart = !trimPrecedingSpaces;
    //         trimPrecedingSpaces = true;
    //     }

    //     // visit child nodes
    //     if (!VOID_ELEMENTS[elementName]) {
    //         const textless = TEXTLESS_ELEMENTS[elementName];

    //         // 만약 loop 내에서 node를 추가하거나 제거하려면 반드시 배열 복사본을 만들어야 함.
    //         const childNodes = Array.from(element.childNodes);

    //         for (const child of childNodes) {

    //             if (child.nodeType === 3) {
    //                 if (!textless) {
    //                     handleTextNode(child as Text);
    //                 }
    //                 continue;
    //             }

    //             if (child.nodeType !== 1) {
    //                 continue;
    //             }

    //             const childName = child.nodeName;
    //             if (childName === "BR") {
    //                 flushTextBuf();
    //                 markNewLine(child, "afterend", true);
    //                 continue;
    //             }

    //             if (childName === "IMG") {
    //                 flushTextBuf();

    //                 addImageToken(child as HTMLImageElement);
    //                 continue;
    //             }

    //             if (IGNORED_TAGS[childName]) {
    //                 continue;
    //             }

    //             await walkDOMAsync(child as HTMLElement);
    //             await scheduler.yield();
    //         }
    //     }

    //     if (isBlock || isContainer) {
    //         trimTrailingSpaces = true;
    //         flushTextBuf();
    //         trimTrailingSpaces = false;
    //         if (wasBlockStart) {
    //             trimPrecedingSpaces = false;
    //         }
    //     }

    //     if (isContainer) {
    //         markNewLine(element, "afterend");
    //     } else if (isBlock) {
    //         markNewLine(element, "afterend");
    //     }
    // }

    function markNewLine(which: Node, where: InsertPosition, immediate = false) {
        isLineStart = true;
        lineStartWhich = which;
        lineStartWhere = where;
        nextTokenAtLineStart = true;
        hasPrecedingSpace = false;
        discardPrecedingSpaces = true;
        if (immediate) {
            addNewLine(true);
            newLineAlreadyAdded = true;
        } else {
            newLineAlreadyAdded = false;
        }
    }

    function addNewLine(force = false) {
        if (force || !newLineAlreadyAdded) {
            if (lineStartWhich && lineStartWhere) {
                currentLineNumber++;
                lineStartPoints.push({
                    which: lineStartWhich,
                    where: lineStartWhere,
                });
            }
        } else {
            newLineAlreadyAdded = false;
        }
        lineStartWhich = null;
        lineStartWhere = null;
    }

    function handleTextNode(text: Text) {
        let raw = text.nodeValue!;
        if (raw.length === 0) {
            return;
        }

        const nodeIndex = textNodeBuf.length;
        let out = "";
        let last = 0;
        for (let i = 0; i < raw.length; i++) {
            const ch0 = raw[i];
            const mapped = normalizedCharMap[ch0 as keyof typeof normalizedCharMap];
            if (mapped !== undefined) {
                if (last !== i) {
                    out += raw.slice(last, i);
                }
                for (let j = 0; j < mapped.length; j++) {
                    mapNodeIndex.push(nodeIndex);
                    mapCharIndex.push(i);
                }
                out += mapped;
                last = i + 1;
            } else {
                mapNodeIndex.push(nodeIndex);
                mapCharIndex.push(i);
            }
        }

        if (last === 0) {
            out = raw;
        } else if (last < raw.length) {
            out += raw.slice(last);
        }

        textNodeBuf.push(text);
        currentTokenText += out;
    }

    function flushTextBuf(): boolean {
        if (textNodeBuf.length === 0) {
            return false;
        }

        // 이런 경우가 있나? 일부 문자를 ""로 normalize하는 경우 생길 수 있다...?
        if (currentTokenText.length === 0) {
            resetTextBuf();
            return false;
        }

        let firstNonSpaceIndex = -1;
        let lastNonSpaceIndex = -1;
        let collapsable = true;
        let tokenText = currentTokenText;

        for (let i = 0; i < tokenText.length; i++) {
            const code = tokenText.charCodeAt(i);
            const ws = WS_TABLE[code];
            if (!ws) {
                collapsable = false;
                if (firstNonSpaceIndex === -1) {
                    firstNonSpaceIndex = i;
                    break;
                }
            } else {
                if (ws === 2) {
                    collapsable = false;
                }
            }
        }

        if (firstNonSpaceIndex !== -1) {
            for (let i = tokenText.length - 1; i >= 0; i--) {
                const code = tokenText.charCodeAt(i);
                if (!WS_TABLE[code]) {
                    lastNonSpaceIndex = i;
                    break;
                }
            }
        }

        if (isLineStart && !collapsable) {
            addNewLine();
        }

        if (firstNonSpaceIndex === -1) {
            // 토큰을 만들만한 문자가 없는 경우...

            if (!discardPrecedingSpaces) {
                // 이후에 생성되는 토큰에 선행 공백이 있는지 표시하기 위해
                // 이 플래그는 블럭요소가 끝나거나 토큰이 추가되고 나서 false로 리셋해야함.
                hasPrecedingSpace = true;
            }

            resetTextBuf();
            return false;
        }

        if (firstNonSpaceIndex > 0 && !discardPrecedingSpaces) {
            // 선행 공백이 있음
            hasPrecedingSpace = true;
        }

        tokenText = tokenText.slice(firstNonSpaceIndex, lastNonSpaceIndex + 1);

        let charOffsetBase = firstNonSpaceIndex;
        // let firstTokenCreated = false;

        if (isLineStart) {
            // 줄의 시작이라면 섹션 헤딩/넘버링 매칭 시도
            const numbering = tryMatchNumbering(tokenText);
            if (numbering) {
                const startNodeIndex = mapNodeIndex[0];
                const startCharIndex = mapCharIndex[0];
                const endNodeIndex = mapNodeIndex[numbering.length - 1];
                const endCharIndex = mapCharIndex[numbering.length - 1];
                tokenText = tokenText.slice(numbering.length);

                addToken(
                    TokenType.TEXT,
                    numbering.wholeText,
                    TokenFlags.LINE_START | numbering.type,
                    textNodeBuf[startNodeIndex],
                    startCharIndex,
                    textNodeBuf[endNodeIndex],
                    endCharIndex + 1
                );
                charOffsetBase += numbering.length;
                // firstTokenCreated = true;
            }
        }

        // 1단계: 세그먼트화 (공백 포함)
        const allSegments = Array.from(segmenter.segment(tokenText));

        interface Segment {
            text: string;
            startOffset: number;
            endOffset: number;
            isWordLike: boolean;
        }

        const segments: Segment[] = [];
        let charOffset = 0;
        for (const segment of allSegments) {
            const wordText = segment.segment;
            segments.push({
                text: wordText,
                startOffset: charOffsetBase + charOffset,
                endOffset: charOffsetBase + charOffset + wordText.length,
                isWordLike: !!segment.isWordLike,
            });
            charOffset += wordText.length;
        }

        // 2단계: Trie 매칭으로 다중 세그먼트 패턴 처리
        let i = 0;
        let segmentStart = 0;
        let segmentCount = 0;

        const flushSegments = () => {
            if (segmentCount > 0) {
                if (addSegmentedToken(segments, segmentStart, segmentCount)) {
                    // firstTokenCreated = true;
                }
                segmentCount = 0;
            }
        }

        while (i < segments.length) {
            const currentSegment = segments[i];

            // 첫 글자가 공백문자라면 더 볼 필요도 없음.
            if (WS_TABLE[currentSegment.text.charCodeAt(0)]) {
                flushSegments();
                hasPrecedingSpace = true;
                i++;
                continue;
            }

            const match = matchTrie(wildcardTrie, segments, i);
            if (match) {
                flushSegments();
                addSegmentedToken(segments, i, match.count, match.flags, match.word);
                // firstTokenCreated = true;
                i += match.count;
                continue;
            }

            if (currentSegment.isWordLike) {
                if (segmentCount > 0) {
                    // work-like은 즉시 추가를 하기 때문에 쌓여있는 segment들은 work-like이 아님!
                    if (addSegmentedToken(segments, segmentStart, segmentCount)) {
                        // firstTokenCreated = true;
                    }
                    segmentCount = 0;
                }
                addSegmentedToken(segments, i, 1, TokenFlags.WORD_LIKE);
                // firstTokenCreated = true;
                i++;
                continue;
            }

            if (segmentCount === 0) {
                segmentStart = i;
            }
            segmentCount++;
            i++;
        }

        if (segmentCount > 0) {
            // work-like은 즉시 추가를 하기 때문에 남아있는 segment들은 work-like이 아님!
            if (addSegmentedToken(segments, segmentStart, segmentCount)) {
                // firstTokenCreated = true;
            }
        }

        // 참고:
        // hasPrecedingSpace이 아직도 true라면
        // 줄바꿈이 될 때까지 노드를 넘어서 유지되어야 함.

        resetTextBuf();
        return true;
    }

    function resetTextBuf(): void {
        textNodeBuf.length = 0;
        currentTokenText = '';
        mapNodeIndex.length = 0;
        mapCharIndex.length = 0;
    }

    function addSegmentedToken(segments: Array<{ text: string; startOffset: number; endOffset: number }>, startIdx: number, count: number, flags: TokenFlags = 0, text?: string) {
        const lastIdx = startIdx + count - 1;
        const startSeg = segments[startIdx];
        const endSeg = segments[lastIdx];

        const startNodeIndex = mapNodeIndex[startSeg.startOffset];
        const endNodeIndex = mapNodeIndex[endSeg.endOffset - 1];
        if (startNodeIndex === undefined || endNodeIndex === undefined) {
            return false;
        }

        const startNode = textNodeBuf[startNodeIndex];
        const endNode = textNodeBuf[endNodeIndex];

        if (text === undefined) {
            text = '';
            for (let i = startIdx; i <= lastIdx; i++) {
                text += segments[i].text;
            }
        }

        addToken(
            TokenType.TEXT,
            text,
            flags,
            startNode,
            mapCharIndex[startSeg.startOffset],
            endNode,
            mapCharIndex[endSeg.endOffset - 1] + 1
        );
    }

    let nextImageId = 1;
    function addImageToken(img: HTMLImageElement): void {
        console.log("Adding image token for", img);
        const src = img.src || `image${nextImageId++}`;
        const text = hashStringFNV1aBase64(src);

        console.log(lineStartWhere, lineStartWhich);
        if (isLineStart) {
            addNewLine();
        }

        return addToken(
            TokenType.IMAGE,
            text,
            TokenFlags.IMAGE,
            img, 0,
            img, 0
        );
    }

    function addToken(type: TokenType, text: string, flags: TokenFlags, startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
        const index = tokens.length;
        if (nextTokenAtLineStart) {
            nextTokenAtLineStart = false;
            flags |= TokenFlags.LINE_START;
            if (index > 0) {
                tokens[index - 1].flags |= TokenFlags.LINE_END;
            }
        }

        if (hasPrecedingSpace) {
            flags |= TokenFlags.HAS_PRECEDING_SPACE;
            if (index > 0) {
                tokens[index - 1].flags |= TokenFlags.HAS_FOLLOWING_SPACE;
            }
        }

        const textOffset = wholeText.length;
        const textLength = text.length;
        wholeText += text;

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
        };
        tokens.push(token);

        discardPrecedingSpaces = false;
        hasPrecedingSpace = false;
    }

    // RUN
    const startTime = performance.now();

    const scheduler = new Scheduler({
        signal: options.signal,
        yieldInterval: 0,
    });

    await run();

    if (tokens.length > 0) {
        tokens[tokens.length - 1].flags |= TokenFlags.LINE_END;
    }

    // 리턴하기 전에 한번 더 abort 체크
    scheduler.throwIfAborted();

    const elapsed = performance.now() - startTime;

    return {
        wholeText,
        tokens,
        lineStartPoints,
        elapsed
    };
}
